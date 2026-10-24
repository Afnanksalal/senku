import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG, Config } from '../config';
import { sha256 } from '../common/crypto';

export type Connection = Pool | PoolClient;
export async function rows<T extends QueryResultRow = Record<string, unknown>>(
  db: Connection,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await db.query<T>(sql, values)).rows;
}
@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool: Pool;
  constructor(@Inject(CONFIG) readonly config: Config) {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: config.DB_POOL_SIZE,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
      options: `-c search_path=${config.DB_SCHEMA}`,
    });
    this.pool.on('error', () =>
      console.error(JSON.stringify({ level: 'error', event: 'database.pool_error' })),
    );
  }
  query<T extends QueryResultRow = Record<string, unknown>>(sql: string, values: unknown[] = []) {
    return rows<T>(this.pool, sql, values);
  }
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async migrate(): Promise<void> {
    const client = await this.pool.connect();
    const lock = `senku:migrations:${this.config.DB_SCHEMA}`;
    try {
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [lock]);
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${this.config.DB_SCHEMA}"`);
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
      );
      const directory = path.join(__dirname, 'migrations');
      for (const name of (await readdir(directory)).filter((n) => /^\d+.*\.sql$/.test(n)).sort()) {
        const sql = (await readFile(path.join(directory, name), 'utf8'))
          .replace(/\r\n/g, '\n')
          .replace(/^\uFEFF/, '');
        const hash = sha256(sql);
        const existing = await rows<{ sha256: string }>(
          client,
          'SELECT sha256 FROM schema_migrations WHERE name=$1',
          [name],
        );
        if (existing.length) {
          if (existing[0].sha256 !== hash) throw new Error(`Migration checksum changed: ${name}`);
          continue;
        }
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)', [
            name,
            hash,
          ]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lock]);
      client.release();
    }
  }
  async verifyMigrations() {
    const directory = path.join(__dirname, 'migrations');
    const applied = await this.query<{ name: string; sha256: string }>(
      'SELECT name,sha256 FROM schema_migrations',
    );
    for (const name of (await readdir(directory)).filter((n) => /^\d+.*\.sql$/.test(n)).sort()) {
      const found = applied.find((row) => row.name === name);
      if (
        !found ||
        found.sha256 !==
          sha256(
            (await readFile(path.join(directory, name), 'utf8'))
              .replace(/\r\n/g, '\n')
              .replace(/^\uFEFF/, ''),
          )
      )
        throw new Error('Database migrations are missing or changed');
    }
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
}
