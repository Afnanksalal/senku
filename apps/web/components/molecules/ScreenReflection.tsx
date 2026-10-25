'use client';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CompanionResponse } from '../../lib/companion';
import { molecularApi, screenReflectionKey } from '../../lib/molecular-workspace';
import { useSession } from '../../lib/session';
import { Mascot } from '../Mascot';
import s from '../../app/molecules/molecules.module.css';

type Saved = { key: string; id?: string; answer?: CompanionResponse['response']; failed?: boolean; terminal?: boolean };
export function ScreenReflection({ screenId }: { screenId: string }) {
  const owner = useSession(state => state.user?.id);
  const queries = useQueryClient();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading'), [answer, setAnswer] = useState<CompanionResponse['response']>(null), [retry, setRetry] = useState(0), [terminalFailure, setTerminalFailure] = useState(false);
  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    const storage = `senku:molecular-summary:${owner}:${screenId}`, base = screenReflectionKey(screenId);
    const write = (value: Saved) => { try { localStorage.setItem(storage, JSON.stringify(value)); } catch { /* The server also deduplicates a completed screen summary. */ } };
    void (async () => {
      let saved: Saved = { key: base };
      try { const value = JSON.parse(localStorage.getItem(storage) ?? 'null') as Saved | null; if (value && (value.key === base || value.key.startsWith(base + '-'))) saved = value; } catch { /* Start with the stable server key. */ }
      if (saved.answer) { if (!cancelled) { setAnswer(saved.answer); setState('ready'); } return; }
      if (saved.failed && !retry) { setTerminalFailure(!!saved.terminal); setState('failed'); return; }
      setState('loading'); write(saved);
      try {
        let response = saved.id ? await molecularApi<CompanionResponse>(owner, `/v1/companion/responses/${saved.id}`, { auth: true }) : await molecularApi<CompanionResponse>(owner, `/v1/molecular/screens/${screenId}/reflect`, { method: 'POST', auth: true, idempotencyKey: saved.key, body: {} });
        saved.id = response.id; write(saved); const deadline = Date.now() + 125000;
        while (response.status === 'queued' || response.status === 'running') { if (cancelled) return; if (Date.now() > deadline) throw Error('not_ready'); await new Promise(resolve => setTimeout(resolve, 1500)); if (cancelled) return; response = await molecularApi<CompanionResponse>(owner, `/v1/companion/responses/${response.id}`, { auth: true }); }
        if (response.status !== 'completed' || !response.response) { saved.terminal = true; throw Error('failed'); }
        saved.answer = response.response; delete saved.failed; delete saved.terminal; write(saved);
        void queries.invalidateQueries({ queryKey: ['usage', owner] });
        if (!cancelled) { setAnswer(response.response); setState('ready'); setTerminalFailure(false); }
      } catch { saved.failed = true; write(saved); void queries.invalidateQueries({ queryKey: ['usage', owner] }); if (!cancelled) { setTerminalFailure(!!saved.terminal); setState('failed'); } }
    })();
    return () => { cancelled = true; };
  }, [owner, screenId, retry, queries]);
  const resume = () => { if (terminalFailure && owner) { try { localStorage.setItem(`senku:molecular-summary:${owner}:${screenId}`, JSON.stringify({ key: screenReflectionKey(screenId, crypto.randomUUID()) })); } catch { /* Retrying the same key remains safe if storage is unavailable. */ } setTerminalFailure(false); } setRetry(value => value + 1); };
  return <section className={s.summary} aria-label="Senku’s molecular comparison reflection"><Mascot mood={state === 'loading' ? 'think' : 'wave'} size={64}/><div><h3>{state === 'loading' ? 'Let’s look at the bigger picture' : 'What can you take from this?'}</h3>{state === 'loading' ? <p role="status">Senku is reading the finished searches, one protein at a time…</p> : state === 'ready' ? <><p>{answer?.explanation}</p>{answer?.reflection_question && <p className={s.summaryQuestion}>{answer.reflection_question}</p>}<small>An educational interpretation of saved results. Check it against the evidence below.</small></> : <><p>Your results are ready, but the comparison reflection could not load. Every pose, score and export remains available.</p><button className="btn quiet small" onClick={resume}>{terminalFailure ? 'Try a new reflection · 1 lab unit' : 'Resume reflection'}</button></>}</div></section>;
}
