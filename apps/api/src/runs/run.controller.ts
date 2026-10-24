import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiRequest, SchemaBody, actor, pagination, uuid } from '../common/http';
import { RunService, runRequest } from './run.service';

const batchRequest = z.object({ runs: z.array(runRequest).min(1).max(8) }).strict();
const eventQuery = z.object({
  after: z
    .string()
    .regex(/^\d{1,18}$/)
    .default('0'),
});
@ApiTags('Runs and artifacts')
@ApiBearerAuth()
@Controller('v1')
export class RunController {
  constructor(private readonly runs: RunService) {}
  @Post('runs') @HttpCode(202) @SchemaBody(runRequest) create(
    @Req() req: ApiRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: z.infer<typeof runRequest>,
  ) {
    return this.runs.create(actor(req), key, body);
  }
  @Get('runs') list(@Req() req: ApiRequest, @Query() query: unknown) {
    const q = pagination.parse(query);
    return this.runs.list(actor(req), q.limit, q.after);
  }
  @Get('runs/:id') get(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.runs.get(actor(req), uuid(id));
  }
  @Post('runs/:id/cancel') @HttpCode(202) cancel(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.runs.cancel(actor(req), uuid(id));
  }
  @Get('runs/:id/artifacts') artifacts(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.runs.artifacts(actor(req), uuid(id));
  }
  @Get('runs/:id/artifacts/:artifact/content') async artifact(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Param('artifact') artifact: string,
  ) {
    return new StreamableFile(await this.runs.artifact(actor(req), uuid(id), uuid(artifact)), {
      type: 'application/json',
      disposition: `attachment; filename="${artifact}.json"`,
    });
  }
  @Get('runs/:id/diagnostics') async diagnostics(@Req() req: ApiRequest, @Param('id') id: string) {
    const r = await this.runs.get(actor(req), uuid(id));
    return { id: r.id, status: r.status, diagnostics: r.diagnostics, error_code: r.error_code };
  }
  @Get('runs/:id/reproducibility') reproducibility(
    @Req() req: ApiRequest,
    @Param('id') id: string,
  ) {
    return this.runs.reproducibility(actor(req), uuid(id));
  }
  @Get('runs/:id/events') events(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    return this.runs.events(actor(req), uuid(id), eventQuery.parse(query).after);
  }
  @Post('simulation-batches') @HttpCode(202) @SchemaBody(batchRequest) batch(
    @Req() req: ApiRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: z.infer<typeof batchRequest>,
  ) {
    return this.runs.batch(actor(req), key, body);
  }
  @Get('simulation-batches/:id') batchStatus(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.runs.getBatch(actor(req), uuid(id));
  }
  @Post('simulation-batches/:id/cancel') @HttpCode(202) async cancelBatch(
    @Req() req: ApiRequest,
    @Param('id') id: string,
  ) {
    const batch = await this.runs.getBatch(actor(req), uuid(id));
    return {
      id: batch.id,
      runs: await Promise.all(batch.runs.map((r) => this.runs.cancel(actor(req), r.id))),
    };
  }
}
