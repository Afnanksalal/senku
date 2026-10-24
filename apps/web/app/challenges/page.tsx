'use client';
import Link from 'next/link';
import { ConceptGlyph, Glyph } from '../../components/Glyph';
import { games, useChallenges } from '../../lib/challenges';
import styles from './challenges.module.css';

const concept: Record<string,string> = { 'cell-energy':'limiting-resources','enzyme-explorer':'enzyme-saturation','population-dynamics':'carrying-capacity','genetics-lab':'inheritance' };

export default function ChallengesPage() {
  const challenges = useChallenges();
  return <div className="page stack loose">
    <header className={styles.intro}>
      <h1>Play with a purpose</h1>
      <p className="muted">Pick a science world. Senku prepares a personal puzzle as you enter, with a reachable goal and hints grounded in your actual results.</p>
      <p className="faint">Explore a practice round, or sign in with lab access for personalized challenges and saved progress.</p>
    </header>
    {challenges.error && <p className="notice warn">Scores could not load. You can keep practicing and try again later.</p>}
    <section className={styles.list} aria-label="Science games">
      {games.map((game) => { const official=challenges.data?.find(c=>c.id===game.id); return <article className={`glass ${styles.card}`} data-stain={game.stain} key={game.id}>
        <div className={styles.badge}><ConceptGlyph concept={concept[game.experiment]} size={32} /></div>
        <div className="stack snug"><h2>{game.name}</h2><p>{game.description}</p></div>
        <div className="row"><span className="chip">Personalized challenge</span>{official && <span className="chip tone"><Glyph name="spark" size={14}/>{official.definition.xp} XP on first success</span>}</div>
        <Link className="btn" href={`/challenges/${game.id}`}><Glyph name="run" size={16}/>Play {game.name}</Link>
      </article>; })}
    </section>
    <p className="faint">These are illustrative teaching models. A game score is not a biological or clinical prediction.</p>
  </div>;
}
