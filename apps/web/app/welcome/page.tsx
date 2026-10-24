/* eslint-disable @next/next/no-img-element -- original, pre-sized Senku WebP artwork */
import Link from 'next/link';
import { BrandMark, ConceptGlyph, Glyph } from '../../components/Glyph';
import { Mascot } from '../../components/Mascot';
import styles from './welcome.module.css';

const experiments = [
  { name: 'Save the Cell', id: 'cell-energy', concept: 'limiting-resources', question: 'What happens when a cell runs low on fuel?', detail: 'Balance oxygen, glucose and demand.', stain: 'hema' },
  { name: 'Enzyme Explorer', id: 'enzyme-explorer', concept: 'enzyme-saturation', question: 'Can a reaction ever go fast enough?', detail: 'Explore how enzymes reach their limits.', stain: 'eosin' },
  { name: 'Genetics Lab', id: 'genetics-lab', concept: 'inheritance', question: 'What might the next generation inherit?', detail: 'Try a cross and inspect the outcomes.', stain: 'chlorophyll' },
] as const;

export default function WelcomePage() {
  return <div className={styles.welcome}>
    <section className={styles.hero} aria-labelledby="welcome-title">
      <div className={styles.heroCopy}>
        <div className={styles.introduction}><BrandMark size={25} /><span>Your science sidekick</span></div>
        <h1 id="welcome-title">Big questions.<br /><span>Tiny adventures.</span></h1>
        <p className={styles.heroDescription}>Why do cells get hungry? How do tiny things work? Ask Senku, then follow your curiosity into a mission made for you, a playful challenge or your own little lab.</p>
        <div className={styles.actions}>
          <Link href="/home" className={`btn ${styles.primary}`}><Glyph name="spark" size={19} />Ask your first question<Glyph name="next" size={17}/></Link>
          <Link href="/learn" className={`btn quiet ${styles.secondary}`}>Browse science missions</Link>
        </div>
        <p className={styles.guestNote}>Practice as a guest. Sign in with lab access for fresh adventures.</p>
      </div>
      <figure className={styles.heroWorld}>
        <div className={styles.worldBackdrop} />
        <img className={styles.worldArt} src="/art/hero-curiosity.png" alt="Senku's friendly science companion exploring a miniature world of cells and tiny discoveries" width={1536} height={1024} fetchPriority="high" draggable={false} />
        <figcaption className={styles.worldCaption}><span className="hand">A tiny what if...</span><span>can take you somewhere wonderful.</span></figcaption>
      </figure>
    </section>

    <nav className={styles.adventurePaths} aria-label="Ways to explore science">
      <Link href="/learn"><span data-stain="chlorophyll"><Glyph name="spark" size={21}/></span><div><strong>A mission made for you</strong><small>Fresh questions, just for you</small></div><Glyph name="next" size={17}/></Link>
      <Link href="/challenges"><span data-stain="eosin"><Glyph name="run" size={21}/></span><div><strong>Play your way to an aha</strong><small>Fresh puzzles. Little discoveries.</small></div><Glyph name="next" size={17}/></Link>
      <Link href="/lab"><span data-stain="cobalt"><Glyph name="flask" size={21}/></span><div><strong>A world you can tinker with</strong><small>Hands-on labs and real 3D</small></div><Glyph name="next" size={17}/></Link>
    </nav>

    <section id="how-it-works" className={styles.learningLoop} aria-labelledby="loop-title">
      <div className={styles.loopIntro}><h2 id="loop-title">A question is<br />a lovely place to start.</h2><p>Senku helps you turn “why?” into “oh, now I get it.”</p></div>
      <ol className={styles.loopSteps}>
        <li><span className={styles.stepIcon}><Glyph name="spark" size={24} /></span><div><h3>Make a prediction</h3><p>What do you think will happen?</p></div></li>
        <li><span className={styles.stepIcon}><Glyph name="flask" size={24} /></span><div><h3>Try a change</h3><p>Change a setting and see what happens.</p></div></li>
        <li><span className={styles.stepIcon}><Glyph name="check" size={24} /></span><div><h3>Find your explanation</h3><p>Compare the evidence with your first guess.</p></div></li>
      </ol>
    </section>

    <section className={styles.firstQuestion} aria-labelledby="first-question-title">
      <div className={styles.sectionHeading}><div><h2 id="first-question-title">Which question is yours?</h2><p>You choose the experiment. Your curiosity sets the pace.</p></div><Link href="/learn" className={styles.textLink}>See the learning map<Glyph name="next" size={17} /></Link></div>
      <div className={styles.specimens}>{experiments.map((experiment) => <Link key={experiment.id} className={styles.specimen} href={`/learn/${experiment.id}-mission`} data-stain={experiment.stain}>
        <div className={styles.specimenArt}><img src={`/art/cover-${experiment.id}.webp`} alt="" width={800} height={600} loading="lazy" draggable={false} /><span className={styles.specimenGlyph}><ConceptGlyph concept={experiment.concept} size={24} /></span></div>
        <div className={styles.specimenCopy}><p className={styles.specimenName}>{experiment.name}</p><h3>{experiment.question}</h3><p>{experiment.detail}</p><span className={styles.specimenAction}>Try this mission<Glyph name="next" size={17} /></span></div>
      </Link>)}</div>
    </section>

    <section className={styles.playSection} aria-labelledby="play-title">
      <div className={styles.playArt}><img src="/art/science-friends.png" alt="A cheerful collection of tiny science friends inviting you to explore biology" width={1536} height={1024} loading="lazy" /><span className={styles.handNote}>Small changes. Happy discoveries.</span></div>
      <div className={styles.storyCopy}><span className={styles.sectionSymbol} data-stain="eosin"><Glyph name="spark" size={25} /></span><h2 id="play-title">Meet your next<br />little challenge.</h2><p>Help a hungry cell. Grow a tiny population. Untangle an inheritance puzzle. Senku prepares fresh challenges, and your experiments show what your choices did.</p><Link href="/challenges" className={`btn ${styles.primary}`}>Let’s play with science<Glyph name="next" size={18} /></Link><p className={styles.smallNote}>Try again, compare your results, and find your own aha.</p></div>
    </section>

    <section className={styles.depthSection} aria-labelledby="depth-title">
      <div className={styles.storyCopy}><span className={styles.sectionSymbol} data-stain="cobalt"><ConceptGlyph concept="molecular-structure" size={27} /></span><h2 id="depth-title">Get closer to<br />the tiny stuff.</h2><p>Turn a molecule around. Inspect a deposited protein structure. Discover how the tiny shapes connect to the science you are exploring.</p><div className={styles.actions}><Link href="/lab/molecule-sketchbook" className="btn quiet">Explore molecules<Glyph name="next" size={18} /></Link><Link href="/discover" className={styles.textLink}>Find a structure</Link></div></div>
      <div className={styles.depthArt}><img src="/art/cover-molecule-sketchbook.webp" alt="A playful molecular illustration introducing the interactive molecular tools" width={800} height={600} loading="lazy" /><div className={styles.depthCaption}><ConceptGlyph concept="molecular-structure" size={20} /><span>Small structures. Bigger understanding.</span></div></div>
    </section>

    <section className={styles.researchSection} aria-labelledby="research-title">
      <div className={styles.researchCopy}><span className={styles.sectionSymbol} data-stain="hema"><Glyph name="compare" size={25} /></span><h2 id="research-title">Let one question<br />lead to another.</h2><p>Ask Senku for a little help. Search the literature. Set up a comparison and follow it from the first plan to the final evidence.</p><p>Every explanation stays connected to its sources and experiment results, so you can check the evidence and make up your own mind.</p><div className={styles.actions}><Link href="/discover" className={`btn ${styles.primary}`}>Follow a question<Glyph name="next" size={18} /></Link><Link href="/companion" className={styles.textLink}>Ask Senku</Link></div></div>
      <div className={styles.researchProof}>
        <Mascot mood="think" size={180} className={styles.researchMascot} />
        <h3>A trail you can follow</h3>
        <ol><li><span>Your question</span><p>Choose a question and what to compare.</p></li><li><span>The evidence</span><p>Compare your experiments and scientific references.</p></li><li><span>Your conclusion</span><p>Read the explanation, including its limits.</p></li></ol>
        <div className={styles.sourceNames}><span>Scientific papers</span><span>3D structures</span><span>Your discoveries</span></div>
      </div>
    </section>

    <section className={styles.offlineSection} aria-labelledby="offline-title">
      <div className={styles.offlineIcon}><Glyph name="device" size={34} /></div><div><h2 id="offline-title">Take a little science with you.</h2><p>Save device-ready lessons, keep exploring offline, and sync your progress when you reconnect.</p></div><Link href="/offline" className="btn quiet">Get ready for offline<Glyph name="next" size={17} /></Link>
    </section>

    <section className={styles.closing} aria-labelledby="closing-title"><Mascot mood="cheer" size={180} /><div><span className="hand">I wonder what you’ll discover.</span><h2 id="closing-title">Bring your curiosity.<br />We’ll bring the tiny lab.</h2><Link href="/home" className={`btn ${styles.primary}`}>Ask Senku a question<Glyph name="spark" size={18} /></Link><p className={styles.guestNote}>One question, lots of places to go.</p></div></section>

    <footer className={styles.footer}>
      <div className={styles.footerBrand}><Link href="/welcome" className={styles.footerLogo}><BrandMark size={33} />Senku</Link><p>A little wonder.<br />A lot to find out.</p></div>
      <nav aria-label="Start exploring"><h3>Explore</h3><Link href="/learn">Learning map</Link><Link href="/lab">The lab</Link><Link href="/challenges">Challenges</Link></nav>
      <nav aria-label="Keep discovering"><h3>Go further</h3><Link href="/discover">Research</Link><Link href="/companion">Ask Senku</Link><Link href="/offline">Offline learning</Link></nav>
      <div className={styles.footerNote}><p>Built around curiosity, clear explanations and questions worth asking.</p><p>Some experiments and saved investigations require an account with lab access.</p></div>
    </footer>
  </div>;
}
