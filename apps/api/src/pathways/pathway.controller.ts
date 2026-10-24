import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Pathway, compileSbml, pathwaySchema, validatePathway } from '@senku/experiment-schema';
import { Database, rows } from '../database/database';
import { ApiRequest, Roles, SchemaBody, actor, uuid } from '../common/http';
import { Idempotency } from '../common/idempotency';
import { digest } from '../common/crypto';
import { audit } from '../common/events';
import { NotFoundException } from '@nestjs/common';

@ApiTags('Approved pathway composition')
@ApiBearerAuth()
@Roles('learner', 'teacher', 'admin')
@Controller('v1/pathways')
export class PathwayController {
  constructor(
    private readonly db: Database,
    private readonly idem: Idempotency,
  ) {}
  @Get() list(@Req() req: ApiRequest) {
    return this.db.query('SELECT id,name,content_hash,created_at FROM pathway_documents WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100', [actor(req).id]);
  }
  @Post('validate') @SchemaBody(pathwaySchema) validate(@Body() body: Pathway) {
    try {
      validatePathway(body);
      return {
        valid: true,
        scientific_status: 'illustrative_educational',
        warnings: [
          'Mass-action rate constants have reaction-order-dependent units. No empirical validity is implied.',
        ],
      };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
  @Post('compile') @SchemaBody(pathwaySchema) compile(
    @Req() req: ApiRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: Pathway,
  ) {
    let sbml: string;
    try {
      sbml = compileSbml(body);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    return this.idem.execute(actor(req).id, 'pathways.compile', key, body, async (tx) => {
      const result = (
        await rows(
          tx,
          'INSERT INTO pathway_documents(owner_id,name,graph,sbml,content_hash) VALUES($1,$2,$3,$4,$5) RETURNING id,name,content_hash,created_at',
          [actor(req).id, body.name, JSON.stringify(body), sbml, digest(body)],
        )
      )[0];
      await audit(tx, actor(req).id, 'pathway.compiled', String(result.id));
      return { ...result, sbml, scientific_status: 'illustrative_educational' };
    });
  }
  @Get(':id') async get(@Req() req: ApiRequest, @Param('id') id: string) {
    const document = (
      await this.db.query(
        'SELECT id,name,graph,sbml,content_hash,created_at FROM pathway_documents WHERE id=$1 AND owner_id=$2',
        [uuid(id), actor(req).id],
      )
    )[0];
    if (!document) throw new NotFoundException();
    return document;
  }
}
