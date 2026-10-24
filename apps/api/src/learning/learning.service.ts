import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { localScalars } from '@senku/experiment-schema';
import { Database, rows } from '../database/database';
import { CatalogService } from '../catalog/catalog.service';
import { Actor } from '../auth/auth.service';
import { CONFIG, Config } from '../config';
import { digest, equal, sign } from '../common/crypto';
import { event } from '../common/events';
import { PoolClient } from 'pg';

export const attemptInput = z
  .object({
    event_id: z.string().uuid(),
    lesson_id: z.string().min(1).max(100),
    lesson_version: z.literal('1.0.0'),
    prediction: z.enum(['increase', 'decrease', 'unchanged']),
    answer_index: z.number().int().min(0).max(2),
    reflection: z.string().trim().min(20).max(2000),
    run_id: z.string().uuid().optional(),
    local: z
      .object({
        parameters: z.record(z.string(), z.union([z.number().finite(), z.string().max(256)])),
        seed: z.number().int().min(0).max(2147483647),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((x) => Boolean(x.run_id) !== Boolean(x.local), {
    message: 'Provide exactly one run or approved local execution',
  });
export type Attempt = z.infer<typeof attemptInput>;
interface Lesson {
  id: string;
  version: string;
  experiment_id: string;
  experiment_version: string;
  definition: { concept: string; xp: number; assessment: { correct_index: number } };
}
@Injectable()
export class LearningService {
  constructor(
    private readonly db: Database,
    private readonly catalog: CatalogService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}
  async pack(lessonId: string) {
    const lesson = await this.catalog.lesson(lessonId);
    const experiment = await this.catalog.experiment(
      lesson.experiment_id,
      lesson.experiment_version,
    );
    if (!experiment.manifest.local_capable)
      throw new BadRequestException('This experiment requires a server engine');
    const payload = {
      schema_version: '1.0.0',
      lesson,
      experiment,
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
    return { payload, signature: sign(payload, this.config.OFFLINE_SIGNING_KEY) };
  }
  verifyPack(pack: { payload: unknown; signature: string }, lessonId: string) {
    if (!equal(sign(pack.payload, this.config.OFFLINE_SIGNING_KEY), pack.signature))
      throw new BadRequestException('Offline pack signature is invalid');
    const payload = pack.payload as { lesson?: { id?: string }; expires_at?: string };
    if (
      payload.lesson?.id !== lessonId ||
      !payload.expires_at ||
      !Number.isFinite(Date.parse(payload.expires_at)) ||
      Date.parse(payload.expires_at) < Date.now()
    )
      throw new BadRequestException('Offline pack expired or does not match this lesson');
  }
  async score(tx: PoolClient, actor: Actor, input: Attempt) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`learning:${actor.id}`]);
    const hash = digest(input);
    const prior = (
      await rows<{ payload_hash: string; result: unknown }>(
        tx,
        'SELECT payload_hash,result FROM offline_events WHERE owner_id=$1 AND event_id=$2',
        [actor.id, input.event_id],
      )
    )[0];
    if (prior) {
      if (prior.payload_hash !== hash)
        throw new ConflictException('Event ID was already used for different evidence');
      return prior.result;
    }
    const lesson = (
      await rows<Lesson>(tx, 'SELECT * FROM lessons WHERE id=$1 AND version=$2', [
        input.lesson_id,
        input.lesson_version,
      ])
    )[0];
    if (!lesson) throw new NotFoundException('Lesson version not found');
    const prerequisites = await rows(
      tx,
      "SELECT p.prerequisite_id FROM lesson_prerequisites p WHERE p.lesson_id=$1 AND NOT EXISTS(SELECT 1 FROM learning_rewards r WHERE r.owner_id=$2 AND r.reward_key='lesson:'||p.prerequisite_id||':1.0.0')",
      [lesson.id, actor.id],
    );
    if (prerequisites.length) throw new BadRequestException('Complete prerequisite lessons first');
    const { manifest } = await this.catalog.experiment(
      lesson.experiment_id,
      lesson.experiment_version,
    );
    let scalars: Record<string, number>;
    let evidence: unknown;
    if (input.local) {
      if (!manifest.local_capable)
        throw new BadRequestException('Local evidence is unavailable for this experiment');
      const parameters = this.catalog.parameters(manifest, input.local.parameters);
      scalars = localScalars(manifest.id, parameters, input.local.seed);
      evidence = {
        execution: 'recomputed_local_kernel',
        parameters,
        seed: input.local.seed,
        scalars,
      };
    } else {
      const run = (
        await rows<{
          result: { scalars: Record<string, number> };
          experiment_id: string;
          experiment_version: string;
        }>(
          tx,
          "SELECT result,experiment_id,experiment_version FROM experiment_runs WHERE id=$1 AND owner_id=$2 AND status='completed'",
          [input.run_id, actor.id],
        )
      )[0];
      if (
        !run ||
        !run.result ||
        run.experiment_id !== manifest.id ||
        run.experiment_version !== manifest.version
      )
        throw new BadRequestException('A completed run of this experiment version is required');
      scalars = run.result.scalars;
      evidence = { execution: 'server', run_id: input.run_id, scalars };
    }
    if (!Object.keys(scalars).length || Object.values(scalars).some((x) => !Number.isFinite(x)))
      throw new BadRequestException('Model evidence is invalid');
    const score = input.answer_index === lesson.definition.assessment.correct_index ? 1 : 0;
    let xp = 0;
    if (score === 1) {
      const reward = await rows(
        tx,
        'INSERT INTO learning_rewards(owner_id,reward_key,xp) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING xp',
        [actor.id, `lesson:${lesson.id}:${lesson.version}`, lesson.definition.xp],
      );
      if (reward.length) xp = lesson.definition.xp;
    }
    const attempt = (
      await rows<{ id: string }>(
        tx,
        'INSERT INTO lesson_attempts(owner_id,lesson_id,lesson_version,event_id,evidence,score,xp) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [
          actor.id,
          lesson.id,
          lesson.version,
          input.event_id,
          JSON.stringify({ input, evidence }),
          score,
          xp,
        ],
      )
    )[0];
    await tx.query(
      'INSERT INTO concept_mastery(owner_id,concept,attempts,score_sum) VALUES($1,$2,1,$3) ON CONFLICT(owner_id,concept) DO UPDATE SET attempts=concept_mastery.attempts+1,score_sum=concept_mastery.score_sum+$3,updated_at=now()',
      [actor.id, lesson.definition.concept, score],
    );
    const achievements = await rows(
      tx,
      "INSERT INTO user_achievements(owner_id,achievement_id) SELECT $1,a.id FROM achievements a WHERE a.required_lessons<=(SELECT count(*) FROM learning_rewards WHERE owner_id=$1 AND reward_key LIKE 'lesson:%') ON CONFLICT DO NOTHING RETURNING achievement_id",
      [actor.id],
    );
    const result = {
      attempt_id: attempt.id,
      event_id: input.event_id,
      score,
      xp_awarded: xp,
      completed: score === 1,
      achievements,
      scalars,
      assessment_feedback:
        score === 1
          ? 'Your conclusion uses model evidence and assumptions.'
          : 'Use model outputs and assumptions to support the conclusion.',
    };
    await tx.query(
      'INSERT INTO offline_events(owner_id,event_id,payload_hash,result) VALUES($1,$2,$3,$4)',
      [actor.id, input.event_id, hash, JSON.stringify(result)],
    );
    await event(tx, actor.id, 'learning', attempt.id, 'learning.attempt_scored', {
      lesson_id: lesson.id,
      xp_awarded: xp,
      score,
    });
    return result;
  }
  attempt(actor: Actor, input: Attempt) {
    return this.db.transaction((tx) => this.score(tx, actor, input));
  }
  async sync(
    actor: Actor,
    input: { pack: { payload: unknown; signature: string }; events: Attempt[] },
  ) {
    for (const attempt of input.events) {
      if (!attempt.local)
        throw new BadRequestException('Offline synchronization requires local evidence');
      this.verifyPack(input.pack, attempt.lesson_id);
    }
    return this.db.transaction(async (tx) => {
      const results = [];
      for (const attempt of input.events) results.push(await this.score(tx, actor, attempt));
      return { results, committed: true };
    });
  }
  async progress(actor: Actor) {
    const [xp, concepts, achievements, lessons, days] = await Promise.all([
      this.db.query(
        'SELECT coalesce(sum(xp),0)::int AS total FROM learning_rewards WHERE owner_id=$1',
        [actor.id],
      ),
      this.db.query(
        'SELECT concept,attempts,score_sum/attempts AS score FROM concept_mastery WHERE owner_id=$1 ORDER BY concept',
        [actor.id],
      ),
      this.db.query(
        'SELECT a.id,a.name,u.created_at FROM user_achievements u JOIN achievements a ON a.id=u.achievement_id WHERE u.owner_id=$1 ORDER BY u.created_at',
        [actor.id],
      ),
      this.db.query(
        "SELECT reward_key,created_at FROM learning_rewards WHERE owner_id=$1 AND reward_key LIKE 'lesson:%' ORDER BY created_at",
        [actor.id],
      ),
      this.db.query<{ day: string }>(
        "SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date::text AS day FROM lesson_attempts WHERE owner_id=$1 ORDER BY day DESC LIMIT 366",
        [actor.id],
      ),
    ]);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let cursor = today.getTime();
    if (days[0] && Date.parse(days[0].day) === cursor - 86400000) cursor -= 86400000;
    let streak = 0;
    for (const { day } of days) {
      if (Date.parse(day) !== cursor) break;
      streak++;
      cursor -= 86400000;
    }
    return {
      xp: xp[0].total,
      concepts,
      achievements,
      lessons,
      streak: {
        days: streak,
        basis: 'Server acceptance date in UTC; repeated events do not create new activity.',
      },
    };
  }
}
