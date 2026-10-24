import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Database } from './database/database';
import { Connections } from './common/events';
import { Public } from './common/http';
import { StorageService } from './artifacts/storage.service';

@Public()
@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly db: Database,
    private readonly connections: Connections,
    private readonly storage: StorageService,
  ) {}
  @Get('health') health() {
    return { status: 'ok', service: 'api' };
  }
  @Get('ready') async ready() {
    try {
      await this.db.query('SELECT 1');
      if ((await this.connections.redis.ping()) !== 'PONG') throw new Error();
      await this.storage.ready();
      if (!(await this.connections.redis.get(this.connections.key('worker:heartbeat'))))
        throw new Error();
    } catch {
      throw new ServiceUnavailableException('Core dependencies are not ready');
    }
    return {
      status: 'ok',
      dependencies: { database: 'ok', redis: 'ok', artifacts: 'ok', worker: 'ok' },
    };
  }
}
