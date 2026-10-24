'use client';
import type { Parameters } from '@senku/experiment-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { AccountDialog } from '../../../components/AccountDialog';
import { CompanionChat } from '../../../components/CompanionChat';
import { Glyph } from '../../../components/Glyph';
import { ParameterControls } from '../../../components/Parameters';
import { RunChart } from '../../../components/RunChart';
import { MolecularResult, RunResult } from '../../../components/RunResult';
import { api, API_URL, ApiError } from '../../../lib/api';
import { useExperiment } from '../../../lib/catalog';
import { shortId, when } from '../../../lib/format';
import { useCancelRun, useRun, useUsage } from '../../../lib/runs';
import type { Room, RoomEvent, RoomMember, Share } from '../../../lib/rooms';
import { useSession } from '../../../lib/session';
import styles from '../rooms.module.css';

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RoomWorkspace id={id} />;
}

function RoomWorkspace({ id }: { id: string }) {
  const user = useSession((s) => s.user);
  const accessToken = useSession((s) => s.tokens?.access_token);
  const member = !!user && user.role !== 'guest';
  const router = useRouter();
  const qc = useQueryClient();
  const usage = useUsage();
  const [connection, setConnection] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [accountOpen, setAccountOpen] = useState(false);
  const [draft, setDraft] = useState<Parameters>({});
  const [draftVersion, setDraftVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer');
  const [createdLink, setCreatedLink] = useState<Share>();
  const [copied, setCopied] = useState(false);
  const after = useRef('0');
  const runAdmission = useRef<{ fingerprint: string; key: string } | null>(null);
  const key = ['room', id, user?.id];
  const roomQuery = useQuery({ queryKey: key, queryFn: () => api<Room>(`/v1/rooms/${id}`, { auth: true }), enabled: member, refetchInterval: 5000 });
  const room = roomQuery.data;
  const experiment = useExperiment(room?.experiment_id ?? '', room?.experiment_version);
  const people = useQuery({ queryKey: ['room-members', id, user?.id], queryFn: () => api<RoomMember[]>(`/v1/rooms/${id}/members`, { auth: true }), enabled: !!room, refetchInterval: 10_000 });
  const links = useQuery({ queryKey: ['shares', user?.id], queryFn: () => api<Share[]>('/v1/shares', { auth: true }), enabled: room?.role === 'owner', staleTime: 10_000 });
  const run = useRun(room?.last_run_id ?? undefined).data;
  const cancel = useCancelRun();
  const canEdit = !!room && (room.role === 'owner' || room.role === 'editor');
  const conflict = dirty && room?.version !== draftVersion;
  useEffect(() => { if (room && !dirty) { setDraft(room.parameters); setDraftVersion(room.version); } }, [room?.version, room?.id, dirty]);
  useEffect(() => { after.current = '0'; }, [id, user?.id]);
  useEffect(() => {
    if (!member || !accessToken) return;
    const origin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;
    const socket = io(`${origin}/collaboration`, {
      path: '/socket.io', transports: ['websocket'], timeout: 5000,
      auth: (callback) => callback({ token: useSession.getState().tokens?.access_token, room_id: id, after: after.current }),
      reconnection: true, reconnectionDelay: 1500, reconnectionDelayMax: 10_000,
    });
    setConnection('connecting');
    socket.on('connect', () => setConnection('connecting'));
    socket.on('disconnect', () => setConnection('polling'));
    socket.on('connect_error', () => setConnection('polling'));
    socket.on('access.error', () => { setConnection('polling'); void qc.invalidateQueries({ queryKey: key }); });
    socket.on('room.snapshot', (snapshot: Room) => {
      if (snapshot.id !== id || !Number.isInteger(snapshot.version)) return;
      setConnection('live');
      qc.setQueryData<Room>(key, (current) => !current || snapshot.version >= current.version ? snapshot : current);
    });
    socket.on('room.event', (event: RoomEvent) => {
      if (!/^\d+$/.test(event.sequence) || BigInt(event.sequence) <= BigInt(after.current)) return;
      after.current = event.sequence;
      if (typeof event.payload.version === 'number' && event.payload.parameters) {
        qc.setQueryData<Room>(key, (current) => current && event.payload.version! > current.version
          ? { ...current, parameters: event.payload.parameters!, version: event.payload.version! } : current);
      } else { void qc.invalidateQueries({ queryKey: ['room-members', id] }); void qc.invalidateQueries({ queryKey: key }); }
    });
    return () => { socket.removeAllListeners(); socket.disconnect(); };
    // Scope and account changes create a new authorized connection; query invalidations use this scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, accessToken, member, qc]);
  const save = useMutation({
    mutationFn: () => api<Room>(`/v1/rooms/${id}`, { method: 'PATCH', auth: true, body: { expected_version: draftVersion, parameters: draft } }),
    onSuccess: (updated) => { qc.setQueryData<Room>(key, (current) => ({ ...updated, role: current?.role ?? 'viewer' })); setDirty(false); },
    onError: () => { void roomQuery.refetch(); },
  });
  const launch = useMutation({
    mutationFn: async () => {
      if (!room) throw new Error('Room unavailable');
      const body = { experiment_id: room.experiment_id, experiment_version: room.experiment_version, parameters: room.parameters, room_id: room.id, room_version: room.version, seed: 0 };
      const fingerprint = JSON.stringify(body);
      if (runAdmission.current?.fingerprint !== fingerprint) runAdmission.current = { fingerprint, key: crypto.randomUUID() };
      return api<{ id: string }>('/v1/runs', { method: 'POST', auth: true, idempotencyKey: runAdmission.current.key, body });
    },
    onSuccess: (created) => { qc.setQueryData<Room>(key, (current) => current ? { ...current, last_run_id: created.id } : current); runAdmission.current = null; void qc.invalidateQueries({ queryKey: ['usage'] }); },
    onError: () => { void roomQuery.refetch(); },
  });
  const share = useMutation({
    mutationFn: () => api<Share>('/v1/shares', { method: 'POST', auth: true, body: { resource_type: 'room', resource_id: id, role: shareRole, expires_in_hours: 24 } }),
    onSuccess: (created) => { setCreatedLink(created); setCopied(false); void qc.invalidateQueries({ queryKey: ['shares'] }); },
  });
  const revoke = useMutation({ mutationFn: (linkId: string) => api(`/v1/shares/${linkId}`, { method: 'DELETE', auth: true }), onSuccess: (_, linkId) => { if (createdLink?.id === linkId) setCreatedLink(undefined); void qc.invalidateQueries({ queryKey: ['shares'] }); } });
  const remove = useMutation({ mutationFn: (person: string) => api(`/v1/rooms/${id}/members/${person}`, { method: 'DELETE', auth: true }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['room-members', id] }); } });
  const close = useMutation({ mutationFn: () => api(`/v1/rooms/${id}`, { method: 'DELETE', auth: true }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['rooms'] }); router.push('/rooms'); } });
  const errorText = (error: unknown) => error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Please try again.';
  const linkUrl = createdLink?.token && typeof window !== 'undefined' ? `${window.location.origin}/shared/${createdLink.token}` : '';
  if (!member) return <div className="page stack"><h1>Open your shared lab</h1><p className="muted">Sign in with the account that joined this room.</p><div><button className="btn" onClick={() => setAccountOpen(true)}>Sign in</button></div><AccountDialog open={accountOpen} onOpenChange={setAccountOpen} /></div>;
  if (roomQuery.error) return <div className="page stack"><h1>Room unavailable</h1><p className="notice alert" role="alert">{errorText(roomQuery.error)} The room may be closed, or your membership may have changed.</p><div className="row"><button className="btn" onClick={() => void roomQuery.refetch()}>Try again</button><Link className="btn quiet" href="/rooms">Your rooms</Link></div></div>;
  if (!room || !experiment.data) return <div className="page stack"><h1>Opening shared lab</h1>{experiment.error ? <p role="alert" className="notice alert">{errorText(experiment.error)}</p> : <div className="skeleton" style={{ height: 300 }} />}</div>;
  return <div className="page stack loose">
    <header className={`glass panel ${styles.bar}`}><div className="stack snug"><Link className="faint" href="/rooms">Your rooms</Link><h1>{experiment.data.name}</h1><p className="faint">Shared lab {shortId(id)}, version {room.version}</p></div><div className="row"><span className="chip">{room.role}</span><span className="chip tone" data-stain={connection === 'live' ? 'chlorophyll' : 'pollen'} role="status">{connection === 'live' ? 'Live connection' : connection === 'connecting' ? 'Connecting, automatic refresh active' : 'Automatic refresh every 5 seconds'}</span></div></header>
    <div className={styles.workspace}>
      <div className={styles.main}>
        <section className="glass panel stack" aria-labelledby="shared-result"><div className="spread"><h2 id="shared-result" style={{ fontSize: '1.3rem' }}>Shared result</h2>{run && <span className="faint">Run {shortId(run.id)}</span>}</div>
          {run ? <>{run.result?.molecule ? <MolecularResult run={run} /> : <RunChart runs={[run]} />}<RunResult run={run} showMolecule={false} onCancel={canEdit ? () => cancel.mutate(run.id) : undefined} cancelling={cancel.isPending} /></> : <p className="muted">No shared run yet. Save the group settings and start a run to give everyone the same evidence.</p>}
          {canEdit && <div className="stack snug"><div><button className="btn" disabled={dirty || launch.isPending || !usage.data?.member?.active || (!!run && (run.status === 'running' || run.status === 'queued'))} onClick={() => launch.mutate()}>{launch.isPending ? 'Starting shared run' : 'Run shared experiment'}</button></div>{dirty && <p className="faint">Save or discard your draft before starting a shared run.</p>}{!usage.data?.member?.active && <p className="faint">You need an active compute invitation to start server runs. You can still collaborate on the settings.</p>}</div>}
          {launch.error && <p role="alert" className="notice alert">{errorText(launch.error)}</p>}{cancel.error && <p role="alert" className="notice alert">{errorText(cancel.error)}</p>}
        </section>
        <CompanionChat experiment={experiment.data} run={run} />
        <section className="glass panel stack" aria-labelledby="group-settings"><h2 id="group-settings" style={{ fontSize: '1.3rem' }}>Shared settings</h2><p className="faint">{canEdit ? 'Changes are a private draft until you save them to the group.' : 'You have read-only access. The room owner can send an editor invitation.'}</p>
          <ParameterControls manifest={experiment.data} values={draft} onChange={(next) => { setDraft(next); setDirty(true); }} disabled={!canEdit || save.isPending} />
          {conflict && <p role="alert" className="notice warn">Another learner changed the room. Your draft is preserved. Load the latest group settings before editing again.</p>}
          {save.error && <p role="alert" className="notice alert">{errorText(save.error)}</p>}
          {canEdit && <div className="row"><button className="btn" disabled={!dirty || conflict || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving to group' : 'Save to group'}</button><button className="btn quiet" disabled={!dirty || save.isPending} onClick={() => { setDraft(room.parameters); setDraftVersion(room.version); setDirty(false); save.reset(); }}>Use latest shared settings</button></div>}
        </section>
      </div>
      <aside className={styles.side}>
        <section className="glass panel stack" aria-labelledby="room-members"><h2 id="room-members" style={{ fontSize: '1.25rem' }}>Your group</h2><ul className={styles.members}>{people.data?.map((person) => <li key={person.user_id}><span><strong>{person.display_name}</strong>{person.user_id === user?.id ? ' (you)' : ''}<span className="faint">, {person.role}</span></span>{room.role === 'owner' && person.role !== 'owner' && <button className="btn ghost small" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove ${person.display_name} from this room?`)) remove.mutate(person.user_id); }}>Remove</button>}</li>)}</ul>{people.error && <p role="alert" className="notice alert">{errorText(people.error)}</p>}{remove.error && <p role="alert" className="notice alert">{errorText(remove.error)}</p>}</section>
        {room.role === 'owner' && <section className="glass panel stack" aria-labelledby="room-sharing"><h2 id="room-sharing" style={{ fontSize: '1.25rem' }}>Invite your group</h2><label className="field"><span>Link permission</span><select className="input" value={shareRole} onChange={(e) => setShareRole(e.target.value as 'viewer' | 'editor')}><option value="viewer">View shared settings and results</option><option value="editor">Edit settings and start runs</option></select></label><p className="faint">Anyone with the link can preview it. Joining requires an account. Links expire in 24 hours.</p><div><button className="btn quiet" disabled={share.isPending} onClick={() => share.mutate()}>{share.isPending ? 'Creating link' : 'Create invitation link'}</button></div>
          {linkUrl && <div className="stack snug"><label className="field"><span>New private link</span><input className="input" value={linkUrl} readOnly onFocus={(e) => e.target.select()} /></label><div><button className="btn quiet small" onClick={() => { void navigator.clipboard?.writeText(linkUrl).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Link copied' : 'Copy link'}</button></div><p className="faint">Copy it now, or select the link to copy manually. The server keeps only a secure hash and cannot show the full link again.</p></div>}
          {share.error && <p role="alert" className="notice alert">{errorText(share.error)}</p>}
          <div><h3>Existing links</h3>{links.data?.filter((link) => link.resource_type === 'room' && link.resource_id === id).map((link) => <div className={styles.shareItem} key={link.id}><div><strong>{link.role} link</strong><p className="faint">{link.revoked_at ? 'Revoked' : `Expires ${when(link.expires_at)}`}</p></div>{!link.revoked_at && <button className="btn ghost small" disabled={revoke.isPending} onClick={() => revoke.mutate(link.id)}>Revoke</button>}</div>)}</div>{(links.error || revoke.error) && <p role="alert" className="notice alert">{errorText(links.error ?? revoke.error)}</p>}
          <p className="faint">Revoking a link stops future joins. Remove an existing member separately to end their room access.</p>
        </section>}
        <section className="glass panel stack"><h2 style={{ fontSize: '1.25rem' }}>Keep the model in view</h2><p className="muted">{experiment.data.description}</p><Link className="btn quiet small" href={`/lab/${room.experiment_id}?v=${room.experiment_version}${room.last_run_id ? `&runs=${room.last_run_id}` : ''}`}>Open full lab</Link><p className="faint">Educational model. Check the model assumptions before drawing conclusions.</p>{room.role === 'owner' && <div><button className="btn ghost small" disabled={close.isPending} onClick={() => { if (window.confirm('Close this room for everyone? Existing runs remain in their owners’ history.')) close.mutate(); }}>Close room</button></div>}{close.error && <p role="alert" className="notice alert">{errorText(close.error)}</p>}</section>
      </aside>
    </div>
  </div>;
}
