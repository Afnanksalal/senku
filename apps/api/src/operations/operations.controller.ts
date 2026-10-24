import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Database } from '../database/database';
import { Connections } from '../common/events';
import { Roles } from '../common/http';
import { ScienceClient } from '../science/science.client';
@ApiTags('Operations')
@ApiBearerAuth()
@Roles('admin')
@Controller('v1/admin/operations')
export class OperationsController {
  constructor(
    private readonly db: Database,
    private readonly connections: Connections,
    private readonly science: ScienceClient,
  ) {}
  @Get('metrics') async metrics() {
    return {
      runs: await this.db.query(
        'SELECT status,engine_id,count(*)::int FROM experiment_runs GROUP BY status,engine_id',
      ),
      outbox: await this.db.query(
        'SELECT queue,count(*)::int FROM outbox WHERE processed_at IS NULL GROUP BY queue',
      ),
      worker_heartbeat: await this.connections.redis.get(this.connections.key('worker:heartbeat')),
      investigations: await this.db.query(
        'SELECT status,count(*)::int FROM investigations GROUP BY status',
      ),
    };
  }
  @Get('engines') async engines() {
    return Object.fromEntries(
      await Promise.all(
        [
          'numerics',
          'rdkit',
          'vina',
          'roadrunner',
          'tellurium',
          'copasi',
          'cobrapy',
          'physicell',
          'biosimulators',
        ].map(async (engine) => [engine, await this.science.capability(engine)]),
      ),
    );
  }
}
