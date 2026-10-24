import { Injectable, Inject } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { Database, rows } from '../database/database';
import { CONFIG, Config } from '../config';
import { Connections, event } from '../common/events';
import { RunRow, terminal } from '../runs/run.service';
import { BudgetService } from '../budgets/budget.service';
import { ScienceClient } from '../science/science.client';
import { StorageService } from '../artifacts/storage.service';
import { InvestigationService } from '../investigations/investigation.service';
import { MaintenanceService } from '../operations/maintenance.service';

@Injectable()
export class JobRuntime {
  private queue!: Queue;
  private worker!: Worker;
  private investigationsQueue!: Queue;
  private investigationsWorker!: Worker;
  private connection!: Redis;
  private timer?: NodeJS.Timeout;
  private dispatching = false;
  private maintenanceTimer?: NodeJS.Timeout;
  private maintaining = false;
  constructor(
    private readonly db: Database,
    private readonly connections: Connections,
    private readonly budget: BudgetService,
    private readonly science: ScienceClient,
    private readonly storage: StorageService,
    private readonly investigations: InvestigationService,
    private readonly maintenance: MaintenanceService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}
  async start() {
    this.connection = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: null });
    this.connection.on('error', () =>
      console.error(JSON.stringify({ level: 'error', event: 'queue.connection_error' })),
    );
    this.queue = new Queue('science', {
      connection: this.connections.redis,
      prefix: this.config.QUEUE_PREFIX,
    });
    this.investigationsQueue = new Queue('investigations', {
      connection: this.connections.redis,
      prefix: this.config.QUEUE_PREFIX,
    });
    this.investigationsWorker = new Worker(
      'investigations',
      (job) => this.investigations.process(String(job.id)),
      {
        connection: this.connection,
        prefix: this.config.QUEUE_PREFIX,
        concurrency: this.config.INVESTIGATION_CONCURRENCY,
        lockDuration: 90000,
        maxStalledCount: 2,
      },
    );
    this.investigationsWorker.on('error', () =>
      console.error(JSON.stringify({ level: 'error', event: 'investigation.worker_error' })),
    );
    this.investigationsWorker.on('failed', (job) => {
      if (job)
        void this.investigations
          .fail(String(job.id), 'worker_execution_failed')
          .catch(() =>
            console.error(
              JSON.stringify({ level: 'error', event: 'investigation.failure_persist_failed' }),
            ),
          );
    });
    this.worker = new Worker('science', (job) => this.run(job), {
      connection: this.connection,
      prefix: this.config.QUEUE_PREFIX,
      concurrency: this.config.SCIENCE_CONCURRENCY,
      lockDuration: 90000,
      maxStalledCount: 2,
    });
    this.worker.on('error', () =>
      console.error(JSON.stringify({ level: 'error', event: 'queue.worker_error' })),
    );
    this.worker.on('failed', (job) => {
      if (job && job.attemptsMade >= 3)
        void this.finishFailure(String(job.id), 'execution_unavailable').catch(() =>
          console.error(JSON.stringify({ level: 'error', event: 'run.failure_persist_failed' })),
        );
    });
    await this.dispatch();
    this.timer = setInterval(
      () =>
        void this.dispatch().catch(() =>
          console.error(JSON.stringify({ level: 'error', event: 'outbox.dispatch_failed' })),
        ),
      1000,
    );
    this.maintenanceTimer = setInterval(() => {
      if (this.maintaining) return;
      this.maintaining = true;
      void this.maintenance
        .cleanup()
        .catch(() => console.error(JSON.stringify({ level: 'error', event: 'maintenance.failed' })))
        .finally(() => {
          this.maintaining = false;
        });
    }, 60000);
  }
  private async dispatch() {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      await this.db.transaction(async (tx) => {
        const pending = await rows<{ id: string; queue: string; job_id: string; payload: unknown }>(
          tx,
          'SELECT id,queue,job_id,payload FROM outbox WHERE processed_at IS NULL AND available_at<=now() ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED',
        );
        for (const entry of pending) {
          await (entry.queue === 'science' ? this.queue : this.investigationsQueue).add(
            'execute',
            entry.payload,
            {
              jobId: entry.job_id,
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: { age: 86400, count: 10000 },
              removeOnFail: { age: 604800, count: 10000 },
            },
          );
          await tx.query('UPDATE outbox SET processed_at=now(),attempts=attempts+1 WHERE id=$1', [
            entry.id,
          ]);
        }
      });
      // Redis can be rebuilt without losing admitted jobs. Database rows remain authoritative.
      const stranded = await this.db.query<{ id: string }>(
        "SELECT id FROM experiment_runs WHERE status IN ('queued','running') AND created_at<now()-interval '2 minutes' ORDER BY created_at LIMIT 100",
      );
      for (const run of stranded) {
        const job = await this.queue.getJob(run.id);
        if (!job)
          await this.queue.add(
            'execute',
            { run_id: run.id },
            { jobId: run.id, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
          );
        else if ((await job.getState()) === 'failed')
          await this.finishFailure(run.id, 'execution_unavailable');
      }
      const pendingInvestigations = await this.db.query<{ id: string }>(
        "SELECT id FROM investigations WHERE status IN ('queued','running') AND created_at<now()-interval '2 minutes' ORDER BY created_at LIMIT 25",
      );
      for (const item of pendingInvestigations) {
        const job = await this.investigationsQueue.getJob(item.id);
        if (!job)
          await this.investigationsQueue.add(
            'execute',
            { investigation_id: item.id },
            { jobId: item.id, attempts: 3 },
          );
        else if ((await job.getState()) === 'failed')
          await this.investigations.fail(item.id, 'worker_execution_failed');
      }
      await this.connections.redis.set(
        this.connections.key('worker:heartbeat'),
        new Date().toISOString(),
        'EX',
        15,
      );
    } finally {
      this.dispatching = false;
    }
  }
  private async finishFailure(id: string, code: string) {
    await this.db.transaction(async (tx) => {
      const run = (
        await rows<RunRow>(tx, 'SELECT * FROM experiment_runs WHERE id=$1 FOR UPDATE', [id])
      )[0];
      if (!run || terminal.has(run.status)) return;
      const status = run.cancel_requested_at
        ? 'cancelled'
        : code === 'timed_out'
          ? 'timed_out'
          : 'failed';
      await tx.query(
        'UPDATE experiment_runs SET status=$2,error_code=$3,finished_at=now() WHERE id=$1',
        [id, status, status === 'cancelled' ? null : code],
      );
      await this.budget.release(tx, id);
      await event(tx, run.owner_id, 'run', id, `run.${status}`, {
        run_id: id,
        error_code: status === 'cancelled' ? null : code,
      });
    });
  }
  private async run(job: Job) {
    const id = String(job.id);
    const run = await this.db.transaction(async (tx) => {
      const row = (
        await rows<RunRow>(tx, 'SELECT * FROM experiment_runs WHERE id=$1 FOR UPDATE', [id])
      )[0];
      if (!row || terminal.has(row.status)) return null;
      if (row.cancel_requested_at) {
        await tx.query(
          "UPDATE experiment_runs SET status='cancelled',finished_at=now() WHERE id=$1",
          [id],
        );
        await this.budget.release(tx, id);
        await event(tx, row.owner_id, 'run', id, 'run.cancelled', { run_id: id });
        return null;
      }
      if (
        (row.status === 'queued' && Date.now() - row.created_at.getTime() > 900000) ||
        (row.status === 'running' &&
          row.started_at &&
          Date.now() - row.started_at.getTime() > 300000)
      ) {
        await tx.query(
          "UPDATE experiment_runs SET status='failed',error_code='execution_window_expired',finished_at=now() WHERE id=$1",
          [id],
        );
        await this.budget.release(tx, id);
        await event(tx, row.owner_id, 'run', id, 'run.failed', {
          run_id: id,
          error_code: 'execution_window_expired',
        });
        return null;
      }
      await tx.query(
        "UPDATE experiment_runs SET status='running',started_at=coalesce(started_at,now()),attempt_count=attempt_count+1 WHERE id=$1",
        [id],
      );
      await this.budget.consume(tx, id);
      await event(tx, row.owner_id, 'run', id, 'run.running', { run_id: id });
      return row;
    });
    if (!run) return;
    let cancelled = false,
      polling = false;
    const timer = setInterval(() => {
      if (polling) return;
      polling = true;
      void this.db
        .query<{ cancel_requested_at: Date | null }>(
          'SELECT cancel_requested_at FROM experiment_runs WHERE id=$1',
          [id],
        )
        .then(async (rows) => {
          if (rows[0]?.cancel_requested_at) {
            cancelled = true;
            await this.science.cancel(run.engine_id, id);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          polling = false;
        });
    }, 200);
    let artifact: Awaited<ReturnType<StorageService['put']>> | undefined;
    try {
      const output = await this.science.execute(run.engine_id, {
        job_id: id,
        model_id: run.experiment_id,
        parameters: run.parameters,
        seed: run.seed,
        input: run.input,
        timeout_seconds: run.engine_id === 'vina' ? 60 : Math.min(60, this.config.SCIENCE_TIMEOUT_MS / 1000),
      });
      if (output.engine_id !== run.engine_id || output.model_id !== run.experiment_id)
        throw new Error('invalid_output');
      if (run.engine_id === 'vina' && (!output.docking ||
          output.docking.target.id !== run.parameters.target ||
          output.docking.provenance.seed !== run.seed ||
          output.docking.poses.length > Number(run.parameters.num_modes)))
        throw new Error('invalid_output');
      for (const series of output.series)
        if (
          series.columns.length !== series.units.length ||
          series.data.some((row) => row.length !== series.columns.length)
        )
          throw new Error('invalid_output');
      artifact = await this.storage.put(run.owner_id, id, output);
      const saved = await this.db.transaction(async (tx) => {
        const current = (
          await rows<RunRow>(tx, 'SELECT * FROM experiment_runs WHERE id=$1 FOR UPDATE', [id])
        )[0];
        if (terminal.has(current.status)) return false;
        if (current.cancel_requested_at || cancelled) {
          await tx.query(
            "UPDATE experiment_runs SET status='cancelled',finished_at=now() WHERE id=$1",
            [id],
          );
          await event(tx, run.owner_id, 'run', id, 'run.cancelled', { run_id: id });
          return false;
        }
        await tx.query(
          'INSERT INTO run_artifacts(id,run_id,kind,content_type,object_key,sha256,byte_length) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            artifact!.id,
            id,
            artifact!.kind,
            artifact!.content_type,
            artifact!.object_key,
            artifact!.sha256,
            artifact!.byte_length,
          ],
        );
        await tx.query(
          "UPDATE experiment_runs SET status='completed',result=$2,diagnostics=$3,engine_version=$4,image_digest=$5,finished_at=now(),error_code=NULL WHERE id=$1",
          [
            id,
            JSON.stringify(output),
            JSON.stringify(output.diagnostics),
            output.engine_version,
            output.diagnostics.worker_image_digest ?? null,
          ],
        );
        await event(tx, run.owner_id, 'run', id, 'run.completed', {
          run_id: id,
          artifact_id: artifact!.id,
        });
        return true;
      });
      if (!saved) await this.storage.remove(artifact.object_key);
    } catch (error) {
      if (artifact) await this.storage.remove(artifact.object_key).catch(() => undefined);
      const code = (error as Error).message;
      if (
        [
          'cancelled',
          'timed_out',
          'invalid_input',
          'invalid_output',
          'output_limit',
          'engine_error',
        ].includes(code) ||
        cancelled
      ) {
        await this.finishFailure(id, cancelled ? 'cancelled' : code);
        return;
      }
      throw error;
    } finally {
      clearInterval(timer);
    }
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
    await Promise.all([this.worker?.close(), this.investigationsWorker?.close()]);
    await Promise.all([this.queue?.close(), this.investigationsQueue?.close()]);
    if (this.connection) await this.connection.quit();
  }
}
