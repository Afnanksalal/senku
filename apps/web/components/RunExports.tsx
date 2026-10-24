'use client';
import { useState } from 'react';
import type { RunRecord, Series } from '../lib/runs';

/** Quote text correctly, and keep spreadsheet formulas inert without altering numeric values. */
export function quoteCsv(value: string | number | null | undefined): string {
  if (typeof value === 'number') return String(value);
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function provenance(run: RunRecord) {
  return {
    run_id: run.id,
    source: run.origin,
    experiment_id: run.experiment_id,
    experiment_version: run.experiment_version,
    model_id: run.model_id,
    model_version: run.model_version,
    engine_id: run.engine_id,
    engine_version: run.engine_version,
    adapter_version: run.adapter_version,
    scientific_status: run.scientific_status,
    manifest_hash: run.manifest_hash,
    seed: run.seed,
    parameters: run.parameters,
    created_at: run.created_at,
    finished_at: run.finished_at,
  };
}

/** Unit names stay in column headers, so every subsequent CSV row is ordinary tabular data. */
export function seriesCsv(run: RunRecord, series: Series): string {
  const metadata = ['run_id', 'source', 'experiment_id', 'experiment_version', 'seed'];
  const columns = series.columns.map((name, index) => series.units[index] ? `${name} [${series.units[index]}]` : name);
  const rows = [
    [...metadata, ...columns],
    ...series.data.map(row => [run.id, run.origin, run.experiment_id, run.experiment_version, run.seed, ...row]),
  ];
  return rows.map(row => row.map(quoteCsv).join(',')).join('\r\n') + '\r\n';
}

export function resultJson(run: RunRecord): string {
  return JSON.stringify({ schema_version: '1.0.0', provenance: provenance(run), result: run.result }, null, 2);
}

export function scalarJson(run: RunRecord): string {
  return JSON.stringify({ schema_version: '1.0.0', provenance: provenance(run), scalars: run.result?.scalars, units: run.result?.units }, null, 2);
}

function frameJson(run: RunRecord): string {
  return JSON.stringify({ schema_version: '1.0.0', provenance: provenance(run), frames: run.result?.frames }, null, 2);
}

function saveFile(filename: string, mediaType: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

/** Client-side exports use the exact retained device/server result, never a recomputed preview. */
export function RunExports({ run }: { run: RunRecord }) {
  const [error, setError] = useState(false);
  if (run.status !== 'completed' || !run.result) return null;
  const prefix = `senku-${run.experiment_id}-${run.id}`.replace(/[^A-Za-z0-9_.-]/g, '_');
  const save = (suffix: string, mediaType: string, content: () => string) => {
    setError(false);
    try { saveFile(`${prefix}-${suffix}`, mediaType, content()); }
    catch { setError(true); }
  };
  return <details className="more">
    <summary>Export your result</summary>
    <div className="stack snug" style={{ paddingTop: '.65rem' }}>
      <p className="faint">Exports contain this saved {run.origin === 'device' ? 'device' : 'lab server'} run, including its ID and model provenance. CSV column headers include reported units. Current unsaved controls are not exported.</p>
      <div className="row">
        <button type="button" className="btn quiet small" onClick={() => save('readouts.json', 'application/json;charset=utf-8', () => scalarJson(run))}>Readouts JSON</button>
        <button type="button" className="btn quiet small" onClick={() => save('result.json', 'application/json;charset=utf-8', () => resultJson(run))}>Full result JSON</button>
        {run.result.series?.map((series, index, all) => <button type="button" className="btn quiet small" key={index} onClick={() => save(`series-${index + 1}.csv`, 'text/csv;charset=utf-8', () => seriesCsv(run, series))}>Time-series CSV{all.length > 1 ? ` ${index + 1}` : ''}</button>)}
        {!!run.result.frames?.length && <button type="button" className="btn quiet small" onClick={() => save('frames.json', 'application/json;charset=utf-8', () => frameJson(run))}>Saved frames JSON</button>}
      </div>
      {error && <p role="alert" className="notice alert">The export could not be prepared. Try again.</p>}
    </div>
  </details>;
}
