'use client';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localScalars, localUnits, validateParameters, type Parameters } from '@senku/experiment-schema';
import { api, ApiError, type CatalogExperiment } from '../lib/api';
import { friendlyControls, games, isScenarioComplete, useChallenges, type Challenge, type ChallengeDifficulty, type ChallengeExplanation, type ChallengeScore, type DynamicScenario, type Game, type ScenarioRecord } from '../lib/challenges';
import { useExperiment } from '../lib/catalog';
import { runOnDevice, useUsage, useRun, useCancelRun, terminal, type RunRecord } from '../lib/runs';
import { readEntryIntent } from '../lib/intent';
import { useSession } from '../lib/session';
import { fmt, label, unitText, shortId } from '../lib/format';
import { defaults, ParameterControls } from './Parameters';
import { AccountDialog } from './AccountDialog';
import { ErrorState, ModelCard } from './States';
import { Glyph } from './Glyph';
import { RunResult } from './RunResult';
import { Mascot } from './Mascot';
import styles from '../app/challenges/challenges.module.css';

const message=(error:unknown)=>error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'The request did not finish. Try again.';
const bounded=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

function ModelScene({game,values,output,seed,simple=false}:{game:Game;values:Parameters;output:Record<string,number>;seed:number;simple?:boolean}) {
  if(game.experiment==='cell-energy') {
    const energy=output.energy_index;
    return <svg className={styles.scene} viewBox="0 0 560 310" role="img" aria-label={`Model energy index ${fmt(energy)} percent. Oxygen ${values.oxygen}, glucose ${values.glucose}, demand ${values.demand}.`}>
      <ellipse cx="280" cy="145" rx="130" ry="100" className={styles.cell}/>
      <rect x="236" y="77" width="88" height="134" rx="18" fill="white" stroke="var(--c)" strokeWidth="3"/>
      <rect x="244" y={203-118*bounded(energy/100)} width="72" height={118*bounded(energy/100)} rx="10" fill="var(--c)" className={styles.fluid}/>
      <text x="280" y="258" textAnchor="middle" className={styles.big}>{simple?(energy>=80?'Thriving':energy>=40?'Keeping up':'Needs support'):`${fmt(energy)}%`}</text>
      <text x="280" y="286" textAnchor="middle">{simple?'How the model cell is doing':'Model energy index'}</text>
      <text x="75" y="65" textAnchor="middle">Oxygen</text>
      <rect x="50" y="85" width="50" height="145" rx="14" fill="white" stroke="var(--line)"/>
      <rect x="55" y={225-135*bounded(Number(values.oxygen)/100)} width="40" height={135*bounded(Number(values.oxygen)/100)} rx="9" fill="var(--cobalt)" className={styles.fluid}/>
      <text x="75" y="255" textAnchor="middle">{simple?(Number(values.oxygen)<35?'A little':Number(values.oxygen)<70?'Some':'Plenty'):fmt(Number(values.oxygen))}</text>
      <text x="485" y="65" textAnchor="middle">Glucose</text>
      <rect x="460" y="85" width="50" height="145" rx="14" fill="white" stroke="var(--line)"/>
      <rect x="465" y={225-135*bounded(Number(values.glucose)/100)} width="40" height={135*bounded(Number(values.glucose)/100)} rx="9" fill="var(--pollen)" className={styles.fluid}/>
      <text x="485" y="255" textAnchor="middle">{simple?(Number(values.glucose)<35?'A little':Number(values.glucose)<70?'Some':'Plenty'):fmt(Number(values.glucose))}</text>
    </svg>;
  }
  if(game.experiment==='genetics-lab') {
    const count=Number(values.sample_size);
    return <svg className={styles.scene} viewBox="0 0 560 310" role="img" aria-label={`Seed ${seed}: ${output.AA} AA, ${output.Aa} Aa and ${output.aa} aa offspring out of ${count}.`}>
      <text x="280" y="37" textAnchor="middle">{values.parent1} × {values.parent2}{!simple&&`, seed ${seed}`}</text>
      {(['AA','Aa','aa'] as const).map((key,i)=><g key={key}>
        <rect x={72+i*160} y="65" width="96" height="170" rx="15" fill="white" stroke="var(--line)"/>
        <rect className={styles.fluid} x={78+i*160} y={229-158*bounded(output[key]/count)} width="84" height={158*bounded(output[key]/count)} rx="10" fill={`var(--${['eosin','hema','cobalt'][i]})`}/>
        <text x={120+i*160} y="264" textAnchor="middle" className={styles.big}>{simple?(output[key]===0?'None':output[key]/count>=.65?'Many':output[key]/count>=.25?'Some':'Few'):fmt(output[key])}</text>
        <text x={120+i*160} y="292" textAnchor="middle">{key} offspring</text>
      </g>)}
    </svg>;
  }
  const enzyme=game.experiment==='enzyme-explorer';
  const xmax=enzyme ? 20 : Number(values.duration);
  const xmin=enzyme ? 0 : .1;
  const ymax=enzyme ? Number(values.vmax) : Math.max(Number(values.capacity),Number(values.initial_population),1);
  const reference=enzyme ? Number(values.vmax) : Number(values.capacity);
  const referenceY=240-190*bounded(reference/ymax);
  const curve=Array.from({length:41},(_,i)=>{
    const x=xmin+(xmax-xmin)*i/40;
    const y=localScalars(game.experiment,{...values,[enzyme?'substrate_mM':'duration']:x},seed)[game.metric];
    return `${45+i*465/40},${240-190*bounded(y/ymax)}`;
  }).join(' ');
  const currentX=enzyme ? 45+465*Number(values.substrate_mM)/20 : 510;
  const currentY=240-190*bounded(output[game.metric]/ymax);
  return <svg className={styles.scene} viewBox="0 0 560 310" role="img" aria-label={`${enzyme?'Substrate response':'Population growth'} curve calculated from this teaching model. Current ${label(game.metric)} ${fmt(output[game.metric])}.`}>
    <path d="M45 40V240H520" className={styles.axis} fill="none"/>
    <path d={`M45 ${referenceY}H520`} className={styles.axis} strokeDasharray="4 6" fill="none"/>
    <polyline points={curve} className={styles.curve}/>
    <circle cx={currentX} cy={currentY} r="7" className={styles.valueDot}/>
    <text x="45" y="28">{simple?(enzyme?'Reaction speed':'Population size'):(enzyme?'Reaction rate (mM/min)':'Population (individuals)')}</text>
    <text x="45" y="263">{simple?'Less':fmt(xmin)}</text><text x="510" y="263" textAnchor="end">{simple?'More':fmt(xmax)}</text>
    <text x="280" y="293" textAnchor="middle">{simple?(enzyme?'Material for the reaction':'Time to grow'):(enzyme?'Substrate (mM)':'Time (min)')}</text>
    <text x="520" y={referenceY-5} textAnchor="end">{simple?(enzyme?'Reaction limit':'Habitat limit'):`${enzyme?'Vmax':'Capacity'} ${fmt(reference)}`}</text>
  </svg>;
}

function FriendlyControl({manifest,name,values,onChange,descriptor,disabled}:{manifest:CatalogExperiment;name:string;values:Parameters;onChange:(next:Parameters)=>void;descriptor?:DynamicScenario['controls'][number];disabled:boolean}) {
  const id=useId();
  const spec=manifest.parameters[name];
  if(!spec)return null;
  const friendly=friendlyControls[name];
  const title=descriptor?.label??friendly?.label??label(name,spec.unit);
  const low=descriptor?.low_label??friendly?.low??'Less';
  const high=descriptor?.high_label??friendly?.high??'More';
  if(spec.type==='enum')return <fieldset className={styles.friendlyControl} disabled={disabled}>
    <legend>{title}</legend><div className="segmented">{spec.values.map(option=><label key={option}><input type="radio" name={`${id}-${name}`} value={option} checked={values[name]===option} onChange={()=>onChange({...values,[name]:option})}/><span>{option==='AA'?'Two A copies':option==='Aa'?'One A, one a':option==='aa'?'Two a copies':option}</span></label>)}</div>
  </fieldset>;
  if(spec.type!=='number')return null;
  const value=Number(values[name]);
  const fraction=bounded((value-spec.min)/(spec.max-spec.min));
  const word=fraction<.2?low:fraction>.8?high:fraction<.4?'A little more':fraction<.65?'In the middle':'Quite a lot';
  return <div className={styles.friendlyControl}>
    <div className={styles.friendlyLabel}><label htmlFor={id}>{title}</label><span>{word}</span></div>
    <input id={id} type="range" min={spec.min} max={spec.max} step={spec.integer?1:'any'} value={value} disabled={disabled} onChange={e=>onChange({...values,[name]:spec.integer?Math.round(Number(e.target.value)):+Number(e.target.value).toPrecision(8)})} aria-valuetext={`${word}, ${fmt(value)} ${unitText(spec.unit)}`}/>
    <div className={styles.rangeWords}><span>{low}</span><span>{high}</span></div>
  </div>;
}

function PlayableGame({game,manifest,challenge}:{game:Game;manifest:CatalogExperiment;challenge?:Challenge}) {
  const [values,setValues]=useState<Parameters>(()=>({...defaults(manifest),...game.initial}));
  const [seed,setSeed]=useState(0);
  const [runRef,setRunRef]=useState<{id:string;origin:RunRecord['origin']}>();
  const [eventId,setEventId]=useState('');
  const [open,setOpen]=useState(false);
  const [history,setHistory]=useState<{id:string;metric:number;origin:string}[]>([]);
  const [difficulty,setDifficulty]=useState<ChallengeDifficulty>('gentle');
  const [interest,setInterest]=useState('');
  const [scenarioId,setScenarioId]=useState<string>();
  const [scenario,setScenario]=useState<DynamicScenario>();
  const [scenarioError,setScenarioError]=useState('');
  const [setupOpen,setSetupOpen]=useState(false);
  const [hintOpen,setHintOpen]=useState(false);
  const generationKey=useRef<{fingerprint:string;key:string}|undefined>(undefined);
  const explanationKey=useRef<{fingerprint:string;key:string}|undefined>(undefined);
  const appliedScenario=useRef<string|undefined>(undefined);
  const launch=useMutation({mutationFn:({parameters,seed}:{parameters:Parameters;seed:number})=>runOnDevice(manifest,parameters,seed)});
  const usage=useUsage();
  const [practice,setPractice]=useState(false);
  const [blurRevision,setBlurRevision]=useState(0);
  useEffect(()=>{const settle=()=>setBlurRevision(value=>value+1);document.addEventListener('focusout',settle);return()=>document.removeEventListener('focusout',settle);},[]);
  const initialized=useRef<string|undefined>(undefined);
  const autoProof=useRef('');
  const scoredRun=useRef('');
  const completedRound=useRef('');
  const result=useRun(runRef?.id,runRef?.origin);
  const cancel=useCancelRun();
  const user=useSession(s=>s.user);
  const signedIn=!!user&&user.role!=='guest';
  const previousUser=useRef(user?.id);
  const qc=useQueryClient();
  const metric=scenario?.goal.metric??challenge?.definition.metric??game.metric;
  const target=scenario?.goal.value??challenge?.definition.minimum??game.target;
  const operator=scenario?.goal.operator??'gte';
  const preview=useMemo(()=>{
    try { return {output:localScalars(manifest.id,validateParameters(manifest,values),seed),error:null}; }
    catch(error) { return {output:null,error:message(error)}; }
  },[manifest,values,seed]);
  const generation=useMutation({
    mutationFn:({key,body}:{owner:string;intentId?:string;key:string;body:{challenge_id:string;difficulty:ChallengeDifficulty;interest?:string}})=>api<ScenarioRecord>('/v1/challenges/dynamic',{method:'POST',auth:true,idempotencyKey:key,body}),
    onSuccess:(record,variables)=>{if(variables.owner!==useSession.getState().user?.id)return;try{localStorage.setItem(`senku:game:${user?.id}:${game.id}:${manifest.version}`,JSON.stringify({id:record.id,key:variables.key,body:variables.body,intentId:variables.intentId}));}catch{}setPractice(false);setScenarioId(record.id);void qc.invalidateQueries({queryKey:['usage']});},
  });
  const scenarioQuery=useQuery({
    queryKey:['dynamic-challenge',scenarioId,user?.id],enabled:!!scenarioId&&signedIn,
    queryFn:()=>api<ScenarioRecord>(`/v1/challenges/dynamic/${scenarioId}`,{auth:true}),
    refetchInterval:q=>q.state.data&&['queued','running'].includes(q.state.data.status)?2000:false,
  });
  const record=scenarioQuery.data??generation.data;
  const loaded=isScenarioComplete(record)?record:undefined;
  const generating=generation.isPending||!!record&&['queued','running'].includes(record.status);
  const score=useMutation({
    mutationFn:()=>{
      const run=result.data;
      if(!run||run.status!=='completed'||!run.result||!challenge)throw Error('Finish a valid run before submitting.');
      return api<ChallengeScore>(`/v1/challenges/${challenge.id}/attempts`,{method:'POST',auth:true,body:{event_id:eventId,...(scenario?{scenario_id:scenario.id}:{}),...(run.origin==='server'?{run_id:run.id}:{local:{parameters:run.parameters,seed:run.seed}})}});
    },
    onSuccess:checked=>{if(checked.passed)completedRound.current=scenario?.id??game.id;void qc.invalidateQueries({queryKey:['progress']});},
  });
  const explain=useMutation({
    mutationFn:()=>{
      const run=result.data;
      if(!scenario||!run||run.status!=='completed'||!run.result)throw Error('Test this scenario first.');
      const proof=run.origin==='server'?{run_id:run.id}:{local:{parameters:run.parameters,seed:run.seed}};
      const fingerprint=JSON.stringify({scenario:scenario.id,proof});
      if(explanationKey.current?.fingerprint!==fingerprint)explanationKey.current={fingerprint,key:crypto.randomUUID()};
      return api<ChallengeExplanation>(`/v1/challenges/dynamic/${scenario.id}/explain`,{method:'POST',auth:true,idempotencyKey:explanationKey.current!.key,body:proof});
    },
    onSuccess:()=>{void qc.invalidateQueries({queryKey:['usage']});},
  });
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('scenario');
    if(id&&/^[0-9a-f-]{36}$/i.test(id))setScenarioId(id);
  },[]);
  useEffect(()=>{
    if(!loaded||appliedScenario.current===loaded.id)return;
    if(loaded.challenge_id!==game.id||loaded.experiment_id!==manifest.id||loaded.experiment_version!==manifest.version){setScenarioError('This scenario belongs to a different game or model version. Choose a new scenario here.');return;}
    try {
      const parameters=validateParameters(manifest,loaded.parameters);
      const check=localScalars(manifest.id,parameters,loaded.seed);
      if(!Number.isFinite(check[loaded.goal.metric])||!loaded.controls.length||loaded.controls.some(c=>!Object.hasOwn(manifest.parameters,c.key)))throw Error();
      appliedScenario.current=loaded.id;setSetupOpen(false);setScenario(loaded);setValues(parameters);setSeed(loaded.seed);setRunRef(undefined);setEventId('');setHistory([]);setHintOpen(false);setScenarioError('');score.reset();explain.reset();
      const url=new URL(window.location.href);url.searchParams.set('scenario',loaded.id);window.history.replaceState(null,'',url);
    }catch{setScenarioError('This challenge could not be prepared. Please try another one.');}
  },[loaded,manifest,game.id]);
  useEffect(()=>{
    if(previousUser.current&&previousUser.current!==user?.id){
      setPractice(false);initialized.current=undefined;autoProof.current='';scoredRun.current='';setScenario(undefined);setScenarioId(undefined);setRunRef(undefined);setValues({...defaults(manifest),...game.initial});setSeed(0);generation.reset();score.reset();explain.reset();
      const url=new URL(window.location.href);url.searchParams.delete('scenario');window.history.replaceState(null,'',url);
    }
    previousUser.current=user?.id;
  },[user?.id,manifest,game.initial]);
  const createScenario=()=>{
    if(!signedIn){setOpen(true);return;}
    const body={challenge_id:game.id,difficulty,...(interest.trim()?{interest:interest.trim()}: {})};
    const fingerprint=JSON.stringify(body);
    if(!generationKey.current||generationKey.current.fingerprint!==fingerprint||!generation.isError)generationKey.current={fingerprint,key:crypto.randomUUID()};
    setScenarioError('');try{localStorage.setItem(`senku:game:${user?.id}:${game.id}:${manifest.version}`,JSON.stringify({key:generationKey.current.key,body,intentId:readEntryIntent('/challenges/'+game.id,user?.id)?.id}));}catch{}generation.mutate({owner:user!.id,intentId:readEntryIntent('/challenges/'+game.id,user?.id)?.id,key:generationKey.current.key,body});
  };
  const start=async()=>{
    score.reset();explain.reset();
    try {
      const run=await launch.mutateAsync({parameters:values,seed});
      qc.setQueryData(['run',run.id],run);void qc.invalidateQueries({queryKey:['device-runs']});
      setRunRef({id:run.id,origin:run.origin});setEventId(crypto.randomUUID());
      if(run.status==='completed'&&run.result)setHistory(h=>[{id:run.id,metric:run.result!.scalars[metric],origin:run.origin},...h].slice(0,6));
      void qc.invalidateQueries({queryKey:['usage']});
    } catch { /* The previous saved result stays available; the new request error is shown below. */ }
  };
  const run=result.data;
  const busy=launch.isPending||!!run&&!terminal(run.status);
  const actual=preview.output?.[metric];
  const passed=actual!==undefined&&(operator==='gte'?actual>=target:actual<=target);
  const progress=actual===undefined?0:operator==='gte'?bounded(actual/target):actual<=target?1:bounded(target/actual);
  const unit=unitText(localUnits(manifest)[metric]);
  const editable=scenario?scenario.controls.map(c=>c.key):Object.keys(manifest.parameters);
  const editableManifest={...manifest,parameters:Object.fromEntries(Object.entries(manifest.parameters).filter(([key])=>editable.includes(key)))};
  const fixed=scenario?Object.entries(manifest.parameters).filter(([key])=>!editable.includes(key)):[];
  const reset=()=>{setValues(scenario?{...scenario.parameters}:{...defaults(manifest),...game.initial});setSeed(scenario?.seed??0);};
  const baseGoal=game.id==='restore-cell'?'Help the cell get enough energy to keep up.':game.id==='enzyme-saturation'?'Help the enzyme reaction get up to speed.':game.id==='population-recovery'?'Help the small population recover.':'Choose parents that produce enough offspring with two A copies.';
  const goalWords=scenario?scenario.goal_text.split(' Reach at ')[0].trim():baseGoal;
  const explanationWaiting=explain.data?.status==='queued'||explain.data?.status==='running';
  const backToPractice=()=>{setPractice(true);setScenario(undefined);setScenarioId(undefined);setValues({...defaults(manifest),...game.initial});setSeed(0);setRunRef(undefined);setEventId('');setHintOpen(false);score.reset();explain.reset();generation.reset();const url=new URL(window.location.href);url.searchParams.delete('scenario');window.history.replaceState(null,'',url);};

  const admitted=signedIn&&!!usage.data?.member?.active;
  useEffect(()=>{
    if(!signedIn||!admitted||practice||!challenge)return;
    const owner=`${user.id}:${game.id}:${manifest.version}`;
    if(initialized.current===owner)return;
    initialized.current=owner;
    const entry=readEntryIntent('/challenges/'+game.id,user.id);
    let cached:{id?:string;intentId?:string;key?:string;body?:{challenge_id:string;difficulty:ChallengeDifficulty;interest?:string}}={};
    try{cached=JSON.parse(localStorage.getItem(`senku:game:${owner}`)||'{}');}catch{}
    const freshIntent=!!entry&&cached.intentId!==entry.id;
    if(freshIntent){
      cached={intentId:entry.id};setScenario(undefined);setScenarioId(undefined);
      const url=new URL(window.location.href);url.searchParams.delete('scenario');window.history.replaceState(null,'',url);
    }else if(new URLSearchParams(window.location.search).has('scenario'))return;
    if(cached.id){setScenarioId(cached.id);return;}
    const body=cached.body??{challenge_id:game.id,difficulty:'gentle' as const,...(entry?{interest:entry.message}:{})};
    setDifficulty(body.difficulty);setInterest(body.interest??'');
    const key=cached.key??crypto.randomUUID();generationKey.current={fingerprint:JSON.stringify(body),key};
    const intentId=entry?.id??cached.intentId;
    try{localStorage.setItem(`senku:game:${owner}`,JSON.stringify({key,body,intentId}));}catch{}
    generation.mutate({owner:user.id,intentId,key,body});
  },[signedIn,admitted,practice,challenge,user?.id,game.id,manifest.version]);
  const baseline=scenario?.parameters??{...defaults(manifest),...game.initial};
  const changed=Object.keys(manifest.parameters).some(key=>values[key]!==baseline[key]);
  const proof=JSON.stringify({scenario:scenario?.id??game.id,parameters:values,seed});
  useEffect(()=>{
    if(!passed||!changed||busy||generating||!preview.output||autoProof.current===proof||completedRound.current===(scenario?.id??game.id))return;
    if(signedIn&&admitted&&!scenario&&!practice)return;
    const timer=window.setTimeout(()=>{
      const active=document.activeElement;
      if(active instanceof HTMLInputElement&&active.type!=='range'&&active.type!=='radio')return;
      autoProof.current=proof;void start();
    },800);
    return()=>window.clearTimeout(timer);
  },[proof,passed,changed,busy,generating,scenario,practice,blurRevision]);
  useEffect(()=>{
    if(!run||run.status!=='completed'||!run.result||!eventId||scoredRun.current===run.id)return;
    const reaches=operator==='gte'?run.result.scalars[metric]>=target:run.result.scalars[metric]<=target;
    if(!reaches)return;
    if(!signedIn){completedRound.current=scenario?.id??game.id;return;}
    if(!challenge)return;
    scoredRun.current=run.id;score.mutate();
  },[run?.id,run?.status,eventId,signedIn,challenge]);
  const aiFailed=!!generation.error||!!scenarioQuery.error||!!scenarioError||record?.status==='failed';
  const awaitingAi=signedIn&&!practice&&!scenario&&(usage.isPending||admitted);

  return <div className="page stack loose" data-stain={game.stain}>
    <header className={styles.header}>
      <Link className="btn ghost small" style={{justifySelf:'start'}} href="/challenges"><Glyph name="back" size={16}/>All games</Link>
      <h1>{scenario?.title??game.name}</h1>
      <p className="muted">{scenario?.story??baseGoal}</p>
      <div className="row"><span className="chip tone">{scenario?'Your fresh challenge':awaitingAi?'Your personalized challenge':'Practice round'}</span><span className="chip">{scenario?.source==='gemini'?'Created for you':scenario?'Practice challenge':awaitingAi?'Preparing your adventure':'Ready to explore'}</span></div>
    </header>
    <details className="glass panel" open={!scenario||setupOpen||generating||!!generation.error||!!scenarioQuery.error||!!scenarioError||record?.status==='failed'} onToggle={event=>{if(scenario&&!generating)setSetupOpen(event.currentTarget.open);}}>
      <summary className={styles.setupSummary}>{scenario?'Change challenge':'Create your own challenge'}</summary>
      <div className={styles.setupFields}>
      <div className={styles.storyHeading}><Mascot mood="think" size={72}/><div><h2 id="new-game-scenario">Make this your kind of puzzle</h2><p className="muted">Choose a pace and something you enjoy. Senku can build a new story and a checked model goal around it.</p></div></div>
      <fieldset className={styles.difficulty} disabled={generating||busy}><legend>Choose your pace</legend><div className="segmented">{([{id:'gentle',name:'Gentle'},{id:'curious',name:'Curious'},{id:'stretch',name:'Stretch me'}] as const).map(item=><label key={item.id}><input type="radio" name={`difficulty-${game.id}`} checked={difficulty===item.id} onChange={()=>setDifficulty(item.id)}/><span>{item.name}</span></label>)}</div></fieldset>
      <label className="field"><span>Something you like, optional</span><input className="input" maxLength={120} value={interest} onChange={event=>setInterest(event.target.value)} placeholder="A garden, a space adventure, your football team…" disabled={generating||busy}/></label>
      <div className={styles.actions}><button className="btn hema" disabled={generating||busy||!challenge} onClick={createScenario}><Glyph name="spark" size={17}/>{generating?'Shaping your challenge':signedIn?(generation.isError?'Retry new challenge':'Create a fresh challenge'):'Sign in for a fresh challenge'}</button>{scenario&&<button className="btn ghost small" disabled={generating||busy} onClick={backToPractice}>Back to practice</button>}</div>
      {generating&&<p role="status" className="notice">Senku is choosing a reachable goal and writing your story. The current practice stays available while it prepares.</p>}
      {(generation.error||scenarioQuery.error||scenarioError||record?.status==='failed')&&<p role="alert" className="notice alert">{scenarioError||message(generation.error??scenarioQuery.error??new Error('The scenario could not be prepared. Try a fresh challenge.'))}</p>}
      {!signedIn&&<p className="faint">Guest practice is free. Sign in with lab access for a personalized challenge.</p>}
      {scenario?.source==='fallback'&&<p className="notice warn">Personalization is taking a break. You can still explore this checked practice challenge.</p>}
      {scenario?.source==='gemini'&&<p className="faint">Your challenge has a reachable goal and hints that follow your results.</p>}
      </div>
    </details>
    {awaitingAi?<section className="glass panel stack" aria-busy={generating||scenarioQuery.isPending}><Mascot mood="think" size={96}/><h2>{aiFailed?'Your challenge could not load':'Senku is preparing your challenge'}</h2><p role="status" className="muted">{aiFailed?'Retry above using the same request, or explore clearly labeled practice.':'Senku is creating a story and finding a goal for you to explore.'}</p>{!aiFailed&&<div className="skeleton" style={{height:'10rem'}}/>}<button className="btn quiet" onClick={()=>setPractice(true)}>Open a practice round instead</button></section>:<div className={styles.layout}>
      <div className={styles.scenePanel}>
        <section className="glass panel stack" aria-labelledby="game-scene">
          <div className={styles.previewLabel}><h2 id="game-scene">What is happening?</h2><span className="faint">Live idea, not a saved test</span></div>
          {preview.output?<ModelScene game={game} values={values} output={preview.output} seed={seed} simple/>:<p role="alert" className="notice alert">{preview.error}</p>}
          <div className={styles.goalCard}><strong>Your goal</strong><p>{goalWords}</p><span className="chip tone">{passed?'Goal reached. Checking your idea…':'Try a small change and watch what happens.'}</span><progress className={styles.meter} value={progress*100} max={100} aria-label="Progress toward the checked model goal"/></div>
          <div className={styles.actions}><button className="btn quiet small" onClick={()=>setHintOpen(value=>!value)} aria-expanded={hintOpen}>{hintOpen?'Hide hint':'Give me a nudge'}</button></div>
          {hintOpen&&<p className={styles.feedback}>{scenario?.hint??game.tactic}</p>}
          <details className="more"><summary>Show the exact science</summary><div className="stack snug" style={{paddingTop:'.75rem'}}>{preview.output&&<ModelScene game={game} values={values} output={preview.output} seed={seed}/>}<p><strong>{label(metric)}: {actual===undefined?'Unavailable':fmt(actual)} {unit}</strong></p><p className="faint">The goal is {operator==='gte'?'at least':'at most'} {fmt(target)} {unit}. The preview and your saved test use the same scientific model.</p></div></details>
          <p className="faint">This is a teaching model, not a real-world biological prediction. The shapes help explain its rules; they are not measurements.</p>
        </section>
        <section className="glass panel stack" aria-labelledby="challenge-result">
          <h2 id="challenge-result">Your checked result</h2>
          {!run&&<p className="muted">Move a control and watch the model. When your idea reaches the goal, Senku saves and checks it automatically.</p>}
          {run&&!terminal(run.status)&&<RunResult run={run} onCancel={()=>cancel.mutate(run.id)} cancelling={cancel.isPending}/>}
          {run&&terminal(run.status)&&run.status!=='completed'&&<RunResult run={run}/>}
          {result.error&&<p role="alert" className="notice alert">{message(result.error)}</p>}
          {run?.status==='completed'&&run.result&&<div className={styles.score}>
            <p className={styles.feedback}>{(operator==='gte'?run.result.scalars[metric]>=target:run.result.scalars[metric]<=target)?'Your saved test reaches the goal.':'This saved test is not there yet. Change one thing and compare your next try.'}</p>
            {challenge?signedIn?(score.isPending?<p role="status">Checking your idea…</p>:score.isError?<button className="btn hema" disabled={score.isPending||score.isSuccess} onClick={()=>score.mutate()}><Glyph name="check" size={18}/>{score.isPending?'Checking your idea':score.isSuccess?'Score recorded':'Retry score check'}</button>:null):<><p className="muted">Sign in to record your score. Guest practice earns no XP.</p><button className="btn quiet" onClick={()=>setOpen(true)}>Sign in to save your score</button></>:<p className="notice warn">You can practice now. The scoring service is not available yet.</p>}
            {score.error&&<p role="alert" className="notice alert">{message(score.error)} Retrying checks the same attempt.</p>}
            {score.data&&<div className={styles.feedback} role="status"><strong>{score.data.passed?'You figured it out!':'A useful experiment. Try one more change.'}</strong><p>{score.data.xp_awarded>0?`You earned ${score.data.xp_awarded} XP.`:score.data.passed?'This game has already earned its XP. New puzzles still help you practise.':'No XP this time. A different result can tell you what to try next.'}</p></div>}
            {scenario&&signedIn&&<button className="btn quiet" disabled={explain.isPending} onClick={()=>explain.mutate()}><Glyph name="spark" size={17}/>{explain.isPending?'Senku is reading this test':explanationWaiting?'Reopen the explanation':'Why did that happen?'}</button>}
            {explain.error&&<p role="alert" className="notice alert">{message(explain.error)} Try again to reopen the same explanation.</p>}
            {explanationWaiting&&<p role="status" className="notice">The explanation is still being prepared. Reopening it checks the same request.</p>}{explain.data&&!explanationWaiting&&<div className={`solid panel ${styles.explanation}`}><div className={styles.storyHeading}><Mascot mood="think" size={64}/><h3>Let’s work it out</h3></div><p>{explain.data.explanation}</p>{explain.data.hint&&<p className="muted">{explain.data.hint}</p>}<p className="faint">{explain.data.source==='gemini'?'An explanation based on your saved test.':'Feedback based on the model and your saved test.'}</p></div>}
            <details className="more"><summary>Exact results and exports</summary><div style={{paddingTop:'.75rem'}}><RunResult run={run}/></div></details>
            <p className="faint">The score uses saved test {shortId(run.id)}. Changing a control changes your live idea, not that saved test.</p>
            <Link className="btn quiet small" href={`/lab/${manifest.id}?v=${manifest.version}&runs=${run.id}`}><Glyph name="flask" size={16}/>Explore this test in Lab</Link>
          </div>}
        </section>
        {!!history.length&&<details className="glass panel more"><summary>Your recent tests</summary><ul className={styles.history}>{history.map(h=><li key={h.id}><span>Test {shortId(h.id)}</span><strong>{fmt(h.metric)} {unit}</strong></li>)}</ul></details>}
        <details className="glass panel more"><summary>Model rules and limitations</summary><div style={{paddingTop:'1rem'}}><ModelCard manifest={manifest}/></div></details>
      </div>
      <section className={`glass panel ${styles.controls}`} aria-labelledby="game-controls">
        <div className="panel-title"><h2 id="game-controls">Try changing…</h2><button className="btn ghost small" onClick={reset} disabled={busy||generating}><Glyph name="reset" size={15}/>Start again</button></div>
        {editable.map(name=><FriendlyControl key={name} manifest={manifest} name={name} values={values} onChange={setValues} descriptor={scenario?.controls.find(c=>c.key===name)} disabled={busy||generating}/>)}
        <details className="more"><summary>Exact values and fixed conditions</summary><div className="stack snug" style={{paddingTop:'.75rem'}}><ParameterControls defaultPrecise manifest={editableManifest} values={values} onChange={setValues} disabled={busy||generating}/>{!!fixed.length&&<><p className="faint">These conditions stay fixed for this puzzle.</p><dl className={styles.fixedConditions}>{fixed.map(([name,spec])=><div key={name}><dt>{label(name)}</dt><dd>{typeof values[name]==='number'?fmt(Number(values[name])):values[name]} {unitText(spec.unit)}</dd></div>)}</dl></>}{scenario?<p className="faint">Sample seed: {seed}, fixed for this scenario.</p>:<label className={`field ${styles.seed}`}><span>Sample seed</span><input type="number" className="input num" min={0} max={2147483647} step={1} value={seed} disabled={busy} onChange={e=>setSeed(Math.max(0,Math.min(2147483647,Math.trunc(Number(e.target.value)||0))))}/></label>}</div></details>
        <div className="stack" style={{marginTop:'1rem'}}>{launch.isError&&<button className="btn" disabled={busy||generating||!preview.output} onClick={()=>void start()}><Glyph name="run" size={16}/>{busy?'Saving your idea':'Retry saving this idea'}</button>}{launch.error&&<p role="alert" className="notice alert">{message(launch.error)}</p>}<p className="faint" role="status">{busy?'Saving your checked model result…':passed&&changed?'Goal reached. Your result saves automatically.':'Keep exploring. Reach the goal to save your result automatically.'}</p><p className="faint">Your idea updates as you explore. Senku checks your saved result before recording a score.</p><p className="faint">A test records the exact model settings so its result can be checked and replayed.</p></div>
      </section>
    </div>}
    <AccountDialog open={open} onOpenChange={setOpen}/>
  </div>;
}

function GameLoader({game,challenge}:{game:Game;challenge?:Challenge}) {
  const experiment=useExperiment(game.experiment,challenge?.definition.experiment_version);
  if(experiment.error)return <div className="page"><ErrorState error={experiment.error} retry={experiment.refetch} what="game"/></div>;
  if(!experiment.data)return <div className="page" aria-busy="true"><div className="skeleton" style={{height:'30rem'}}/></div>;
  return <PlayableGame key={game.id} game={game} manifest={experiment.data} challenge={challenge}/>;
}

export function ChallengeGame({id}:{id:string}) {
  const challenges=useChallenges();
  const game=games.find(g=>g.id===id);
  if(!game)return <div className="page"><ErrorState error={new ApiError(404,'not_found','Game not found')} what="game"/></div>;
  return <GameLoader game={game} challenge={challenges.data?.find(c=>c.id===game.id)}/>;
}
