import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Experiment, Parameters } from '@senku/experiment-schema';
import { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Actor } from '../auth/auth.service';
import { Database, rows } from '../database/database';
import { CatalogService } from '../catalog/catalog.service';
import { BudgetService } from '../budgets/budget.service';
import { Idempotency } from '../common/idempotency';
import { audit, Connections, enqueue, event } from '../common/events';
import { StorageService } from '../artifacts/storage.service';
import { digest } from '../common/crypto';

export const runRequest = z
  .object({
    experiment_id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    experiment_version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .default('1.0.0'),
    parameters: z
      .record(z.string(), z.union([z.number().finite(), z.string().max(512)]))
      .default({}),
    seed: z.number().int().min(0).max(2147483647).default(0),
    engine: z
      .enum(['numerics', 'roadrunner', 'tellurium', 'copasi', 'cobrapy', 'physicell', 'rdkit', 'vina'])
      .optional(),
    pathway_id: z.string().uuid().optional(),
    room_id: z.string().uuid().optional(),
    room_version: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((input) => Boolean(input.room_id) === (input.room_version !== undefined), {
    message: 'Room ID and expected room version must be supplied together',
  });
export type RunRequest = z.infer<typeof runRequest>;
export interface PreparedRun {
  manifest: Experiment;
  manifestHash: string;
  parameters: Parameters;
  engine: string;
  input: Record<string, unknown>;
  request: RunRequest;
}
export interface RunRow {
  id: string;
  owner_id: string;
  experiment_id: string;
  experiment_version: string;
  model_id: string;
  model_version: string;
  engine_id: string;
  engine_version: string | null;
  adapter_version: string;
  image_digest: string | null;
  manifest_hash: string;
  parameters: Parameters;
  seed: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
  result: Record<string, unknown> | null;
  diagnostics: Record<string, unknown>;
  scientific_status: string;
  error_code: string | null;
  attempt_count: number;
  cancel_requested_at: Date | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  input: Record<string, unknown>;
  room_id: string | null;
}
export const terminal = new Set(['completed', 'failed', 'cancelled', 'timed_out']);
@Injectable()
export class RunService {
  constructor(
    private readonly db: Database,
    private readonly catalog: CatalogService,
    private readonly budget: BudgetService,
    private readonly idem: Idempotency,
    private readonly connections: Connections,
    private readonly storage: StorageService,
  ) {}
  async prepare(actor: Actor, request: RunRequest): Promise<PreparedRun> {
    const { manifest, content_hash } = await this.catalog.experiment(
      request.experiment_id,
      request.experiment_version,
    );
    const parameters = this.catalog.parameters(manifest, request.parameters),
      engine = request.engine ?? manifest.engine.id;
    const capability = this.catalog.engines().find((e) => e.id === engine);
    if (
      !capability ||
      !capability.execution ||
      !(capability.models as string[]).includes(manifest.id)
    )
      throw new BadRequestException('Engine does not support this approved experiment');
    if (manifest.id === 'molecular-docking') {
      const seed = parameters.seed as number;
      if (request.seed !== 0 && request.seed !== seed)
        throw new BadRequestException('The run seed must match the docking seed');
      request = { ...request, seed };
    }
    const input: Record<string, unknown> = {};
    if (manifest.id === 'pathway-playground') {
      if (!request.pathway_id)
        throw new BadRequestException('A validated pathway document is required');
      const pathway = (
        await this.db.query<{ graph: unknown; sbml: string; content_hash: string }>(
          'SELECT graph,sbml,content_hash FROM pathway_documents WHERE id=$1 AND owner_id=$2',
          [request.pathway_id, actor.id],
        )
      )[0];
      if (!pathway) throw new NotFoundException('Pathway not found');
      input.pathway = pathway.graph;
      input.sbml = pathway.sbml;
      input.pathway_hash = pathway.content_hash;
    } else if (request.pathway_id)
      throw new BadRequestException('This experiment does not accept a pathway');
    if (request.room_id) {
      const room = (
        await this.db.query<{
          experiment_id: string;
          experiment_version: string;
          role: string;
          version: number;
          parameters: Parameters;
        }>(
          'SELECT r.experiment_id,r.experiment_version,r.version,r.parameters,m.role FROM collaboration_rooms r JOIN room_members m ON m.room_id=r.id WHERE r.id=$1 AND m.user_id=$2 AND r.closed_at IS NULL',
          [request.room_id, actor.id],
        )
      )[0];
      if (!room || !['owner', 'editor'].includes(room.role))
        throw new NotFoundException('Editable room not found');
      if (room.experiment_id !== manifest.id || room.experiment_version !== manifest.version)
        throw new BadRequestException('Run and room must use the same experiment version');
      if (room.version !== request.room_version || digest(parameters) !== digest(room.parameters))
        throw new BadRequestException(
          'Run inputs must match the current room version and parameters',
        );
    }
    return { manifest, manifestHash: content_hash, parameters, engine, input, request };
  }
  async insert(tx: PoolClient, actor: Actor, prepared: PreparedRun): Promise<RunRow> {
    const id = randomUUID(),
      m = prepared.manifest;
    await this.budget.reserve(tx, actor, id, 1, 'simulation');
    const row = (
      await rows<RunRow>(
        tx,
        `INSERT INTO experiment_runs(id,owner_id,experiment_id,experiment_version,model_id,model_version,engine_id,adapter_version,manifest_hash,parameters,seed,status,scientific_status,input,room_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'queued',$12,$13,$14) RETURNING *`,
        [
          id,
          actor.id,
          m.id,
          m.version,
          m.model.id,
          m.model.version,
          prepared.engine,
          m.engine.adapter_version,
          prepared.manifestHash,
          JSON.stringify(prepared.parameters),
          prepared.request.seed,
          m.model.scientific_status,
          JSON.stringify(prepared.input),
          prepared.request.room_id ?? null,
        ],
      )
    )[0];
    if (prepared.request.room_id) {
      // Recheck under the transaction, so a revoked room membership cannot race a run admission.
      const member = await rows(
        tx,
        "SELECT r.id FROM collaboration_rooms r JOIN room_members m ON m.room_id=r.id WHERE r.id=$1 AND m.user_id=$2 AND m.role IN ('owner','editor') AND r.closed_at IS NULL AND r.version=$3 AND r.parameters=$4::jsonb FOR UPDATE OF r",
        [
          prepared.request.room_id,
          actor.id,
          prepared.request.room_version,
          JSON.stringify(prepared.parameters),
        ],
      );
      if (!member.length) throw new NotFoundException('Editable room not found');
      await tx.query('UPDATE collaboration_rooms SET last_run_id=$2 WHERE id=$1', [
        prepared.request.room_id,
        id,
      ]);
    }
    await event(tx, actor.id, 'run', id, 'run.queued', { run_id: id });
    await enqueue(tx, 'science', id, { run_id: id });
    await audit(tx, actor.id, 'run.created', id, { experiment_id: m.id, engine: prepared.engine });
    return row;
  }
  async create(actor: Actor, key: string | undefined, input: RunRequest) {
    const prepared = await this.prepare(actor, input);
    return this.idem.execute(actor.id, 'runs.create', key, input, async (tx) => {
      const run = await this.insert(tx, actor, prepared);
      return { id: run.id, status: run.status, url: `/v1/runs/${run.id}` };
    });
  }
  async authorize(actor: Actor, id: string, edit = false, tx?: PoolClient): Promise<RunRow> {
    const query = `SELECT r.* FROM experiment_runs r WHERE r.id=$1 AND (r.owner_id=$2 OR EXISTS(SELECT 1 FROM room_members m JOIN collaboration_rooms room ON room.id=m.room_id WHERE m.room_id=r.room_id AND m.user_id=$2 AND room.closed_at IS NULL ${edit ? "AND m.role IN ('owner','editor')" : ''}))`;
    const result = tx
      ? await rows<RunRow>(tx, query, [id, actor.id])
      : await this.db.query<RunRow>(query, [id, actor.id]);
    if (!result.length) throw new NotFoundException('Run not found');
    return result[0];
  }
  async get(actor: Actor, id: string) {
    const { input, ...run } = await this.authorize(actor, id);
    return {
      ...run,
      result_available: run.result !== null,
      cancellation_requested: !!run.cancel_requested_at,
    };
  }
  list(actor: Actor, limit: number, after: string) {
    return this.db.query(
      "SELECT r.id,r.experiment_id,r.experiment_version,r.engine_id,r.status,r.scientific_status,r.error_code,r.created_at,r.finished_at FROM experiment_runs r WHERE r.owner_id=$1 AND ($2='' OR (r.created_at,r.id)<(SELECT created_at,id FROM experiment_runs WHERE id::text=$2 AND owner_id=$1)) ORDER BY r.created_at DESC,r.id DESC LIMIT $3",
      [actor.id, after, limit],
    );
  }
  async cancel(actor: Actor, id: string) {
    const result = await this.db.transaction(async (tx) => {
      await this.authorize(actor, id, true, tx);
      const run = (
        await rows<RunRow>(tx, 'SELECT * FROM experiment_runs WHERE id=$1 FOR UPDATE', [id])
      )[0];
      if (terminal.has(run.status))
        return { id, status: run.status, cancellation_requested: !!run.cancel_requested_at };
      const queued = run.status === 'queued';
      await tx.query(
        "UPDATE experiment_runs SET cancel_requested_at=coalesce(cancel_requested_at,now()),status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,finished_at=CASE WHEN status='queued' THEN now() ELSE finished_at END WHERE id=$1",
        [id],
      );
      if (queued) {
        await this.budget.release(tx, id);
        await event(tx, run.owner_id, 'run', id, 'run.cancelled', { run_id: id });
      }
      await audit(tx, actor.id, 'run.cancel_requested', id);
      return { id, status: queued ? 'cancelled' : 'running', cancellation_requested: true };
    });
    await this.connections.redis.set(this.connections.key(`cancel:${id}`), '1', 'EX', 600);
    return result;
  }
  async artifacts(actor: Actor, id: string) {
    await this.authorize(actor, id);
    return this.db.query(
      'SELECT id,kind,content_type,sha256,byte_length,created_at FROM run_artifacts WHERE run_id=$1 ORDER BY created_at,id',
      [id],
    );
  }
  async artifact(actor: Actor, runId: string, artifactId: string) {
    await this.authorize(actor, runId);
    const artifact = (
      await this.db.query<{ object_key: string; sha256: string; byte_length: number }>(
        'SELECT object_key,sha256,byte_length FROM run_artifacts WHERE run_id=$1 AND id=$2',
        [runId, artifactId],
      )
    )[0];
    if (!artifact) throw new NotFoundException('Artifact not found');
    return this.storage.get(artifact);
  }
  async reproducibility(actor: Actor, id: string) {
    const run = await this.authorize(actor, id);
    const { manifest } = await this.catalog.experiment(run.experiment_id, run.experiment_version);
    return {
      schema_version: '1.0.0',
      run: { ...run, owner_id: undefined },
      manifest,
      artifacts: await this.artifacts(actor, id),
      replay: {
        experiment_id: run.experiment_id,
        experiment_version: run.experiment_version,
        parameters: run.parameters,
        seed: run.seed,
        engine: run.engine_id,
      },
      limitations: manifest.model.limitations,
    };
  }
  async events(actor: Actor, id: string, after: string) {
    await this.authorize(actor, id);
    return this.db.query(
      "SELECT sequence::text,id,type,payload,created_at FROM durable_events WHERE resource_type='run' AND resource_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 500",
      [id, after],
    );
  }
  async batch(
    actor: Actor,
    key: string | undefined,
    input: { runs: RunRequest[] },
    investigationId?: string,
  ) {
    const prepared = await Promise.all(input.runs.map((run) => this.prepare(actor, run)));
    return this.idem.execute(actor.id, 'batches.create', key, input, async (tx) => {
      const id = randomUUID();
      await tx.query(
        'INSERT INTO simulation_batches(id,owner_id,investigation_id) VALUES($1,$2,$3)',
        [id, actor.id, investigationId ?? null],
      );
      const ids: string[] = [];
      for (let i = 0; i < prepared.length; i++) {
        const run = await this.insert(tx, actor, prepared[i]);
        ids.push(run.id);
        await tx.query(
          'INSERT INTO simulation_batch_members(batch_id,run_id,position) VALUES($1,$2,$3)',
          [id, run.id, i],
        );
      }
      return { id, run_ids: ids, url: `/v1/simulation-batches/${id}` };
    });
  }
  async getBatch(actor: Actor, id: string) {
    if (
      !(
        await this.db.query('SELECT id FROM simulation_batches WHERE id=$1 AND owner_id=$2', [
          id,
          actor.id,
        ])
      ).length
    )
      throw new NotFoundException('Batch not found');
    const runs = await this.db.query<{ id: string; status: string; error_code: string | null }>(
      'SELECT r.id,r.status,r.error_code FROM simulation_batch_members m JOIN experiment_runs r ON r.id=m.run_id WHERE m.batch_id=$1 ORDER BY m.position',
      [id],
    );
    const done = runs.every((r) => terminal.has(r.status));
    return {
      id,
      status: done
        ? runs.every((r) => r.status === 'completed')
          ? 'completed'
          : runs.every((r) => r.status === 'cancelled')
            ? 'cancelled'
            : 'completed_with_errors'
        : 'running',
      runs,
    };
  }
}
