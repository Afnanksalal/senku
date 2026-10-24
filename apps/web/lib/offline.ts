import { openDB, type DBSchema } from 'idb';
import { experimentSchema, type Experiment, type Parameters } from '@senku/experiment-schema';
import { API_URL, api, ApiError, type Lesson } from './api';
import { useSession, type User } from './session';

export type OfflineAttempt = {
  event_id: string; lesson_id: string; lesson_version: string;
  prediction: 'increase' | 'decrease' | 'unchanged'; answer_index: number; reflection: string;
  local: { parameters: Parameters; seed: number };
};
export type SignedOfflinePack = { payload: { schema_version: string; lesson: Lesson; experiment: { manifest: Experiment; content_hash: string }; issued_at: string; expires_at: string }; signature: string };
export type SavedOfflinePack = { id: string; pack: SignedOfflinePack; saved_at: string; assets_ready: boolean; preparation_error?: string };
export type OfflineReceipt = { event_id: string; xp_awarded: number; completed: boolean; assessment_feedback: string };
export type QueuedOfflineAttempt = { event_id: string; owner_id: string; attempt: OfflineAttempt; created_at: string; state: 'pending' | 'blocked' | 'synced'; error?: string; receipt?: OfflineReceipt };
interface OfflineDB extends DBSchema {
  packs: { key: string; value: SavedOfflinePack };
  events: { key: string; value: QueuedOfflineAttempt; indexes: { owner: string } };
}
const database = () => openDB<OfflineDB>('senku-offline', 1, { upgrade(db) { db.createObjectStore('packs', { keyPath: 'id' }); const events = db.createObjectStore('events', { keyPath: 'event_id' }); events.createIndex('owner', 'owner_id'); } });
const changed = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('senku:offline-change')); };
export const packExpired = (pack: SignedOfflinePack) => !Number.isFinite(Date.parse(pack.payload.expires_at)) || Date.parse(pack.payload.expires_at) <= Date.now();
export async function listOfflinePacks() { return (await (await database()).getAll('packs')).sort((a, b) => b.saved_at.localeCompare(a.saved_at)); }
export async function getOfflinePack(lessonId: string) { return (await database()).get('packs', lessonId); }
export async function listOfflineAttempts(ownerId?: string) { if (!ownerId) return []; return (await (await database()).getAllFromIndex('events', 'owner', ownerId)).sort((a, b) => a.created_at.localeCompare(b.created_at)); }

async function prepareAssets(lessonId: string, experimentId: string, version: string) {
  if (!('serviceWorker' in navigator)) throw new Error('This browser does not support offline application storage.');
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const ready = await navigator.serviceWorker.ready;
  const worker = ready.active ?? registration.active;
  if (!worker) throw new Error('The offline worker could not start. Try saving again.');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('Offline preparation took too long. Try saving again.')); }, 60000);
    channel.port1.onmessage = (e: MessageEvent<{ ok: boolean; error?: string }>) => { clearTimeout(timeout); channel.port1.close(); if (e.data.ok) resolve(); else reject(new Error(e.data.error ?? 'Some lesson assets could not be saved.')); };
    worker.postMessage({ type: 'CACHE_LESSON', lessonId, experimentId, version }, [channel.port2]);
  });
}
export async function saveOfflinePack(lessonId: string): Promise<SavedOfflinePack> {
  if (typeof navigator === 'undefined' || !navigator.onLine) throw new Error('Connect to the lab server before saving a lesson.');
  const pack = await api<SignedOfflinePack>(`/v1/offline/packs/${encodeURIComponent(lessonId)}`);
  const manifest = experimentSchema.parse(pack.payload?.experiment?.manifest);
  if (!manifest.local_capable || pack.payload.lesson.id !== lessonId || pack.payload.schema_version !== '1.0.0' || packExpired(pack) || typeof pack.signature !== 'string' || pack.signature.length < 40)
    throw new Error('This lesson pack is unavailable or has an unsupported version.');
  const record: SavedOfflinePack = { id: lessonId, pack, saved_at: new Date().toISOString(), assets_ready: false };
  const db = await database();
  await db.put('packs', record);
  try { await prepareAssets(lessonId, manifest.id, manifest.version); record.assets_ready = true; }
  catch (e) { record.preparation_error = e instanceof Error ? e.message : 'The lesson assets could not be prepared.'; }
  await db.put('packs', record); changed();
  if (!record.assets_ready) throw new Error(record.preparation_error);
  return record;
}
export async function removeOfflinePack(lessonId: string) { await (await database()).delete('packs', lessonId); changed(); }

export async function enqueueAttempt(attempt: OfflineAttempt): Promise<{ queued: true; event_id: string }> {
  const user = useSession.getState().user;
  if (!user || user.role === 'guest') throw new Error('Sign in before going offline to queue account progress.');
  const saved = await getOfflinePack(attempt.lesson_id);
  if (!saved || !saved.assets_ready || packExpired(saved.pack) || saved.pack.payload.lesson.version !== attempt.lesson_version)
    throw new Error('Save a current offline pack for this lesson before queuing an attempt.');
  if (!attempt.local || !attempt.event_id || attempt.reflection.trim().length < 20 || attempt.answer_index < 0 || attempt.answer_index > 2)
    throw new Error('Complete the local experiment and reflection before saving the attempt.');
  const db = await database();
  const prior = await db.get('events', attempt.event_id);
  if (prior) { if (prior.owner_id !== user.id || JSON.stringify(prior.attempt) !== JSON.stringify(attempt)) throw new Error('This event ID already belongs to different evidence.'); return { queued: true, event_id: attempt.event_id }; }
  const pending = (await db.getAllFromIndex('events', 'owner', user.id)).filter((e) => e.state !== 'synced');
  if (pending.length >= 200) throw new Error('Sync your pending attempts before adding more.');
  await db.put('events', { event_id: attempt.event_id, owner_id: user.id, attempt, created_at: new Date().toISOString(), state: 'pending' }); changed();
  return { queued: true, event_id: attempt.event_id };
}

let syncing: Promise<{ synced: number; blocked: number; pending: number }> | null = null;
export function syncPending() {
  syncing ??= synchronize().finally(() => { syncing = null; });
  return syncing;
}
async function synchronize() {
  const initial = useSession.getState().user;
  if (!initial || initial.role === 'guest') throw new Error('Sign in to the account that saved these attempts.');
  if (!navigator.onLine) throw new Error('You are offline. Attempts remain saved on this device.');
  // Use the shared API refresh lock before capturing an owner-bound token in memory.
  const verified = await api<User>('/v1/me', { auth: true });
  const current = useSession.getState();
  if (verified.id !== initial.id || current.user?.id !== initial.id || !current.tokens) throw new Error('The account changed. No pending attempts were submitted.');
  const bearer = current.tokens.access_token;
  const records = await listOfflineAttempts(initial.id);
  const db = await database();
  let synced = 0, blocked = 0;
  for (const record of records.filter((r) => r.state !== 'synced').slice(0, 50)) {
    if (useSession.getState().user?.id !== initial.id) break;
    const saved = await getOfflinePack(record.attempt.lesson_id);
    if (!saved || packExpired(saved.pack)) { await db.put('events', { ...record, state: 'blocked', error: 'Refresh this lesson pack online before syncing.' }); blocked++; continue; }
    try {
      const response = await fetch(`${API_URL}/v1/offline/sync`, { method: 'POST', cache: 'no-store', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ pack: saved.pack, events: [record.attempt] }) });
      if (response.status === 401) throw new Error('Your sign-in expired. Sign in again, then sync.');
      const body = await response.json() as { committed?: boolean; results?: OfflineReceipt[]; error?: { message?: string } };
      if (!response.ok || !body.committed || !body.results?.[0]) {
        await db.put('events', { ...record, state: 'blocked', error: body.error?.message ?? 'The server could not accept this attempt.' }); blocked++; continue;
      }
      await db.put('events', { ...record, state: 'synced', error: undefined, receipt: body.results[0] }); synced++;
    } catch (error) { changed(); throw error instanceof ApiError ? error : new Error(error instanceof Error ? error.message : 'Connection lost. Pending attempts are still saved.'); }
  }
  changed();
  const pending = (await listOfflineAttempts(initial.id)).filter((e) => e.state !== 'synced').length;
  return { synced, blocked, pending };
}
