'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
type Share={id:string;resource_id:string;resource_type:string;role:string;expires_at:string;revoked_at:string|null};
export function ShareResource({type,id}:{type:'run'|'room'|'investigation';id:string}){
  const [open,setOpen]=useState(false),[url,setUrl]=useState(''),[copied,setCopied]=useState(false);
  const user=useSession(s=>s.user),qc=useQueryClient();
  const list=useQuery({queryKey:['shares',user?.id],queryFn:()=>api<Share[]>('/v1/shares',{auth:true}),enabled:open&&!!user&&user.role!=='guest'});
  const create=useMutation({mutationFn:()=>api<{id:string;token:string}>('/v1/shares',{method:'POST',auth:true,body:{resource_type:type,resource_id:id,role:'viewer',expires_in_hours:24}}),onSuccess:r=>{setUrl(`${location.origin}/shared/${r.token}`);setCopied(false);void qc.invalidateQueries({queryKey:['shares']});}});
  const revoke=useMutation({mutationFn:(sid:string)=>api(`/v1/shares/${sid}`,{method:'DELETE',auth:true}),onSuccess:()=>{setUrl('');void qc.invalidateQueries({queryKey:['shares']});}});
  return <details className="more" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Share this {type}</summary><div className="stack snug" style={{paddingTop:12}}><p className="faint">A private viewer link expires after 24 hours. Anyone with it can read the shared result until you revoke it.</p><div><button className="btn quiet" disabled={create.isPending} onClick={()=>create.mutate()}>{create.isPending?'Creating link':'Create viewer link'}</button></div>{url&&<div className="stack snug"><input aria-label="Private share link" className="input" value={url} readOnly onFocus={e=>e.target.select()}/><button className="btn quiet" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);}catch{setCopied(false);}}}>{copied?'Copied':'Copy link'}</button></div>}{(create.error||revoke.error)&&<p role="alert" className="notice alert">{(create.error??revoke.error)?.message}</p>}{list.data?.filter(s=>s.resource_id===id&&s.resource_type===type&&!s.revoked_at&&Date.parse(s.expires_at)>Date.now()).map(s=><div className="spread" key={s.id}><span className="faint">Viewer link expires {new Date(s.expires_at).toLocaleString()}</span><button className="btn ghost" disabled={revoke.isPending} onClick={()=>revoke.mutate(s.id)}>Revoke link</button></div>)}</div></details>;
}
