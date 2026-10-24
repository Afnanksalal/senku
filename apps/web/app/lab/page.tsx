import Link from 'next/link';
export default function LabIndex(){return <div className="page stack loose"><header className="stack snug"><h1>Your laboratory</h1><p className="muted">Explore an approved model, build a reaction network, or investigate together.</p></header><div className="feature-grid">
  <section className="glass panel stack"><h2>Experiment bench</h2><p className="muted">Choose from the scientific catalog, adjust real parameters, compare results, and export reproducibility records.</p><Link href="/" className="btn">Choose an experiment</Link></section>
  <section className="glass panel stack"><h2>A molecular match</h2><p className="muted">Try a molecule in a teaching protein’s binding pocket. Compare its predicted poses with a known crystal structure.</p><Link href="/docking" className="btn">Explore docking</Link></section>
  <section className="glass panel stack"><h2>Pathway builder</h2><p className="muted">Connect species with approved mass-action reactions, compile a network, and run its dynamics.</p><Link href="/pathways" className="btn hema">Build a pathway</Link></section>
  <section className="glass panel stack"><h2>Shared laboratory</h2><p className="muted">Invite a collaborator, synchronize model settings, and inspect the same scientific run.</p><Link href="/rooms" className="btn quiet">Open shared labs</Link></section>
</div></div>;}
