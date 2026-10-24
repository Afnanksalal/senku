'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import s from './PwaManager.module.css';
type InstallEvent = Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
export function PwaManager(){
 const [install,setInstall]=useState<InstallEvent|null>(null),[waiting,setWaiting]=useState<ServiceWorker|null>(null),[offline,setOffline]=useState(false),[ios,setIos]=useState(false),[dismissed,setDismissed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let disposed=false,registration:ServiceWorkerRegistration|undefined;
  const online=()=>setOffline(!navigator.onLine);
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator & {standalone?:boolean}).standalone;
  setIos((/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))&&!standalone());online();
  const before=(event:Event)=>{event.preventDefault();if(!standalone()){setInstall(event as InstallEvent);setDismissed(false);}};
  const installed=()=>{setInstall(null);setIos(false);};
  const controller=()=>{if(!disposed)setWaiting(null);};
  window.addEventListener('online',online);window.addEventListener('offline',online);window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',installed);
  if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('controllerchange',controller);void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(reg=>{if(disposed)return;registration=reg;if(reg.waiting)setWaiting(reg.waiting);reg.onupdatefound=()=>{const worker=reg.installing;if(worker)worker.onstatechange=()=>{if(!disposed&&worker.state==='installed'&&navigator.serviceWorker.controller)setWaiting(reg.waiting??worker);};};}).catch(()=>{ /* Prepared lessons show their own actionable storage errors. */ });}
  return()=>{disposed=true;if(registration)registration.onupdatefound=null;window.removeEventListener('online',online);window.removeEventListener('offline',online);window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',installed);if('serviceWorker' in navigator)navigator.serviceWorker.removeEventListener('controllerchange',controller);};
 },[]);
 const prompt=async()=>{if(!install)return;setBusy(true);setError('');try{await install.prompt();await install.userChoice;setInstall(null);}catch{setError('Installation could not start. Use your browser’s install menu if available.');}finally{setBusy(false);}};
 const update=()=>{if(!waiting)return;if(!window.confirm('Reload Senku now? Finish or save any unsent edits first. Saved lesson packs and queued attempts will remain on this device.'))return;navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});waiting.postMessage({type:'SKIP_WAITING'});};
 if(!offline&&!waiting&&(!install&&!ios||dismissed))return null;
 return <aside className={s.banner} aria-label="Senku app options">
  <div className={s.mascot} aria-hidden="true"><img src="/art/senku-mark.svg" alt="" width="44" height="44" /></div>
  <div className={s.content}>
   <strong>{offline?'A little offline adventure':waiting?'A fresh Senku is ready':'A little closer to curiosity'}</strong>
   <p>{offline?'Your saved lessons are ready to explore.':waiting?'Finish your edits, then come see what’s new.':'Add Senku to your home screen. Your next discovery is a tap away.'}</p>
   {!offline&&!waiting&&!install&&<details><summary>How to add Senku</summary><p>In Safari, tap Share, then Add to Home Screen.</p></details>}
   {error&&<p role="alert">{error}</p>}
  </div>
  <div className={s.actions}>
   {offline?<Link href="/offline" className="btn quiet small">Saved lessons</Link>:waiting?<button className="btn primary small" onClick={update}>Update Senku</button>:<>
    {install&&<button className="btn primary small" disabled={busy} onClick={()=>void prompt()}>{busy?'One moment…':'Add Senku'}</button>}
    <button className="btn ghost small" onClick={()=>setDismissed(true)}>Maybe later</button>
   </>}
  </div>
 </aside>;
}
