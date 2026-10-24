'use client';
import { useQuery } from '@tanstack/react-query';
import { api, type CatalogExperiment, type Lesson, type LessonSummary, type Subject } from './api';

const semver = (v: string) => v.split('.').map(Number);
const newer = (a: string, b: string) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

async function allExperiments(): Promise<CatalogExperiment[]> {
  const items: CatalogExperiment[] = [];
  let after = '';
  do {
    const page = await api<{ items: CatalogExperiment[]; next_cursor: string | null }>(`/v1/experiments?limit=100&after=${encodeURIComponent(after)}`);
    items.push(...page.items);
    after = page.next_cursor ?? '';
  } while (after);
  const latest = new Map<string, CatalogExperiment>();
  for (const e of items) { const seen = latest.get(e.id); if (!seen || newer(e.version, seen.version)) latest.set(e.id, e); }
  return [...latest.values()];
}

export const useSubjects = () => useQuery({ queryKey: ['subjects'], queryFn: () => api<Subject[]>('/v1/subjects'), staleTime: 300_000 });
export const useCatalog = () => useQuery({ queryKey: ['experiments'], queryFn: allExperiments, staleTime: 300_000 });
export const useLessons = () => useQuery({ queryKey: ['lessons'], queryFn: () => api<LessonSummary[]>('/v1/lessons'), staleTime: 300_000 });
export const useLesson = (id: string) => useQuery({ queryKey: ['lesson', id], queryFn: () => api<Lesson>(`/v1/lessons/${id}`), staleTime: 300_000 });
export function useExperiment(id: string, version?: string) {
  const catalog = useCatalog();
  const v = version ?? catalog.data?.find((e) => e.id === id)?.version;
  const exact = useQuery({
    queryKey: ['experiment', id, v], enabled: !!v, staleTime: Infinity,
    queryFn: () => api<CatalogExperiment>(`/v1/experiments/${id}/versions/${v}`),
  });
  const notListed = !version && catalog.isSuccess && !v;
  return { data: exact.data, isLoading: (!version && catalog.isLoading) || exact.isLoading, error: catalog.error ?? exact.error, notFound: notListed, refetch: () => { void catalog.refetch(); void exact.refetch(); } };
}
