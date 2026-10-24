import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Actor } from '../auth/auth.service';
import { Database, rows } from '../database/database';
import { CatalogService } from '../catalog/catalog.service';
import { audit, event } from '../common/events';
import { Idempotency } from '../common/idempotency';
import { sha256, token } from '../common/crypto';
import { PoolClient } from 'pg';
export interface Room {
  id: string;
  owner_id: string;
  experiment_id: string;
  experiment_version: string;
  parameters: Record<string, number | string>;
  version: number;
  last_run_id: string | null;
  closed_at: Date | null;
  role: string;
}
@Injectable()
export class CollaborationService {
  constructor(
    private readonly db: Database,
    private readonly catalog: CatalogService,
    private readonly idem: Idempotency,
  ) {}
  async list(actor: Actor) {
    return this.db.query('SELECT r.*,m.role FROM collaboration_rooms r JOIN room_members m ON m.room_id=r.id WHERE m.user_id=$1 AND r.closed_at IS NULL ORDER BY r.created_at DESC LIMIT 100', [actor.id]);
  }
  async shares(actor: Actor) {
    return this.db.query('SELECT id,resource_type,resource_id,role,expires_at,revoked_at,created_at FROM share_links WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100', [actor.id]);
  }
  async room(actor: Actor, id: string, edit = false, tx?: PoolClient) {
    const sql = `SELECT r.*,m.role FROM collaboration_rooms r JOIN room_members m ON m.room_id=r.id WHERE r.id=$1 AND m.user_id=$2 AND r.closed_at IS NULL ${edit ? "AND m.role IN ('owner','editor')" : ''}`;
    const room = (
      tx
        ? await rows<Room>(tx, sql, [id, actor.id])
        : await this.db.query<Room>(sql, [id, actor.id])
    )[0];
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }
  async create(
    actor: Actor,
    key: string | undefined,
    input: {
      experiment_id: string;
      experiment_version: string;
      parameters: Record<string, number | string>;
    },
  ) {
    const { manifest } = await this.catalog.experiment(
      input.experiment_id,
      input.experiment_version,
    );
    const parameters = this.catalog.parameters(manifest, input.parameters);
    return this.idem.execute(actor.id, 'rooms.create', key, input, async (tx) => {
      const room = (
        await rows<Room>(
          tx,
          'INSERT INTO collaboration_rooms(owner_id,experiment_id,experiment_version,parameters) VALUES($1,$2,$3,$4) RETURNING *',
          [actor.id, manifest.id, manifest.version, JSON.stringify(parameters)],
        )
      )[0];
      await tx.query("INSERT INTO room_members(room_id,user_id,role) VALUES($1,$2,'owner')", [
        room.id,
        actor.id,
      ]);
      await event(tx, actor.id, 'room', room.id, 'room.created', { version: 0, parameters });
      return room;
    });
  }
  async edit(
    actor: Actor,
    id: string,
    input: { expected_version: number; parameters: Record<string, number | string> },
  ) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM collaboration_rooms WHERE id=$1 FOR UPDATE', [id]);
      const room = await this.room(actor, id, true, tx);
      if (room.version !== input.expected_version)
        throw new ConflictException('Room changed. Reload the current version before editing.');
      const { manifest } = await this.catalog.experiment(
        room.experiment_id,
        room.experiment_version,
      );
      const parameters = this.catalog.parameters(manifest, input.parameters);
      const result = (
        await rows(
          tx,
          'UPDATE collaboration_rooms SET parameters=$2,version=version+1 WHERE id=$1 RETURNING *',
          [id, JSON.stringify(parameters)],
        )
      )[0];
      await event(tx, room.owner_id, 'room', id, 'room.parameters_changed', {
        parameters,
        version: room.version + 1,
        actor_id: actor.id,
      });
      return result;
    });
  }
  async events(actor: Actor, id: string, after: string) {
    await this.room(actor, id);
    return this.db.query(
      "SELECT sequence::text,type,payload,created_at FROM durable_events WHERE resource_type='room' AND resource_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 100",
      [id, after],
    );
  }
  async members(actor: Actor, id: string) {
    await this.room(actor, id);
    return this.db.query(
      'SELECT m.user_id,m.role,u.display_name FROM room_members m JOIN users u ON u.id=m.user_id WHERE m.room_id=$1 ORDER BY m.joined_at',
      [id],
    );
  }
  async removeMember(actor: Actor, id: string, userId: string) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM collaboration_rooms WHERE id=$1 FOR UPDATE', [id]);
      const room = await this.room(actor, id, false, tx);
      if (room.owner_id !== actor.id && userId !== actor.id)
        throw new NotFoundException('Membership not found');
      if (userId === room.owner_id) throw new BadRequestException('The owner must close the room');
      await tx.query('DELETE FROM room_members WHERE room_id=$1 AND user_id=$2', [id, userId]);
      await event(tx, room.owner_id, 'room', id, 'room.member_removed', { user_id: userId });
      return { removed: true };
    });
  }
  async close(actor: Actor, id: string) {
    return this.db.transaction(async (tx) => {
      const room = await this.room(actor, id, false, tx);
      if (room.owner_id !== actor.id) throw new NotFoundException('Room not found');
      await tx.query('UPDATE collaboration_rooms SET closed_at=now() WHERE id=$1', [id]);
      await audit(tx, actor.id, 'room.closed', id);
      return { closed: true };
    });
  }
  async share(
    actor: Actor,
    input: {
      resource_type: 'run' | 'room' | 'investigation';
      resource_id: string;
      role: 'viewer' | 'editor';
      expires_in_hours: number;
    },
  ) {
    if (input.resource_type !== 'room' && input.role !== 'viewer')
      throw new BadRequestException('Only room links can grant editing');
    const tables = {
      run: 'experiment_runs',
      room: 'collaboration_rooms',
      investigation: 'investigations',
    };
    if (
      !(
        await this.db.query(
          `SELECT id FROM ${tables[input.resource_type]} WHERE id=$1 AND owner_id=$2`,
          [input.resource_id, actor.id],
        )
      ).length
    )
      throw new NotFoundException('Resource not found');
    const value = token();
    return this.db.transaction(async (tx) => {
      const row = (
        await rows(
          tx,
          "INSERT INTO share_links(owner_id,token_hash,resource_type,resource_id,role,expires_at) VALUES($1,$2,$3,$4,$5,now()+$6*interval '1 hour') RETURNING id,resource_type,resource_id,role,expires_at",
          [
            actor.id,
            sha256(value),
            input.resource_type,
            input.resource_id,
            input.role,
            input.expires_in_hours,
          ],
        )
      )[0];
      await audit(tx, actor.id, 'share.created', String(row.id));
      return { ...row, token: value };
    });
  }
  async revoke(actor: Actor, id: string) {
    const changed = await this.db.query(
      'UPDATE share_links SET revoked_at=coalesce(revoked_at,now()) WHERE id=$1 AND owner_id=$2 RETURNING id',
      [id, actor.id],
    );
    if (!changed.length) throw new NotFoundException('Share link not found');
    return { revoked: true };
  }
  async link(value: string, tx?: PoolClient) {
    const sql =
      'SELECT * FROM share_links WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()';
    const link = (
      tx
        ? await rows<{ resource_type: string; resource_id: string; role: string }>(tx, sql, [
            sha256(value),
          ])
        : await this.db.query<{ resource_type: string; resource_id: string; role: string }>(sql, [
            sha256(value),
          ])
    )[0];
    if (!link) throw new NotFoundException('Share link not found');
    return link;
  }
  async view(value: string) {
    const link = await this.link(value);
    const sql =
      link.resource_type === 'run'
        ? 'SELECT id,experiment_id,experiment_version,model_id,model_version,engine_id,engine_version,parameters,seed,status,result,diagnostics,scientific_status FROM experiment_runs WHERE id=$1'
        : link.resource_type === 'room'
          ? 'SELECT id,experiment_id,experiment_version,parameters,version,last_run_id FROM collaboration_rooms WHERE id=$1 AND closed_at IS NULL'
          : 'SELECT id,question,status,result FROM investigations WHERE id=$1';
    const resource = (await this.db.query(sql, [link.resource_id]))[0];
    if (!resource) throw new NotFoundException('Shared resource not found');
    return { type: link.resource_type, role: link.role, resource };
  }
  async join(actor: Actor, value: string) {
    return this.db.transaction(async (tx) => {
      const link = await this.link(value, tx);
      if (link.resource_type !== 'room')
        throw new BadRequestException('This link is not a room invitation');
      const room = (
        await rows<Room>(
          tx,
          'SELECT * FROM collaboration_rooms WHERE id=$1 AND closed_at IS NULL FOR UPDATE',
          [link.resource_id],
        )
      )[0];
      if (!room) throw new NotFoundException('Room not found');
      await tx.query(
        "INSERT INTO room_members(room_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(room_id,user_id) DO UPDATE SET role=CASE WHEN room_members.role='owner' THEN 'owner' WHEN room_members.role='editor' THEN 'editor' ELSE excluded.role END",
        [room.id, actor.id, link.role],
      );
      await event(tx, room.owner_id, 'room', room.id, 'room.member_joined', { user_id: actor.id });
      return { room_id: room.id };
    });
  }
}
