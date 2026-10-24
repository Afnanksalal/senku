import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CONFIG, Config } from '../config';
import { z } from 'zod';

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
  })
  .strict();
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
    const timeout = AbortSignal.timeout(this.config.SCIENCE_TIMEOUT_MS + 5000);
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
