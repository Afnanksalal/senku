'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CompanionChat } from '../../components/CompanionChat';
import { Mascot } from '../../components/Mascot';
import { ErrorState } from '../../components/States';
import { useCatalog } from '../../lib/catalog';
import { useExperimentRuns } from '../../lib/runs';
import { shortId, when } from '../../lib/format';
import styles from './companion.module.css';

export default function CompanionPage() {
  const catalog = useCatalog();
  const [experimentId, setExperimentId] = useState('');
  const [runId, setRunId] = useState('');
  const experiment = catalog.data?.find((e) => e.id === experimentId) ?? catalog.data?.find((e) => e.id === 'cell-energy') ?? catalog.data?.[0];
  const { runs } = useExperimentRuns(experiment?.id ?? '');
  const completed = runs.filter((r) => r.origin === 'server' && r.status === 'completed' && r.result && r.experiment_version === experiment?.version);
  const run = completed.find((r) => r.id === runId) ?? null;
  return <div className="page stack loose">
    <header className={styles.intro}><div><h1>Your science companion</h1><p className="muted">Bring a question, explore a model, and work through your results together. Senku stays quiet until you ask.</p></div><Mascot mood="think" size={120} className={styles.introArt} /></header>
    {catalog.error ? <ErrorState error={catalog.error} retry={() => void catalog.refetch()} what="experiment list" home /> : !experiment ? <div className="skeleton" style={{ height: 320 }} aria-label="Loading experiments" /> : <div className={styles.workspace}>
      <aside className={`glass panel ${styles.context}`} aria-label="Conversation context">
        <h2 style={{ fontSize: '1.2rem' }}>What are we exploring?</h2>
        <label className="field"><span>Experiment</span><select className="input" value={experiment.id} onChange={(e) => { setExperimentId(e.target.value); setRunId(''); }}>{catalog.data?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label className="field"><span>Evidence</span><select className="input" value={run?.id ?? ''} onChange={(e) => setRunId(e.target.value)}><option value="">Model concepts only</option>{completed.map((r) => <option key={r.id} value={r.id}>Run {shortId(r.id)}, {when(r.created_at)}</option>)}</select></label>
        <p className="faint">Only completed lab-server results can be attached. A concept conversation has no measured result attached.</p>
        <Link className="btn quiet small" href={`/lab/${experiment.id}?v=${experiment.version}${run ? `&runs=${run.id}` : ''}`}>Open this experiment</Link>
        <details className="more"><summary>About this model</summary><div className="stack snug" style={{ paddingTop: '.65rem' }}><p>{experiment.description}</p><ul className="list">{experiment.model.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div></details>
      </aside>
      <CompanionChat key={`${experiment.id}:${run?.id ?? ''}`} experiment={experiment} run={run} defaultOpen />
    </div>}
  </div>;
}
