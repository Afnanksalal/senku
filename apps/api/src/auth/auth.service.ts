import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { Database, rows } from '../database/database';
import { CONFIG, Config } from '../config';
import { hashPassword, sha256, token, verifyPassword } from '../common/crypto';
import { audit } from '../common/events';

export interface Actor {
  id: string;
  role: 'guest' | 'learner' | 'teacher' | 'admin';
  display_name: string;
  email: string | null;
  timezone: string;
}
interface UserRow extends Actor {
  password_hash: string | null;
}
interface SessionRow {
  id: string;
  family_id: string;
  user_id: string;
  revoked_at: Date | null;
  refresh_expires_at: Date;
}
const publicActor = (user: Actor): Actor => ({
  id: user.id,
  role: user.role,
  display_name: user.display_name,
  email: user.email,
  timezone: user.timezone,
});
@Injectable()
export class AuthService {
  private readonly dummy = hashPassword(token());
  constructor(
    private readonly db: Database,
    @Inject(CONFIG) private readonly config: Config,
  ) {}
  async guest() {
    if (!this.config.ALLOW_GUESTS)
      throw new ServiceUnavailableException('Guest sessions are disabled');
    return this.db.transaction(async (tx) => {
      const user = (
        await rows<UserRow>(
          tx,
          "INSERT INTO users(display_name,role) VALUES('Guest','guest') RETURNING *",
        )
      )[0];
      return this.issue(tx, user);
    });
  }
  private async issue(tx: PoolClient, user: Actor, family: string = randomUUID()) {
    const access = `st_${token()}`,
      refresh = `sr_${token()}`;
    const accessSeconds = user.role === 'guest' ? 86400 : 900;
    await tx.query(
      "INSERT INTO sessions(user_id,family_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,$4,now()+$5*interval '1 second',now()+$6*interval '1 day')",
      [
        user.id,
        family,
        sha256(access),
        sha256(refresh),
        accessSeconds,
        user.role === 'guest' ? 1 : 30,
      ],
    );
    return {
      user: publicActor(user),
      access_token: access,
      refresh_token: refresh,
      token_type: 'Bearer',
      expires_in: accessSeconds,
    };
  }
  async register(email: string, password: string, displayName: string, guestBearer?: string) {
    if (!this.config.ALLOW_LOCAL_REGISTRATION)
      throw new ServiceUnavailableException('Account registration is disabled');
    const encoded = await hashPassword(password);
    const guest = guestBearer ? await this.authenticate(guestBearer) : undefined;
    if (guest && guest.role !== 'guest')
      throw new BadRequestException('Only a guest session can be upgraded');
    try {
      return await this.db.transaction(async (tx) => {
        const user = guest
          ? (
              await rows<UserRow>(
                tx,
                "UPDATE users SET email=$2,password_hash=$3,display_name=$4,role='learner' WHERE id=$1 AND role='guest' AND deleted_at IS NULL RETURNING *",
                [guest.id, email, encoded, displayName],
              )
            )[0]
          : (
              await rows<UserRow>(
                tx,
                "INSERT INTO users(email,password_hash,display_name,role) VALUES($1,$2,$3,'learner') RETURNING *",
                [email, encoded, displayName],
              )
            )[0];
        if (!user) throw new ConflictException('Session upgrade conflicted');
        if (guest)
          await tx.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1', [guest.id]);
        await audit(tx, user.id, 'account.registered', user.id, { provider: 'local' });
        return this.issue(tx, user);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException('Registration could not be completed');
      throw error;
    }
  }
  async login(email: string, password: string) {
    const user = (
      await this.db.query<UserRow>('SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL', [
        email,
      ])
    )[0];
    const valid = await verifyPassword(password, user?.password_hash ?? (await this.dummy));
    if (!user || !user.password_hash || !valid)
      throw new UnauthorizedException('Invalid credentials');
    return this.db.transaction((tx) => this.issue(tx, user));
  }
  async refresh(refreshToken: string) {
    const outcome = await this.db.transaction(async (tx) => {
      const session = (
        await rows<SessionRow>(
          tx,
          'SELECT s.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE refresh_hash=$1 AND u.deleted_at IS NULL FOR UPDATE OF s',
          [sha256(refreshToken)],
        )
      )[0];
      if (!session) return null;
      if (session.revoked_at || new Date(session.refresh_expires_at).getTime() <= Date.now()) {
        await tx.query(
          'UPDATE sessions SET revoked_at=coalesce(revoked_at,now()) WHERE family_id=$1',
          [session.family_id],
        );
        await audit(tx, session.user_id, 'session.reuse_or_expiry', session.id);
        return null;
      }
      const user = (
        await rows<UserRow>(tx, 'SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL', [
          session.user_id,
        ])
      )[0];
      if (!user) return null;
      await tx.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [session.id]);
      return this.issue(tx, user, session.family_id);
    });
    if (!outcome) throw new UnauthorizedException('Invalid refresh token');
    return outcome;
  }
  async authenticate(bearer: string): Promise<Actor> {
    if (bearer.startsWith('st_')) {
      const user = (
        await this.db.query<UserRow>(
          'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.access_hash=$1 AND s.revoked_at IS NULL AND s.access_expires_at>now() AND u.deleted_at IS NULL',
          [sha256(bearer)],
        )
      )[0];
      if (!user) throw new UnauthorizedException('Invalid or expired session');
      return publicActor(user);
    }
    throw new UnauthorizedException('Invalid session token');
  }
  async logout(actor: Actor, bearer: string, all = false) {
    await this.db.transaction(async (tx) => {
      if (all) await tx.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1', [actor.id]);
      else
        await tx.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND access_hash=$2', [
          actor.id,
          sha256(bearer),
        ]);
      await audit(tx, actor.id, 'session.revoked', actor.id, { all });
    });
    return { revoked: true, token_type: 'Bearer' };
  }
}
