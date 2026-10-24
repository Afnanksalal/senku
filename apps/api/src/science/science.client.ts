import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CONFIG, Config } from '../config';
import { z } from 'zod';

const coordinate = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const dockingOutput = z.object({
  target: z.object({
    id: z.enum(['trypsin', 'streptavidin']), name: z.string().min(1).max(100),
    pdb_id: z.string().regex(/^[0-9A-Z]{4}$/), source_url: z.enum(['https://www.rcsb.org/structure/3PTB','https://www.rcsb.org/structure/1STP']),
    organism: z.string().max(160), reference_ligand: z.string().max(100),
    reference_smiles: z.string().max(160),
  }).strict(),
  protein_pdb: z.string().min(1).max(1000000),
  reference_ligand_pdb: z.string().min(1).max(64000),
  box: z.object({ center: coordinate, size: coordinate.refine(v => v.every(n => n > 0 && n <= 40)) }).strict(),
  binding_site_residues: z.array(z.object({
    chain: z.string().max(4), residue_name: z.string().max(8),
    residue_number: z.number().int(), distance_angstrom: z.number().finite().min(0),
  }).strict()).max(250),
  poses: z.array(z.object({
    rank: z.number().int().min(1).max(5), score_kcal_mol: z.number().finite(),
    pdbqt: z.string().min(1).max(64000), pdb: z.string().min(1).max(64000),
  }).strict()).min(1).max(5),
  limitations: z.array(z.string().min(1).max(500)).min(2).max(20),
  provenance: z.object({
    source_pdb_sha256: hash, receptor_pdbqt_sha256: hash, preparation_sha256: hash,
    ligand_pdbqt_sha256: hash, seed: z.number().int().min(1).max(2147483647),
    cpu: z.literal(1), scoring_function: z.literal('vina'),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.target.pdb_id !== (value.target.id === 'trypsin' ? '3PTB' : '1STP'))
    context.addIssue({code:'custom',message:'Docking target structure does not match its approved identity'});
  for (let i = 0; i < value.poses.length; i++) {
    if (value.poses[i].rank !== i + 1 || (i > 0 && value.poses[i].score_kcal_mol < value.poses[i - 1].score_kcal_mol))
      context.addIssue({code:'custom',message:'Docking poses must be ranked in ascending score order'});
  }
});

export const scienceOutput = z
  .object({
    engine_id: z.string(),
    engine_version: z.string(),
    adapter_version: z.literal('1.0.0'),
    model_id: z.string(),
    scientific_status: z.literal('illustrative_educational'),
    scalars: z.record(z.string(), z.number().finite()),
    units: z.record(z.string(), z.string()),
    series: z
      .array(
        z.object({
          columns: z.array(z.string()),
          units: z.array(z.string()),
          data: z.array(z.array(z.number().finite())),
        }),
      )
      .max(10)
      .default([]),
    frames: z.array(z.unknown()).max(25).default([]),
    diagnostics: z.record(z.string(), z.unknown()),
    warnings: z.array(z.string()).max(50),
    molecule: z.unknown().optional(),
    network: z.unknown().optional(),
    docking: dockingOutput.optional(),
  })
  .strict().superRefine((value, context) => {
    if (value.engine_id === 'vina') {
      if (!value.docking || value.model_id !== 'molecular-docking') {
        context.addIssue({code:'custom',message:'Docking output is missing its approved model and pose evidence'});
        return;
      }
      if (value.scalars.pose_count !== value.docking.poses.length ||
          value.scalars.best_score_kcal_mol !== value.docking.poses[0].score_kcal_mol ||
          value.units.best_score_kcal_mol !== 'kcal/mol')
        context.addIssue({code:'custom',message:'Docking score summary does not match ranked poses'});
    } else if (value.docking) context.addIssue({code:'custom',message:'Only the approved docking adapter may return docking poses'});
  });
export type ScienceOutput = z.infer<typeof scienceOutput>;
const engines = new Set([
  'numerics',
  'rdkit',
  'roadrunner',
  'tellurium',
  'copasi',
  'cobrapy',
  'physicell',
  'biosimulators',
  'vina',
]);
export async function boundedJson(
  response: Response,
  maxBytes = 4 * 1024 * 1024,
): Promise<unknown> {
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > maxBytes)
    throw new BadGatewayException('Upstream response exceeded the size budget');
  if (!response.body) throw new BadGatewayException('Upstream response was empty');
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes)
        throw new BadGatewayException('Upstream response exceeded the size budget');
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
@Injectable()
export class ScienceClient {
  constructor(@Inject(CONFIG) private readonly config: Config) {}
  private endpoint(engine: string) {
    if (!engines.has(engine)) throw new ServiceUnavailableException('Engine is not allowlisted');
    return `http://${engine}:8080`;
  }
  async execute(
    engine: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ScienceOutput> {
    const timeout = AbortSignal.timeout((engine === 'vina' ? 60000 : this.config.SCIENCE_TIMEOUT_MS) + 5000);
    const response = await fetch(`${this.endpoint(engine)}/v1/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.SCIENCE_TOKEN}`,
      },
      body: JSON.stringify(input),
      redirect: 'error',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const output = await boundedJson(response);
    if (!response.ok) {
      const code = (output as { error?: { code?: string } })?.error?.code;
      throw new Error(
        [
          'cancelled',
          'timed_out',
          'invalid_input',
          'output_limit',
          'engine_error',
          'busy',
        ].includes(code ?? '')
          ? code
          : 'engine_error',
      );
    }
    return scienceOutput.parse(output);
  }
  async cancel(engine: string, id: string) {
    const response = await fetch(`${this.endpoint(engine)}/v1/jobs/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.SCIENCE_TOKEN}` },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok && response.status !== 404) throw new Error('Engine cancellation failed');
  }
  async capability(engine: string) {
    try {
      const response = await fetch(`${this.endpoint(engine)}/health`, {
        signal: AbortSignal.timeout(1500),
        redirect: 'error',
      });
      return { available: response.ok, health: await boundedJson(response, 16384) };
    } catch {
      return { available: false, health: null };
    }
  }
}
