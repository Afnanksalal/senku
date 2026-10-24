'use client';
import { localScalars, localUnits, validateParameters, type Parameters } from '@senku/experiment-schema';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { openDB } from 'idb';
import { api, type CatalogExperiment, type Usage } from './api';
import { useSession } from './session';
import { useEffect, useState } from 'react';

export type Series = { columns: string[]; units: string[]; data: number[][] };
export type Frame = { time_min: number; concentration?: number[][]; unit?: string; cells?: { id: number; position_um: number[]; volume_um3: number }[] };
export type RunResult = {
  scalars: Record<string, number>; units?: Record<string, string>; series?: Series[]; frames?: Frame[];
  docking?: unknown;
  molecule?: { canonical_smiles: string; formula: string; molblock?: string };
  diagnostics?: Record<string, unknown>; warnings?: string[]; engine_version?: string;
};
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
export type RunRecord = {
  id: string; origin: 'server' | 'device'; experiment_id: string; experiment_version: string;
  model_id: string; model_version: string; engine_id: string; engine_version?: string | null; adapter_version?: string;
  manifest_hash?: string; parameters: Parameters; seed: number; status: RunStatus; scientific_status: string;
  created_at: string; finished_at?: string | null; result?: RunResult | null; error_code?: string | null; cancellation_requested?: boolean;
};
type ServerRunSummary = { id: string; experiment_id: string; experiment_version: string; status: RunStatus; created_at: string };

export const terminal = (s: RunStatus) => s !== 'queued' && s !== 'running';

const db = () => openDB('senku', 1, { upgrade: (d) => d.createObjectStore('device-runs', { keyPath: 'id' }) });
async function deviceRuns(experimentId?: string): Promise<RunRecord[]> {
  if (typeof indexedDB === 'undefined') return [];
  const all = await (await db()).getAll('device-runs') as RunRecord[];
  return all.filter((r) => !experimentId || r.experiment_id === experimentId);
}

/** Same validator and kernel the server ships in @senku/experiment-schema, so device runs never use a lesson-only model. */
export async function runOnDevice(manifest: CatalogExperiment, input: Parameters, seed: number): Promise<RunRecord> {
  const base = {
    id: crypto.randomUUID(), origin: 'device' as const, experiment_id: manifest.id, experiment_version: manifest.version,
    model_id: manifest.model.id, model_version: manifest.model.version, engine_id: 'device-kernel', manifest_hash: manifest.content_hash,
    seed, scientific_status: manifest.model.scientific_status, created_at: new Date().toISOString(),
  };
  const parameters = validateParameters(manifest, input);
  let record: RunRecord;
  try {
    record = { ...base, parameters, status: 'completed', finished_at: new Date().toISOString(), result: { scalars: localScalars(manifest.id, parameters, seed), units: localUnits(manifest), warnings: manifest.model.limitations } };
  } catch {
    record = { ...base, parameters, status: 'failed', finished_at: new Date().toISOString(), error_code: 'device_kernel_unavailable' };
  }
  await (await db()).put('device-runs', record);
  return record;
}

export function useUsage() {
  const user = useSession((s) => s.user);
  return useQuery({ queryKey: ['usage', user?.id], queryFn: () => api<Usage>('/v1/me/usage', { auth: true }), enabled: !!user && user.role !== 'guest', staleTime: 30_000 });
}

/** Where a new run can execute, decided from the account, its compute admission and the manifest. */
export function useRunTarget(manifest?: CatalogExperiment) {
  const [online,setOnline]=useState(true);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  const user = useSession((s) => s.user);
  const usage = useUsage();
  const server = online && !!user && user.role !== 'guest' && !!usage.data?.member?.active;
  if (!manifest) return { target: null, reason: null } as const;
  // ponytail: the API gates this by id too; switch to a manifest flag if the backend adds one.
  if (manifest.id === 'pathway-playground') return { target: null, reason: 'pathway' } as const;
  if (server) return { target: 'server', reason: null } as const;
  if (manifest.local_capable) return { target: 'device', reason: null } as const;
  if (!online) return { target: null, reason: 'offline' } as const;
  return { target: null, reason: !user || user.role === 'guest' ? 'account' : 'invitation' } as const;
}

async function fetchRun(id: string): Promise<RunRecord> {
  const run = await api<Omit<RunRecord, 'origin'>>(`/v1/runs/${id}`, { auth: true });
  return { ...run, origin: 'server' };
}

export function useRun(id?: string, origin: RunRecord['origin'] = 'server') {
  return useQuery({
    queryKey: ['run', id], enabled: !!id,
    queryFn: async () => origin === 'server' ? fetchRun(id!) : (await deviceRuns()).find((r) => r.id === id) ?? null,
    refetchInterval: (q) => q.state.data && !terminal(q.state.data.status) ? 1000 : false,
  });
}

/** Every run of one experiment this learner can see, newest first. */
export function useExperimentRuns(experimentId: string) {
  const user = useSession((s) => s.user);
  const device = useQuery({ queryKey: ['device-runs', experimentId], queryFn: () => deviceRuns(experimentId) });
  const list = useQuery({
    queryKey: ['server-runs', user?.id], enabled: !!user && user.role !== 'guest', staleTime: 10_000,
    queryFn: () => api<ServerRunSummary[]>('/v1/runs?limit=100', { auth: true }),
  });
  const mine = (list.data ?? []).filter((r) => r.experiment_id === experimentId);
  const details = useQueries({
    queries: mine.map((r) => ({
      queryKey: ['run', r.id], queryFn: () => fetchRun(r.id),
      refetchInterval: (q: { state: { data?: RunRecord } }) => q.state.data && !terminal(q.state.data.status) ? 1000 : false,
    })),
  });
  const runs = [...(device.data ?? []), ...details.flatMap((d) => d.data ? [d.data] : [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { runs, loading: device.isLoading || list.isLoading || details.some((d) => d.isLoading), error: list.error ?? device.error };
}

/** Latest runs across all experiments, for resuming work. */
export function useRecentRuns(limit = 4) {
  const user = useSession((s) => s.user);
  const device = useQuery({ queryKey: ['device-runs', 'all'], queryFn: () => deviceRuns() });
  const server = useQuery({
    queryKey: ['server-runs', user?.id], enabled: !!user && user.role !== 'guest', staleTime: 10_000,
    queryFn: () => api<ServerRunSummary[]>('/v1/runs?limit=100', { auth: true }),
  });
  const runs = [
    ...(device.data ?? []).map((r) => ({ id: r.id, experiment_id: r.experiment_id, experiment_version: r.experiment_version, status: r.status, created_at: r.created_at, origin: 'device' as const })),
    ...(server.data ?? []).map((r) => ({ ...r, origin: 'server' as const })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  return { runs, loading: device.isLoading || server.isLoading };
}

export function useLaunchRun(manifest?: CatalogExperiment) {
  const qc = useQueryClient();
  const { target } = useRunTarget(manifest);
  return useMutation({
    mutationFn: async ({ parameters, seed }: { parameters: Parameters; seed: number }): Promise<RunRecord> => {
      if (!manifest || !target) throw new Error('This experiment can\u2019t run here yet.');
      if (target === 'device') return runOnDevice(manifest, parameters, seed);
      const created = await api<{ id: string }>('/v1/runs', {
        method: 'POST', auth: true, idempotencyKey: crypto.randomUUID(),
        body: { experiment_id: manifest.id, experiment_version: manifest.version, parameters, seed },
      });
      return fetchRun(created.id);
    },
    onSuccess: (run) => {
      qc.setQueryData(['run', run.id], run);
      void qc.invalidateQueries({ queryKey: run.origin === 'device' ? ['device-runs'] : ['server-runs'] });
    },
  });
}

export function useCancelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ status: RunStatus }>(`/v1/runs/${id}/cancel`, { method: 'POST', auth: true }),
    onSuccess: (_r, id) => qc.invalidateQueries({ queryKey: ['run', id] }),
  });
}
