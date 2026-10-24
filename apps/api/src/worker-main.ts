import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Database } from './database/database';
import { CatalogService } from './catalog/catalog.service';
import { StorageService } from './artifacts/storage.service';
import { JobRuntime } from './runs/job.runtime';
import { CONFIG, Config } from './config';
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  if (app.get<Config>(CONFIG).AUTO_MIGRATE) {
    await app.get(Database).migrate();
    await app.get(CatalogService).seed();
  } else await app.get(Database).verifyMigrations();
  await app.get(StorageService).initialize();
  const runtime = app.get(JobRuntime);
  await runtime.start();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await runtime.stop();
    await app.close();
  };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());
}
void main().catch(() => {
  console.error(JSON.stringify({ level: 'fatal', event: 'worker.startup_failed' }));
  process.exit(1);
});
