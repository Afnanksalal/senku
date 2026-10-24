'use client';
import { requiresPathway } from '@senku/experiment-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AccountDialog } from '../../components/AccountDialog';
import { Glyph } from '../../components/Glyph';
import { defaults } from '../../components/Parameters';
import { api, ApiError } from '../../lib/api';
import { useCatalog } from '../../lib/catalog';
import { shortId, when } from '../../lib/format';
import { shareToken, type Room } from '../../lib/rooms';
import { useSession } from '../../lib/session';
import styles from './rooms.module.css';

export default function RoomsPage() {
  const user = useSession((s) => s.user);
  const admitted = !!user && user.role !== 'guest';
  const catalog = useCatalog();
  const qc = useQueryClient();
  const router = useRouter();
  const [experimentId, setExperimentId] = useState('');
  const [invitation, setInvitation] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [createKey, setCreateKey] = useState(() => crypto.randomUUID());
  const [joinError, setJoinError] = useState('');
  const experiments = catalog.data?.filter((e) => !requiresPathway(e)) ?? [];
  const experiment = experiments.find((e) => e.id === experimentId) ?? experiments.find((e) => e.id === 'cell-energy') ?? experiments[0];
  const list = useQuery({ queryKey: ['rooms', user?.id], queryFn: () => api<Room[]>('/v1/rooms', { auth: true }), enabled: admitted, staleTime: 10_000 });
  const create = useMutation({
    mutationFn: () => api<Room>('/v1/rooms', { method: 'POST', auth: true, idempotencyKey: createKey, body: { experiment_id: experiment!.id, experiment_version: experiment!.version, parameters: defaults(experiment!) } }),
    onSuccess: (room) => { void qc.invalidateQueries({ queryKey: ['rooms'] }); router.push(`/rooms/${room.id}`); },
  });
  const join = useMutation({
    mutationFn: (token: string) => api<{ room_id: string }>(`/v1/shared/${token}/join`, { method: 'POST', auth: true }),
    onSuccess: (room) => { void qc.invalidateQueries({ queryKey: ['rooms'] }); router.push(`/rooms/${room.room_id}`); },
  });
  return <div className="page stack loose">
    <header className={styles.intro}><h1>Make discoveries together</h1><p className="muted">Share the same model, adjust a common set of controls, and inspect the same experiment result. Private rooms keep your group focused.</p></header>
    {!admitted && <div className="notice"><Glyph name="person" /><div className="stack snug"><p>Sign in to create a room or join another learner. Only lab-server runs need a compute invitation.</p><div><button className="btn small" onClick={() => setAccountOpen(true)}>Sign in or create account</button></div></div></div>}
    <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    <div className={styles.columns}>
      <section className="glass panel stack" aria-labelledby="new-room"><h2 id="new-room" style={{ fontSize: '1.3rem' }}>Start a shared lab</h2><form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (experiment && admitted) create.mutate(); }}>
        <label className="field"><span>Experiment</span><select className="input" value={experiment?.id ?? ''} onChange={(e) => { setExperimentId(e.target.value); setCreateKey(crypto.randomUUID()); create.reset(); }} disabled={!experiments.length || create.isPending}>{experiments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {experiment && <p className="muted">{experiment.description}</p>}
        <p className="faint">A room starts at the model defaults. Editors can change the shared settings. Runs use the allowance of the learner who starts them.</p>
        {(create.error || catalog.error) && <p role="alert" className="notice alert">{create.error instanceof ApiError ? create.error.message : catalog.error ? 'Could not load experiments. Refresh and try again.' : 'Could not create this room.'}</p>}
        <div><button className="btn" disabled={!admitted || !experiment || create.isPending}>{create.isPending ? 'Creating room' : 'Create room'}</button></div>
      </form></section>
      <section className="glass panel stack" aria-labelledby="join-room"><h2 id="join-room" style={{ fontSize: '1.3rem' }}>Have a room link?</h2><form className={styles.form} onSubmit={(e) => { e.preventDefault(); const token = shareToken(invitation); if (!token) { setJoinError('Paste a complete Senku shared link or its 43-character code.'); return; } setJoinError(''); join.mutate(token); }}>
        <label className="field"><span>Private room link</span><input className="input" value={invitation} onChange={(e) => setInvitation(e.target.value)} placeholder="Paste a link from your group" autoComplete="off" required /></label>
        {(joinError || join.error) && <p role="alert" className="notice alert">{joinError || (join.error instanceof ApiError ? join.error.message : 'Could not join this room.')}</p>}
        <div><button className="btn quiet" disabled={!admitted || !invitation.trim() || join.isPending}>{join.isPending ? 'Joining room' : 'Join room'}</button></div>
      </form></section>
    </div>
    <section className="glass panel stack" aria-labelledby="your-rooms"><div className="spread"><h2 id="your-rooms" style={{ fontSize: '1.3rem' }}>Your rooms</h2>{admitted && <button className="btn ghost small" onClick={() => void list.refetch()}>Refresh</button>}</div>
      {!admitted ? <p className="muted">Your joined rooms appear here after you sign in.</p> : list.isLoading ? <p className="faint">Loading your shared labs</p> : list.error ? <p role="alert" className="notice alert">{list.error instanceof ApiError ? list.error.message : 'Could not load your rooms.'}</p> : !list.data?.length ? <p className="muted">No rooms yet. Start one above or join a link from your group.</p> : <ul className={styles.roomList}>{list.data.map((room) => <li className="solid" key={room.id}><div><strong>{catalog.data?.find((e) => e.id === room.experiment_id)?.name ?? room.experiment_id}</strong><p className="faint">Room {shortId(room.id)}, {room.role}{room.created_at ? `, ${when(room.created_at)}` : ''}</p></div><Link className="btn quiet small" href={`/rooms/${room.id}`}>Open room</Link></li>)}</ul>}
    </section>
  </div>;
}
