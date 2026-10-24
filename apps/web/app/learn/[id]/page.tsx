'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Link from 'next/link';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Parameters } from '@senku/experiment-schema';
import { AccountDialog } from '../../../components/AccountDialog';
import { ConceptGlyph, Glyph, stainFor } from '../../../components/Glyph';
import { Mascot } from '../../../components/Mascot';
import { defaults, ParameterControls } from '../../../components/Parameters';
import { RunChart } from '../../../components/RunChart';
import { Readouts, RunResult } from '../../../components/RunResult';
import { ErrorState, RunTargetNote } from '../../../components/States';
import type { CatalogExperiment, Lesson } from '../../../lib/api';
import { api, ApiError } from '../../../lib/api';
import { useExperiment, useLesson } from '../../../lib/catalog';
import { fmt, label, unitText } from '../../../lib/format';
import { terminal, useCancelRun, useLaunchRun, useRun, useRunTarget, type RunRecord } from '../../../lib/runs';
import { useSession } from '../../../lib/session';
import { enqueueAttempt, type OfflineAttempt } from '../../../lib/offline';
import { OfflineSaveButton } from '../../../components/OfflineManager';
import { CompanionChat } from '../../../components/CompanionChat';
import {readEntryIntent} from '../../../lib/intent';
import { loadPersonalizedMission, type PersonalizedMission } from '../../../lib/dynamic-missions';

gsap.registerPlugin(useGSAP);

const stepName: Record<string, string> = { predict: 'Predict', manipulate: 'Experiment', observe: 'Observe', explain: 'Explain' };
const MIN_REFLECTION = 20;
type Ref = { id: string; origin: RunRecord['origin'] };
type AttemptResult = { score: number; xp_awarded: number; completed: boolean; achievements: unknown[]; assessment_feedback: string };

function direction(a: number, b: number) {
  if (Math.abs(b - a) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) return 'unchanged';
  return b > a ? 'increase' : 'decrease';
}

function Comparison({ base, next, prediction }: { base: RunRecord; next: RunRecord; prediction: string }) {
  const keys = Object.keys(next.result!.scalars);
  const changed = Object.keys(next.parameters).filter((k) => next.parameters[k] !== base.parameters[k]);
  return (
    <div className="stack">
      <div className="row"><span className="faint">You predicted</span><span className="prediction-note"><span className="hand">{prediction}</span></span></div>
      <p className="muted">You changed <strong>{changed.map((k) => label(k)).join(', ')}</strong> and kept everything else the same.</p>
      <div className="table-scroll" role="region" aria-label="Result comparison" tabIndex={0}><table className="table">
        <caption className="sr-only">Result before and after your change</caption>
        <thead><tr><th scope="col">Quantity</th><th scope="col" className="num">Starting</th><th scope="col" className="num">Your change</th><th scope="col">What happened</th></tr></thead>
        <tbody>
          {keys.map((k) => {
            const a = base.result!.scalars[k], b = next.result!.scalars[k];
            const d = direction(a, b);
            return (
              <tr key={k}>
                <th scope="row">{label(k)} <span className="faint">{unitText(next.result!.units?.[k])}</span></th>
                <td className="num">{fmt(a)}</td><td className="num"><strong>{fmt(b)}</strong></td>
                <td><span className="chip tone" data-stain={d === 'increase' ? 'chlorophyll' : d === 'decrease' ? 'eosin' : 'hema'}>{d === 'unchanged' ? 'Unchanged' : d === 'increase' ? 'Increased' : 'Decreased'}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      <RunChart runs={[base, next]} />
    </div>
  );
}

function Mission({ lesson, manifest, personalized, practice, onNewMission }: { lesson: Lesson; manifest: CatalogExperiment; personalized?: PersonalizedMission; practice?: boolean; onNewMission?:()=>void }) {
  const def = lesson.definition;
  const predictionPrompt = personalized?.prediction ?? def.prediction;
  const assessmentPrompt = personalized?.assessment ?? def.assessment;
  const steps = def.steps;
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [values, setValues] = useState<Parameters>(() => personalized?.suggested_parameters ?? defaults(manifest));
  const [baseRef, setBaseRef] = useState<Ref>();
  const [nextRef, setNextRef] = useState<Ref>();
  const [answer, setAnswer] = useState<number | null>(null);
  const [reflection, setReflection] = useState('');
  const [finished, setFinished] = useState(false);
  const launch = useLaunchRun(manifest);
  const cancel = useCancelRun();
  const { target } = useRunTarget(manifest);
  const base = useRun(baseRef?.id, baseRef?.origin).data ?? undefined;
  const next = useRun(nextRef?.id, nextRef?.origin).data ?? undefined;
  const stage = useRef<HTMLDivElement>(null);
  const stageMounted = useRef(false);
  useEffect(() => {
    if (!stageMounted.current) { stageMounted.current = true; return; }
    stage.current?.focus({ preventScroll: true });
    stage.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [step, finished]);
  const start = useMemo(() => defaults(manifest), [manifest]);
  const edited = Object.keys(start).some((k) => start[k] !== values[k]);
  const user = useSession((s) => s.user);
  const member = !!user && user.role !== 'guest';
  const [accountOpen, setAccountOpen] = useState(false);
  const [eventId] = useState(() => crypto.randomUUID());
  const qc = useQueryClient();
  const record = useMutation({
    mutationFn: async ():Promise<AttemptResult|{queued:true;event_id:string}> => {
      const body = {
        event_id: eventId, lesson_id: lesson.id, lesson_version: lesson.version,
        prediction: personalized ? ['increase','decrease','unchanged'][predictionPrompt.choices.indexOf(prediction)] : prediction,
        answer_index: answer, reflection: reflection.trim(),
        ...(personalized ? { personalization_id: personalized.id } : {}),
        ...(next!.origin === 'device' ? { local: { parameters: next!.parameters, seed: next!.seed } } : { run_id: next!.id }),
      };
      try { return await api<AttemptResult>(`/v1/lessons/${lesson.id}/attempts`, {method:'POST',auth:true,body}); }
      catch(error) {
        if(!personalized&&next?.origin==='device'&&(!navigator.onLine||(error instanceof ApiError&&error.status===0))) return enqueueAttempt(body as OfflineAttempt);
        if(personalized&&(!navigator.onLine||(error instanceof ApiError&&error.status===0)))throw new Error('Reconnect to record this personalized assessment. Your results remain on this screen. Personalized answers cannot be scored against an offline practice pack.');
        throw error;
      }
    },
    onSuccess: (result) => { setFinished(true); if(!('queued' in result))void qc.invalidateQueries({ queryKey: ['progress'] }); },
  });
  const finish = () => (member ? record.mutate() : setFinished(true));

  useGSAP(() => {
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(stage.current!.children, { x: 28, opacity: 0, duration: 0.45, ease: 'power3.out', stagger: 0.05, clearProps: 'all' });
      if (finished) gsap.from('.celebrate', { scale: 0.3, rotate: -14, y: 30, duration: 0.8, ease: 'back.out(2.4)', delay: 0.15, clearProps: 'all' });
    });
  }, { scope: stage, dependencies: [step, finished] });

  const go = async (params: Parameters, set: (r: Ref) => void) => {
    const run = await launch.mutateAsync({ parameters: params, seed: 0 });
    set({ id: run.id, origin: run.origin });
  };
  const current = finished ? 'done' : steps[step];
  const canAdvance =
    current === 'predict' ? !!prediction
    : current === 'manipulate' ? next?.status === 'completed' && base?.status === 'completed'
    : current === 'observe' ? true
    : current === 'explain' ? answer !== null && reflection.trim().length >= MIN_REFLECTION && !record.isPending : false;
  const stain = stainFor(def.concept);
  const labHref = `/lab/${manifest.id}?v=${manifest.version}&runs=${[baseRef?.id, nextRef?.id].filter(Boolean).join(',')}`;

  return (
    <div className="page mission-page stack loose" data-stain={stain}>
      <header className="stack snug">
        <div className="row">
          <Link href="/" className="btn ghost small"><Glyph name="back" size={16} />Experiments</Link>
        </div>
        <div className="row" style={{ gap: '.85rem' }}>
          <span className="chip tone" data-stain={stain} style={{ padding: '.45rem' }}><ConceptGlyph concept={def.concept} size={26} /></span>
          <div><h1 style={{ fontSize: 'clamp(1.8rem, 1.3rem + 2vw, 2.6rem)' }}>{personalized?.title ?? def.name}</h1><p className="muted">{personalized?.introduction ?? def.objective}</p></div>
        </div>
        <ol className="stepper" aria-label="Mission progress">
          {steps.map((s, i) => (
            <li key={s} data-state={finished || i < step ? 'done' : i === step ? 'current' : 'todo'} aria-current={!finished && i === step ? 'step' : undefined}>{stepName[s] ?? label(s)}</li>
          ))}
        </ol>
      </header>

      {personalized ? <p className="faint">{personalized.source==='gemini'?'A fresh mission prepared for you around this science model.':'Practice mission based on this science model.'} {personalized.reason ? 'A prepared practice mission is available while a fresh version cannot be completed.' : ''}</p> : practice ? <p className="notice">Practice mode uses the saved lesson questions. This attempt uses the prepared practice version.</p> : null}

      {manifest.local_capable&&<div><OfflineSaveButton lessonId={lesson.id}/></div>}

      <section className="glass panel stage stack" ref={stage} tabIndex={-1} aria-live="polite">
        {current === 'predict' && (
          <>
            <div className="row companion">
              <Mascot mood="think" size={120} />
              <div className="stack snug">
                <h2>{predictionPrompt.question}</h2>
                <p className="muted">Commit to a guess before you run anything. You&apos;ll compare it with the real result.</p>
              </div>
            </div>
            <div className="choices" role="radiogroup" aria-label="Your prediction">
              {predictionPrompt.choices.map((c, i) => (
                <label key={c} className="choice"><input type="radio" name="prediction" value={c} checked={prediction === c} onChange={() => setPrediction(c)} /><span className="key">{i + 1}</span>{c.charAt(0).toUpperCase() + c.slice(1)}</label>
              ))}
            </div>
          </>
        )}

        {current === 'manipulate' && (
          <>
            <div className="spread">
              <h2>{!base ? 'First, run the starting conditions' : 'Now change one thing and run again'}</h2>
              {prediction && <span className="prediction-note"><span className="faint">Your guess</span><span className="hand">{prediction}</span></span>}
            </div>
            {personalized && <div className="notice"><Glyph name="info"/><div className="stack snug"><p>{personalized.manipulation_instruction}</p><p className="faint">Start with {label(personalized.focus_parameter)}. Your suggested change is already set below; run the starting conditions first to make a fair comparison.</p></div></div>}
            <RunTargetNote manifest={manifest} />
            {launch.error && <p role="alert" className="notice alert"><Glyph name="info" />{launch.error instanceof ApiError ? launch.error.message : (launch.error as Error).message}</p>}
            {!base ? (
              <div className="stack snug">
                <p className="muted">Starting settings: {Object.entries(start).map(([k, v]) => `${label(k, manifest.parameters[k].unit)} ${typeof v === 'number' ? fmt(v) : v} ${unitText(manifest.parameters[k].unit)}`.trim()).join(', ')}.</p>
                <div><button className="btn" disabled={!target || launch.isPending} onClick={() => go(start, setBaseRef)}><Glyph name="run" size={16} />{launch.isPending ? 'Starting run' : 'Run starting conditions'}</button></div>
              </div>
            ) : base.status !== 'completed' ? (
              <div className="stack snug">
                <RunResult run={base} onCancel={() => cancel.mutate(base.id)} cancelling={cancel.isPending} />
                {terminal(base.status) && <div><button className="btn" disabled={!target || launch.isPending} onClick={() => go(start, setBaseRef)}><Glyph name="reset" size={16} />Run starting conditions again</button></div>}
              </div>
            ) : (
              <div className="stack">
                <div className="stack snug"><h3>Starting result</h3><Readouts run={base} /></div>
                <hr className="divider" />
                <ParameterControls manifest={manifest} values={values} onChange={setValues} baseline={start} disabled={!!next && !terminal(next.status)} />
                <div className="row mobile-dock">
                  <button className="btn hema" disabled={!edited || !target || launch.isPending || (!!next && !terminal(next.status))} onClick={() => go(values, setNextRef)}>
                    <Glyph name="run" size={16} />{next ? 'Run again with these settings' : 'Run with my change'}
                  </button>
                  {!edited && <span className="faint">Change at least one setting first.</span>}
                </div>
                {next && <RunResult run={next} onCancel={() => cancel.mutate(next.id)} cancelling={cancel.isPending} />}
              </div>
            )}
          </>
        )}

        {current === 'observe' && base && next && (
          <>
            <h2>{personalized?.observation_question ?? 'What actually happened?'}</h2>
            <Comparison base={base} next={next} prediction={prediction} />
          </>
        )}

        {current === 'explain' && (
          <>
            <h2>{assessmentPrompt.question}</h2>
            <div className="choices" role="radiogroup" aria-label="Your answer">
              {assessmentPrompt.choices.map((c, i) => (
                <label key={c} className="choice"><input type="radio" name="answer" checked={answer === i} onChange={() => setAnswer(i)} /><span className="key">{i + 1}</span>{c}</label>
              ))}
            </div>
            <label className="field"><span>{personalized?.reflection_question ?? 'In your own words, why did the result change?'}</span>
              <textarea className="input" value={reflection} onChange={(e) => setReflection(e.target.value)} minLength={MIN_REFLECTION} maxLength={2000} aria-describedby="reflection-hint" placeholder="Use what you saw in the numbers and the model's assumptions." />
            </label>
            <p id="reflection-hint" className="faint">{reflection.trim().length < MIN_REFLECTION ? `Write at least ${MIN_REFLECTION - reflection.trim().length} more characters.` : 'Looks good.'}</p>
            {record.error && <p role="alert" className="notice alert"><Glyph name="info" />{record.error instanceof ApiError ? record.error.message : (record.error as Error).message}</p>}
          </>
        )}

        {current === 'done' && (
          <div className="stack">
            <div className="row companion">
              <Mascot mood="cheer" size={150} className="celebrate" />
              <h2>You ran a real experiment!</h2>
            </div>
            <p className="muted">Your two runs are saved {next?.origin === 'device' ? 'on this device' : 'to your account'}. Take them into the lab to try more settings, compare results and check exactly how each one was made.</p>
            {record.data&&'queued' in record.data ? <div className="notice"><Glyph name="device"/><div className="stack snug"><strong>Saved on this device, waiting to sync</strong><p>No cloud XP has been awarded yet. Reconnect and sync this attempt to have Senku check your evidence.</p><Link className="btn quiet" href="/offline">Open offline work</Link></div></div> : record.data ? (
              <div className={`notice ${record.data.completed ? 'ok' : 'warn'}`}>
                <Glyph name={record.data.completed ? 'check' : 'info'} />
                <div className="stack snug">
                  <p><strong>{record.data.xp_awarded > 0 ? `+${record.data.xp_awarded} XP` : record.data.completed ? 'Mission already completed, no new XP' : 'Not quite yet, no XP this time'}</strong>{record.data.achievements.length > 0 && ` and ${record.data.achievements.length} new achievement${record.data.achievements.length > 1 ? 's' : ''}`}</p>
                  <p>{record.data.assessment_feedback}</p>
                </div>
              </div>
            ) : member ? (
              <div className="notice">
                <Glyph name="info" />
                <div className="stack snug">
                  <p>This attempt hasn&apos;t been recorded to your account yet.</p>
                  {record.error && <p role="alert">{record.error instanceof ApiError ? record.error.message : (record.error as Error).message}</p>}
                  <div><button className="btn hema small" disabled={record.isPending} onClick={() => record.mutate()}>{record.isPending ? 'Recording' : 'Record this attempt'}</button></div>
                </div>
              </div>
            ) : (
              <div className="notice">
                <Glyph name="info" />
                <div className="stack snug">
                  <p>Guests don&apos;t earn XP. Create an account to record this attempt and track your mastery. Your runs on this device carry over.</p>
                  <div><button className="btn hema small" onClick={() => setAccountOpen(true)}>Sign in or create account</button></div>
                </div>
                <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
              </div>
            )}
            <div className="row">
              <Link className="btn" href={labHref}><Glyph name="flask" size={18} />Open these runs in the lab</Link>
              {personalized&&onNewMission&&<button className="btn quiet" onClick={onNewMission}>Try a fresh mission</button>}
              <Link className="btn quiet" href="/">Choose another experiment</Link>
            </div>
          </div>
        )}
      </section>

      <CompanionChat experiment={manifest} run={next??base}/>

      {current !== 'done' && (
        <nav className="spread mobile-dock glass" style={{ padding: '.6rem', borderRadius: 20 }} aria-label="Mission steps">
          <button className="btn ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><Glyph name="back" size={16} />Back</button>
          <button className="btn" disabled={!canAdvance} onClick={() => step === steps.length - 1 ? finish() : setStep(step + 1)}>
            {step === steps.length - 1 ? (record.isPending ? 'Recording' : 'Finish mission') : current === 'predict' ? 'Lock in prediction' : 'Continue'}<Glyph name="next" size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

export default function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const owner = useSession(s=>s.user?.id);
  const lesson = useLesson(id);
  const def = lesson.data?.definition;
  const manifest = useExperiment(def?.experiment_id ?? '', def?.experiment_version);
  if (lesson.error) return <div className="page"><ErrorState error={lesson.error} retry={() => void lesson.refetch()} what="mission" /></div>;
  if (manifest.error) return <div className="page"><ErrorState error={manifest.error} retry={manifest.refetch} what="experiment" /></div>;
  if (!def || !manifest.data) return <div className="page stack" aria-busy="true"><div className="skeleton" style={{ height: '7rem' }} /><div className="skeleton" style={{ height: '24rem' }} /></div>;
  return <MissionPreparation key={`${owner??'anonymous'}:${lesson.data!.id}:${lesson.data!.version}`} lesson={lesson.data!} manifest={manifest.data} />;
}

function MissionPreparation({lesson,manifest}:{lesson:Lesson;manifest:CatalogExperiment}) {
  const user=useSession(s=>s.user);
  const [mission,setMission]=useState<PersonalizedMission>();
  const [error,setError]=useState<Error>();
  const [practice,setPractice]=useState(false);
  const [retry,setRetry]=useState(0);
  const [accountOpen,setAccountOpen]=useState(false);
  const [online,setOnline]=useState(true);
  const [ready,setReady]=useState(false);
  const fresh=useRef(false);
  useEffect(()=>{setReady(true);const update=()=>setOnline(navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  useEffect(()=>{
    setMission(undefined);setError(undefined);
    if(!ready||!user||user.role==='guest'||!online||practice)return;
    let active=true;
    const createFresh=fresh.current;fresh.current=false;
    loadPersonalizedMission(user.id,lesson.id,lesson.version,{difficulty:'gentle',...(readEntryIntent('/learn/'+lesson.id,user.id)?{interest:readEntryIntent('/learn/'+lesson.id,user.id)!.message}:{})},createFresh).then(value=>{if(active)setMission(value);}).catch(value=>{if(active)setError(value instanceof Error?value:new Error('The mission could not be prepared.'));});
    return()=>{active=false;};
  },[user?.id,user?.role,lesson.id,lesson.version,ready,online,practice,retry]);
  if(practice)return <Mission key={`practice:${user?.id??'guest'}`} lesson={lesson} manifest={manifest} practice/>;
  if(mission)return <Mission key={`${user?.id}:${mission.id}`} lesson={lesson} manifest={manifest} personalized={mission} onNewMission={()=>{fresh.current=true;setMission(undefined);setRetry(x=>x+1);}}/>;
  const guest=ready&&(!user||user.role==='guest');
  const waiting=!ready||(!error&&online&&!guest);
  return <main className="page mission-page stack loose">
    <Link className="btn ghost small" href="/learn"><Glyph name="back" size={16}/>Learning map</Link>
    <header className="stack snug"><p className="eyebrow">Your science mission</p><h1>{lesson.definition.name}</h1></header>
    <section className="glass panel stack loose" aria-busy={waiting} aria-live="polite">
      <div className="row companion"><Mascot mood="think" size={120}/><div className="stack snug"><h2>{waiting?'Preparing a mission for you':!online?'Explore with an offline practice mission':guest?'Make this mission yours':'Your mission needs a moment'}</h2><p className="muted">{waiting?'Senku is preparing your prediction, experiment prompts and questions around the science model.':!online?'Fresh Questions for Senku need a connection. Saved practice uses the approved lesson and runs on supported devices.':guest?'Sign in for personalized questions and saved learning progress. You can also explore the practice lesson.':error?.message}</p></div></div>
      {waiting&&<div className="stack" aria-hidden="true"><div className="skeleton" style={{height:'2rem',maxWidth:'70%'}}/>{[0,1,2].map(i=><div className="skeleton" key={i} style={{height:'3.6rem'}}/>)}</div>}
      <div className="row">
        {guest&&<button className="btn" onClick={()=>setAccountOpen(true)}>Sign in for my mission</button>}
        {error&&online&&<button className="btn" onClick={()=>{setError(undefined);setRetry(x=>x+1);}}>Retry this mission</button>}
        <button className="btn quiet" onClick={()=>setPractice(true)}>{waiting?'Use practice while I wait':'Explore practice lesson'}</button>
      </div>
      {error instanceof ApiError&&error.status===403&&<p className="faint">Personalized missions use invitation-only cloud access. <Link href="/profile">Redeem your invitation in your profile</Link>, then retry.</p>}
      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen}/>
    </section>
  </main>;
}
