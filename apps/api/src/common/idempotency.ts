import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Database, rows } from '../database/database';
import { digest } from './crypto';

@Injectable()
export class Idempotency {
  constructor(private readonly db: Database) {}
  async execute<T>(
    owner: string,
    scope: string,
    key: string | undefined,
    request: unknown,
    fn: (tx: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key header is required');
    const hash = digest(request);
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [
        owner,
        `${scope}:${key}`,
      ]);
      await tx.query(
        'DELETE FROM idempotency_keys WHERE owner_id=$1 AND scope=$2 AND key=$3 AND expires_at<now()',
        [owner, scope, key],
      );
      const existing = (
        await rows<{ request_hash: string; response: T }>(
          tx,
          'SELECT request_hash,response FROM idempotency_keys WHERE owner_id=$1 AND scope=$2 AND key=$3',
          [owner, scope, key],
        )
      )[0];
      if (existing) {
        if (existing.request_hash !== hash)
          throw new ConflictException('Idempotency key was used for different input');
        return existing.response;
      }
      const response = await fn(tx);
      await tx.query(
        'INSERT INTO idempotency_keys(owner_id,scope,key,request_hash,response) VALUES($1,$2,$3,$4,$5)',
        [owner, scope, key, hash, JSON.stringify(response)],
      );
      return response;
    });
  }
}
