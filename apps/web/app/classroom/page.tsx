'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AccountDialog } from '../../components/AccountDialog';
import { Glyph } from '../../components/Glyph';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { when } from '../../lib/format';
import styles from './classroom.module.css';

export type ClassroomSummary = { id: string; name: string; created_at: string; is_teacher: boolean };
export default function ClassroomPage() {
  const user = useSession((s) => s.user);
  const signedIn = !!user && user.role !== 'guest';
  const teacher = user?.role === 'teacher' || user?.role === 'admin';
  const qc = useQueryClient();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [created, setCreated] = useState<{ id: string; name: string; join_code: string }>();
  const [copied, setCopied] = useState(false);
  const classes = useQuery({ queryKey: ['classrooms', user?.id], queryFn: () => api<ClassroomSummary[]>('/v1/classrooms', { auth: true }), enabled: signedIn, staleTime: 15_000 });
  const create = useMutation({
    mutationFn: () => api<{ id: string; name: string; join_code: string }>('/v1/classrooms', { method: 'POST', auth: true, body: { name: name.trim() } }),
    onSuccess: (result) => { setCreated(result); setName(''); setCopied(false); try { sessionStorage.setItem(`senku-class-code:${user!.id}:${result.id}`, result.join_code); } catch { /* The code remains visible in this page. */ } void qc.invalidateQueries({ queryKey: ['classrooms'] }); },
  });
  const join = useMutation({ mutationFn: () => api<{ classroom_id: string }>('/v1/classrooms/join', { method: 'POST', auth: true, body: { code: code.trim() } }), onSuccess: (result) => { void qc.invalidateQueries({ queryKey: ['classrooms'] }); router.push(`/classroom/${result.classroom_id}`); } });
  return <div className="page stack loose">
    <header className={styles.intro}><h1>{teacher ? 'Teacher Studio' : 'Your science classroom'}</h1><p className="muted">{teacher ? 'Bring your group into Senku, assign reviewed experiments, and see how learners explain their results.' : 'Join your teacher’s class, open a mission, and build understanding through real experiments.'}</p></header>
    {!signedIn && <div className="notice"><Glyph name="person" /><div className="stack snug"><p>An account keeps classroom assignments and learning progress together.</p><div><button className="btn small" onClick={() => setAccountOpen(true)}>Sign in or create account</button></div></div></div>}
    <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    <div className={styles.columns}>
      <section className="glass panel stack" aria-labelledby="join-class"><h2 id="join-class" style={{ fontSize: '1.3rem' }}>Join a class</h2><form className={styles.form} onSubmit={(e) => { e.preventDefault(); join.mutate(); }}><label className="field"><span>Class invitation code</span><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} pattern="[A-Za-z0-9_\-]{43}" maxLength={43} title="43 letters, numbers, dashes or underscores" required autoComplete="off" /></label><p className="faint">Ask your teacher for the current class code. A classroom code is separate from a compute invitation.</p>{join.error && <p role="alert" className="notice alert">{join.error instanceof ApiError ? join.error.message : 'Could not join this class.'}</p>}<div><button className="btn" disabled={!signedIn || !/^[A-Za-z0-9_-]{43}$/.test(code.trim()) || join.isPending}>{join.isPending ? 'Joining class' : 'Join class'}</button></div></form></section>
      {teacher ? <section className="glass panel stack" aria-labelledby="create-class"><h2 id="create-class" style={{ fontSize: '1.3rem' }}>Create a classroom</h2><form className={styles.form} onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><label className="field"><span>Class name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="For example, Biology explorers" required /></label>{create.error && <p role="alert" className="notice alert">{create.error instanceof ApiError ? create.error.message : 'Could not create this class.'}</p>}<div><button className="btn quiet" disabled={!name.trim() || create.isPending}>{create.isPending ? 'Creating class' : 'Create class'}</button></div></form></section> : <section className="glass panel stack"><h2 style={{ fontSize: '1.3rem' }}>Learn by investigating</h2><p className="muted">Assignments use the same reviewed missions and models as your personal lab. Predict, change a control, inspect the output, then explain what you found.</p><p className="faint">Teacher Studio is available to teacher and administrator accounts. Learner accounts can join classes and complete assignments.</p><div><Link className="btn quiet" href="/">Explore experiments</Link></div></section>}
    </div>
    {created && <section className="glass panel stack" aria-label="New classroom invitation"><h2 style={{ fontSize: '1.3rem' }}>{created.name} is ready</h2><p className="muted">Share this invitation code with your learners. The server stores a hash, so copy the code before leaving this browser session.</p><p className={styles.code}>{created.join_code}</p><div className="row"><button className="btn quiet small" onClick={() => { if (navigator.clipboard) void navigator.clipboard.writeText(created.join_code).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Code copied' : 'Copy code'}</button><Link className="btn small" href={`/classroom/${created.id}`}>Open classroom</Link></div></section>}
    <section className="glass panel stack" aria-labelledby="your-classes"><div className={styles.bar}><h2 id="your-classes" style={{ fontSize: '1.3rem' }}>Your classes</h2>{signedIn && <button className="btn ghost small" onClick={() => void classes.refetch()}>Refresh</button>}</div>{!signedIn ? <p className="muted">Sign in to see your classes.</p> : classes.isLoading ? <p className="faint">Loading classrooms</p> : classes.error ? <p role="alert" className="notice alert">{classes.error instanceof ApiError ? classes.error.message : 'Could not load your classes.'}</p> : !classes.data?.length ? <p className="muted">You have not joined a class yet. Use a teacher’s invitation code above.</p> : <ul className={styles.list}>{classes.data.map((item) => <li className={`solid ${styles.item}`} key={item.id}><div><h3>{item.name}</h3><p className="faint">{item.is_teacher ? 'Your classroom' : 'Learner'}, created {when(item.created_at)}</p></div><Link className="btn quiet small" href={`/classroom/${item.id}`}>Open class</Link></li>)}</ul>}</section>
  </div>;
}
