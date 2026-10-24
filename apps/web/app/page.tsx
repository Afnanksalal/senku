'use client';
/* eslint-disable @next/next/no-img-element -- pre-sized static webp art */
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ConceptGlyph, Glyph, stainFor } from '../components/Glyph';
import { Mascot } from '../components/Mascot';
import { ErrorState } from '../components/States';
import { coverFor } from '../lib/art';
import type { CatalogExperiment, LessonSummary } from '../lib/api';
import { useCatalog, useLessons, useSubjects } from '../lib/catalog';
import { statusText, when } from '../lib/format';
import { useRecentRuns } from '../lib/runs';

gsap.registerPlugin(useGSAP);

function Slide({ e, lesson }: { e: CatalogExperiment; lesson?: LessonSummary }) {
  const stain = stainFor(e.learning.concept);
  const art = coverFor(e.id);
  return (
    <article className="slide" data-stain={stain} aria-labelledby={`x-${e.id}`}>
      <div className="slide-art">
        {art && <img src={art} alt="" width={800} height={600} loading="lazy" draggable={false} />}
        <span className="slide-concept"><ConceptGlyph concept={e.learning.concept} size={art ? 18 : 34} /></span>
      </div>
      <div className="slide-body">
        <h3 id={`x-${e.id}`}>{e.name}</h3>
        <p className="muted">{e.description}</p>
        <div className="row" style={{ gap: '.4rem' }}>
          {e.local_capable
            ? <span className="chip"><Glyph name="device" size={14} />Works on your device</span>
            : <span className="chip"><Glyph name="server" size={14} />Lab server</span>}
          <span className="chip">{Object.keys(e.parameters).length} {Object.keys(e.parameters).length === 1 ? 'control' : 'controls'}</span>
        </div>
        <div className="slide-actions">
          {lesson && e.modes.includes('learn') && <Link className="btn small" href={`/learn/${lesson.id}`}><Glyph name="run" size={14} />Start mission</Link>}
          {e.modes.includes('lab') && <Link className="btn quiet small" href={`/lab/${e.id}`}><Glyph name="flask" size={16} />Open lab</Link>}
        </div>
      </div>
    </article>
  );
}

function Recent({ catalog }: { catalog: CatalogExperiment[] }) {
  const { runs } = useRecentRuns();
  if (!runs.length) return null;
  const name = (id: string) => catalog.find((e) => e.id === id)?.name ?? id;
  return (
    <section className="glass panel" aria-labelledby="recent">
      <div className="panel-title"><h2 id="recent">Pick up where you left off</h2></div>
      <ul className="stack snug" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {runs.map((r) => (
          <li key={r.id} className="spread">
            <div className="row" style={{ gap: '.6rem' }}>
              <Glyph name={r.origin === 'device' ? 'device' : 'server'} size={18} />
              <div><strong>{name(r.experiment_id)}</strong><div className="faint">{statusText[r.status]}, {when(r.created_at)}</div></div>
            </div>
            <Link className="btn quiet small" href={`/lab/${r.experiment_id}?v=${r.experiment_version}&runs=${r.id}`}>Open in lab</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  const subjects = useSubjects();
  const catalog = useCatalog();
  const lessons = useLessons();
  const tray = useRef<HTMLDivElement>(null);
  const [search,setSearch]=useState('');
  const [availability,setAvailability]=useState('all');

  useGSAP(() => {
    if (!catalog.data?.length) return;
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.slide', { y: 18, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.045, clearProps: 'all' });
    });
  }, { scope: tray, dependencies: [catalog.data?.length] });

  const subject = subjects.data?.[0];
  const experiments = [...(catalog.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const visible=experiments.filter(e=>(availability==='all'||(availability==='device'?e.local_capable:!e.local_capable))&&`${e.name} ${e.description} ${e.learning.concept}`.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div className="page stack loose">
      <section className="hero">
        <div className="hero-copy">
          <h1>What will you find out today?</h1>
          <p className="muted">
            A whole lab of little discoveries. Pick something that makes you curious.
          </p>
          {subject && <p className="row" style={{ gap: '.5rem' }}><span className="chip tone" data-stain="chlorophyll">{subject.name}</span><span className="faint">{subject.description}</span></p>}
        </div>
        <Mascot mood="wave" size={260} className="hero-mascot" />
      </section>

      {catalog.isLoading ? (
        <div className="tray" aria-busy="true" aria-label="Loading experiments">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ height: '11.5rem' }} />)}</div>
      ) : catalog.error ? (
        <ErrorState error={catalog.error} retry={() => void catalog.refetch()} what="experiment list" home />
      ) : !experiments.length ? (
        <div className="glass empty"><h2>No experiments are published yet</h2><p className="muted">Once reviewed experiments are published they&apos;ll appear here.</p></div>
      ) : (
        <>
          <Recent catalog={experiments} />
          <section aria-labelledby="all" className="stack">
            <div className="spread"><h2 id="all">Experiments</h2><span className="faint" role="status">{visible.length} of {experiments.length} experiments</span></div>
            <div className="catalog-filters"><label className="catalog-search"><Glyph name="search" size={21}/><input className="input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find your next discovery" aria-label="Search experiments"/></label><div className="catalog-segments" role="group" aria-label="Where experiments run">{[['all','All experiments'],['device','On your device'],['server','Lab server']].map(([value,title])=><button key={value} className="btn quiet small" aria-pressed={availability===value} onClick={()=>setAvailability(value)}>{title}</button>)}</div></div>
            <div className="tray" ref={tray}>
              {visible.map((e) => <Slide key={e.id} e={e} lesson={lessons.data?.find((l) => l.experiment_id === e.id && l.experiment_version === e.version)} />)}
            </div>
            {!visible.length&&<div className="solid panel stack"><h3>No experiments match yet</h3><p className="muted">Try another word, or show the whole lab.</p><button className="btn quiet" onClick={()=>{setSearch('');setAvailability('all');}}>Show all experiments</button></div>}
          </section>
        </>
      )}
    </div>
  );
}
