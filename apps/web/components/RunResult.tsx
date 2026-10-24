'use client';
import dynamic from 'next/dynamic';
import { Fragment, useState } from 'react';
import { download } from '../lib/api';
import { fmt, label, runError, scientificStatusText, shortId, statusText, unitText, when } from '../lib/format';
import { terminal, type RunRecord } from '../lib/runs';
import { Glyph } from './Glyph';
import { RunExports } from './RunExports';

const MoleculeViewer = dynamic(() => import('./MoleculeViewer'), { ssr: false, loading: () => <div className="mol-view skeleton" /> });

const statusStain: Record<RunRecord['status'], string> = { queued: 'pollen', running: 'cobalt', completed: 'chlorophyll', failed: 'eosin', cancelled: 'hema', timed_out: 'eosin' };
export function RunStatus({ run }: { run: RunRecord }) {
  return <span className={`chip tone status-${run.status}`} data-stain={statusStain[run.status]} role="status"><span className="dot" />{statusText[run.status]}</span>;
}

export function Readouts({ run }: { run: RunRecord }) {
  const r = run.result!;
  return (
    <div className="readouts">
      {Object.entries(r.scalars).map(([k, v]) => (
        <div key={k} className="readout">
          <div className="name">{label(k)}</div>
          <div className="value">{fmt(v)}</div>
          <div className="faint">{r.units?.[k] ? unitText(r.units[k]) || 'no unit' : 'unit not reported by device kernel'}</div>
        </div>
      ))}
    </div>
  );
}

export function Provenance({ run }: { run: RunRecord }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const save = async (what: string, path: string, file: string) => {
    setBusy(what); setFailed(false);
    try { await download(path, file); } catch { setFailed(true); } finally { setBusy(null); }
  };
  return (
    <details className="more">
      <summary>How this result was made</summary>
      <div className="stack snug" style={{ paddingTop: '.5rem' }}>
        <dl className="kv">
          <dt>Run</dt><dd className="mono">{run.id}</dd>
          <dt>Where</dt><dd>{run.origin === 'device' ? 'This device, using the shared Senku kernel' : `Lab server, ${run.engine_id} engine${run.engine_version ? ` ${run.engine_version}` : ''}`}</dd>
          <dt>Experiment</dt><dd>{run.experiment_id} v{run.experiment_version}</dd>
          <dt>Model</dt><dd>{run.model_id} v{run.model_version}</dd>
          {run.adapter_version && <><dt>Adapter</dt><dd>v{run.adapter_version}</dd></>}
          <dt>Status</dt><dd>{scientificStatusText[run.scientific_status] ?? run.scientific_status}</dd>
          <dt>Seed</dt><dd className="num">{run.seed}</dd>
          <dt>Settings</dt><dd>{Object.entries(run.parameters).map(([k, v]) => `${label(k)} ${typeof v === 'number' ? fmt(v) : v}`).join(', ')}</dd>
          {run.manifest_hash && <><dt>Manifest hash</dt><dd className="mono">{run.manifest_hash}</dd></>}
          <dt>Started</dt><dd>{when(run.created_at)}</dd>
          {run.finished_at && <><dt>Finished</dt><dd>{when(run.finished_at)}</dd></>}
        </dl>
        {run.result?.diagnostics && Object.keys(run.result.diagnostics).length > 0 && (
          <dl className="kv">
            {Object.entries(run.result.diagnostics).map(([k, v]) => <Fragment key={k}><dt>{label(k)}</dt><dd className="num">{typeof v === 'number' ? fmt(v) : String(v)}</dd></Fragment>)}
          </dl>
        )}
        {run.origin === 'server' && run.status === 'completed' && (
          <div className="row">
            <button className="btn quiet small" disabled={!!busy} onClick={() => save('bundle', `/v1/runs/${run.id}/reproducibility`, `senku-run-${shortId(run.id)}-reproducibility.json`)}>
              <Glyph name="download" size={16} />{busy === 'bundle' ? 'Preparing' : 'Reproducibility bundle'}
            </button>
          </div>
        )}
        {failed && <p role="alert" className="notice alert">The download didn&apos;t complete. Try again.</p>}
      </div>
    </details>
  );
}

export function MolecularResult({ run }: { run: RunRecord }) {
  const molecule = run.result?.molecule;
  if (!molecule) return null;
  return <div className="stack snug">
    {molecule.molblock && <MoleculeViewer molblock={molecule.molblock} label={molecule.formula} />}
    <dl className="kv"><dt>Formula</dt><dd>{molecule.formula}</dd><dt>Canonical SMILES</dt><dd className="mono">{molecule.canonical_smiles}</dd></dl>
  </div>;
}

export function RunResult({ run, onCancel, cancelling, showMolecule = true }: { run: RunRecord; onCancel?: () => void; cancelling?: boolean; showMolecule?: boolean }) {
  if (!terminal(run.status)) return (
    <div className="spread">
      <RunStatus run={run} />
      {run.origin === 'server' && onCancel && (
        <button className="btn quiet small" onClick={onCancel} disabled={cancelling || run.cancellation_requested}>
          <Glyph name="stop" size={14} />{run.cancellation_requested || cancelling ? 'Cancelling' : 'Cancel run'}
        </button>
      )}
    </div>
  );
  if (run.status !== 'completed' || !run.result) return (
    <div className="stack snug">
      <RunStatus run={run} />
      {run.status === 'completed'
        ? <p className="notice warn"><Glyph name="info" />This run&apos;s stored output has expired. Run it again with the same settings and seed to recreate it.</p>
        : run.status !== 'cancelled' && <p className="notice alert"><Glyph name="info" />{runError(run.error_code)}</p>}
      <Provenance run={run} />
    </div>
  );
  const r = run.result;
  return (
    <div className="stack">
      <Readouts run={run} />
      {showMolecule && <MolecularResult run={run} />}
      {!!r.warnings?.length && (
        <div className="notice warn"><Glyph name="info" /><ul className="list" style={{ paddingLeft: '1rem' }}>{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>
      )}
      <RunExports run={run}/>
      <Provenance run={run} />
    </div>
  );
}
