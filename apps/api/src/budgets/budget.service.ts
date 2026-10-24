import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { Actor } from '../auth/auth.service';
import { CONFIG, Config } from '../config';
import { Database, rows } from '../database/database';
import { audit } from '../common/events';
import { sha256, token } from '../common/crypto';

@Injectable()
export class BudgetService {
  constructor(
    private readonly db: Database,
    @Inject(CONFIG) private readonly config: Config,
  ) {}
  async reserve(tx: PoolClient, actor: Actor, id: string, units: number, purpose: string) {
    if (actor.role === 'guest')
      throw new ForbiddenException('An account and invitation are required for server computation');
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('senku:daily-budget'))");
    const member = (
      await rows<{ id: string; daily_units: number; member_daily_units: number }>(
        tx,
        'SELECT g.id,g.daily_units,g.member_daily_units FROM budget_members m JOIN budget_groups g ON g.id=m.group_id WHERE m.user_id=$1 AND g.active FOR UPDATE OF g',
        [actor.id],
      )
    )[0];
    if (!member) throw new ForbiddenException('Redeem a valid compute invitation first');
    const day = "day=(now() AT TIME ZONE 'UTC')::date AND state IN ('reserved','consumed')";
    const used = (
      await rows<{ global: number; group_used: number; user_used: number }>(
        tx,
        `SELECT coalesce(sum(units),0)::int AS global,coalesce(sum(units) FILTER(WHERE group_id=$1),0)::int AS group_used,coalesce(sum(units) FILTER(WHERE user_id=$2),0)::int AS user_used FROM usage_reservations WHERE ${day}`,
        [member.id, actor.id],
      )
    )[0];
    if (
      used.global + units > this.config.GLOBAL_DAILY_UNITS ||
      used.group_used + units > member.daily_units ||
      used.user_used + units > member.member_daily_units
    )
      throw new HttpException('Daily compute allowance exhausted', 429);
    await tx.query(
      'INSERT INTO usage_reservations(id,group_id,user_id,units,purpose) VALUES($1,$2,$3,$4,$5)',
      [id, member.id, actor.id, units, purpose],
    );
  }
  async consume(tx: PoolClient, id: string) {
    await tx.query(
      "UPDATE usage_reservations SET state='consumed' WHERE id=$1 AND state='reserved'",
      [id],
    );
  }
  async release(tx: PoolClient, id: string) {
    await tx.query(
      "UPDATE usage_reservations SET state='released' WHERE id=$1 AND state='reserved'",
      [id],
    );
  }
  async usage(actor: Actor) {
    const member =
      (
        await this.db.query(
          'SELECT g.id,g.name,g.daily_units,g.member_daily_units,g.active FROM budget_members m JOIN budget_groups g ON g.id=m.group_id WHERE m.user_id=$1',
          [actor.id],
        )
      )[0] ?? null;
    const usage = await this.db.query(
      "SELECT purpose,state,sum(units)::int AS units FROM usage_reservations WHERE user_id=$1 AND day=(now() AT TIME ZONE 'UTC')::date GROUP BY purpose,state",
      [actor.id],
    );
    return {
      member,
      usage,
      day_basis: 'UTC',
      unit_definition:
        'Bounded admitted computation or investigation; not a currency/GCP credit balance.',
    };
  }
  async createGroup(
    actor: Actor,
    input: { name: string; daily_units: number; member_daily_units: number },
  ) {
    return this.db.transaction(async (tx) => {
      const row = (
        await rows(
          tx,
          'INSERT INTO budget_groups(name,daily_units,member_daily_units) VALUES($1,$2,$3) RETURNING *',
          [input.name, input.daily_units, input.member_daily_units],
        )
      )[0];
      await audit(tx, actor.id, 'budget.created', String(row.id));
      return row;
    });
  }
  async invite(
    actor: Actor,
    input: { group_id: string; max_uses: number; expires_in_hours: number },
  ) {
    const code = token();
    return this.db.transaction(async (tx) => {
      if (
        !(await rows(tx, 'SELECT id FROM budget_groups WHERE id=$1 AND active', [input.group_id]))
          .length
      )
        throw new NotFoundException('Budget group not found');
      const invitation = (
        await rows(
          tx,
          "INSERT INTO invitations(token_hash,group_id,created_by,max_uses,expires_at) VALUES($1,$2,$3,$4,now()+$5*interval '1 hour') RETURNING id,group_id,max_uses,expires_at",
          [sha256(code), input.group_id, actor.id, input.max_uses, input.expires_in_hours],
        )
      )[0];
      await audit(tx, actor.id, 'invitation.created', String(invitation.id));
      return { ...invitation, code };
    });
  }
  async redeem(actor: Actor, code: string) {
    if (actor.role === 'guest') throw new ForbiddenException('An account is required');
    return this.db.transaction(async (tx) => {
      const invitation = (
        await rows<{ id: string; group_id: string }>(
          tx,
          'SELECT i.id,i.group_id FROM invitations i JOIN budget_groups g ON g.id=i.group_id WHERE i.token_hash=$1 AND i.revoked_at IS NULL AND i.expires_at>now() AND i.uses<i.max_uses AND g.active FOR UPDATE OF i',
          [sha256(code)],
        )
      )[0];
      if (!invitation) throw new ForbiddenException('Invitation is invalid or expired');
      const member = await rows<{ group_id: string }>(
        tx,
        'SELECT group_id FROM budget_members WHERE user_id=$1 FOR UPDATE',
        [actor.id],
      );
      if (member.length) {
        if (member[0].group_id === invitation.group_id)
          return { admitted: true, group_id: invitation.group_id };
        throw new ForbiddenException('Account already belongs to a compute group');
      }
      const inserted = await rows(
        tx,
        'INSERT INTO budget_members(user_id,group_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING user_id',
        [actor.id, invitation.group_id],
      );
      if (!inserted.length) throw new ForbiddenException('Membership changed concurrently');
      await tx.query('UPDATE invitations SET uses=uses+1 WHERE id=$1', [invitation.id]);
      await audit(tx, actor.id, 'invitation.redeemed', invitation.id);
      return { admitted: true, group_id: invitation.group_id };
    });
  }
  async revoke(actor: Actor, id: string) {
    await this.db.transaction(async (tx) => {
      const result = await rows(
        tx,
        'UPDATE invitations SET revoked_at=now() WHERE id=$1 RETURNING id',
        [id],
      );
      if (!result.length) throw new NotFoundException();
      await audit(tx, actor.id, 'invitation.revoked', id);
    });
    return { revoked: true };
  }
}
