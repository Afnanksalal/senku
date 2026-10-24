'use client';
/* eslint-disable @next/next/no-img-element -- original pre-sized Senku artwork */
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLessons, useCatalog } from '../../lib/catalog';
import { useSession } from '../../lib/session';
import { api, type LessonSummary } from '../../lib/api';
import { ConceptGlyph, Glyph, stainFor } from '../../components/Glyph';
import { Mascot } from '../../components/Mascot';
import { ErrorState } from '../../components/States';
import { coverFor } from '../../lib/art';
import { label } from '../../lib/format';
import styles from './learn.module.css';

type Progress = { xp: number; streak: { days: number }; lessons: { reward_key: string }[]; achievements: { id: string; name: string }[]; concepts: { concept: string; attempts: number; score: number }[] };
const preferredOrder = ['cell-energy', 'enzyme-explorer', 'genetics-lab', 'population-dynamics', 'diffusion-playground', 'ecosystem-rescue', 'metabolism-explorer', 'cell-colony', 'molecule-sketchbook', 'pathway-playground'];
const lanes = [
  { id: 'essentials', title: 'Start with the little things', description: 'Cells, reactions, inheritance and growing populations. These models can run on your device.' },
  { id: 'systems', title: 'Watch life connect', description: 'Explore how movement, resources and feedback shape a living system.' },
  { id: 'structures', title: 'Look inside the structure', description: 'Inspect molecules and assemble approved reaction networks.' },
  { id: 'more', title: 'Keep following the question', description: 'More published missions to explore in your own order.' },
] as const;

export default function LearnMap() {
  const lessons = useLessons(), catalog = useCatalog();
  const user = useSession((s) => s.user);
  const signedIn = !!user && user.role !== 'guest';
  const progress = useQuery({ queryKey: ['progress', user?.id], queryFn: () => api<Progress>('/v1/me/progress', { auth: true }), enabled: signedIn, staleTime: 15_000 });
  const completed = new Set(progress.data?.lessons.map((x) => x.reward_key) ?? []);
  const done = (lesson: LessonSummary) => completed.has(`lesson:${lesson.id}:${lesson.version}`);
  const ordered = [...(lessons.data ?? [])].sort((a, b) => {
    const ai = preferredOrder.indexOf(a.experiment_id), bi = preferredOrder.indexOf(b.experiment_id);
    return (ai < 0 ? preferredOrder.length : ai) - (bi < 0 ? preferredOrder.length : bi) || a.name.localeCompare(b.name);
  });
  const completedCount = ordered.filter(done).length;
  const progressKnown = !signedIn || progress.isSuccess;
  const suggested = ordered.find((l) => !done(l)) ?? ordered[0];
  const suggestedExperiment = catalog.data?.find((e) => e.id === suggested?.experiment_id);
  const allDone = ordered.length > 0 && completedCount === ordered.length;
  const laneFor = (lesson: LessonSummary) => {
    const e = catalog.data?.find((x) => x.id === lesson.experiment_id);
    if (e?.local_capable) return 'essentials';
    if (['diffusion-playground', 'ecosystem-rescue', 'metabolism-explorer', 'cell-colony'].includes(lesson.experiment_id)) return 'systems';
    if (['molecule-sketchbook', 'pathway-playground'].includes(lesson.experiment_id)) return 'structures';
    return 'more';
  };
  return <div className={`page ${styles.map}`}>
    <header className={styles.intro}>
      <div><h1>Follow your curiosity.</h1><p>Biology, one good question at a time. Choose any mission, then take the same model into the lab.</p><span className={styles.invitation}>There’s more than one way to find out.</span></div>
      <Mascot mood={allDone ? 'cheer' : 'wave'} size={190} className={styles.guide} />
    </header>

    {signedIn && progress.data && <section className={styles.progressStrip} aria-label="Your learning progress">
      <dl><div><dt>Learning XP</dt><dd>{progress.data.xp.toLocaleString('en')}</dd></div><div><dt>Active streak</dt><dd>{progress.data.streak.days}<span>{progress.data.streak.days === 1 ? 'day' : 'days'}</span></dd></div><div><dt>Missions completed</dt><dd>{completedCount}<span>of {ordered.length}</span></dd></div></dl>
      {progress.data.achievements.length > 0 && <div className={styles.achievements}>{progress.data.achievements.map((a) => <span key={a.id}><Glyph name="spark" size={16} />{a.name}</span>)}</div>}
    </section>}
    {signedIn && progress.isLoading && <p className="faint" role="status">Loading your learning progress...</p>}
    {!signedIn && <p className={styles.guestNote}><Glyph name="info" size={18} /><span>You can explore as a guest. Sign in from the header to save your mastery, XP and achievements.</span></p>}
    {progress.error && <p role="alert" className="notice alert">Your progress could not be loaded. Every mission is still available below.</p>}

    {lessons.error || catalog.error ? <ErrorState error={lessons.error ?? catalog.error} what="learning map" home retry={() => { void lessons.refetch(); void catalog.refetch(); }} /> : lessons.isLoading || catalog.isLoading ? <div className={styles.loading} aria-busy="true" aria-label="Loading missions">{[0, 1, 2].map((n) => <div className="skeleton" style={{ height: 130 }} key={n} />)}</div> : !ordered.length ? <section className="glass panel stack"><h2>The next question is on its way</h2><p>No missions are published right now. You can still open the lab to see available experiments.</p><div><Link href="/lab" className="btn quiet">Explore the lab</Link></div></section> : <>
      {suggested && <section className={styles.nextMission} aria-labelledby="suggested-mission" data-stain={stainFor(suggestedExperiment?.learning.concept ?? '')}>
        <div className={styles.nextArtwork}>{coverFor(suggested.experiment_id) ? <img src={coverFor(suggested.experiment_id)} alt="" width={160} height={120} /> : <ConceptGlyph concept={suggestedExperiment?.learning.concept ?? ''} size={56} />}</div>
        <div className={styles.nextCopy}><p>{allDone ? 'A question worth revisiting' : signedIn && progressKnown && completedCount > 0 ? 'Your next question' : 'A place to start'}</p><h2 id="suggested-mission">{suggested.name}</h2><span>{suggestedExperiment?.learning.objective ?? 'Predict, experiment, and explain what the evidence shows.'}</span></div>
        <Link href={`/learn/${suggested.id}`} className={`btn ${styles.primary}`}>{allDone ? 'Revisit mission' : 'Start this mission'}<Glyph name="next" size={18} /></Link>
      </section>}
      <div className={styles.mapHeading}><h2>Find your own path</h2><p>Explore in any order. These groups help you browse. You choose where to begin.</p></div>
      <div className={styles.lanes}>{lanes.map((lane) => {
        const items = ordered.filter((l) => laneFor(l) === lane.id);
        if (!items.length) return null;
        return <section key={lane.id} className={styles.lane} aria-labelledby={`lane-${lane.id}`}>
          <header className={styles.laneHeading}><div><h2 id={`lane-${lane.id}`}>{lane.title}</h2><p>{lane.description}</p></div><span>{items.length} {items.length === 1 ? 'mission' : 'missions'}</span></header>
          <ol className={styles.missionList}>{items.map((lesson) => {
            const e = catalog.data?.find((x) => x.id === lesson.experiment_id);
            const isDone = done(lesson), isNext = progressKnown && !allDone && lesson.id === suggested?.id;
            const mastery = progress.data?.concepts.find((c) => c.concept === e?.learning.concept);
            const globalIndex = ordered.findIndex((l) => l.id === lesson.id) + 1;
            return <li key={lesson.id} className={styles.mission} data-stain={stainFor(e?.learning.concept ?? '')} data-completed={isDone} data-current={isNext}>
              <div className={styles.position} aria-hidden="true">{isDone ? <Glyph name="check" size={19} /> : globalIndex}</div>
              <div className={styles.missionArtwork}>{coverFor(lesson.experiment_id) ? <img src={coverFor(lesson.experiment_id)} alt="" width={128} height={96} loading="lazy" /> : <ConceptGlyph concept={e?.learning.concept ?? ''} size={36} />}</div>
              <div className={styles.missionCopy}><div className={styles.missionLabel}><span>{e ? label(e.learning.concept.replaceAll('-', ' ')) : 'Science mission'}</span>{isDone && <span className={styles.completed}><Glyph name="check" size={14} />Completed</span>}{isNext && <span className={styles.suggestion}>Suggested next</span>}</div><h3>{lesson.name}</h3><p>{e?.learning.objective ?? 'Make a prediction, run the experiment, and explain your result.'}</p>{mastery && <span className={styles.mastery}>{mastery.attempts} recorded {mastery.attempts === 1 ? 'attempt' : 'attempts'}. {Math.round(mastery.score * 100)}% assessment score.</span>}</div>
              <div className={styles.missionActions}><Link href={`/learn/${lesson.id}`} className={styles.missionAction}>{isDone ? 'Revisit' : 'Start mission'}<Glyph name="next" size={17} /></Link><Link href={`/lab/${lesson.experiment_id}?v=${lesson.experiment_version}`} className={styles.labLink}>Open lab</Link></div>
            </li>;
          })}</ol>
        </section>;
      })}</div>
    </>}
    <section className={styles.nextAdventure}><div><span className="hand">Keep asking what if.</span><h2>Take your curiosity further.</h2><p>Try a scientific challenge, or investigate a question of your own.</p></div><div className="row"><Link href="/challenges" className="btn hema">Play a challenge<Glyph name="next" size={17} /></Link><Link href="/discover" className="btn quiet">Research a question</Link></div></section>
  </div>;
}
