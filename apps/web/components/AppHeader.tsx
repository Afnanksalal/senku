'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useSession } from '../lib/session';
import { useLearningProgress } from '../lib/profile';
import { AccountDialog } from './AccountDialog';
import { BrandMark, Glyph } from './Glyph';
import s from './AppHeader.module.css';
const primary = [['/home','Home','home'],['/learn','Learn','book'],['/challenges','Play','spark'],['/discover','Research','search'],['/profile','Profile','person']] as const;
const tools = [
  ['/','Explore','Find your next experiment','search'], ['/lab','Lab','Change a parameter. See what happens.','flask'],
  ['/docking','Molecule docking','Discover how molecules fit a protein','flask'],
  ['/pathways','Pathways','Build a biological network','compare'], ['/companion','Ask Senku','Talk through a scientific question','spark'],
  ['/rooms','Shared labs','Experiment with someone else','person'], ['/classroom','Classroom','Assignments and learning together','book'],
  ['/offline','Offline','Take your lessons with you','download'], ['/profile','Profile','Your progress, goals and account','person'],
] as const;
export function AppHeader() {
  const path=usePathname(), user=useSession(s=>s.user), progress=useLearningProgress();
  const toolTrigger=useRef<HTMLButtonElement>(null);
  const [account,setAccount]=useState(false), [toolkit,setToolkit]=useState(false), [hydrated,setHydrated]=useState(false);
  useEffect(()=>setHydrated(true),[]);
  useEffect(()=>setToolkit(false),[path]);
  useEffect(()=>{const open=()=>setAccount(true);window.addEventListener('senku:open-account',open);return()=>window.removeEventListener('senku:open-account',open);},[]);
  const signed=hydrated&&user&&user.role!=='guest', marketing=path==='/welcome';
  const active=(href:string)=>href==='/'?path==='/':path===href||path.startsWith(href+'/');
  return <>
    <header className={`${s.header} glass`} data-marketing={marketing}>
      <Link href={marketing?'/welcome':'/home'} className={`brand ${s.brand}`} aria-label="Senku home"><BrandMark/>Senku</Link>
      <nav className={s.desktop} aria-label="Main">{marketing?<><a href="#how-it-works">How it works</a><Link href="/">Experiments</Link></>:primary.slice(0,4).map(([href,title])=><Link key={href} href={href} prefetch={false} aria-current={active(href)?'page':undefined}>{title}</Link>)}</nav>
      <div className={s.actions}>
        {signed&&progress.data&&!marketing&&<Link href="/profile" className={s.xp} aria-label={`${progress.data.xp} learning XP`}><Glyph name="spark" size={17}/><span>{progress.data.xp}<span className={s.xpLabel}> XP</span></span></Link>}
        {!marketing&&<button ref={toolTrigger} className={`btn quiet small ${s.tools}`} onClick={()=>setToolkit(true)}><Glyph name="grid" size={19}/><span>Tools</span></button>}
        {signed?<Link className={s.avatar} href="/profile" aria-label={`Open ${user.display_name}'s profile`}>{user.display_name.slice(0,1).toUpperCase()}</Link>:<button className="btn quiet small" onClick={()=>setAccount(true)}>Sign in</button>}
        {marketing&&<Link className={`btn small ${s.start}`} href="/learn">Start learning</Link>}
      </div>
    </header>
    {!marketing&&<nav className={s.bottom} aria-label="Mobile main">{primary.map(([href,title,icon])=><Link key={href} href={href} prefetch={false} aria-current={active(href)?'page':undefined}><Glyph name={icon} size={23}/><span>{title}</span></Link>)}</nav>}
    <Dialog.Root open={toolkit} onOpenChange={setToolkit}><Dialog.Portal><Dialog.Overlay className={s.overlay}/><Dialog.Content className={s.sheet} onCloseAutoFocus={e=>{e.preventDefault();toolTrigger.current?.focus();}}>
      <div className={s.sheetHeading}><div className="stack tight"><Dialog.Title>Your science toolkit</Dialog.Title><Dialog.Description className="muted">Follow your curiosity. Everything is here.</Dialog.Description></div><Dialog.Close className="icon-btn" aria-label="Close toolkit"><Glyph name="close"/></Dialog.Close></div>
      <div className={s.toolGrid}>{tools.map(([href,title,description,icon])=><Link href={href} prefetch={false} className={s.toolCard} key={href} aria-current={active(href)?'page':undefined} onClick={()=>setToolkit(false)}><span className={s.toolIcon}><Glyph name={icon} size={24}/></span><span><strong>{title}</strong><small>{description}</small></span><Glyph name="next" size={17}/></Link>)}</div>
      <div className={s.footer}><Link href="/welcome" onClick={()=>setToolkit(false)}>About Senku</Link><button className="btn quiet small" onClick={()=>{setToolkit(false);setAccount(true);}}>Account options</button></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <AccountDialog open={account} onOpenChange={setAccount}/>
  </>;
}
