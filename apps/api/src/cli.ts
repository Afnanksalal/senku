import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Database } from './database/database';
import { CatalogService } from './catalog/catalog.service';
import { MaintenanceService } from './operations/maintenance.service';
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const db = app.get(Database),
      command = process.argv[2];
    if (command === 'migrate') {
      await db.migrate();
      await app.get(CatalogService).seed();
      console.log('Migrations and immutable catalog checked');
    } else if (command === 'admin') {
      const uid = process.argv[3];
      if (!uid || !/^[0-9a-f-]{36}$/.test(uid)) throw new Error('Pass the existing account UUID');
      await db.transaction(async (tx) => {
        const row = await tx.query(
          "UPDATE users SET role='admin' WHERE id=$1 AND role<>'guest' AND deleted_at IS NULL RETURNING id",
          [uid],
        );
        if (!row.rowCount) throw new Error('Active account not found');
        await tx.query(
          "INSERT INTO audit_log(actor_id,action,resource_id) VALUES($1,'admin.provisioned_cli',$1)",
          [uid],
        );
      });
      console.log('Administrator role provisioned');
    } else if (command === 'cleanup')
      console.log(JSON.stringify(await app.get(MaintenanceService).cleanup()));
    else throw new Error('Expected migrate, admin <account UUID>, or cleanup');
  } finally {
    await app.close();
  }
}
void main().catch(() => {
  console.error('Operation failed. Check configuration and command arguments.');
  process.exitCode = 1;
});
