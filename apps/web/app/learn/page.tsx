'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLessons, useCatalog } from '../../lib/catalog';
import { useSession } from '../../lib/session';
import { api } from '../../lib/api';
import { ConceptGlyph, Glyph, stainFor } from '../../components/Glyph';
import { ErrorState } from '../../components/States';
import { label } from '../../lib/format';

type Progress = { xp: number; streak: { days: number }; lessons: {reward_key:string}[]; achievements: {id:string;name:string}[]; concepts: {concept:string;attempts:number;score:number}[] };
export default function LearnMap() {
  const lessons=useLessons(), catalog=useCatalog();
  const user=useSession(s=>s.user);
  const signedIn=!!user&&user.role!=='guest';
  const progress=useQuery({queryKey:['progress',user?.id],queryFn:()=>api<Progress>('/v1/me/progress',{auth:true}),enabled:signedIn,staleTime:15_000});
  const completed=new Set(progress.data?.lessons.map(x=>x.reward_key)??[]);
  return <div className="page stack loose">
    <header className="stack snug"><h1>Your science journey</h1><p className="muted">Choose a concept. Predict, experiment, and explain what the evidence shows.</p></header>
    {signedIn&&progress.data&&<section className="glass panel stack" aria-label="Your learning progress"><div className="readouts">
      <div className="readout"><div className="name">Learning XP</div><div className="value">{progress.data.xp}</div></div>
      <div className="readout"><div className="name">Active streak</div><div className="value">{progress.data.streak.days} days</div></div>
      <div className="readout"><div className="name">Missions completed</div><div className="value">{completed.size}</div></div>
    </div>{progress.data.achievements.length>0&&<div className="row">{progress.data.achievements.map(a=><span className="chip tone" data-stain="chlorophyll" key={a.id}><Glyph name="spark" size={16}/>{a.name}</span>)}</div>}</section>}
    {!signedIn&&<p className="notice">Explore every concept as a guest. Sign in from the header to save mastery, XP, and achievements.</p>}
    {progress.error&&<p className="notice alert">Your progress could not be loaded. Your missions are still available below.</p>}
    {lessons.error||catalog.error?<ErrorState error={lessons.error??catalog.error} what="learning map" retry={()=>{void lessons.refetch();void catalog.refetch();}}/>:lessons.isLoading||catalog.isLoading?<div className="tray" aria-busy="true">{[0,1,2].map(n=><div className="skeleton" style={{height:220}} key={n}/>)}</div>:<section className="concept-map" aria-label="Choose a learning mission">
      {lessons.data?.map((lesson,i)=>{const e=catalog.data?.find(e=>e.id===lesson.experiment_id);if(!e)return null;const done=completed.has(`lesson:${lesson.id}:${lesson.version}`);const mastery=progress.data?.concepts.find(c=>c.concept===e.learning.concept);return <article className="glass panel stack" data-stain={stainFor(e.learning.concept)} key={lesson.id}>
        <div className="spread"><span className="concept-orbit"><ConceptGlyph concept={e.learning.concept} size={32}/></span><span className="chip">{done?'Completed':'Ready to explore'}</span></div>
        <div className="stack snug"><p className="faint">{label(e.learning.concept)}</p><h2>{lesson.name}</h2><p className="muted">{e.learning.objective}</p></div>
        {mastery&&<p className="faint">{mastery.attempts} recorded {mastery.attempts===1?'attempt':'attempts'} · {Math.round(mastery.score*100)}% assessment score</p>}
        <div className="row"><Link href={`/learn/${lesson.id}`} className="btn">{done?'Revisit mission':'Start mission'}<Glyph name="next" size={16}/></Link><Link className="btn quiet" href={`/lab/${e.id}`}>Open lab</Link></div>
      </article>;})}
    </section>}
    <section className="solid panel spread"><div><h2>Put your understanding to work</h2><p className="muted">Try a model challenge or investigate your own question.</p></div><div className="row"><Link href="/challenges" className="btn hema">Play a challenge</Link><Link href="/discover" className="btn quiet">Research a question</Link></div></section>
  </div>;
}
