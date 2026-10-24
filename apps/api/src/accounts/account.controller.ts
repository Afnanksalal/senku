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
const learningGoal = z.object({ daily_xp_goal: z.number().int().min(5).max(200) }).strict();
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
  @Get('learning-goal') async learningGoal(@Req() r: ApiRequest) {
    const saved = (await this.db.query('SELECT daily_xp_goal,updated_at FROM learning_preferences WHERE owner_id=$1', [actor(r).id]))[0];
    return saved ? { ...saved, is_default: false } : { daily_xp_goal: 20, updated_at: null, is_default: true };
  }
  @Patch('learning-goal') @SchemaBody(learningGoal) async updateLearningGoal(
    @Req() r: ApiRequest,
    @Body() input: z.infer<typeof learningGoal>,
  ) {
    return this.db.transaction(async (tx) => {
      const saved = (await tx.query(
        'INSERT INTO learning_preferences(owner_id,daily_xp_goal) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET daily_xp_goal=excluded.daily_xp_goal,updated_at=now() RETURNING daily_xp_goal,updated_at',
        [actor(r).id, input.daily_xp_goal],
      )).rows[0];
      await audit(tx, actor(r).id, 'learning.goal_updated', actor(r).id, { daily_xp_goal: input.daily_xp_goal });
      return { ...saved, is_default: false };
    });
  }
  @Get('activity') async activity(@Req() r: ApiRequest) {
    const id = actor(r).id;
    const [calendar, history, totals] = await Promise.all([
      this.db.query(`
        WITH days AS (
          SELECT generate_series((now() AT TIME ZONE 'UTC')::date-27,(now() AT TIME ZONE 'UTC')::date,'1 day'::interval)::date AS day
        ), earned AS (
          SELECT (created_at AT TIME ZONE 'UTC')::date AS day,sum(xp)::int AS earned_xp
          FROM learning_rewards WHERE owner_id=$1 AND created_at>=(((now() AT TIME ZONE 'UTC')::date-27)::timestamp AT TIME ZONE 'UTC') GROUP BY 1
        ), actions AS (
          SELECT created_at,'lesson' AS kind FROM lesson_attempts WHERE owner_id=$1
          UNION ALL SELECT created_at,'challenge' FROM challenge_attempts WHERE owner_id=$1
          UNION ALL SELECT created_at,'run' FROM experiment_runs WHERE owner_id=$1
          UNION ALL SELECT created_at,'investigation' FROM investigations WHERE owner_id=$1
          UNION ALL SELECT created_at,'question' FROM companion_responses WHERE owner_id=$1
        ), counts AS (
          SELECT (created_at AT TIME ZONE 'UTC')::date AS day,count(*)::int AS activity_count,
            count(*) FILTER(WHERE kind='lesson')::int AS lesson_attempts,
            count(*) FILTER(WHERE kind='challenge')::int AS challenge_attempts,
            count(*) FILTER(WHERE kind='run')::int AS runs_started,
            count(*) FILTER(WHERE kind='investigation')::int AS investigations_started,
            count(*) FILTER(WHERE kind='question')::int AS questions_asked
          FROM actions WHERE created_at>=(((now() AT TIME ZONE 'UTC')::date-27)::timestamp AT TIME ZONE 'UTC') GROUP BY 1
        )
        SELECT days.day::text,coalesce(earned.earned_xp,0)::int AS earned_xp,
          coalesce(counts.activity_count,0)::int AS activity_count,
          coalesce(counts.lesson_attempts,0)::int AS lesson_attempts,
          coalesce(counts.challenge_attempts,0)::int AS challenge_attempts,
          coalesce(counts.runs_started,0)::int AS runs_started,
          coalesce(counts.investigations_started,0)::int AS investigations_started,
          coalesce(counts.questions_asked,0)::int AS questions_asked
        FROM days LEFT JOIN earned USING(day) LEFT JOIN counts USING(day) ORDER BY days.day`, [id]),
      this.db.query(`
        SELECT * FROM (
          SELECT t.id,'lesson' AS kind,t.lesson_id AS resource_id,t.lesson_version AS resource_version,coalesce(l.definition->>'name',t.lesson_id) AS title,
            CASE WHEN t.score=1 THEN 'completed' ELSE 'attempted' END AS status,t.xp AS earned_xp,t.created_at
          FROM lesson_attempts t JOIN lessons l ON l.id=t.lesson_id WHERE t.owner_id=$1
          UNION ALL SELECT t.id,'challenge',t.challenge_id,NULL::text,coalesce(c.definition->>'name',t.challenge_id),
            CASE WHEN (t.result->>'passed')::boolean THEN 'passed' ELSE 'attempted' END,coalesce((t.result->>'xp_awarded')::int,0),t.created_at
          FROM challenge_attempts t JOIN challenges c ON c.id=t.challenge_id WHERE t.owner_id=$1
          UNION ALL SELECT r.id,'run',r.experiment_id,r.experiment_version,coalesce(e.manifest->>'name',r.experiment_id),r.status,0,r.created_at
          FROM experiment_runs r JOIN experiment_definitions e ON e.id=r.experiment_id AND e.version=r.experiment_version WHERE r.owner_id=$1
          UNION ALL SELECT id,'investigation',id::text,NULL::text,question,status,0,created_at FROM investigations WHERE owner_id=$1
          UNION ALL SELECT c.id,'question',coalesce(c.request->>'experiment_id',''),c.request->>'experiment_version',left(c.request->>'message',160),c.status,0,c.created_at FROM companion_responses c WHERE c.owner_id=$1
        ) AS history ORDER BY created_at DESC,id DESC LIMIT 20`, [id]),
      this.db.query(`SELECT
        (SELECT count(*)::int FROM lesson_attempts WHERE owner_id=$1) AS lesson_attempts,
        (SELECT count(*)::int FROM challenge_attempts WHERE owner_id=$1) AS challenge_attempts,
        (SELECT count(*)::int FROM experiment_runs WHERE owner_id=$1) AS runs_started,
        (SELECT count(*)::int FROM experiment_runs WHERE owner_id=$1 AND status='completed') AS runs_completed,
        (SELECT count(*)::int FROM investigations WHERE owner_id=$1) AS investigations_started,
        (SELECT count(*)::int FROM companion_responses WHERE owner_id=$1) AS questions_asked`, [id]),
    ]);
    return {
      day_basis: 'UTC',
      today: new Date().toISOString().slice(0, 10),
      days: calendar,
      history,
      history_limit: 20,
      totals: totals[0],
      source: 'Saved account records only. Device-only runs appear after they are recorded to the server.',
    };
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
      'dynamic_challenges',
      'dynamic_challenge_feedback',
      'personalized_missions',
      'ai_intents',
    ];
    const records: Record<string, unknown> = {};
    for (const table of tables)
      records[table] = await this.db.query(
        `SELECT * FROM ${table} WHERE owner_id=$1 ORDER BY ${table === 'concept_mastery' ? 'concept' : table === 'user_achievements' ? 'achievement_id' : 'created_at'} LIMIT 10001`,
        [id],
      );
    records.learning_preferences = await this.db.query('SELECT daily_xp_goal,updated_at FROM learning_preferences WHERE owner_id=$1', [id]);
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
      await tx.query('DELETE FROM learning_preferences WHERE owner_id=$1', [id]);
      await tx.query('DELETE FROM dynamic_challenge_feedback WHERE owner_id=$1', [id]);
      await tx.query('DELETE FROM dynamic_challenges WHERE owner_id=$1', [id]);
      await tx.query('DELETE FROM personalized_missions WHERE owner_id=$1', [id]);
      await tx.query('DELETE FROM ai_intents WHERE owner_id=$1', [id]);
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
