import type { Experiment } from '@senku/experiment-schema';
import { useSession, type AuthResponse } from './session';

// Same-origin by default so another device never sends requests to its own localhost.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '/backend').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly requestId?: string) { super(message); }
}

type Options = { method?: string; body?: unknown; auth?: boolean; idempotencyKey?: string; signal?: AbortSignal; raw?: boolean };

async function send(path: string, opts: Options, bearer?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  try {
    return await fetch(`${API_URL}${path}`, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: opts.signal, cache: 'no-store' });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'network_unavailable', 'Senku can\u2019t reach the lab server right now.');
  }
}

async function failure(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null) as { error?: { code?: string; message?: string; request_id?: string } } | null;
  return new ApiError(res.status, body?.error?.code ?? 'request_failed', body?.error?.message ?? `Request failed (${res.status})`, body?.error?.request_id);
}

let pending: Promise<string> | null = null;
/** One shared promise so parallel queries never mint two guest sessions or rotate a refresh token twice. */
function token(forceRefresh = false): Promise<string> {
  const { tokens } = useSession.getState();
  if (tokens && !forceRefresh && tokens.expires_at > Date.now() + 30_000) return Promise.resolve(tokens.access_token);
  pending ??= (async () => {
    const current = useSession.getState().tokens;
    if (current) {
      const res = await send('/v1/auth/refresh', { method: 'POST', body: { refresh_token: current.refresh_token } });
      if (res.ok) return useSession.getState().signIn(await res.json() as AuthResponse);
      useSession.getState().signOut();
    }
    const res = await send('/v1/auth/guest', { method: 'POST' });
    if (!res.ok) throw await failure(res);
    return useSession.getState().signIn(await res.json() as AuthResponse);
  })().finally(() => { pending = null; });
  return pending;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  let res = await send(path, opts, opts.auth ? await token() : undefined);
  if (res.status === 401 && opts.auth) res = await send(path, opts, await token(true));
  if (!res.ok) throw await failure(res);
  if (opts.raw) return res as T;
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function download(path: string, filename: string) {
  const res = await api<Response>(path, { auth: true, raw: true });
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export type CatalogExperiment = Experiment & { content_hash: string };
export type Subject = { id: string; name: string; description: string };
export type LessonSummary = { id: string; version: string; subject_id: string; experiment_id: string; experiment_version: string; name: string };
export type LessonDefinition = {
  id: string; name: string; objective: string; concept: string; steps: string[]; xp: number;
  prediction: { question: string; choices: string[] }; assessment: { question: string; choices: string[] };
  experiment_id: string; experiment_version: string;
};
export type Lesson = Omit<LessonSummary, 'name'> & { definition: LessonDefinition };
export type Usage = { member: { id: string; name: string; daily_units: number; member_daily_units: number; active: boolean } | null; usage: { purpose: string; state: string; units: number }[]; day_basis: string };
