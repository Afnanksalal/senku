import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { z } from 'zod';
import { ApiRequest, Roles, SchemaBody, actor, pagination, uuid } from '../common/http';
import { InvestigationService, investigationInput } from './investigation.service';
import { AuthService } from '../auth/auth.service';
import { Connections } from '../common/events';
import { randomUUID } from 'node:crypto';
@ApiTags('Evidence investigations')
@ApiBearerAuth()
@Roles('learner', 'teacher', 'admin')
@Controller('v1/investigations')
export class InvestigationController {
  constructor(
    private readonly investigations: InvestigationService,
    private readonly auth: AuthService,
    private readonly connections: Connections,
  ) {}
  @Post() @SchemaBody(investigationInput) create(
    @Req() r: ApiRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: z.infer<typeof investigationInput>,
  ) {
    return this.investigations.create(actor(r), key, body);
  }
  @Get() list(@Req() r: ApiRequest, @Query() q: Record<string, string>) {
    const p = pagination.parse(q);
    return this.investigations.list(actor(r), p.limit, p.after);
  }
  @Get(':id') get(@Req() r: ApiRequest, @Param('id') id: string) {
    return this.investigations.get(actor(r), uuid(id));
  }
  @Post(':id/cancel') cancel(@Req() r: ApiRequest, @Param('id') id: string) {
    return this.investigations.cancel(actor(r), uuid(id));
  }
  @Get(':id/events') events(
    @Req() r: ApiRequest,
    @Param('id') id: string,
    @Query('after') after = '0',
  ) {
    return this.investigations.events(
      actor(r),
      uuid(id),
      z
        .string()
        .regex(/^\d{1,18}$/)
        .parse(after),
    );
  }
  @Sse(':id/stream') async stream(
    @Req() r: ApiRequest,
    @Param('id') id: string,
    @Headers('last-event-id') cursor = '0',
  ) {
    id = uuid(id);
    let after = z
      .string()
      .regex(/^\d{1,18}$/)
      .parse(cursor);
    await this.investigations.get(actor(r), id);
    const lease = randomUUID(),
      key = this.connections.key(`sse:${actor(r).id}`),
      now = Date.now();
    const admitted = await this.connections.redis.eval(
      "redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[1]); if redis.call('ZCARD',KEYS[1])>=3 then return 0 end; redis.call('ZADD',KEYS[1],ARGV[2],ARGV[3]); redis.call('EXPIRE',KEYS[1],930); return 1",
      1,
      key,
      now,
      now + 900000,
      lease,
    );
    if (!admitted) throw new HttpException('Too many active event streams', 429);
    return new Observable<{ id?: string; type: string; data: unknown }>((subscriber) => {
      let running = false;
      let ticks = 0;
      const tick = async () => {
        if (Date.now() >= now + 900000) {
          subscriber.complete();
          return;
        }
        if (running) return;
        running = true;
        try {
          const verified = await this.auth.authenticate(r.bearer!);
          const events = await this.investigations.events(verified, id, after);
          for (const event of events) {
            after = String(event.sequence);
            subscriber.next({ id: after, type: String(event.type), data: event.payload });
          }
          if (++ticks % 15 === 0) subscriber.next({ type: 'heartbeat', data: {} });
          if (ticks >= 900) subscriber.complete();
        } catch {
          subscriber.complete();
        } finally {
          running = false;
        }
      };
      const timer = setInterval(() => void tick(), 1000);
      void tick();
      return () => {
        clearInterval(timer);
        void this.connections.redis.zrem(key, lease).catch(() => undefined);
      };
    });
  }
}
