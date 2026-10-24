import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { rows } from '../database/database';
import { CONFIG, Config } from '../config';
import { requestContext } from './request-context';

@Injectable()
export class Connections implements OnModuleDestroy {
  readonly redis: Redis;
  constructor(@Inject(CONFIG) readonly config: Config) {
    this.redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      commandTimeout: 3000,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    this.redis.on('error', () =>
      console.error(JSON.stringify({ level: 'error', event: 'redis.connection_error' })),
    );
  }
  key(name: string) {
    return `${this.config.QUEUE_PREFIX}:${name}`;
  }
  async onModuleDestroy() {
    await this.redis.quit();
  }
}
export async function audit(
  db: PoolClient,
  actorId: string | null,
  action: string,
  resourceId?: string,
  metadata: Record<string, unknown> = {},
) {
  await db.query(
    'INSERT INTO audit_log(actor_id,action,resource_id,metadata,request_id) VALUES($1,$2,$3,$4,$5)',
    [
      actorId,
      action,
      resourceId ?? null,
      JSON.stringify(metadata),
      requestContext.getStore()?.requestId ?? null,
    ],
  );
}
export async function event(
  db: PoolClient,
  ownerId: string,
  resourceType: string,
  resourceId: string,
  type: string,
  payload: unknown = {},
) {
  return (
    await rows(
      db,
      'INSERT INTO durable_events(owner_id,resource_type,resource_id,type,payload) VALUES($1,$2,$3,$4,$5) RETURNING sequence::text,id,type,payload,created_at',
      [ownerId, resourceType, resourceId, type, JSON.stringify(payload)],
    )
  )[0];
}
export async function enqueue(
  db: PoolClient,
  queue: 'science' | 'investigations',
  jobId: string,
  payload: unknown,
) {
  await db.query(
    'INSERT INTO outbox(id,queue,job_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(queue,job_id) DO NOTHING',
    [randomUUID(), queue, jobId, JSON.stringify(payload)],
  );
}
