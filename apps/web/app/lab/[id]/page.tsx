'use client';
/* eslint-disable @next/next/no-img-element -- pre-sized static webp art */
import type { Parameters } from '@senku/experiment-schema';
import Link from 'next/link';
import { redirect, useSearchParams } from 'next/navigation';
import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { ConceptGlyph, Glyph, stainFor } from '../../../components/Glyph';
import { defaults, ParameterControls } from '../../../components/Parameters';
import { RunChart } from '../../../components/RunChart';
import { MolecularResult, RunResult, RunStatus } from '../../../components/RunResult';
import { ErrorState, ModelCard, RunTargetNote } from '../../../components/States';
import { CompanionChat } from '../../../components/CompanionChat';
import { ShareResource } from '../../../components/ShareResource';
import { ScientificScene } from '../../../components/ScientificScene';
import type { CatalogExperiment } from '../../../lib/api';
import { ApiError } from '../../../lib/api';
import { coverFor } from '../../../lib/art';
import { useExperiment } from '../../../lib/catalog';
import { fmt, label, scientificStatusText, shortId, when } from '../../../lib/format';
import { terminal, useCancelRun, useExperimentRuns, useLaunchRun, useRunTarget, type RunRecord } from '../../../lib/runs';
import styles from './lab.module.css';

const MAX_COMPARE = 4;

function settingsSummary(run: RunRecord) {
  return Object.entries(run.parameters).map(([k, v]) => `${label(k)} ${typeof v === 'number' ? fmt(v) : v}`).join(', ');
}

function Lab({ manifest, initialRuns }: { manifest: CatalogExperiment; initialRuns: string[] }) {
  const { runs, loading, error } = useExperimentRuns(manifest.id);
  const launch = useLaunchRun(manifest);
  const cancel = useCancelRun();
  const { target } = useRunTarget(manifest);
  const [values, setValues] = useState<Parameters>(() => defaults(manifest));
  const [seed, setSeed] = useState(0);
  const [focusId, setFocusId] = useState<string | undefined>(initialRuns.at(-1));
  const [compare, setCompare] = useState<string[]>(initialRuns.length > 1 ? initialRuns.slice(0, MAX_COMPARE) : []);
  const adopted = useRef(false);
  const [mobileSection, setMobileSection] = useState('results');
  const showControls = () => {
    setMobileSection('controls');
    requestAnimationFrame(() => { const heading = document.getElementById('par-h'); heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
  };
  const showResults = () => {
    setMobileSection('results');
    if (window.matchMedia('(max-width: 799px)').matches) requestAnimationFrame(() => { const heading = document.getElementById('viz-h'); heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
  };

  const sameVersion = runs.filter((r) => r.experiment_version === manifest.version);
  const focus = runs.find((r) => r.id === focusId) ?? sameVersion[0];
  const compared = compare.map((id) => runs.find((r) => r.id === id)).filter((r): r is RunRecord => !!r);
  const inFlight = runs.find((r) => !terminal(r.status));

  // Continuity from Learn: start from the settings of the run that was handed over.
  useEffect(() => {
    if (adopted.current || !focusId) return;
    const run = runs.find((r) => r.id === focusId);
    if (run && run.experiment_version === manifest.version) { adopted.current = true; setValues(run.parameters); setSeed(run.seed); }
  }, [runs, focusId, manifest.version]);

  const toggle = (id: string) => setCompare((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? c : [...c, id]);
  const start = async () => {
    try {
      const run = await launch.mutateAsync({ parameters: values, seed });
      setFocusId(run.id);
      showResults();
    } catch { /* The mutation's error is shown beside the run action. */ }
  };
  const plotted = compared.length >= 2 ? compared : focus ? [focus] : [];
  const stain = stainFor(manifest.learning.concept);

  return (
    <div className="page">
      <Tabs.Root value={mobileSection} onValueChange={setMobileSection} asChild><div className={`lab ${styles.layout}`} data-stain={stain}>
        <header className="lab-bar glass panel spread">
          <div className="row" style={{ gap: '.85rem' }}>
            <Link href="/" className="icon-btn" aria-label="Back to experiments"><Glyph name="back" /></Link>
            <span className="chip tone" data-stain={stain} style={{ padding: '.4rem' }}><ConceptGlyph concept={manifest.learning.concept} size={24} /></span>
            <div><h1 style={{ fontSize: 'clamp(1.5rem, 1.2rem + 1.4vw, 2.1rem)' }}>{manifest.name}</h1><p className="faint">Lab, version {manifest.version}</p></div>
          </div>
          <div className="row">
            {inFlight && <RunStatus run={inFlight} />}
            {compared.length >= 2 && <span className="chip tone" data-stain="hema"><Glyph name="compare" size={14} />Comparing {compared.length} runs</span>}
          </div>
        </header>

        <div className={`glass panel ${styles.mobileNav}`}>
          <div className={styles.mobileSafety}><strong>{scientificStatusText[manifest.model.scientific_status] ?? manifest.model.scientific_status}</strong><p>{manifest.model.limitations.join(' ')}</p></div>
          <button type="button" className="btn" disabled={!target || launch.isPending} onClick={() => void start()}><Glyph name="run" size={16}/>{launch.isPending ? 'Starting run' : 'Run experiment'}</button>
          {launch.error && <p role="alert" className="notice alert"><Glyph name="info"/>{launch.error instanceof ApiError ? launch.error.message : (launch.error as Error).message}</p>}
          {!target && <RunTargetNote manifest={manifest}/>}
          <Tabs.List className={styles.sectionTabs} aria-label="Lab sections">
            <Tabs.Trigger className={styles.tab} value="results">Results</Tabs.Trigger>
            <Tabs.Trigger className={styles.tab} value="controls">Controls</Tabs.Trigger>
            <Tabs.Trigger className={styles.tab} value="model">Model</Tabs.Trigger>
            <Tabs.Trigger className={styles.tab} value="history">History</Tabs.Trigger>
          </Tabs.List>
        </div>

        <Tabs.Content value="controls" forceMount asChild><section className={`lab-params glass panel ${styles.tabPanel}`} aria-labelledby="par-h">
          <div className="panel-title">
            <h2 id="par-h" tabIndex={-1}>Controls</h2>
            <button className="btn ghost small" onClick={() => { setValues(defaults(manifest)); setSeed(0); }}><Glyph name="reset" size={15} />Defaults</button>
          </div>
          <ParameterControls manifest={manifest} values={values} onChange={setValues} />
          <details className="more">
            <summary>Advanced</summary>
            <label className="field" style={{ paddingTop: '.5rem' }}><span>Random seed</span>
              <input className="input num" type="number" min={0} max={2147483647} step={1} value={seed} onChange={(e) => setSeed(Math.max(0, Math.min(2147483647, Math.trunc(Number(e.target.value) || 0))))} aria-describedby="seed-hint" />
            </label>
            <p id="seed-hint" className="faint">The same seed and settings reproduce the same sampled result.</p>
          </details>
          <div className={`stack snug mobile-dock ${styles.desktopRunAction}`} style={{ marginTop: '1rem' }}>
            <button className="btn" disabled={!target || launch.isPending} onClick={start}><Glyph name="run" size={16} />{launch.isPending ? 'Starting run' : 'Run experiment'}</button>
            {launch.error && <p role="alert" className="notice alert"><Glyph name="info" />{launch.error instanceof ApiError ? launch.error.message : (launch.error as Error).message}</p>}
          </div>
          <div style={{ marginTop: '.6rem' }}><RunTargetNote manifest={manifest} /></div>
        </section></Tabs.Content>

        <Tabs.Content value="results" forceMount asChild><div className={`lab-workspace ${styles.tabPanel}`}>
        <section className="lab-viz glass panel" aria-labelledby="viz-h">
          <div className="panel-title">
            <h2 id="viz-h" tabIndex={-1}>{compared.length >= 2 ? 'Comparison' : 'Result'}</h2>
            {plotted.length === 1 && plotted[0] && <span className="faint mono">Run {shortId(plotted[0].id)}</span>}
          </div>
          {focus?.result?.molecule && compared.length < 2 ? <MolecularResult run={focus} /> : plotted.some((r) => r.status === 'completed') && (
            <div className="stack loose">{plotted.length===1&&focus&&<ScientificScene run={focus}/>}<RunChart runs={plotted} fallback={<p className="faint">This model reports single-value readouts rather than a time course.</p>} /></div>
          )}
          {!plotted.length && !loading && (
            <div className="empty" style={{ padding: '1rem 0 2rem' }}>
              {coverFor(manifest.id) && <img className="mascot" src={coverFor(manifest.id)} alt="" width={320} height={240} />}
              <h3>No runs yet</h3>
              <p className="muted">Set the controls and run the experiment. Results, plots and how they were made will appear here.</p>
            </div>
          )}
          {loading && !plotted.length && <div className="skeleton chart" />}
          {focus && !terminal(focus.status) && <div className="stack snug"><RunStatus run={focus}/><p className="muted">The engine is preparing your result. Its readouts will appear here when the run finishes.</p></div>}
          <button type="button" className={`btn quiet small ${styles.mobileShortcut}`} onClick={showControls}><Glyph name="next" size={15}/>Adjust controls</button>
        </section>

        <section className="lab-results glass panel" aria-labelledby="res-h">
          <div className="panel-title"><h2 id="res-h">Readouts</h2>{focus && <span className="faint">{when(focus.created_at)}</span>}</div>
          {focus ? <><RunResult run={focus} showMolecule={false} onCancel={() => cancel.mutate(focus.id)} cancelling={cancel.isPending} />{focus.origin==='server'&&focus.status==='completed'&&<ShareResource type="run" id={focus.id}/>}</> : <p className="faint">Readouts for the selected run show here.</p>}
        </section>

        <CompanionChat experiment={manifest} run={focus} onSuggestParameter={showControls}/>
        </div>
        </Tabs.Content>

        <Tabs.Content value="history" forceMount asChild><section className={`lab-runs glass panel ${styles.tabPanel}`} aria-labelledby="runs-h">
          <div className="panel-title">
            <h2 id="runs-h">Your runs</h2>
            <span className="faint">Tick up to {MAX_COMPARE} to compare{compare.length ? `, ${compare.length} selected` : ''}</span>
          </div>
          {error && <p className="notice alert"><Glyph name="info" />{error instanceof ApiError ? error.message : 'Couldn\u2019t load your server runs.'} Runs on this device are still listed.</p>}
          {!runs.length && !loading && <p className="faint">Runs you start will be listed here with their exact settings.</p>}
          <ul className="stack tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {runs.map((r) => {
              const comparable = r.experiment_version === manifest.version && r.status === 'completed';
              return (
                <li key={r.id} className="run-row" data-focused={r.id === focus?.id}>
                  <input type="checkbox" className="check" aria-label={`Compare run ${shortId(r.id)}`} checked={compare.includes(r.id)} disabled={!comparable || (!compare.includes(r.id) && compare.length >= MAX_COMPARE)} onChange={() => toggle(r.id)} />
                  <button className="link" onClick={() => { setFocusId(r.id); showResults(); }} aria-pressed={r.id === focus?.id}>
                    <span className="row" style={{ gap: '.5rem' }}>
                      <Glyph name={r.origin === 'device' ? 'device' : 'server'} size={16} />
                      <strong className="mono">{shortId(r.id)}</strong>
                      <span className="faint">{when(r.created_at)}</span>
                      {r.experiment_version !== manifest.version && <span className="chip">v{r.experiment_version}</span>}
                    </span>
                    <span className="faint">{settingsSummary(r)}</span>
                  </button>
                  <div className="row" style={{ gap: '.4rem', justifyContent: 'flex-end' }}>
                    <RunStatus run={r} />
                    {r.experiment_version === manifest.version && <button className="btn quiet small" onClick={() => { setValues(r.parameters); setSeed(r.seed); showControls(); }}>Use settings</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section></Tabs.Content>
        <Tabs.Content value="model" forceMount asChild><aside className={`lab-model glass panel ${styles.tabPanel}`} aria-labelledby="model-h">
          <div className="panel-title"><h2 id="model-h">The model</h2></div>
          <ModelCard manifest={manifest} />
        </aside></Tabs.Content>

      </div></Tabs.Root>
    </div>
  );
}

function LabRoute({ id }: { id: string }) {
  const search = useSearchParams();
  const version = search.get('v') ?? undefined;
  const initialRuns = useMemo(() => (search.get('runs') ?? '').split(',').filter(Boolean), [search]);
  const manifest = useExperiment(id, version);
  if(id==='molecular-docking') redirect('/docking'+(search.size?`?${search.toString()}`:''));
  if (manifest.error) return <div className="page"><ErrorState error={manifest.error} retry={manifest.refetch} what="experiment" /></div>;
  if (manifest.notFound) return <div className="page"><ErrorState error={new ApiError(404, 'not_found', 'Not found')} what="experiment" /></div>;
  if (!manifest.data) return <div className="page stack" aria-busy="true"><div className="skeleton" style={{ height: '5rem' }} /><div className="skeleton" style={{ height: '30rem' }} /></div>;
  return <Lab manifest={manifest.data} initialRuns={initialRuns} />;
}

export default function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense><LabRoute id={id} /></Suspense>;
}
