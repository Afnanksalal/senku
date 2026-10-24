'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from '../../lib/session';
import { useLessons, useCatalog } from '../../lib/catalog';
import { useLearningProgress, useAccountActivity, useLearningGoal, learningLevel } from '../../lib/profile';
import { useRecentRuns } from '../../lib/runs';
import { AiStart } from '../../components/AiStart';
import { Mascot } from '../../components/Mascot';
import { Glyph, ConceptGlyph } from '../../components/Glyph';
import s from './home.module.css';
export default function HomeDashboard(){
  const user=useSession(s=>s.user), progress=useLearningProgress(), activity=useAccountActivity(), goal=useLearningGoal(), lessons=useLessons(), catalog=useCatalog(), recent=useRecentRuns();
  const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
  const signed=ready&&user&&user.role!=='guest';
  const completed=new Set(progress.data?.lessons.map(l=>l.reward_key)??[]);
  const ordered=[...(lessons.data??[])].sort((a,b)=>Number(b.experiment_id==='cell-energy')-Number(a.experiment_id==='cell-energy'));
  const next=ordered.find(l=>!completed.has(`lesson:${l.id}:${l.version}`))??ordered[0];
  const experiment=catalog.data?.find(e=>e.id===next?.experiment_id);
  const today=activity.data?.days.find(d=>d.day===activity.data?.today);
  const dailyGoal=goal.data?.daily_xp_goal, xp=progress.data?.xp, level=xp===undefined?undefined:learningLevel(xp);
  return <div className={`page stack ${s.page}`}>
    <section className={s.hero}>
      <div className={s.heroCopy}>
        <div className={s.intro}>
          <p className={`hand ${s.eyebrow}`}>{signed?`Welcome back, ${user.display_name}`:'A little curiosity goes a long way'}</p>
          <h1>Where will your curiosity take you?</h1>
          <p className={s.lead}>Ask a question. Find an adventure. See what happens.</p>
        </div>
        <AiStart/>
        <div className={s.heroLinks}>
          <Link href={signed&&next?`/learn/${next.id}`:'/learn'}>{signed&&completed.size?'Continue learning':'Browse missions'}<Glyph name="next" size={16}/></Link>
          <Link href="/">Explore experiments<Glyph name="next" size={16}/></Link>
        </div>
      </div>
      <div className={s.heroVisual}><Mascot mood="wave" size={320} className={s.mascot}/><p className="hand">Small questions.<br/>Big discoveries.</p></div>
    </section>
    {signed?<section className={s.progress} aria-label="Your learning today">
      <div className={`solid ${s.goal}`}><div className="spread"><span className="row"><Glyph name="spark" size={20}/><strong>Your daily goal</strong></span><Link href="/profile#daily-goal">Edit goal</Link></div>{today&&dailyGoal!==undefined?<><p><strong className={s.big}>{today.earned_xp}</strong> / {dailyGoal} XP today</p><progress value={Math.min(today.earned_xp,dailyGoal)} max={dailyGoal} aria-label="Daily learning XP"/><p className="faint">{today.earned_xp>=dailyGoal?'Goal reached. Keep exploring if you feel like it.':'Complete a mission or challenge to earn learning points.'} Days follow UTC.</p></>:<p className="muted" role="status">{activity.error||goal.error?'Your daily progress could not be loaded.':'Loading your daily progress…'}</p>}</div>
      <Link href="/profile" className={`solid ${s.stat}`}><Glyph name="trophy" size={24}/><strong>{xp??'…'}</strong><span>Total learning XP{level?` · Level ${level.level}`:''}</span></Link>
      <Link href="/profile#profile-activity" className={`solid ${s.stat}`}><Glyph name="flame" size={24}/><strong>{progress.data?.streak.days??'…'}</strong><span>Day mission streak</span></Link>
    </section>:<div className={`solid ${s.guest}`}><span><strong>Make yourself at home.</strong> Explore as a guest, or save your XP and progress with an account.</span><button className="btn quiet small" onClick={()=>window.dispatchEvent(new Event('senku:open-account'))}>Save my progress</button></div>}
    <section className={s.split}>
      <div className={`glass ${s.next}`}><div className="row faint"><Glyph name="book" size={18}/>YOUR NEXT MISSION</div>{lessons.error||catalog.error?<><h2>Your missions are still waiting.</h2><p className="muted">The mission list could not load just now.</p><button className="btn quiet" onClick={()=>{void lessons.refetch();void catalog.refetch();}}>Try again</button></>:next?<><div className="row">{experiment&&<span className={s.orbit}><ConceptGlyph concept={experiment.learning.concept} size={30}/></span>}<h2>{next.name}</h2></div><p className="muted">{experiment?.learning.objective??'Make a prediction, run your experiment, and explain what you find.'}</p><div className="row"><Link className="btn" href={`/learn/${next.id}`}>Let’s try it<Glyph name="run" size={16}/></Link><Link className="btn quiet" href="/learn">All missions</Link></div></>:<p role="status">{lessons.isLoading?'Finding your next experiment…':'New missions will appear here when published.'}</p>}</div>
      <div className={`solid ${s.play}`}><Glyph name="spark" size={30}/><p className="hand">Put your ideas to the test.</p><h2>Small challenges. Big discoveries.</h2><p className="muted">Restore a cell, tune an enzyme, or help a population recover.</p><Link className="btn hema" href="/challenges">Play a challenge<Glyph name="next" size={17}/></Link></div>
    </section>
    <section className="stack"><div className="spread"><h2>Follow your curiosity</h2><Link href="/lab" className="btn quiet small">Open the lab<Glyph name="flask" size={17}/></Link></div><div className={s.tools}>{[
      ['/companion','spark','Ask Senku','Talk through a question, whenever you need a hand.'],
      ['/discover','search','Investigate an idea','Find papers, inspect structures, and compare evidence.'],
      ['/pathways','compare','Connect the pieces','Build a network and see how it behaves.'],
      ['/rooms','person','Bring a lab partner','Share an experiment and explore together.'],
    ].map(([href,icon,title,description])=><Link href={href} className={`solid ${s.tool}`} key={href}><Glyph name={icon as 'spark'} size={24}/><h3>{title}</h3><p className="muted">{description}</p><span className={s.arrow}><Glyph name="next" size={18}/></span></Link>)}</div></section>
    {recent.runs.length>0&&<section className="stack"><h2>Back to your experiments</h2><div className={`solid ${s.recent}`}>{recent.runs.slice(0,3).map(run=><Link key={run.id} href={`/lab/${run.experiment_id}?v=${run.experiment_version}&runs=${run.id}`}><span><strong>{catalog.data?.find(e=>e.id===run.experiment_id)?.name??run.experiment_id}</strong><small>{run.status} · {run.origin==='device'?'On this device':'Saved to your account'}</small></span><Glyph name="next" size={19}/></Link>)}</div></section>}
    <footer className={s.footer}><Link href="/welcome">Meet Senku</Link><Link href="/offline">Offline lessons</Link><Link href="/classroom">Classroom</Link><Link href="/profile">Your profile and usage</Link></footer>
  </div>;
}
