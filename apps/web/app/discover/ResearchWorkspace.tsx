'use client';
import Link from 'next/link';
import { SelectField } from '../../components/SelectField';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import type { Parameters } from '@senku/experiment-schema';
import { AccountDialog } from '../../components/AccountDialog';
import { ShareResource } from '../../components/ShareResource';
import { Glyph } from '../../components/Glyph';
import { defaults, ParameterControls } from '../../components/Parameters';
import { api, ApiError, download, type CatalogExperiment } from '../../lib/api';
import { useCatalog } from '../../lib/catalog';
import { useUsage } from '../../lib/runs';
import { useSession } from '../../lib/session';
import { fmt, label, unitText, when, shortId } from '../../lib/format';
import { exportReport, investigationDone, safeSourceUrl, type Investigation, type InvestigationReport, type InvestigationSummary, type Paper, type PaperPage, type Structure, type StructureSearch } from '../../lib/research';
import styles from './research.module.css';
import {readEntryIntent} from '../../lib/intent';

const message = (e: unknown) => e instanceof ApiError ? e.message : 'The request did not finish. Try again.';
const ProteinViewer = dynamic(() => import('./ProteinViewer'), { ssr: false, loading: () => <p role="status">Preparing the structure viewer...</p> });
function Failure({ error }: { error: unknown }) { return <p role="alert" className="notice alert"><Glyph name="info" /><span>{message(error)}</span></p>; }
function PaperCard({ paper }: { paper: Paper }) {
  const url = safeSourceUrl(paper.url);
  return <article className={styles.paper}>
    <h3>{url ? <a href={url} target="_blank" rel="noreferrer">{paper.title}</a> : paper.title}</h3>
    <p>{paper.authors ?? 'Authors not reported'}{paper.year ? ` (${paper.year})` : ''}</p>
    <footer><span className="chip">Europe PMC</span><span>{paper.id}</span>{paper.doi && <span>DOI: {paper.doi}</span>}</footer>
  </article>;
}
function Literature() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const papers = useInfiniteQuery({
    queryKey: ['research-papers', query], enabled: query.length >= 2, initialPageParam: '*', staleTime: 60_000,
    queryFn: ({ pageParam }) => api<PaperPage>(`/v1/sources/papers?${new URLSearchParams({ q: query, limit: '8', cursor: pageParam })}`, { auth: true }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  const items = papers.data?.pages.flatMap((p) => p.items) ?? [];
  const unique = [...new Map(items.map((p) => [p.id, p])).values()];
  const submit = (e: FormEvent) => { e.preventDefault(); setQuery(draft.trim()); };
  return <section className="glass panel stack loose" aria-labelledby="papers-title">
    <div className="stack snug"><h2 id="papers-title">Follow the evidence</h2><p className={styles.hint}>Find published papers in Europe PMC. These are retrieved references, not a claim that a paper supports your model.</p></div>
    <form className={styles.search} onSubmit={submit}>
      <label className="field"><span>Search scientific literature</span><input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} minLength={2} maxLength={200} required placeholder="For example, enzyme kinetics" /></label>
      <button className="btn" disabled={papers.isFetching}>Search papers</button>
    </form>
    {!query && <div className="row">{['Enzyme kinetics', 'Photosynthesis', 'Cell diffusion'].map((q) => <button key={q} className="btn quiet small" onClick={() => { setDraft(q); setQuery(q); }}>{q}</button>)}</div>}
    {papers.isLoading && query && <p role="status">Searching Europe PMC...</p>}
    {papers.error && <Failure error={papers.error} />}
    {papers.data && <div className={styles.results}>
      <p className="faint">{papers.data.pages[0].total.toLocaleString()} matching references. Retrieved {when(papers.data.pages[0].retrieved_at)}.</p>
      {!unique.length && <p>No papers matched. Try a broader concept or a different phrase.</p>}
      <div className={styles.papers}>{unique.map((p) => <PaperCard key={p.id} paper={p} />)}</div>
      {papers.hasNextPage && <div><button className="btn quiet" disabled={papers.isFetchingNextPage} onClick={() => void papers.fetchNextPage()}>{papers.isFetchingNextPage ? 'Loading references' : 'More references'}</button></div>}
    </div>}
  </section>;
}
function Structures() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [fileError, setFileError] = useState<unknown>();
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState(false);
  const structures = useQuery({ queryKey: ['research-structures', query], enabled: query.length >= 2, staleTime: 60_000,
    queryFn: () => api<StructureSearch>('/v1/structures/search', { method: 'POST', auth: true, body: { query, limit: 8 } }),
  });
  const detail = useQuery({ queryKey: ['research-structure', selected], enabled: !!selected, staleTime: 60_000, queryFn: () => api<Structure>(`/v1/structures/${encodeURIComponent(selected)}`, { auth: true }) });
  const save = async () => { setFileError(undefined); setDownloading(true); try { await download(`/v1/structures/${selected}/file`, `${selected}.cif`); } catch (e) { setFileError(e); } finally { setDownloading(false); } };
  return <section className="glass panel stack loose" aria-labelledby="structures-title">
    <div className="stack snug"><h2 id="structures-title">Explore molecular structures</h2><p className={styles.hint}>Search experimental structures in the RCSB Protein Data Bank and inspect their source records.</p></div>
    <form className={styles.search} onSubmit={(e) => { e.preventDefault(); setQuery(draft.trim()); setSelected(''); setPreview(false); }}>
      <label className="field"><span>Find a protein or molecule</span><input className="input" minLength={2} maxLength={200} required value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="For example, hemoglobin" /></label>
      <button className="btn" disabled={structures.isFetching}>Search structures</button>
    </form>
    {structures.isLoading && query && <p role="status">Searching RCSB...</p>}
    {structures.error && <Failure error={structures.error} />}
    {structures.data && <><p className="faint">{structures.data.total.toLocaleString()} matching structure records.</p><div className={styles.structureList}>{structures.data.items.map((s) => <button key={s.pdb_id} className={`btn ${selected === s.pdb_id ? '' : 'quiet'} small`} onClick={() => { setSelected(s.pdb_id); setFileError(undefined); setPreview(false); }} aria-pressed={selected === s.pdb_id}>{s.pdb_id}</button>)}</div>{!structures.data.items.length && <p>No matching structures. Try a protein name.</p>}</>}
    {detail.isFetching && selected && <p role="status">Reading structure metadata...</p>}
    {detail.error && <Failure error={detail.error} />}
    {detail.data && <article className={styles.structure}><h3>{detail.data.pdb_id}: {detail.data.title}</h3><dl className="kv"><dt>Method</dt><dd>{detail.data.methods.join(', ') || 'Not reported'}</dd><dt>Resolution</dt><dd>{detail.data.resolution_angstrom.length ? `${detail.data.resolution_angstrom.map(fmt).join(', ')} Å` : 'Not reported'}</dd></dl><div className="row"><a className="btn quiet small" href={safeSourceUrl(detail.data.url)} target="_blank" rel="noreferrer">Open RCSB record</a><button className="btn quiet small" onClick={() => void save()} disabled={downloading}>{downloading ? 'Preparing structure' : 'Download structure (.cif)'}</button></div><p className="faint">Structure metadata and coordinates describe this deposited record. They do not validate a Senku teaching model.</p></article>}
    {fileError !== undefined && <Failure error={fileError} />}
    {detail.data && <div className="stack"><div><button className="btn quiet" aria-expanded={preview} onClick={() => setPreview(!preview)}>{preview ? 'Close 3D preview' : 'View deposited structure in 3D'}</button></div>{preview && <ProteinViewer key={selected} pdbId={selected} />}</div>}
  </section>;
}
function InvestigationComposer({ onCreated }: { onCreated: (id: string) => void }) {
  const user = useSession((s) => s.user);
  const usage = useUsage();
  const catalog = useCatalog();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [question, setQuestion] = useState('');
  useEffect(()=>{const entry=readEntryIntent('/discover',user?.id);if(entry)setQuestion(entry.message);},[user?.id]);
  const [literature, setLiterature] = useState('');
  const [experimentId, setExperimentId] = useState('cell-energy');
  const [parameters, setParameters] = useState<Parameters | null>(null);
  const [vary, setVary] = useState('');
  const [alternative, setAlternative] = useState('');
  const [aiReport, setAiReport] = useState(false);
  const experiments = (catalog.data ?? []).filter((e) => e.id !== 'pathway-playground' && Object.values(e.parameters).some((p) => p.type === 'number'));
  const experiment = experiments.find((e) => e.id === experimentId) ?? experiments[0];
  const numeric = Object.entries(experiment?.parameters ?? {}).filter(([, p]) => p.type === 'number');
  const parameter = vary && numeric.some(([k]) => k === vary) ? vary : numeric[0]?.[0];
  const spec = parameter ? experiment?.parameters[parameter] : undefined;
  const baseline = parameters ?? (experiment ? defaults(experiment) : {});
  const changed = Number(alternative);
  const validAlternative = alternative.trim() !== '' && Number.isFinite(changed) && spec?.type === 'number' && changed >= spec.min && changed <= spec.max && (!spec.integer || Number.isInteger(changed)) && changed !== baseline[parameter!];
  const admitted = user && user.role !== 'guest' && !!usage.data?.member?.active;
  const key = useState(() => ({ value: crypto.randomUUID() }))[0];
  const qc = useQueryClient();
  const create = useMutation({ mutationFn: () => api<{ id: string }>('/v1/investigations', {
    method: 'POST', auth: true, idempotencyKey: key.value,
    body: { question: question.trim(), ...(experiment?{experiment_id:experiment.id}:{}), ...(literature.trim() ? { literature_query: literature.trim() } : {}), use_ai: mode === 'ai' || aiReport,
      runs: mode === 'manual' && experiment ? [baseline, { ...baseline, [parameter!]: changed }].map((p) => ({ experiment_id: experiment.id, experiment_version: experiment.version, parameters: p, seed: 0 })) : [] },
  }), onSuccess: (r) => { key.value = crypto.randomUUID(); void qc.invalidateQueries({ queryKey: ['research-investigations'] }); void qc.invalidateQueries({ queryKey: ['usage'] }); onCreated(r.id); } });
  const resetKey = () => { key.value = crypto.randomUUID(); create.reset(); };
  return <section className="glass panel stack loose" aria-labelledby="question-title">
    <div className="stack snug"><h2 id="question-title">Turn a question into evidence</h2><p className={styles.hint}>Run a bounded investigation with approved educational models, literature references, a recorded plan, and a reviewable report.</p></div>
    <div className={styles.mode} role="group" aria-label="Investigation method"><button className={`btn ${mode === 'ai' ? '' : 'quiet'}`} aria-pressed={mode === 'ai'} onClick={() => { setMode('ai'); resetKey(); }}>Let Senku plan</button><button className={`btn ${mode === 'manual' ? '' : 'quiet'}`} aria-pressed={mode === 'manual'} onClick={() => { setMode('manual'); resetKey(); }}>Build a comparison</button></div>
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
      <label className="field"><span>Your research question</span><textarea className="input" minLength={10} maxLength={1000} required value={question} onChange={(e) => { setQuestion(e.target.value); resetKey(); }} placeholder="How does a limiting resource change the energy available to a cell?" /></label>
      <label className="field"><span>Literature search (optional)</span><input className="input" minLength={2} maxLength={200} value={literature} onChange={(e) => { setLiterature(e.target.value); resetKey(); }} placeholder="For example, cellular energy limiting resources" /></label>
      {mode === 'ai' ? <><label className="field"><span>Experiment scope</span><SelectField label="Experiment scope" value={experiment?.id ?? ''} onValueChange={value=>{setExperimentId(value);resetKey();}} options={experiments.map(e=>({value:e.id,label:e.name}))}/></label><p className="notice"><Glyph name="spark" /><span>Senku will plan a focused comparison within this science model, run the calculations, and explain the evidence. This explores a teaching model, not a real-world biological prediction.</span></p></> : <>
        <label className="field"><span>Approved experiment</span><SelectField label="Approved experiment" value={experiment?.id ?? ''} onValueChange={(value) => { setExperimentId(value); setParameters(null); setVary(''); setAlternative(''); resetKey(); }} options={experiments.map(e=>({value:e.id,label:e.name}))}/></label>
        {experiment && <details className="more"><summary>Starting settings</summary><ParameterControls manifest={experiment} values={baseline} onChange={(v) => { setParameters(v); resetKey(); }} /></details>}
        <div className={styles.split}><label className="field"><span>Change one parameter</span><SelectField label="Change one parameter" value={parameter ?? ''} onValueChange={(value) => { setVary(value); setAlternative(''); resetKey(); }} options={numeric.map(([name,p])=>({value:name,label:label(name,p.unit)}))} disabled={!numeric.length}/></label><label className="field"><span>Value for the second run</span><input className="input num" type="number" required min={spec?.type === 'number' ? spec.min : undefined} max={spec?.type === 'number' ? spec.max : undefined} step={spec?.type === 'number' && spec.integer ? 1 : 'any'} value={alternative} onChange={(e) => { setAlternative(e.target.value); resetKey(); }} /></label></div>
        {spec?.type === 'number' && <p className="faint">Starting value: {String(baseline[parameter!])}. Choose {fmt(spec.min)} to {fmt(spec.max)} {unitText(spec.unit)}. The two runs use the same seed.</p>}
        <label className={styles.checkbox}><input type="checkbox" checked={aiReport} onChange={(e) => { setAiReport(e.target.checked); resetKey(); }} /><span>Add Senku’s explanation to the evidence report</span></label>
      </>}
      {!admitted && <div className={styles.notice}>{!user || user.role === 'guest' ? <><p>Sign in to save an investigation. Lab access is required for cloud computation.</p><button type="button" className="btn quiet small" onClick={() => setAccountOpen(true)}>Sign in or create account</button></> : usage.isLoading ? <p>Checking lab access...</p> : usage.error ? <Failure error={usage.error} /> : <p>Your account needs a lab invitation before an investigation can run. Redeem it from your account menu.</p>}</div>}
      {catalog.error && <Failure error={catalog.error} />}
      {create.error && <Failure error={create.error} />}
      <div className="row"><button className="btn" disabled={!admitted || create.isPending || question.trim().length < 10 || (mode === 'manual' && !validAlternative)}>{create.isPending ? 'Starting investigation' : 'Start investigation'}</button><span className="faint">Uses your shared lab allowance.</span></div>
    </form>
    <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
  </section>;
}
function InvestigationHistory() {
  const user = useSession((s) => s.user);
  const list = useInfiniteQuery({ queryKey: ['research-investigations', user?.id], enabled: !!user && user.role !== 'guest', initialPageParam: '', staleTime: 15_000,
    queryFn: ({ pageParam }) => api<InvestigationSummary[]>(`/v1/investigations?limit=12&after=${encodeURIComponent(pageParam)}`, { auth: true }),
    getNextPageParam: (last) => last.length === 12 ? last.at(-1)?.id : undefined,
  });
  const rows = list.data?.pages.flat().sort((a, b) => b.created_at.localeCompare(a.created_at)) ?? [];
  return <aside className="glass panel stack loose"><h2>Your investigations</h2>{(!user || user.role === 'guest') ? <p className="muted">Saved investigations appear here after you sign in.</p> : list.isLoading ? <p role="status">Loading your research...</p> : list.error ? <Failure error={list.error} /> : !rows.length ? <p className="muted">Ask your first question to start a research trail.</p> : <ul className={styles.history}>{rows.map((r) => <li key={r.id}><Link href={`/discover/${r.id}`}><strong>{r.question}</strong><div className="spread"><span className={`chip ${styles.status}`}>{r.status}</span><small>{when(r.created_at)}</small></div></Link></li>)}</ul>}{list.hasNextPage && <button className="btn quiet small" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>Older investigations</button>}</aside>;
}
const taskNames: Record<string, string> = { planner: 'Plan the comparison', librarian: 'Find references', simulation: 'Run experiments', analysis: 'Compare outputs', critic: 'Check limitations', report: 'Write the report' };
const taskOrder = ['planner', 'librarian', 'simulation', 'analysis', 'critic', 'report'];
function Report({ report, id, catalog }: { report: InvestigationReport; id: string; catalog: CatalogExperiment[] }) {
  return <section className="glass panel stack loose" aria-labelledby="report-title">
    <div className="panel-title"><h2 id="report-title">What the evidence says</h2><button className="btn quiet small" onClick={() => exportReport(report, id)}><Glyph name="download" size={16} />Export report</button></div>
    <p className={styles.narrative}>{report.narrative.explanation ?? report.narrative.text ?? 'No narrative was returned.'}</p>
    {report.narrative.mode === 'gemini' && <p className="faint">Senku’s explanation. Check it against the recorded results below.</p>}
    <h3>Recorded model outputs</h3>
    <div className={styles.facts}>{report.facts.map((f) => <article key={f.run_id} className={styles.fact}><div className="spread"><h3>{catalog.find((e) => e.id === f.experiment_id)?.name ?? label(f.experiment_id.replaceAll('-', ' '))}</h3><Link className="btn quiet small" href={`/lab/${f.experiment_id}?v=${f.experiment_version}&runs=${f.run_id}`}>Open run {shortId(f.run_id)}</Link></div><p className="faint">{Object.entries(f.parameters).map(([k, v]) => `${label(k)}: ${String(v)}`).join('; ')}. Seed {f.seed}.</p>{f.status !== 'completed' ? <p className="notice warn">This run {f.status}. No missing values were inferred.</p> : f.scalars ? <dl>{Object.entries(f.scalars).map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd>{fmt(v)}</dd><span className="faint">{unitText(f.units?.[k])}</span></div>)}</dl> : <p>The retained numerical output is unavailable.</p>}</article>)}</div>
    <div className="notice warn"><Glyph name="info" /><div className="stack snug"><strong>Limits of this investigation</strong><ul className="list">{report.critique.limitations.map((x) => <li key={x}>{x}</li>)}</ul>{!report.critique.all_runs_completed && <p>Some runs did not complete. Treat this comparison as incomplete.</p>}</div></div>
    <h3>Retrieved references</h3>{report.citations.length ? <div className={styles.papers}>{report.citations.map((p) => <PaperCard key={p.id} paper={p} />)}</div> : <p className="muted">No references were retrieved for this report. A teaching-model run is not a literature finding.</p>}
  </section>;
}
function InvestigationDetail({ id }: { id: string }) {
  const user = useSession((s) => s.user);
  const catalog = useCatalog();
  const qc = useQueryClient();
  const [accountOpen, setAccountOpen] = useState(false);
  const investigation = useQuery({ queryKey: ['research-investigation', id, user?.id], enabled: !!user && user.role !== 'guest',
    queryFn: () => api<Investigation>(`/v1/investigations/${encodeURIComponent(id)}`, { auth: true }),
    refetchInterval: (q) => q.state.data && !investigationDone(q.state.data.status) ? 2500 : false,
  });
  const events = useQuery({ queryKey: ['research-events', id, user?.id], enabled: !!investigation.data,
    queryFn: () => api<{ sequence: string; type: string; created_at: string }[]>(`/v1/investigations/${encodeURIComponent(id)}/events?after=0`, { auth: true }),
    refetchInterval: investigation.data && !investigationDone(investigation.data.status) ? 5000 : false,
  });
  const cancel = useMutation({ mutationFn: () => api(`/v1/investigations/${encodeURIComponent(id)}/cancel`, { method: 'POST', auth: true }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['research-investigation', id] }); void qc.invalidateQueries({ queryKey: ['research-investigations'] }); } });
  if (!user || user.role === 'guest') return <div className="glass panel stack"><h2>Your research stays private</h2><p>Sign in to open an investigation you own.</p><div><button className="btn" onClick={() => setAccountOpen(true)}>Sign in</button></div><AccountDialog open={accountOpen} onOpenChange={setAccountOpen} /></div>;
  if (investigation.isLoading) return <div className="glass panel" role="status">Loading investigation...</div>;
  if (investigation.error) return <div className="stack"><Failure error={investigation.error} /><button className="btn quiet" onClick={() => void investigation.refetch()}>Try again</button></div>;
  const inv = investigation.data;
  if (!inv) return null;
  return <div className="stack loose">
    <section className="glass panel stack loose"><div className="spread"><h2>{inv.question}</h2><span className={`chip ${styles.status}`} role="status">{inv.status}</span></div><p className="faint">Started {when(inv.created_at)}. Investigation {shortId(id)}.</p>
      <ol className={styles.taskList} aria-label="Investigation workflow">{taskOrder.map((role) => { const t = inv.tasks.find((x) => x.role === role); return <li key={role} className={styles.task} data-state={t?.status ?? 'pending'}><strong>{taskNames[role]}</strong><span className={styles.status}>{t?.status ?? 'pending'}</span><small>{t?.dependencies.length ? `After ${t.dependencies.map((d) => taskNames[d]?.toLowerCase() ?? d).join(', ')}` : 'Starts the investigation'}</small>{role === 'planner' && typeof t?.output?.rationale === 'string' && <p>{t.output.rationale}</p>}</li>; })}</ol>
      {!investigationDone(inv.status) && <div className="row"><button className="btn quiet" disabled={cancel.isPending || !!inv.cancel_requested_at || cancel.isSuccess} onClick={() => cancel.mutate()}>{cancel.isPending || inv.cancel_requested_at || cancel.isSuccess ? 'Cancellation requested' : 'Cancel investigation'}</button><p className="faint">The page updates while the lab works. You can leave and return later.</p></div>}
      {cancel.error && <Failure error={cancel.error} />}
      {inv.status === 'failed' && <p className="notice alert">The investigation could not finish. Its recorded tasks remain available. Try a narrower question or a manual comparison with shorter runs.</p>}
      {inv.status === 'cancelled' && <p className="notice">This investigation was cancelled. It has no completed report.</p>}
    </section>
    {inv.result && <Report report={inv.result} id={id} catalog={catalog.data ?? []} />}
    {inv.status === 'completed' && <section className="glass panel"><ShareResource type="investigation" id={id} /></section>}
    <details className="glass panel more"><summary>Activity trail</summary>{events.error ? <Failure error={events.error} /> : <ol className={styles.events}>{events.data?.map((e) => <li key={e.sequence}><strong>{label(e.type.replaceAll('.', ' '))}</strong> <span className="faint">{when(e.created_at)}</span></li>)}</ol>}</details>
  </div>;
}
export default function ResearchWorkspace({ investigationId }: { investigationId?: string }) {
  const [tab, setTab] = useState<'papers' | 'structures' | 'investigations'>('investigations');
  const router = useRouter();
  return <div className="page stack loose">
    <header className={styles.header}>{investigationId && <Link href="/discover" className="nav-link">Back to Discover</Link>}<h1>{investigationId ? 'Your investigation' : 'Discover'}</h1><p className="muted">Ask a question. Find its sources. Test an idea with a real model.</p></header>
    {investigationId ? <InvestigationDetail id={investigationId} /> : <>
      <div className={styles.tabs} role="tablist" aria-label="Research workspace">{([['papers', 'Literature'], ['structures', 'Structures'], ['investigations', 'Investigations']] as const).map(([key, title]) => <button key={key} role="tab" id={`research-tab-${key}`} aria-selected={tab === key} aria-controls={`research-panel-${key}`} onClick={() => setTab(key)}>{title}</button>)}</div>
      <div role="tabpanel" id={`research-panel-${tab}`} aria-labelledby={`research-tab-${tab}`}>{tab === 'papers' ? <Literature /> : tab === 'structures' ? <Structures /> : <div className={styles.workspace}><InvestigationComposer onCreated={(id) => router.push(`/discover/${id}`)} /><InvestigationHistory /></div>}</div>
    </>}
  </div>;
}
