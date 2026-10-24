import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SourcesService } from './sources.service';
@ApiTags('Scientific sources')
@ApiBearerAuth()
@Controller('v1/sources')
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}
  @Get('papers') papers(
    @Query('q') query: string,
    @Query('limit') limit = '5',
    @Query('cursor') cursor = '*',
  ) {
    return this.sources.papers(
      z.string().trim().min(2).max(200).parse(query),
      z.coerce.number().int().min(1).max(25).parse(limit),
      z
        .string()
        .min(1)
        .max(1024)
        .regex(/^[A-Za-z0-9+/=_*-]+$/)
        .parse(cursor),
    );
  }
  @Get('structures/:id') structure(@Param('id') id: string) {
    return this.sources.structure(id);
  }
  @Get('records/:id') cached(@Param('id') id: string) {
    return this.sources.cached(z.string().min(1).max(150).parse(id));
  }
}
