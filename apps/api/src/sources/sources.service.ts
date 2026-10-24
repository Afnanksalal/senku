import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { Database } from '../database/database';
import { CONFIG, Config } from '../config';
import { boundedJson } from '../science/science.client';
import { MAX_ARTIFACT_BYTES, StorageService } from '../artifacts/storage.service';
const paper = z.object({
  id: z.string().max(100),
  source: z.string().regex(/^[A-Z_]{1,20}$/),
  title: z.string().max(2000),
  authorString: z.string().max(4000).optional(),
  pubYear: z.string().max(10).optional(),
  doi: z.string().max(256).optional(),
});
@Injectable()
export class SourcesService {
  constructor(
    private readonly db: Database,
    private readonly storage: StorageService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}
  private enabled() {
    if (!this.config.ENABLE_SOURCE_RETRIEVAL)
      throw new ServiceUnavailableException('Source retrieval is disabled');
  }
  async papers(query: string, limit = 5, cursor = '*') {
    this.enabled();
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.search = new URLSearchParams({
      query,
      format: 'json',
      resultType: 'lite',
      pageSize: String(limit),
      cursorMark: cursor,
    }).toString();
    try {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      const data = z
        .object({
          hitCount: z.number(),
          nextCursorMark: z.string().max(1024).optional(),
          resultList: z.object({ result: z.array(paper).max(25) }),
        })
        .parse(await boundedJson(response, 524288));
      const records = [];
      for (const entry of data.resultList.result) {
        const id = `epmc:${entry.source}:${entry.id}`;
        const record = {
          id,
          provider: 'europe-pmc',
          title: entry.title,
          authors: entry.authorString ?? null,
          year: entry.pubYear ?? null,
          doi: entry.doi ?? null,
          url: `https://europepmc.org/article/${entry.source}/${encodeURIComponent(entry.id)}`,
          evidence_type: 'retrieved_bibliographic_metadata',
        };
        await this.store(id, 'europe-pmc', record);
        records.push(record);
      }
      return {
        items: records,
        total: data.hitCount,
        next_cursor:
          records.length && data.nextCursorMark !== cursor ? (data.nextCursorMark ?? null) : null,
        limit,
        retrieved_at: new Date().toISOString(),
      };
    } catch {
      throw new BadGatewayException('Europe PMC retrieval failed');
    }
  }
  async structure(id: string) {
    this.enabled();
    id = z
      .string()
      .regex(/^[0-9][A-Za-z0-9]{3}$/)
      .parse(id)
      .toUpperCase();
    try {
      const response = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${id}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 404) throw new NotFoundException('Structure not found');
      if (!response.ok) throw new Error();
      const data = z
        .object({
          rcsb_id: z.string(),
          struct: z.object({ title: z.string().max(4000) }),
          exptl: z.array(z.object({ method: z.string() })).optional(),
          rcsb_entry_info: z
            .object({ resolution_combined: z.array(z.number()).optional() })
            .optional(),
        })
        .parse(await boundedJson(response, 1048576));
      const record = {
        id: `pdb:${id}`,
        provider: 'rcsb-pdb',
        pdb_id: id,
        title: data.struct.title,
        methods: data.exptl?.map((x) => x.method) ?? [],
        resolution_angstrom: data.rcsb_entry_info?.resolution_combined ?? [],
        url: `https://www.rcsb.org/structure/${id}`,
        structure_url: `https://files.rcsb.org/download/${id}.cif`,
        evidence_type: 'retrieved_structure_metadata',
      };
      await this.store(record.id, 'rcsb-pdb', record);
      return record;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadGatewayException('RCSB retrieval failed');
    }
  }
  async searchStructures(query: string, limit: number) {
    this.enabled();
    try {
      const response = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: { type: 'terminal', service: 'full_text', parameters: { value: query } },
          return_type: 'entry',
          request_options: { paginate: { start: 0, rows: limit } },
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 204) return { items: [], total: 0 };
      if (!response.ok) throw new Error();
      const data = z
        .object({
          total_count: z.number(),
          result_set: z
            .array(z.object({ identifier: z.string().max(100), score: z.number() }))
            .max(20),
        })
        .parse(await boundedJson(response, 262144));
      return {
        items: data.result_set.map((entry) => ({
          pdb_id: entry.identifier,
          score: entry.score,
          provider: 'rcsb-pdb',
          url: `https://www.rcsb.org/structure/${encodeURIComponent(entry.identifier)}`,
        })),
        total: data.total_count,
        retrieved_at: new Date().toISOString(),
      };
    } catch {
      throw new BadGatewayException('RCSB structure search failed');
    }
  }
  async structureFile(id: string) {
    id = z
      .string()
      .regex(/^[0-9][A-Za-z0-9]{3}$/)
      .parse(id)
      .toUpperCase();
    let asset = (
      await this.db.query<{ object_key: string; sha256: string; byte_length: number }>(
        'SELECT object_key,sha256,byte_length FROM structure_assets WHERE source_id=$1',
        [`pdb:${id}`],
      )
    )[0];
    if (!asset) {
      await this.structure(id);
      try {
        const response = await fetch(`https://files.rcsb.org/download/${id}.cif`, {
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        if (
          !response.ok ||
          !response.body ||
          Number(response.headers.get('content-length') ?? 0) > MAX_ARTIFACT_BYTES
        )
          throw new Error();
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > MAX_ARTIFACT_BYTES) throw new Error();
            chunks.push(part.value);
          }
        } finally {
          await reader.cancel().catch(() => undefined);
        }
        const stored = await this.storage.putStructure(id, Buffer.concat(chunks));
        await this.db.query(
          'INSERT INTO structure_assets(source_id,object_key,sha256,byte_length,content_type) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_id) DO NOTHING',
          [`pdb:${id}`, stored.object_key, stored.sha256, stored.byte_length, stored.content_type],
        );
        asset = (
          await this.db.query<typeof stored>(
            'SELECT object_key,sha256,byte_length,content_type FROM structure_assets WHERE source_id=$1',
            [`pdb:${id}`],
          )
        )[0];
      } catch {
        throw new BadGatewayException(
          'Structure download failed or exceeded the 4 MiB asset budget',
        );
      }
    }
    return { data: await this.storage.get(asset), sha256: asset.sha256, id };
  }
  private async store(id: string, provider: string, record: unknown) {
    await this.db.query(
      'INSERT INTO source_records(id,provider,record) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET record=excluded.record,retrieved_at=now()',
      [id, provider, JSON.stringify(record)],
    );
  }
  async cached(id: string) {
    const result = (
      await this.db.query(
        'SELECT id,provider,record,retrieved_at FROM source_records WHERE id=$1',
        [id],
      )
    )[0];
    if (!result) throw new NotFoundException('Source record not found');
    return result;
  }
}
