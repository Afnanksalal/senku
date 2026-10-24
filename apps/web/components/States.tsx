'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { CatalogExperiment } from '../lib/api';
import { ApiError } from '../lib/api';
import { scientificStatusText } from '../lib/format';
import { useRunTarget } from '../lib/runs';
import { AccountDialog } from './AccountDialog';
import { Glyph } from './Glyph';
import { Mascot } from './Mascot';

export function ErrorState({ error, retry, what, home = false }: { error: unknown; retry?: () => void; what: string; home?: boolean }) {
  const offline = error instanceof ApiError && error.code === 'network_unavailable';
  const missing = error instanceof ApiError && error.status === 404;
  const Heading = home ? 'h2' : 'h1';
  return (
    <div className="glass empty" role="alert">
      <Mascot mood="puzzled" size={130} />
      <Heading>{missing ? `This ${what} doesn\u2019t exist` : offline ? 'Can\u2019t reach the lab server' : `Couldn\u2019t load this ${what}`}</Heading>
      <p className="muted">
        {missing ? 'It may have been renamed or retired. Pick another from the experiment list.'
          : offline ? 'Check your connection and try again. Runs you made on this device are kept and will show up once it reconnects.'
          : error instanceof ApiError ? error.message : 'Something unexpected happened.'}
      </p>
      <div className="row">
        {retry && !missing && <button className="btn" onClick={retry}><Glyph name="reset" size={18} />Try again</button>}
        {!home && <a className="btn quiet" href="/">Back to experiments</a>}
      </div>
    </div>
  );
}

/** Tells the learner where the next run will execute, or what unlocks it. */
export function RunTargetNote({ manifest }: { manifest: CatalogExperiment }) {
  const { target, reason } = useRunTarget(manifest);
  const [open, setOpen] = useState(false);
  if (target === 'server') return <p className="faint row" style={{ gap: '.4rem' }}><Glyph name="server" size={16} />Runs on the Senku lab server with the {manifest.engine.id} engine.</p>;
  if (target === 'device') return <p className="faint row" style={{ gap: '.4rem' }}><Glyph name="device" size={16} />Runs on this device. Sign in with lab server access for full time-course results.</p>;
  if (reason === 'offline') return <p className="notice warn">This experiment needs the lab server. Reconnect to run it, or choose a saved device-capable lesson.</p>;
  if (reason === 'pathway') return <div className="notice"><Glyph name="info" /><div className="stack snug"><p>Build and compile a reaction network before running this experiment.</p><Link className="btn quiet" href="/pathways">Open pathway builder</Link></div></div>;
  return (
    <div className="notice warn">
      <Glyph name="server" />
      <div className="stack snug">
        <p>{reason === 'account' ? 'This experiment runs on the lab server. Create an account and redeem an invitation to run it.' : 'This experiment runs on the lab server. Redeem an invitation to run it.'}</p>
        <div><button className="btn hema small" onClick={() => setOpen(true)}>{reason === 'account' ? 'Sign in or create account' : 'Redeem invitation'}</button></div>
      </div>
      <AccountDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function ModelCard({ manifest }: { manifest: CatalogExperiment }) {
  const m = manifest.model;
  return (
    <div className="stack snug">
      <div className="row" style={{ gap: '.4rem' }}>
        <span className="chip tone" data-stain="pollen">{scientificStatusText[m.scientific_status] ?? m.scientific_status}</span>
        <span className="chip">v{manifest.version}</span>
      </div>
      <p>{manifest.learning.objective}</p>
      <section className="stack snug" aria-label="Equations">
        <h3>Equations</h3>
        {m.equations.map((e) => <p key={e} className="equation">{e}</p>)}
      </section>
      <details className="more" open>
        <summary>Assumptions</summary>
        <ul className="list">{m.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </details>
      <details className="more" open>
        <summary>Limits of this model</summary>
        <ul className="list">{m.limitations.map((a) => <li key={a}>{a}</li>)}</ul>
      </details>
      <details className="more">
        <summary>Sources</summary>
        {m.references.length
          ? <ul className="list">{m.references.map((r) => <li key={r.id}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></li>)}</ul>
          : <p className="faint">No literature sources are attached to this teaching model.</p>}
      </details>
    </div>
  );
}
