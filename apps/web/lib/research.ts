import type { Parameters } from '@senku/experiment-schema';

export type Paper = { id: string; title: string; authors: string | null; year: string | null; doi: string | null; url: string; evidence_type: string };
export type PaperPage = { items: Paper[]; total: number; next_cursor: string | null; retrieved_at: string };
export type Structure = { id: string; pdb_id: string; title: string; methods: string[]; resolution_angstrom: number[]; url: string };
export type StructureSearch = { items: { pdb_id: string; score: number; url: string }[]; total: number };
export type InvestigationSummary = { id: string; question: string; status: string; created_at: string; finished_at: string | null };
export type InvestigationFact = { run_id: string; status: string; experiment_id: string; experiment_version: string; parameters: Parameters; seed: number; scalars: Record<string, number> | null; units: Record<string, string> | null; scientific_status: string; error_code: string | null };
export type InvestigationReport = { question: string; facts: InvestigationFact[]; citations: Paper[]; critique: { empirical_validation: boolean; all_runs_completed: boolean; limitations: string[] }; narrative: { mode: string; text?: string; explanation?: string; model?: string; requires_review?: boolean } };
export type Investigation = InvestigationSummary & { error_code?: string | null; cancel_requested_at: string | null; result: InvestigationReport | null; request: { question: string; use_ai: boolean; literature_query?: string; runs: { experiment_id: string; parameters: Parameters }[] }; tasks: { id: string; role: string; status: string; dependencies: string[]; output: Record<string, unknown> | null; started_at: string | null; finished_at: string | null }[] };
export const investigationDone = (status: string) => ['completed', 'failed', 'cancelled'].includes(status);

export function safeSourceUrl(url: string) {
  try { const u = new URL(url); return u.protocol === 'https:' ? u.toString() : undefined; } catch { return undefined; }
}

export function exportReport(report: InvestigationReport, id: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: `senku-investigation-${id}.json` });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
