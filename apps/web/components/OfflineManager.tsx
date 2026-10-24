'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCatalog, useLessons } from '../lib/catalog';
import { useSession } from '../lib/session';
import { getOfflinePack, listOfflineAttempts, listOfflinePacks, packExpired, removeOfflinePack, saveOfflinePack, syncPending } from '../lib/offline';
import { AccountDialog } from './AccountDialog';
import { when } from '../lib/format';

export function OfflineSaveButton({ lessonId }: { lessonId: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const qc = useQueryClient();
  const pack = useQuery({ queryKey: ['offline-pack', lessonId], queryFn: () => getOfflinePack(lessonId) });
  const ready = pack.data?.assets_ready && !packExpired(pack.data.pack);
  const save = async () => { setBusy(true); setError(''); try { await saveOfflinePack(lessonId); await qc.invalidateQueries({ queryKey: ['offline-pack'] }); await qc.invalidateQueries({ queryKey: ['offline-packs'] }); } catch (e) { setError(e instanceof Error ? e.message : 'The lesson could not be saved.'); } finally { setBusy(false); } };
  return <div className="stack snug"><div><button className="btn quiet small" disabled={busy} onClick={() => void save()}>{busy ? 'Preparing offline lesson' : ready ? 'Refresh offline lesson' : 'Save for offline'}</button></div>{ready && <p className="faint">Ready on this device until {when(pack.data!.pack.payload.expires_at)}.</p>}{error && <p className="notice alert" role="alert">{error}</p>}</div>;
}

export default function OfflineManager() {
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  const catalog = useCatalog(), lessons = useLessons();
  const [online, setOnline] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [accountOpen, setAccountOpen] = useState(false);
  const packs = useQuery({ queryKey: ['offline-packs'], queryFn: listOfflinePacks });
  const events = useQuery({ queryKey: ['offline-attempts', user?.id], queryFn: () => listOfflineAttempts(user?.id) });
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: ['offline-packs'] }); void qc.invalidateQueries({ queryKey: ['offline-attempts'] }); };
    const connection = () => setOnline(navigator.onLine);
    connection(); window.addEventListener('online', connection); window.addEventListener('offline', connection); window.addEventListener('senku:offline-change', refresh);
    return () => { window.removeEventListener('online', connection); window.removeEventListener('offline', connection); window.removeEventListener('senku:offline-change', refresh); };
  }, [qc]);
  const pending = events.data?.filter((e) => e.state !== 'synced') ?? [];
  const receipts = events.data?.filter((e) => e.state === 'synced') ?? [];
  const localLessons = (lessons.data ?? []).filter((l) => catalog.data?.some((e) => e.id === l.experiment_id && e.local_capable));
  const sync = async () => { setBusy(true); setError(''); setNotice(''); try { const result = await syncPending(); setNotice(`${result.synced} attempt${result.synced === 1 ? '' : 's'} accepted by the server. ${result.pending} still pending.`); void qc.invalidateQueries({ queryKey: ['progress'] }); } catch (e) { setError(e instanceof Error ? e.message : 'Synchronization did not finish.'); } finally { setBusy(false); } };
  return <div className="stack loose">
    <section className="glass panel stack"><div className="spread"><h2>Ready when the connection isn’t</h2><span className="chip" role="status">{online ? 'Online' : 'Offline'}</span></div><p className="muted">Save a device-capable lesson while connected. Senku stores its signed model pack, lesson page, and required application assets. Cloud simulations, AI and research still need a connection.</p><p className="faint">The server checks the pack signature and recomputes your local evidence when you sync. Pending work has no cloud XP until that succeeds.</p></section>
    <section className="glass panel stack loose" aria-labelledby="saved-offline"><h2 id="saved-offline">Saved on this device</h2>{packs.isLoading ? <p role="status">Reading offline storage...</p> : packs.error ? <p className="notice alert">This browser could not open local storage.</p> : !packs.data?.length ? <p className="muted">No lessons saved yet. Prepare one below before disconnecting.</p> : <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{packs.data.map((p) => <li key={p.id} className="solid panel stack snug"><div className="spread"><h3>{p.pack.payload.lesson.definition.name}</h3><span className="chip">{packExpired(p.pack) ? 'Expired' : p.assets_ready ? 'Ready offline' : 'Preparation incomplete'}</span></div><p className="faint">Saved {when(p.saved_at)}. Pack expires {when(p.pack.payload.expires_at)}.</p>{p.preparation_error && <p className="notice warn">{p.preparation_error}</p>}<div className="row">{p.assets_ready && !packExpired(p.pack) && <Link className="btn small" href={`/learn/${p.id}`} prefetch={false}>Open saved lesson</Link>}<button className="btn ghost small" onClick={() => void removeOfflinePack(p.id)}>Remove pack</button></div><OfflineSaveButton lessonId={p.id} /></li>)}</ul>}</section>
    <section className="glass panel stack loose" aria-labelledby="offline-progress"><h2 id="offline-progress">Progress waiting to sync</h2>{!user || user.role === 'guest' ? <div className="stack"><p>Sign in before going offline to bind queued progress to your account. Guest experiments can run locally, but don’t earn cloud XP.</p><div><button className="btn quiet" onClick={() => setAccountOpen(true)}>Sign in</button></div></div> : <><p>{pending.length} pending attempt{pending.length === 1 ? '' : 's'} for {user.display_name}. Attempts belonging to another account will never be submitted here.</p><div><button className="btn" disabled={busy || !online || !pending.length} onClick={() => void sync()}>{busy ? 'Syncing saved evidence' : 'Sync pending attempts'}</button></div>{error && <p className="notice alert" role="alert">{error}</p>}{notice && <p className="notice ok" role="status">{notice}</p>}{pending.map((e) => <div key={e.event_id} className="solid panel stack snug"><strong>{e.attempt.lesson_id.replaceAll('-', ' ')}</strong><span className="faint">Saved {when(e.created_at)}. {e.state === 'blocked' ? 'Needs attention' : 'Waiting for server acceptance'}.</span>{e.error && <p className="notice warn">{e.error}</p>}</div>)}{receipts.length > 0 && <details className="more"><summary>Accepted server receipts ({receipts.length})</summary><ul className="list">{receipts.map((e) => <li key={e.event_id}>{e.attempt.lesson_id.replaceAll('-', ' ')}: {e.receipt?.xp_awarded ?? 0} XP awarded. {e.receipt?.assessment_feedback}</li>)}</ul></details>}</>}
    </section>
    <section className="glass panel stack loose" aria-labelledby="prepare-offline"><h2 id="prepare-offline">Prepare a lesson</h2>{catalog.error || lessons.error ? <p className="muted">Connect to load the current lesson catalog. Previously saved lessons remain above.</p> : localLessons.map((l) => <div key={l.id} className="solid panel stack snug"><h3>{l.name}</h3><OfflineSaveButton lessonId={l.id} /></div>)}</section>
    <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
  </div>;
}
