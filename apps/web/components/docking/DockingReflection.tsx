'use client';
import { useEffect,useState } from 'react';
import { api } from '../../lib/api';
import { dockingReflectionKey } from '../../lib/docking';
import type { CompanionResponse } from '../../lib/companion';
import type { RunRecord } from '../../lib/runs';
import { useSession } from '../../lib/session';
import { Mascot } from '../Mascot';
import s from '../../app/docking/docking.module.css';
type Saved={key:string;id?:string;result?:CompanionResponse['response'];failed?:boolean;terminal?:boolean};
export function DockingReflection({run}:{run:RunRecord}){
 const owner=useSession(state=>state.user?.id),[state,setState]=useState<'loading'|'ready'|'failed'>('loading'),[answer,setAnswer]=useState<CompanionResponse['response']>(null),[retry,setRetry]=useState(0),[terminalFailure,setTerminalFailure]=useState(false);
 useEffect(()=>{if(!owner)return;let cancelled=false;const storage=`senku:docking-reflection:${owner}:${run.id}`;
  const write=(value:Saved)=>{try{localStorage.setItem(storage,JSON.stringify(value))}catch{}};
  (async()=>{
   let saved:Saved={key:dockingReflectionKey(run.id)};try{const value=JSON.parse(localStorage.getItem(storage)??'null') as Saved|null;if(value?.key===saved.key||value?.key.startsWith(saved.key+'-'))saved=value}catch{}
   if(saved.result){setAnswer(saved.result);setState('ready');return}
   if(saved.failed&&!retry){setTerminalFailure(!!saved.terminal);setState('failed');return}
   setState('loading');write(saved);
   try{
    const body={message:'Help me understand these docking results. Compare the returned poses with the known crystal molecule, explain what their estimated scores can and cannot tell me, and suggest one simple observation to make. The protein is rigid; do not claim measured binding strength, efficacy, or a cellular outcome.',experiment_id:run.experiment_id,experiment_version:run.experiment_version,run_id:run.id,history:[]};
    let response=saved.id?await api<CompanionResponse>(`/v1/companion/responses/${saved.id}`,{auth:true}):await api<CompanionResponse>('/v1/companion/respond',{method:'POST',auth:true,idempotencyKey:saved.key,body});
    saved.id=response.id;write(saved);const deadline=Date.now()+125000;
    while(response.status==='running'||response.status==='queued'){if(cancelled)return;if(Date.now()>deadline)throw Error('not_ready');await new Promise(resolve=>setTimeout(resolve,1500));if(cancelled)return;response=await api<CompanionResponse>(`/v1/companion/responses/${response.id}`,{auth:true})}
    if(response.status!=='completed'||!response.response){saved.terminal=true;if(!cancelled)setTerminalFailure(true);throw Error('failed')}saved.result=response.response;delete saved.failed;write(saved);if(!cancelled){setAnswer(response.response);setState('ready')}
   }catch{saved.failed=true;write(saved);if(!cancelled)setState('failed')}
  })();return()=>{cancelled=true};
 },[owner,run.id,run.experiment_id,run.experiment_version,retry]);
 return <section className={s.reflection} aria-label="Senku’s result reflection"><Mascot mood={state==='loading'?'think':'wave'} size={68}/><div className={s.reflectionCopy}><h3>{state==='loading'?'Let’s make sense of it':'A little help from Senku'}</h3>{state==='loading'?<p role="status">Senku is looking at your saved poses and their limitations…</p>:state==='failed'?<><p>Your poses are ready, but Senku’s reflection could not load. You can still compare every result below.</p><button className="btn quiet small" type="button" onClick={()=>{if(terminalFailure&&owner){try{localStorage.setItem(`senku:docking-reflection:${owner}:${run.id}`,JSON.stringify({key:dockingReflectionKey(run.id,crypto.randomUUID())}))}catch{}setTerminalFailure(false)}setRetry(n=>n+1)}}>{terminalFailure?'Try a new reflection · 1 lab unit':'Resume reflection'}</button></>:<><p>{answer?.explanation}</p>{answer?.reflection_question&&<p className={s.reflectionQuestion}>{answer.reflection_question}</p>}<span className="faint">An educational interpretation. Check it against the saved results.</span></>}</div></section>;
}
