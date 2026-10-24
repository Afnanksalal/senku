import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { dockingTargets, dockingLimitations } from './docking';
import { Public, pagination } from '../common/http';
import { identifier, version } from '@senku/experiment-schema';

@Public()
@ApiTags('Catalog')
@Controller('v1')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get('docking/targets') docking() {
    return { items: dockingTargets, defaults: { target: 'trypsin', smiles: 'NC(=N)c1ccccc1', exhaustiveness: 2, num_modes: 3, seed: 42 }, limits: { max_smiles_length: 160, max_heavy_atoms: 32, max_rotatable_bonds: 8 }, limitations: dockingLimitations };
  }
  @Get('subjects') subjects() {
    return this.catalog.subjects();
  }
  @Get('experiments') experiments(@Query() query: unknown) {
    const q = pagination.parse(query);
    return this.catalog.list(q.limit, q.after);
  }
  @Get('experiments/:id/versions/:version') experiment(
    @Param('id') id: string,
    @Param('version') v: string,
  ) {
    return this.catalog
      .experiment(identifier.parse(id), version.parse(v))
      .then((r) => ({ ...r.manifest, content_hash: r.content_hash }));
  }
  @Get('engines') engines() {
    return this.catalog.engines();
  }
  @Get('models') models() {
    return this.catalog.models();
  }
  @Get('models/:id/versions') versions(@Param('id') id: string) {
    return this.catalog.modelVersions(identifier.parse(id));
  }
  @Get('lessons') lessons() {
    return this.catalog.lessons().then((items) =>
      items.map(({ definition, ...rest }) => ({
        ...rest,
        name: (definition as Record<string, unknown>).name,
      })),
    );
  }
  @Get('lessons/:id') lesson(@Param('id') id: string) {
    return this.catalog.lesson(identifier.parse(id));
  }
}
