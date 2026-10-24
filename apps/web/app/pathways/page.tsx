'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactFlow, Background, Controls, Position, useNodesState, type Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { pathwaySchema, type Pathway } from '@senku/experiment-schema';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useRun, useUsage } from '../../lib/runs';
import { RunResult } from '../../components/RunResult';
import { RunChart } from '../../components/RunChart';
import { AccountDialog } from '../../components/AccountDialog';
import styles from './pathways.module.css';

const initial:Pathway={name:'My reaction network',species:[{id:'S1',initial_mM:10},{id:'S2',initial_mM:0}],reactions:[{id:'R1',reactants:[{species:'S1',stoichiometry:1}],products:[{species:'S2',stoichiometry:1}],rate_constant:0.1}]};
type Saved={id:string;name:string;content_hash:string;created_at:string;sbml?:string;graph?:Pathway};
const errorText=(e:unknown)=>e instanceof Error?e.message:'The network could not be processed. Try again.';
export default function PathwayBuilder(){
  const [graph,setGraph]=useState<Pathway>(initial),[loaded,setLoaded]=useState(false),[compiled,setCompiled]=useState<Saved|null>(null);
  const [source,setSource]=useState('S1'),[target,setTarget]=useState('S2'),[rate,setRate]=useState(.1),[duration,setDuration]=useState(30),[runId,setRunId]=useState<string>(),[account,setAccount]=useState(false);
  const [nodes,setNodes,onNodesChange]=useNodesState([] as {id:string;data:{label:string};position:{x:number;y:number};sourcePosition:Position;targetPosition:Position}[]);
  const user=useSession(s=>s.user), signed=!!user&&user.role!=='guest', usage=useUsage(),qc=useQueryClient();
  const saved=useQuery({queryKey:['pathways',user?.id],queryFn:()=>api<Saved[]>('/v1/pathways',{auth:true}),enabled:signed});
  const run=useRun(runId);
  useEffect(()=>{try{const draft=localStorage.getItem('senku-pathway-draft');if(draft)setGraph(pathwaySchema.parse(JSON.parse(draft)));}catch{}setLoaded(true);},[]);
  useEffect(()=>{if(loaded)localStorage.setItem('senku-pathway-draft',JSON.stringify(graph));},[graph,loaded]);
  useEffect(()=>setNodes(prior=>graph.species.map((s,i)=>({id:s.id,data:{label:`${s.id} · ${s.initial_mM} mM`},position:prior.find(n=>n.id===s.id)?.position??{x:(i%3)*190,y:Math.floor(i/3)*120},sourcePosition:Position.Right,targetPosition:Position.Left}))),[graph.species,setNodes]);
  const edit=(g:Pathway)=>{setGraph(g);setCompiled(null);};
  const addReaction=(from=source,to=target)=>{if(!from||!to||from===to||graph.reactions.length>=32)return;const n=Math.max(0,...graph.reactions.map(r=>Number(r.id.slice(1))))+1;edit({...graph,reactions:[...graph.reactions,{id:`R${n}`,reactants:[{species:from,stoichiometry:1}],products:[{species:to,stoichiometry:1}],rate_constant:rate}]});};
  const compile=useMutation({mutationFn:async()=>{const value=pathwaySchema.parse(graph);return api<Saved>('/v1/pathways/compile',{method:'POST',auth:true,idempotencyKey:crypto.randomUUID(),body:value});},onSuccess:v=>{setCompiled(v);void qc.invalidateQueries({queryKey:['pathways']});}});
  const launch=useMutation({mutationFn:async()=>{if(!compiled)throw Error('Compile your current network first.');return api<{id:string}>('/v1/runs',{method:'POST',auth:true,idempotencyKey:crypto.randomUUID(),body:{experiment_id:'pathway-playground',experiment_version:'1.0.0',pathway_id:compiled.id,parameters:{duration},seed:0}});},onSuccess:r=>{setRunId(r.id);void qc.invalidateQueries({queryKey:['usage']});}});
  const open=useMutation({mutationFn:(id:string)=>api<Saved>(`/v1/pathways/${id}`,{auth:true}),onSuccess:v=>{if(v.graph)setGraph(v.graph);setCompiled(v);}});
  const edges=graph.reactions.flatMap(r=>r.reactants.flatMap(a=>r.products.map(b=>({id:`${r.id}-${a.species}-${b.species}`,source:a.species,target:b.species,label:`${r.id}: k=${r.rate_constant}`,animated:false}))));
  return <div className="page stack loose"><header className="stack snug"><h1>Build a pathway</h1><p className="muted">Connect species, set concentrations and reaction rates, then test your network with a real solver.</p></header>
    <div className={styles.layout}><section className="glass panel stack"><div className="spread"><h2>Reaction network</h2><span className="chip">Draft saved on this browser</span></div>
      <label className="field"><span>Network name</span><input className="input" maxLength={80} value={graph.name} onChange={e=>edit({...graph,name:e.target.value})}/></label>
      <div className={styles.graph} role="region" aria-label="Reaction network diagram. Use the forms below as a keyboard alternative."><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onConnect={(c:Connection)=>addReaction(c.source,c.target)} fitView minZoom={.3} maxZoom={2} ariaLabelConfig={{'controls.zoomIn.ariaLabel':'Zoom in','controls.zoomOut.ariaLabel':'Zoom out'}}><Background/><Controls showInteractive={false}/></ReactFlow></div>
      <p className="faint">Drag nodes to arrange them. Connect a right handle to a left handle, or use Add reaction below. Layout changes do not change the scientific model.</p>
      <h3>Species and starting concentrations</h3><div className="stack snug">{graph.species.map(s=><div className={styles.species} key={s.id}><strong>{s.id}</strong><label className="field"><span>Starting concentration (mM)</span><input aria-label={`${s.id} starting concentration in mM`} className="input" type="number" min={0} max={100} step={.1} value={s.initial_mM} onChange={e=>edit({...graph,species:graph.species.map(x=>x.id===s.id?{...x,initial_mM:Math.min(100,Math.max(0,Number(e.target.value)))}:x)})}/></label><button className="btn ghost" disabled={graph.species.length<=1} onClick={()=>edit({...graph,species:graph.species.filter(x=>x.id!==s.id),reactions:graph.reactions.filter(r=>![...r.reactants,...r.products].some(x=>x.species===s.id))})}>Remove {s.id}</button></div>)}</div>
      <div><button className="btn quiet" disabled={graph.species.length>=24} onClick={()=>{const n=Math.max(...graph.species.map(s=>Number(s.id.slice(1))))+1;edit({...graph,species:[...graph.species,{id:`S${n}`,initial_mM:0}]});}}>Add species</button></div>
      <h3>Mass-action reactions</h3>{graph.reactions.map(r=><div className={styles.reaction} key={r.id}><strong>{r.id}: {r.reactants.map(x=>x.species).join(' + ')} → {r.products.map(x=>x.species).join(' + ')}</strong><label className="field"><span>Rate constant</span><input className="input" aria-label={`${r.id} rate constant`} type="number" min={0} max={10} step={.01} value={r.rate_constant} onChange={e=>edit({...graph,reactions:graph.reactions.map(x=>x.id===r.id?{...x,rate_constant:Math.min(10,Math.max(0,Number(e.target.value)))}:x)})}/></label><button className="btn ghost" onClick={()=>edit({...graph,reactions:graph.reactions.filter(x=>x.id!==r.id)})}>Remove reaction</button></div>)}
      <div className="solid panel stack"><h3>Add reaction</h3><div className={styles.add}><label className="field"><span>Reactant</span><select className="input" value={source} onChange={e=>setSource(e.target.value)}>{graph.species.map(s=><option key={s.id}>{s.id}</option>)}</select></label><label className="field"><span>Product</span><select className="input" value={target} onChange={e=>setTarget(e.target.value)}>{graph.species.map(s=><option key={s.id}>{s.id}</option>)}</select></label><label className="field"><span>Rate constant</span><input className="input" type="number" min={0} max={10} step={.01} value={rate} onChange={e=>setRate(Math.min(10,Math.max(0,Number(e.target.value))))}/></label></div><button className="btn quiet" disabled={source===target||!graph.species.some(s=>s.id===source)||!graph.species.some(s=>s.id===target)} onClick={()=>addReaction()}>Add reaction</button></div>
    </section><aside className="stack"><section className="glass panel stack"><h2>Compile and run</h2><p className="faint">A mass-action teaching model. Rate-constant units depend on reaction order. This network is not an experimentally calibrated biological prediction.</p>{!signed?<button className="btn" onClick={()=>setAccount(true)}>Sign in to save and compile</button>:<button className="btn" disabled={compile.isPending||!graph.reactions.length||!graph.name.trim()} onClick={()=>compile.mutate()}>{compile.isPending?'Compiling':'Compile network'}</button>}
      {compiled&&<p className="notice ok">Your current network is compiled and saved.</p>}
      <label className="field"><span>Simulation duration (min)</span><input className="input" type="number" min={1} max={120} value={duration} onChange={e=>setDuration(Math.max(1,Math.min(120,Number(e.target.value))))}/></label>
      <button className="btn hema" disabled={!compiled||!usage.data?.member?.active||launch.isPending} onClick={()=>launch.mutate()}>{launch.isPending?'Starting':'Run pathway'}</button>{!usage.data?.member?.active&&<p className="faint">A lab invitation unlocks remote simulations. You can build and save networks before receiving access.</p>}
      {(compile.error||launch.error||open.error)&&<p role="alert" className="notice alert">{errorText(compile.error??launch.error??open.error)}</p>}
      {compiled?.sbml&&<button className="btn quiet" onClick={()=>{const u=URL.createObjectURL(new Blob([compiled.sbml!],{type:'application/xml'}));Object.assign(document.createElement('a'),{href:u,download:'senku-pathway.xml'}).click();URL.revokeObjectURL(u);}}>Download SBML</button>}
    </section>{signed&&<section className="glass panel stack"><h2>Saved networks</h2>{saved.isLoading?<p className="faint">Loading your networks</p>:saved.error?<p className="notice alert">Could not load saved networks.</p>:saved.data?.length?saved.data.map(s=><button className="btn quiet" key={s.id} onClick={()=>open.mutate(s.id)}>{s.name}</button>):<p className="faint">Compiled networks will appear here.</p>}</section>}</aside></div>
    {run.data&&<section className="glass panel stack"><h2>Pathway result</h2><RunChart runs={[run.data]}/><RunResult run={run.data}/></section>}{run.error&&<p className="notice alert">{errorText(run.error)}</p>}
    <AccountDialog open={account} onOpenChange={setAccount}/>
  </div>;
}
