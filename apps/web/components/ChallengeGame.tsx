'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { localScalars, localUnits, validateParameters, type Parameters } from '@senku/experiment-schema';
import { api, ApiError, type CatalogExperiment } from '../lib/api';
import { games, useChallenges, type Challenge, type ChallengeScore, type Game } from '../lib/challenges';
import { useExperiment } from '../lib/catalog';
import { useLaunchRun, useRun, useCancelRun, terminal, type RunRecord } from '../lib/runs';
import { useSession } from '../lib/session';
import { fmt, label, unitText, shortId } from '../lib/format';
import { defaults, ParameterControls } from './Parameters';
import { AccountDialog } from './AccountDialog';
import { ErrorState, ModelCard, RunTargetNote } from './States';
import { Glyph } from './Glyph';
import { RunResult } from './RunResult';
import styles from '../app/challenges/challenges.module.css';

const message=(error:unknown)=>error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'The request did not finish. Try again.';
const bounded=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

function ModelScene({game,values,output,seed}:{game:Game;values:Parameters;output:Record<string,number>;seed:number}) {
  if(game.experiment==='cell-energy') {
    const energy=output.energy_index;
    return <svg className={styles.scene} viewBox="0 0 560 310" role="img" aria-label={`Model energy index ${fmt(energy)} percent. Oxygen ${values.oxygen}, glucose ${values.glucose}, demand ${values.demand}.`}>
      <ellipse cx="280" cy="145" rx="130" ry="100" className={styles.cell}/>
      <rect x="236" y="77" width="88" height="134" rx="18" fill="white" stroke="var(--c)" strokeWidth="3"/>
      <rect x="244" y={203-118*bounded(energy/100)} width="72" height={118*bounded(energy/100)} rx="10" fill="var(--c)" className={styles.fluid}/>
      <text x="280" y="258" textAnchor="middle" className={styles.big}>{fmt(energy)}%</text>
      <text x="280" y="286" textAnchor="middle">Model energy index</text>
      <text x="75" y="65" textAnchor="middle">Oxygen</text>
      <rect x="50" y="85" width="50" height="145" rx="14" fill="white" stroke="var(--line)"/>
      <rect x="55" y={225-135*bounded(Number(values.oxygen)/100)} width="40" height={135*bounded(Number(values.oxygen)/100)} rx="9" fill="var(--cobalt)" className={styles.fluid}/>
      <text x="75" y="255" textAnchor="middle">{fmt(Number(values.oxygen))}</text>
      <text x="485" y="65" textAnchor="middle">Glucose</text>
      <rect x="460" y="85" width="50" height="145" rx="14" fill="white" stroke="var(--line)"/>
      <rect x="465" y={225-135*bounded(Number(values.glucose)/100)} width="40" height={135*bounded(Number(values.glucose)/100)} rx="9" fill="var(--pollen)" className={styles.fluid}/>
      <text x="485" y="255" textAnchor="middle">{fmt(Number(values.glucose))}</text>
    </svg>;
  }
  if(game.experiment==='genetics-lab') {
    const count=Number(values.sample_size);
    return <svg className={styles.scene} viewBox="0 0 560 310" role="img" aria-label={`Seed ${seed}: ${output.AA} AA, ${output.Aa} Aa and ${output.aa} aa offspring out of ${count}.`}>
      <text x="280" y="37" textAnchor="middle">{values.parent1} × {values.parent2}, seed {seed}</text>
      {(['AA','Aa','aa'] as const).map((key,i)=><g key={key}>
        <rect x={72+i*160} y="65" width="96" height="170" rx="15" fill="white" stroke="var(--line)"/>
        <rect className={styles.fluid} x={78+i*160} y={229-158*bounded(output[key]/count)} width="84" height={158*bounded(output[key]/count)} rx="10" fill={`var(--${['eosin','hema','cobalt'][i]})`}/>
        <text x={120+i*160} y="264" textAnchor="middle" className={styles.big}>{fmt(output[key])}</text>
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
  return <svg className={styles.scene} viewBox="0 0 560 310" role="img" aria-label={`${enzyme?'Substrate response':'Population growth'} curve calculated by the approved analytical kernel. Current ${label(game.metric)} ${fmt(output[game.metric])}.`}>
    <path d="M45 40V240H520" className={styles.axis} fill="none"/>
    <path d={`M45 ${referenceY}H520`} className={styles.axis} strokeDasharray="4 6" fill="none"/>
    <polyline points={curve} className={styles.curve}/>
    <circle cx={currentX} cy={currentY} r="7" className={styles.valueDot}/>
    <text x="45" y="28">{enzyme?'Reaction rate (mM/min)':'Population (individuals)'}</text>
    <text x="45" y="263">{fmt(xmin)}</text><text x="510" y="263" textAnchor="end">{fmt(xmax)}</text>
    <text x="280" y="293" textAnchor="middle">{enzyme?'Substrate (mM)':'Time (min)'}</text>
    <text x="520" y={referenceY-5} textAnchor="end">{enzyme?'Vmax':'Capacity'} {fmt(reference)}</text>
  </svg>;
}

function PlayableGame({game,manifest,challenge}:{game:Game;manifest:CatalogExperiment;challenge?:Challenge}) {
  const [values,setValues]=useState<Parameters>(()=>({...defaults(manifest),...game.initial}));
  const [seed,setSeed]=useState(0);
  const [runRef,setRunRef]=useState<{id:string;origin:RunRecord['origin']}>();
  const [eventId,setEventId]=useState('');
  const [open,setOpen]=useState(false);
  const [history,setHistory]=useState<{id:string;metric:number;origin:string}[]>([]);
  const launch=useLaunchRun(manifest);
  const result=useRun(runRef?.id,runRef?.origin);
  const cancel=useCancelRun();
  const user=useSession(s=>s.user);
  const qc=useQueryClient();
  const metric=challenge?.definition.metric??game.metric;
  const target=challenge?.definition.minimum??game.target;
  const preview=useMemo(()=>{
    try { return {output:localScalars(manifest.id,validateParameters(manifest,values),seed),error:null}; }
    catch(error) { return {output:null,error:message(error)}; }
  },[manifest,values,seed]);
  const score=useMutation({
    mutationFn:()=>{
      const run=result.data;
      if(!run||run.status!=='completed'||!run.result||!challenge)throw Error('Finish a valid run before submitting.');
      return api<ChallengeScore>(`/v1/challenges/${challenge.id}/attempts`,{method:'POST',auth:true,body:{event_id:eventId,...(run.origin==='server'?{run_id:run.id}:{local:{parameters:run.parameters,seed:run.seed}})}});
    },
    onSuccess:()=>{void qc.invalidateQueries({queryKey:['progress']});},
  });
  const start=async()=>{
    score.reset();
    try {
      const run=await launch.mutateAsync({parameters:values,seed});
      setRunRef({id:run.id,origin:run.origin});setEventId(crypto.randomUUID());
      if(run.status==='completed'&&run.result)setHistory(h=>[{id:run.id,metric:run.result!.scalars[metric],origin:run.origin},...h].slice(0,6));
      void qc.invalidateQueries({queryKey:['usage']});
    } catch { /* Mutation feedback is rendered below without replacing a previous run. */ }
  };
  const run=result.data;
  const busy=launch.isPending||!!run&&!terminal(run.status);
  const actual=preview.output?.[metric];
  const signedIn=!!user&&user.role!=='guest';
  const passed=actual!==undefined&&actual>=target;
  const unit=unitText(localUnits(manifest)[metric]);

  return <div className="page stack loose" data-stain={game.stain}>
    <header className={styles.header}>
      <Link className="btn ghost small" style={{justifySelf:'start'}} href="/challenges"><Glyph name="back" size={16}/>All games</Link>
      <h1>{game.name}</h1><p className="muted">{game.description}</p>
      <div className="row"><span className="chip tone">{game.subtitle}</span><span className="chip">Goal: {label(metric)} ≥ {fmt(target)} {unit}</span></div>
    </header>
    <div className={styles.layout}>
      <div className={styles.scenePanel}>
        <section className="glass panel stack" aria-labelledby="game-scene">
          <div className={styles.previewLabel}><h2 id="game-scene">Your model, live</h2><span className="faint">Preview, not a saved run</span></div>
          {preview.output ? <ModelScene game={game} values={values} output={preview.output} seed={seed}/> : <p role="alert" className="notice alert">{preview.error}</p>}
          <div className={styles.metric}>
            <div><div className="faint">{label(metric)}</div><strong>{actual===undefined?'':fmt(actual)}</strong><span className="faint"> {unit}</span></div>
            <div className={styles.target}><span className="chip tone">{passed?'Preview reaches the goal':'Keep experimenting'}</span></div>
          </div>
          <progress className={styles.meter} value={actual===undefined?0:bounded(actual/target)*100} max={100} aria-label="Progress toward the model target"/>
          <p className={styles.caption}>{game.tactic}</p>
          <p className="faint">Visuals are symbolic views of the approved model. Quantities are calculated from the current inputs; they are not measurements.</p>
        </section>
        <section className="glass panel stack" aria-labelledby="challenge-result">
          <h2 id="challenge-result">Test your solution</h2>
          {run ? <RunResult run={run} onCancel={()=>cancel.mutate(run.id)} cancelling={cancel.isPending}/> : <p className="muted">Change the controls, then test your solution. Your completed run is the evidence for your score.</p>}
          {result.error&&<p role="alert" className="notice alert">{message(result.error)}</p>}
          {run?.status==='completed'&&run.result&&<div className={styles.score}>
            <p className="faint">This score uses saved run {shortId(run.id)}, with the settings recorded in its provenance. Moving a control changes the preview, not this saved run.</p>
            {challenge ? signedIn ? <button className="btn hema" disabled={score.isPending||score.isSuccess} onClick={()=>score.mutate()}><Glyph name="check" size={18}/>{score.isPending?'Checking the saved run':score.isSuccess?'Score recorded':'Submit score'}</button> : <><p className="muted">Guest practice earns no XP. Sign in to submit this device run for a server-checked score.</p><button className="btn quiet" onClick={()=>setOpen(true)}>Sign in to record your score</button></> : <p className="notice warn">This game is available for practice. Its scoring rule is not published on the server yet.</p>}
            {score.error&&<p role="alert" className="notice alert">{message(score.error)} Retry uses the same attempt ID.</p>}
            {score.data&&<div className={styles.feedback} role="status"><strong>{score.data.passed?'Goal reached!':'Not quite yet.'}</strong><p>The checked {label(metric).toLowerCase()} is {fmt(score.data.metric)} {unit}. {score.data.xp_awarded>0?`You earned ${score.data.xp_awarded} XP.`:score.data.passed?'This challenge was already rewarded, so no additional XP was added.':'Adjust your model and try another run.'}</p></div>}
            <Link className="btn quiet small" href={`/lab/${manifest.id}?v=${manifest.version}&runs=${run.id}`}><Glyph name="flask" size={16}/>Inspect this run in Lab</Link>
          </div>}
        </section>
        {!!history.length&&<section className="glass panel stack"><h2>Recent device trials</h2><ul className={styles.history}>{history.map(h=><li key={h.id}><span>Run {shortId(h.id)}</span><strong>{fmt(h.metric)} {unit}</strong></li>)}</ul></section>}
        <details className="glass panel more"><summary>Model rules and limitations</summary><div style={{paddingTop:'1rem'}}><ModelCard manifest={manifest}/></div></details>
      </div>
      <section className={`glass panel ${styles.controls}`} aria-labelledby="game-controls">
        <div className="panel-title"><h2 id="game-controls">Your controls</h2><button className="btn ghost small" onClick={()=>{setValues({...defaults(manifest),...game.initial});setSeed(0);}} disabled={busy}><Glyph name="reset" size={15}/>Reset</button></div>
        <ParameterControls manifest={manifest} values={values} onChange={setValues} disabled={busy}/>
        <label className={`field ${styles.seed}`}><span>Sample seed</span><input type="number" className="input num" min={0} max={2147483647} step={1} value={seed} disabled={busy} onChange={e=>setSeed(Math.max(0,Math.min(2147483647,Math.trunc(Number(e.target.value)||0))))}/></label>
        <div className="stack" style={{marginTop:'1rem'}}>
          <button className="btn" disabled={busy||!preview.output} onClick={()=>void start()}><Glyph name="run" size={16}/>{busy?'Testing your solution':'Test my solution'}</button>
          {launch.error&&<p role="alert" className="notice alert">{message(launch.error)}</p>}
          <RunTargetNote manifest={manifest}/>
          <p className="faint">Device play uses the same declared parameters and verification kernel. Server results may include additional trajectories.</p>
        </div>
      </section>
    </div>
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
