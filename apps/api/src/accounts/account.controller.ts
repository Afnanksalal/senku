import { Body, Controller, Delete, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Database } from '../database/database';
import { ApiRequest, SchemaBody, actor, text } from '../common/http';
import { audit } from '../common/events';
const profile = z
  .object({
    display_name: text(1, 80).optional(),
    timezone: z
      .string()
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      })
      .optional(),
  })
  .strict();
@ApiTags('Account and privacy')
@ApiBearerAuth()
@Controller('v1/me')
export class AccountController {
  constructor(private readonly db: Database) {}
  @Get() profile(@Req() r: ApiRequest) {
    return actor(r);
  }
  @Patch() @SchemaBody(profile) async update(
    @Req() r: ApiRequest,
    @Body() input: z.infer<typeof profile>,
  ) {
    return (
      await this.db.query(
        'UPDATE users SET display_name=coalesce($2,display_name),timezone=coalesce($3,timezone) WHERE id=$1 RETURNING id,display_name,email,role,timezone',
        [actor(r).id, input.display_name ?? null, input.timezone ?? null],
      )
    )[0];
  }
  @Get('export') async export(@Req() r: ApiRequest) {
    const id = actor(r).id;
    const tables = [
      'lesson_attempts',
      'learning_rewards',
      'concept_mastery',
      'user_achievements',
      'challenge_attempts',
      'pathway_documents',
      'experiment_runs',
      'investigations',
      'collaboration_rooms',
      'companion_responses',
    ];
    const records: Record<string, unknown> = {};
    for (const table of tables)
      records[table] = await this.db.query(
        `SELECT * FROM ${table} WHERE owner_id=$1 ORDER BY ${table === 'concept_mastery' ? 'concept' : table === 'user_achievements' ? 'achievement_id' : 'created_at'} LIMIT 10001`,
        [id],
      );
    const truncated = Object.values(records).some((value) => (value as unknown[]).length > 10000);
    for (const key of Object.keys(records))
      records[key] = (records[key] as unknown[]).slice(0, 10000);
    return {
      schema_version: '1.0.0',
      account: actor(r),
      records,
      exported_at: new Date().toISOString(),
      limit_per_collection: 10000,
      truncated,
    };
  }
  @Delete() async remove(@Req() r: ApiRequest) {
    const id = actor(r).id;
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [id]);
      await tx.query(
        "UPDATE users SET deleted_at=now(),email=NULL,password_hash=NULL,display_name='Deleted learner' WHERE id=$1",
        [id],
      );
      await tx.query('UPDATE sessions SET revoked_at=coalesce(revoked_at,now()) WHERE user_id=$1', [
        id,
      ]);
      await tx.query(
        'UPDATE share_links SET revoked_at=coalesce(revoked_at,now()) WHERE owner_id=$1',
        [id],
      );
      await tx.query(
        'UPDATE collaboration_rooms SET closed_at=coalesce(closed_at,now()) WHERE owner_id=$1',
        [id],
      );
      await tx.query(
        'UPDATE classrooms SET archived_at=coalesce(archived_at,now()) WHERE owner_id=$1',
        [id],
      );
      await tx.query('DELETE FROM room_members WHERE user_id=$1', [id]);
      await tx.query('DELETE FROM classroom_members WHERE user_id=$1', [id]);
      await tx.query(
        "UPDATE experiment_runs SET cancel_requested_at=coalesce(cancel_requested_at,now()) WHERE owner_id=$1 AND status IN ('queued','running')",
        [id],
      );
      await tx.query(
        "UPDATE investigations SET cancel_requested_at=coalesce(cancel_requested_at,now()) WHERE owner_id=$1 AND status IN ('queued','running')",
        [id],
      );
      await audit(tx, id, 'account.deletion_requested', id);
      return {
        deleted: true,
        erasure:
          'Personal records and artifacts are purged by the retention worker after active computations stop.',
      };
    });
  }
}
