import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(String(fallback) as 'true' | 'false')
    .transform((v) => v === 'true');
const integer = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: integer(3001, 1, 65535),
  DATABASE_URL: z.string().url(),
  DB_SCHEMA: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,62}$/)
    .default('public'),
  DB_POOL_SIZE: integer(10, 1, 50),
  AUTO_MIGRATE: bool(false),
  REDIS_URL: z.string().url(),
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-zA-Z0-9:_-]{1,100}$/)
    .default('senku'),
  AUTH_MODE: z.literal('local').default('local'),
  ALLOW_LOCAL_REGISTRATION: bool(true),
  ALLOW_GUESTS: bool(true),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  TRUST_PROXY: bool(false),
  RATE_LIMIT_PER_MINUTE: integer(120, 10, 10000),
  AUTH_RATE_LIMIT_PER_MINUTE: integer(10, 1, 100),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(16),
  S3_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
    .default('senku'),
  S3_REGION: z.string().default('us-east-1'),
  S3_CREATE_BUCKET: bool(false),
  SCIENCE_TOKEN: z.string().min(32),
  OFFLINE_SIGNING_KEY: z.string().min(32),
  SCIENCE_TIMEOUT_MS: integer(30000, 1000, 120000),
  SCIENCE_CONCURRENCY: integer(2, 1, 8),
  INVESTIGATION_CONCURRENCY: integer(1, 1, 4),
  GLOBAL_DAILY_UNITS: integer(1000, 1, 1000000),
  GOOGLE_CLOUD_PROJECT: z.string().default(''),
  GOOGLE_CLOUD_LOCATION: z.string().default(''),
  GEMINI_MODEL: z.string().default(''),
  GOOGLE_GENAI_USE_VERTEXAI: bool(true),
  ENABLE_GEMINI: bool(false),
  ENABLE_SOURCE_RETRIEVAL: bool(true),
  API_DOCS: bool(true),
  RETENTION_DAYS: integer(90, 7, 3650),
});
export type Config = z.infer<typeof envSchema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Invalid configuration keys: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  const c = parsed.data;
  if (c.NODE_ENV === 'production' && (c.AUTO_MIGRATE || c.S3_CREATE_BUCKET))
    throw new Error(
      'Production migrations and bucket creation must run as separate deployment operations',
    );
  if (
    c.NODE_ENV === 'production' &&
    /REPLACE|example|changeme/i.test(
      c.SCIENCE_TOKEN + c.OFFLINE_SIGNING_KEY + c.S3_SECRET_ACCESS_KEY,
    )
  )
    throw new Error('Production secrets must be provisioned');
  if (c.NODE_ENV === 'production' && c.TRUST_PROXY && !c.CORS_ORIGINS)
    throw new Error('Production proxy requires explicit origins');
  if (c.ENABLE_GEMINI && (!c.GOOGLE_CLOUD_PROJECT || !c.GOOGLE_CLOUD_LOCATION || !c.GEMINI_MODEL))
    throw new Error('Gemini requires project, location and explicit model');
  const origins = c.CORS_ORIGINS.split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!origins.length) throw new Error('At least one exact CORS origin is required');
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol))
      throw new Error('CORS origins must be exact HTTP origins');
    if (c.NODE_ENV === 'production' && url.protocol !== 'https:')
      throw new Error('Production CORS origins require HTTPS');
  }
  return c;
}
export const CONFIG = Symbol('CONFIG');
