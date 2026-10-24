import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiRequest, SchemaBody, actor } from '../common/http';
import { RunService, runRequest } from '../runs/run.service';
import { SourcesService } from './sources.service';
const search = z
  .object({
    query: z.string().trim().min(2).max(200),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .strict();
const molecule = z
  .object({
    smiles: z.string().trim().min(1).max(256),
    seed: z.number().int().min(0).max(2147483647).default(0),
    generate_3d: z.boolean().default(false),
  })
  .strict();
@ApiTags('Domain scientific tools')
@ApiBearerAuth()
@Controller('v1')
export class DomainController {
  constructor(
    private readonly sources: SourcesService,
    private readonly runs: RunService,
  ) {}
  @Post('structures/search') @SchemaBody(search) search(@Body() b: z.infer<typeof search>) {
    return this.sources.searchStructures(b.query, b.limit);
  }
  @Get('structures/:id') structure(@Param('id') id: string) {
    return this.sources.structure(id);
  }
  @Get('structures/:id/file') async file(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: { setHeader: (key: string, value: string) => void },
  ) {
    const asset = await this.sources.structureFile(id);
    response.setHeader('X-Content-SHA256', asset.sha256);
    return new StreamableFile(asset.data, {
      type: 'chemical/x-mmcif',
      disposition: `attachment; filename="${asset.id}.cif"`,
    });
  }
  @Post(['molecules/validate', 'molecules/describe']) @HttpCode(202) @SchemaBody(molecule) molecule(
    @Req() r: ApiRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() b: z.infer<typeof molecule>,
  ) {
    return this.runs.create(
      actor(r),
      key,
      runRequest.parse({
        experiment_id: 'molecule-sketchbook',
        parameters: { smiles: b.smiles, generate_3d: b.generate_3d ? 'yes' : 'no' },
        seed: b.seed,
      }),
    );
  }
}
