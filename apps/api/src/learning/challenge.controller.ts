import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Database, rows } from '../database/database';
import { ApiRequest, Public, Roles, SchemaBody, actor } from '../common/http';
import { digest } from '../common/crypto';
import { ConflictException } from '@nestjs/common';
import { Experiment, localScalars, validateParameters } from '@senku/experiment-schema';
const input = z.object({
  event_id: z.string().uuid(),
  run_id: z.string().uuid().optional(),
  local: z.object({
    parameters: z.record(z.string(), z.union([z.number().finite(), z.string().max(256)])),
    seed: z.number().int().min(0).max(2147483647),
  }).strict().optional(),
}).strict().refine((v) => !!v.run_id !== !!v.local, 'Provide a server run or local model inputs');
@ApiTags('Challenges')
@ApiBearerAuth()
@Controller('v1/challenges')
export class ChallengeController {
  constructor(private readonly db: Database) {}
  @Public() @Get() list() {
    return this.db.query('SELECT id,lesson_id,definition FROM challenges ORDER BY id');
  }
  @Roles('learner', 'teacher', 'admin') @Post(':id/attempts') @SchemaBody(input) async attempt(
    @Req() r: ApiRequest,
    @Param('id') id: string,
    @Body() b: z.infer<typeof input>,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`learning:${actor(r).id}`]);
      const existing = (
        await rows<{ result: { request_hash: string } }>(
          tx,
          'SELECT result FROM challenge_attempts WHERE owner_id=$1 AND event_id=$2',
          [actor(r).id, b.event_id],
        )
      )[0];
      const hash = digest({ id, ...b });
      if (existing) {
        if (existing.result.request_hash !== hash)
          throw new ConflictException('Event ID was reused');
        return existing.result;
      }
      const challenge = (
        await rows<{
          definition: {
            experiment_id: string;
            experiment_version: string;
            metric: string;
            minimum: number;
            xp: number;
          };
        }>(tx, 'SELECT definition FROM challenges WHERE id=$1', [id])
      )[0];
      if (!challenge) throw new NotFoundException('Challenge not found');
      let scalars: Record<string, number>;
      if (b.local) {
        const experiment = (await rows<{ manifest: Experiment }>(tx,
          'SELECT manifest FROM experiment_definitions WHERE id=$1 AND version=$2 AND published=true',
          [challenge.definition.experiment_id, challenge.definition.experiment_version],
        ))[0]?.manifest;
        if (!experiment?.local_capable) throw new BadRequestException('This challenge requires a server run');
        try { scalars = localScalars(experiment.id, validateParameters(experiment, b.local.parameters), b.local.seed); }
        catch { throw new BadRequestException('Invalid local challenge evidence'); }
      } else {
      const run = (
        await rows<{ result: { scalars: Record<string, number> } }>(
          tx,
          "SELECT result FROM experiment_runs WHERE id=$1 AND owner_id=$2 AND status='completed' AND experiment_id=$3 AND experiment_version=$4",
          [
            b.run_id,
            actor(r).id,
            challenge.definition.experiment_id,
            challenge.definition.experiment_version,
          ],
        )
      )[0];
      if (!run || !run.result)
        throw new NotFoundException('Completed challenge run with retained results not found');
      scalars = run.result.scalars;
      }
      const metric = scalars[challenge.definition.metric];
      const passed = Number.isFinite(metric) && metric >= challenge.definition.minimum;
      let xp = 0;
      if (passed) {
        const reward = await rows(
          tx,
          'INSERT INTO learning_rewards(owner_id,reward_key,xp) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING xp',
          [actor(r).id, `challenge:${id}`, challenge.definition.xp],
        );
        if (reward.length) xp = challenge.definition.xp;
      }
      const result = { passed, metric, xp_awarded: xp, request_hash: hash };
      await tx.query(
        'INSERT INTO challenge_attempts(owner_id,challenge_id,event_id,result) VALUES($1,$2,$3,$4)',
        [actor(r).id, id, b.event_id, JSON.stringify(result)],
      );
      return result;
    });
  }
}
