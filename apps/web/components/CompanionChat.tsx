'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type CatalogExperiment } from '../lib/api';
import { approvedSuggestion, readConversation, type CompanionRequest, type CompanionResponse, type Conversation } from '../lib/companion';
import { label, shortId } from '../lib/format';
import { useSession } from '../lib/session';
import { useUsage, type RunRecord } from '../lib/runs';
import { AccountDialog } from './AccountDialog';
import { Glyph } from './Glyph';
import { Mascot } from './Mascot';
import styles from '../app/companion/companion.module.css';

/** Embed beside a lab with its exact manifest and optional completed server run.
 * No provider request occurs until the learner submits a question. */
export type CompanionChatProps = {
  experiment: CatalogExperiment;
  run?: RunRecord | null;
  defaultOpen?: boolean;
  onSuggestParameter?: (name: string) => void;
};

export function CompanionChat({ experiment, run, defaultOpen = false, onSuggestParameter }: CompanionChatProps) {
  const [open, setOpen] = useState(defaultOpen);
  const user = useSession((s) => s.user);
  const usableRun = run?.origin === 'server' && run.status === 'completed' && run.result
    && run.experiment_id === experiment.id && run.experiment_version === experiment.version ? run : null;
  const key = `senku-companion:${user?.id ?? 'guest'}:${experiment.id}:${experiment.version}:${usableRun?.id ?? 'concept'}`;
  return <section className={`glass panel ${styles.shell}`} aria-label="Science companion">
    <div className={styles.summon}>
      <div className="stack snug"><h2 style={{ fontSize: '1.25rem' }}>Ask Senku</h2><p className="muted">A science companion for your questions, grounded in this model{usableRun ? ' and your result' : ''}.</p></div>
      <button className="btn quiet small" aria-expanded={open} onClick={() => setOpen((v) => !v)}><Glyph name="spark" size={16} />{open ? 'Close conversation' : 'Ask a question'}</button>
    </div>
    {open && <ConversationPanel key={key} storageKey={key} experiment={experiment} run={usableRun} onSuggestParameter={onSuggestParameter} />}
  </section>;
}

function ConversationPanel({ storageKey, experiment, run, onSuggestParameter }: CompanionChatProps & { storageKey: string }) {
  const user = useSession((s) => s.user);
  const usage = useUsage();
  const qc = useQueryClient();
  const id = useId();
  const [conversation, setConversation] = useState<Conversation>({ entries: [] });
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const mounted = useRef(true);
  const isMember = !!user && user.role !== 'guest';
  const admitted = isMember && !!usage.data?.member?.active;
  useEffect(() => { mounted.current = true; setConversation(readConversation(storageKey)); setLoaded(true); return () => { mounted.current = false; }; }, [storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(conversation)); } catch { /* The active conversation still works without browser persistence. */ }
  }, [conversation, loaded, storageKey]);

  const accept = (response: CompanionResponse, key: string) => {
    if (!mounted.current) return;
    if (response.status === 'completed' && response.response) {
      const answer = response.response;
      setConversation((current) => current.pending?.key !== key ? current : {
        entries: [...current.entries, { id: response.id, role: 'assistant' as const, text: answer.explanation, answer }].slice(-16),
      });
      setError('');
      void qc.invalidateQueries({ queryKey: ['usage'] });
    } else if (response.status === 'failed') {
      setConversation((current) => current.pending?.key !== key ? current : { entries: current.entries });
      setError('Senku could not finish that response. This attempt may have used an allowance. You can submit a new question when you are ready.');
      void qc.invalidateQueries({ queryKey: ['usage'] });
    } else {
      setConversation((current) => current.pending?.key !== key ? current : { ...current, pending: { ...current.pending, id: response.id } });
    }
  };

  useEffect(() => {
    const request = conversation.pending;
    if (!loaded || !request?.id || !admitted) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const response = await api<CompanionResponse>(`/v1/companion/responses/${request.id}`, { auth: true, signal: controller.signal });
        if (controller.signal.aborted) return;
        accept(response, request.key);
        if (response.status === 'queued' || response.status === 'running') timer = setTimeout(check, 1500);
      } catch (e) {
        if (!controller.signal.aborted && mounted.current) setError(e instanceof ApiError ? e.message : 'Could not check this response. Try resuming it.');
      }
    };
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
    // Context is remounted for every account/model/run, and terminal responses clear pending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, conversation.pending?.id, admitted]);

  const execute = async (request: CompanionRequest) => {
    setBusy(true); setError('');
    try {
      const response = request.id
        ? await api<CompanionResponse>(`/v1/companion/responses/${request.id}`, { auth: true })
        : await api<CompanionResponse>('/v1/companion/respond', { method: 'POST', auth: true, idempotencyKey: request.key, body: request.body });
      accept(response, request.key);
    } catch (e) {
      if (mounted.current) setError(e instanceof ApiError ? e.message : 'The connection was interrupted. Resume this question to check the same attempt.');
    } finally { if (mounted.current) setBusy(false); }
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!admitted || !draft.trim() || conversation.pending || busy) return;
    const message = draft.trim();
    const request: CompanionRequest = { key: crypto.randomUUID(), body: {
      message, experiment_id: experiment.id, experiment_version: experiment.version,
      ...(run ? { run_id: run.id } : {}),
      history: conversation.entries.slice(-8).map(({ role, text }) => ({ role, text: text.slice(0, 1000) })),
    } };
    const next: Conversation = { entries: [...conversation.entries, { id: request.key, role: 'user' as const, text: message }].slice(-16), pending: request };
    setConversation(next); setDraft('');
    // Persist admission identity before network I/O, so a reload can safely reuse this key.
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Optional persistence. */ }
    void execute(request);
  };

  return <div className="stack" style={{ paddingTop: '1.25rem' }}>
    <div className="row"><span className="chip">{experiment.name} v{experiment.version}</span><span className="chip">{run ? `Result ${shortId(run.id)}` : 'Model concepts'}</span></div>
    {!isMember ? <div className="notice"><Glyph name="info" /><div className="stack snug"><p>Sign in to ask Senku and keep your conversation on this browser.</p><div><button className="btn small" onClick={() => setAccountOpen(true)}>Sign in or create account</button></div></div></div>
      : usage.isLoading ? <p className="faint">Checking your lab allowance</p>
      : !admitted ? <div className="notice warn"><Glyph name="info" /><div className="stack snug"><p>{usage.error instanceof ApiError ? usage.error.message : 'AI questions use your invitation-only lab allowance. Add your invitation in your account to get started.'}</p><div><button className="btn quiet small" onClick={() => setAccountOpen(true)}>Open account</button></div></div></div> : null}
    <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    {!conversation.entries.length && <div className={styles.empty}><Mascot mood="think" size={100} /><div className="stack snug"><h3>What are you curious about?</h3><p className="muted">Ask why a result changed, unpack an assumption, or plan a comparison. Senku only responds when you ask.</p></div></div>}
    {!!conversation.entries.length && <ol className={styles.transcript} aria-label="Conversation">
      {conversation.entries.map((entry) => {
        const suggestion = approvedSuggestion(experiment, entry.answer);
        return <li key={entry.id} className={styles.message} data-role={entry.role}>
          <header>{entry.role === 'user' ? 'You' : <><Glyph name="spark" size={15} />Senku<span className="faint">AI explanation</span></>}</header>
          <p>{entry.role === 'assistant' ? entry.text.replaceAll('\u2014', ', ') : entry.text}</p>
          {entry.answer?.reflection_question && <div className={styles.reflection}><strong>Think about this</strong><p>{entry.answer.reflection_question.replaceAll('\u2014', ', ')}</p></div>}
          {suggestion && <div className="row"><span className="faint">Parameter to explore: <strong>{label(suggestion)}</strong></span>{onSuggestParameter && <button className="btn quiet small" onClick={() => onSuggestParameter(suggestion)}>Show control</button>}</div>}
          {entry.answer && <footer>{entry.answer.model}. Educational interpretation, check it against the model and its assumptions.</footer>}
        </li>;
      })}
    </ol>}
    <div role="status" aria-live="polite">{(busy || conversation.pending?.id) && <p className={styles.status}><Glyph name="spark" size={16} />Senku is considering your question</p>}</div>
    {error && <p className="notice alert" role="alert">{error}</p>}
    {conversation.pending && !busy && <div className="row"><button className="btn quiet small" disabled={!admitted} onClick={() => void execute(conversation.pending!)}>Resume this question</button><span className="faint">Resumes the same attempt.</span>{error && <button className="btn ghost small" onClick={() => { setConversation((current) => ({ entries: current.entries })); setError(''); }}>Dismiss this request</button>}</div>}
    <form className={styles.composer} onSubmit={send}>
      <label className="field" htmlFor={id}><span>Your question</span><textarea id={id} className="input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder={run ? 'What does this result tell me?' : 'Help me understand this model'} disabled={!loaded || !admitted} /></label>
      <div className={styles.composerFooter}><span className="faint">{draft.length}/2,000 characters. Each question uses 1 lab unit.</span><button className="btn" type="submit" disabled={!loaded || !admitted || !draft.trim() || busy || !!conversation.pending}><Glyph name="spark" size={16} />Ask Senku</button></div>
    </form>
    {!conversation.entries.length && <div className={styles.starters} aria-label="Question ideas">{['Explain this model in simple terms.', 'Which assumption should I pay attention to?', 'What parameter could I compare next?'].map((question) => <button key={question} className="btn quiet small" disabled={!admitted} onClick={() => setDraft(question)}>{question}</button>)}</div>}
    {!!conversation.entries.length && !conversation.pending && <div><button className="btn ghost small" onClick={() => { setConversation({ entries: [] }); setError(''); }}>Start a fresh conversation</button><p className="faint">This conversation is saved on this browser for this account and experiment context. Starting fresh removes its local history.</p></div>}
  </div>;
}
