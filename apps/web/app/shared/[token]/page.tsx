'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { AccountDialog } from '../../../components/AccountDialog';
import { Glyph } from '../../../components/Glyph';
import { RunChart } from '../../../components/RunChart';
import { MolecularResult, Readouts } from '../../../components/RunResult';
import { api, ApiError } from '../../../lib/api';
import { label, shortId } from '../../../lib/format';
import type { SharedResource } from '../../../lib/rooms';
import type { RunRecord } from '../../../lib/runs';
import { useSession } from '../../../lib/session';
import styles from '../../rooms/rooms.module.css';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const safeUrl = (value: unknown) => { try { const url = new URL(text(value)); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined; } catch { return undefined; } };

export default function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token);
  const shared = useQuery({ queryKey: ['shared', token], queryFn: () => api<SharedResource>(`/v1/shared/${token}`), enabled: valid, refetchInterval: 10_000 });
  const join = useMutation({ mutationFn: () => api<{ room_id: string }>(`/v1/shared/${token}/join`, { method: 'POST', auth: true }), onSuccess: (data) => { void qc.invalidateQueries({ queryKey: ['rooms'] }); router.push(`/rooms/${data.room_id}`); } });
  if (!valid || shared.error) return <div className="page stack"><h1>This private link is unavailable</h1><p className="muted">It may have expired or been revoked. Ask its owner for a new link.</p>{shared.error instanceof ApiError && shared.error.status !== 404 && <p role="alert" className="notice alert">{shared.error.message}</p>}<div><Link className="btn quiet" href="/">Explore experiments</Link></div></div>;
  if (!shared.data) return <div className="page stack"><h1>Opening shared science</h1><div className="skeleton" style={{ height: 300 }} /></div>;
  const { resource, type, role } = shared.data;
  const parameters = object(resource.parameters);
  return <div className="page stack loose">
    <header className={styles.intro}><div className="row"><span className="chip">Private share</span><span className="chip">{role}</span></div><h1>{type === 'room' ? 'You are invited to a shared lab' : type === 'run' ? 'A shared experiment result' : 'A shared investigation'}</h1><p className="muted">{type === 'room' ? 'Preview the group settings, then join with your own account.' : 'This is a read-only view chosen by its owner. It does not grant access to their account.'}</p></header>
    {type === 'room' ? <section className="glass panel stack"><h2 style={{ fontSize: '1.3rem' }}>{label(text(resource.experiment_id))}</h2><p className="faint">Model v{text(resource.experiment_version)}, shared settings revision {String(resource.version ?? '')}</p><dl className="kv">{Object.entries(parameters).map(([name, value]) => <div key={name} style={{ display: 'contents' }}><dt>{label(name)}</dt><dd>{String(value)}</dd></div>)}</dl><p className="muted">{role === 'editor' ? 'This invitation allows you to edit group settings. Starting a run also needs your own lab allowance.' : 'This invitation gives you a viewer seat. You can inspect shared settings and results.'}</p><div>{user && user.role !== 'guest' ? <button className="btn" disabled={join.isPending} onClick={() => join.mutate()}>{join.isPending ? 'Joining shared lab' : 'Join shared lab'}</button> : <button className="btn" onClick={() => setAccountOpen(true)}>Sign in to join</button>}</div>{join.error && <p role="alert" className="notice alert">{join.error instanceof ApiError ? join.error.message : 'Could not join this room.'}</p>}</section>
      : type === 'run' ? <SharedRun resource={resource} /> : <SharedInvestigation resource={resource} />}
    <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    <div><Link className="btn quiet" href="/">Explore Senku</Link></div>
  </div>;
}

function SharedRun({ resource }: { resource: Record<string, unknown> }) {
  const result = object(resource.result);
  // This projection deliberately excludes private account metadata and creation dates.
  // Render only result components that consume the fields present in the public API.
  const run = resource as unknown as RunRecord;
  return <section className="glass panel stack"><div className="spread"><h2 style={{ fontSize: '1.3rem' }}>{label(text(resource.experiment_id))}</h2><span className="chip">{label(text(resource.status))}</span></div><p className="faint">Run {shortId(text(resource.id))}, model {text(resource.model_id)} v{text(resource.model_version)}</p>
    {Object.keys(result).length ? <>{result.molecule ? <MolecularResult run={run} /> : <RunChart runs={[run]} />}{result.scalars ? <Readouts run={run} /> : null}</> : <p className="muted">There is no retained completed output to display for this run.</p>}
    <details className="more"><summary>Input settings</summary><dl className="kv">{Object.entries(object(resource.parameters)).map(([name, value]) => <div key={name} style={{ display: 'contents' }}><dt>{label(name)}</dt><dd>{String(value)}</dd></div>)}</dl></details>
    <p className="notice warn"><Glyph name="info" />Educational model output. It does not establish biological or clinical validity.</p>
  </section>;
}

function SharedInvestigation({ resource }: { resource: Record<string, unknown> }) {
  const report = object(resource.result);
  const narrative = object(report.narrative);
  const critique = object(report.critique);
  const citations = Array.isArray(report.citations) ? report.citations.map(object) : [];
  const facts = Array.isArray(report.facts) ? report.facts.map(object) : [];
  return <section className="glass panel stack"><h2 style={{ fontSize: '1.3rem' }}>{text(resource.question)}</h2><span className="chip">{label(text(resource.status))}</span>
    {(text(narrative.explanation) || text(narrative.text)) && <p style={{ whiteSpace: 'pre-wrap' }}>{text(narrative.explanation) || text(narrative.text)}</p>}
    {narrative.ai_generated === true && <p className="faint">AI interpretation, review against the recorded model facts.</p>}
    {facts.map((fact) => <article className={`solid ${styles.projection}`} key={text(fact.run_id)}><div className="spread"><h3>{label(text(fact.experiment_id))}</h3><span className="chip">{label(text(fact.status))}</span></div><p className="faint">Run {shortId(text(fact.run_id))}</p><dl className="kv">{Object.entries(object(fact.scalars)).map(([name, value]) => <div key={name} style={{ display: 'contents' }}><dt>{label(name)}</dt><dd>{String(value)} {text(object(fact.units)[name])}</dd></div>)}</dl></article>)}
    {citations.length > 0 && <div className="stack snug"><h3>Retrieved sources</h3><ul className="list">{citations.map((citation, i) => <li key={text(citation.id) || i}>{safeUrl(citation.url) ? <a href={safeUrl(citation.url)} target="_blank" rel="noreferrer">{text(citation.title) || text(citation.id)}</a> : text(citation.title) || text(citation.id)}</li>)}</ul></div>}
    {Array.isArray(critique.limitations) && <div className="notice warn"><ul className="list">{critique.limitations.filter((item): item is string => typeof item === 'string').map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {!Object.keys(report).length && <p className="muted">This investigation has no completed report to display yet.</p>}
  </section>;
}
