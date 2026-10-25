import type { RunRecord } from './runs';
import { api } from './api';
import { useSession } from './session';

/** Never put a newly switched account's response under an earlier owner's query key. */
export async function molecularApi<T>(owner: string | undefined, path: string, options: Parameters<typeof api>[1] = {}): Promise<T> {
  const assertOwner = () => { if (!owner || useSession.getState().user?.id !== owner) throw Error('Your account changed. Please try again from this account.'); };
  assertOwner();
  const controller = new AbortController(), opts = options ?? {};
  const abort = () => controller.abort();
  if (opts.signal?.aborted) abort();
  else opts.signal?.addEventListener('abort', abort, { once: true });
  const unsubscribe = useSession.subscribe(state => { if (state.user?.id !== owner) abort(); });
  try { const value = await api<T>(path, { ...opts, signal: controller.signal }); assertOwner(); if (controller.signal.aborted) throw new DOMException('The request was cancelled.', 'AbortError'); return value; }
  catch (error) { assertOwner(); throw error; }
  finally { unsubscribe(); opts.signal?.removeEventListener('abort', abort); }
}

export type Compound = {
  id: string; name: string; smiles: string; canonical_smiles: string; formula: string;
  notes: string; validation_run_id: string; created_at: string;
};
export type Collection = {
  id: string; name: string; notes: string; compound_count?: number; created_at: string;
  compounds?: Compound[];
};
export type ScreenMember = {
  run_id: string; compound_id: string; compound_name: string; canonical_smiles: string;
  target: 'trypsin' | 'streptavidin'; status: RunRecord['status'];
  best_score_kcal_mol: number | null; pose_count: number | null; error_code: string | null;
  experiment_id: string; experiment_version: string;
};
export type MolecularScreen = {
  id: string; name: string; collection_name: string; status: string; created_at: string;
  batch_id: string; members?: ScreenMember[];
  settings?: { targets: string[]; exhaustiveness: number; num_modes: number; seed: number };
};
export const proteinNames: Record<string, string> = { trypsin: 'Trypsin', streptavidin: 'Streptavidin' };
export function screenIsActive(screen?: MolecularScreen) {
  return !!screen?.members?.some(member => member.status === 'queued' || member.status === 'running');
}
export function screenReflectionKey(screenId: string, attempt?: string) {
  return `molecular-screen-${screenId}${attempt ? `-${attempt}` : ''}`;
}
export function screenCsv(screen: MolecularScreen) {
  const quote = (value: unknown) => { const raw = String(value ?? ''); const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"`; };
  const rows: unknown[][] = [['Compound', 'Molecule code', 'Protein', 'Status', 'Estimated score (kcal/mol)', 'Poses', 'Run ID', 'Seed']];
  for (const member of screen.members ?? []) rows.push([member.compound_name, member.canonical_smiles, proteinNames[member.target], member.status, member.best_score_kcal_mol, member.pose_count, member.run_id, screen.settings?.seed]);
  return rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
export function saveWorkspaceFile(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
