'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { AccountDialog } from '../../../components/AccountDialog';
import { api, ApiError } from '../../../lib/api';
import { useLessons } from '../../../lib/catalog';
import { when } from '../../../lib/format';
import { useSession } from '../../../lib/session';
import type { ClassroomSummary } from '../page';
import styles from '../classroom.module.css';

type Assignment = { id: string; lesson_id: string; title: string; due_at: string | null; created_at: string };
type Progress = { user_id: string; display_name: string; assignment_id: string; lesson_id: string; best_score: number | string | null; attempts: number; last_attempt: string | null };
const message = (error: unknown) => error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Please try again.';
const score = (value: Progress['best_score']) => value === null ? 'Not attempted' : `${Math.round(Number(value) * 100)}%`;
const csvValue = (value: unknown) => { const text = String(value ?? ''); return `"${(/^[=+\-@]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`; };

export default function ClassroomDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useSession((s) => s.user);
  const admitted = !!user && user.role !== 'guest';
  const qc = useQueryClient();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const [lessonId, setLessonId] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const classes = useQuery({ queryKey: ['classrooms', user?.id], queryFn: () => api<ClassroomSummary[]>('/v1/classrooms', { auth: true }), enabled: admitted, staleTime: 15_000 });
  const classroom = classes.data?.find((item) => item.id === id);
  const teacher = !!classroom?.is_teacher && (user?.role === 'teacher' || user?.role === 'admin');
  const assignments = useQuery({ queryKey: ['assignments', id, user?.id], queryFn: () => api<Assignment[]>(`/v1/classrooms/${id}/assignments`, { auth: true }), enabled: !!classroom });
  const progress = useQuery({ queryKey: ['class-progress', id, user?.id], queryFn: () => api<Progress[]>(`/v1/classrooms/${id}/progress`, { auth: true }), enabled: teacher, staleTime: 15_000 });
  const lessons = useLessons();
  const lesson = lessons.data?.find((item) => item.id === lessonId) ?? lessons.data?.[0];
  useEffect(() => { try { setCode(sessionStorage.getItem(`senku-class-code:${user?.id}:${id}`) ?? ''); } catch { setCode(''); } }, [user?.id, id]);
  const assign = useMutation({ mutationFn: () => api<Assignment>(`/v1/classrooms/${id}/assignments`, { method: 'POST', auth: true, body: { lesson_id: lesson!.id, title: title.trim() || lesson!.name, ...(due ? { due_at: new Date(due).toISOString() } : {}) } }), onSuccess: () => { setTitle(''); setDue(''); void qc.invalidateQueries({ queryKey: ['assignments', id] }); void qc.invalidateQueries({ queryKey: ['class-progress', id] }); } });
  const rotate = useMutation({ mutationFn: () => api<{ join_code: string }>(`/v1/classrooms/${id}/rotate-code`, { method: 'POST', auth: true }), onSuccess: (result) => { setCode(result.join_code); setCopied(false); try { sessionStorage.setItem(`senku-class-code:${user!.id}:${id}`, result.join_code); } catch { /* Code remains visible. */ } } });
  const archive = useMutation({ mutationFn: () => api(`/v1/classrooms/${id}`, { method: 'DELETE', auth: true }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['classrooms'] }); router.push('/classroom'); } });
  const leave = useMutation({ mutationFn: () => api(`/v1/classrooms/${id}/members/${user!.id}`, { method: 'DELETE', auth: true }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['classrooms'] }); router.push('/classroom'); } });
  const remove = useMutation({ mutationFn: (userId: string) => api(`/v1/classrooms/${id}/members/${userId}`, { method: 'DELETE', auth: true }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['class-progress', id] }); } });
  const exportProgress = () => {
    if (!progress.data) return;
    const rows: unknown[][] = [['Learner', 'Assignment', 'Lesson', 'Best score', 'Attempts', 'Last attempt'], ...progress.data.map((row) => [row.display_name, assignments.data?.find((item) => item.id === row.assignment_id)?.title ?? row.assignment_id, row.lesson_id, score(row.best_score), row.attempts, row.last_attempt ?? ''])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((row) => row.map(csvValue).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = Object.assign(document.createElement('a'), { href: url, download: 'senku-classroom-progress.csv' }); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!admitted) return <div className="page stack"><h1>Open your classroom</h1><p className="muted">Sign in with the account that joined this class.</p><div><button className="btn" onClick={() => setAccountOpen(true)}>Sign in</button></div><AccountDialog open={accountOpen} onOpenChange={setAccountOpen} /></div>;
  if (classes.isLoading) return <div className="page stack"><h1>Opening classroom</h1><div className="skeleton" style={{ height: 240 }} /></div>;
  if (!classroom) return <div className="page stack"><h1>Classroom unavailable</h1><p className="muted">{classes.error ? message(classes.error) : 'This class may be archived, or your account has not joined it.'}</p><div><Link className="btn quiet" href="/classroom">Your classrooms</Link></div></div>;
  const members = [...new Map((progress.data ?? []).map((row) => [row.user_id, row])).values()];
  return <div className="page stack loose">
    <header className={`glass panel ${styles.bar}`}><div className="stack snug"><Link className="faint" href="/classroom">Your classrooms</Link><h1>{classroom.name}</h1><p className="faint">{teacher ? 'Teacher Studio' : 'Class assignments'}</p></div><span className="chip">{teacher ? 'Teacher' : 'Learner'}</span></header>
    {teacher && <div className={styles.columns}>
      <section className="glass panel stack" aria-labelledby="assign-mission"><h2 id="assign-mission" style={{ fontSize: '1.3rem' }}>Assign a mission</h2><form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (lesson) assign.mutate(); }}><label className="field"><span>Reviewed mission</span><select className="input" value={lesson?.id ?? ''} onChange={(e) => setLessonId(e.target.value)} disabled={!lessons.data?.length}>{lessons.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Assignment title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={lesson?.name ?? 'Choose a mission'} /></label><label className="field"><span>Due date, optional</span><input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></label><p className="faint">The due date uses your browser’s local time. Learners work through the approved model and assessment.</p>{(assign.error || lessons.error) && <p role="alert" className="notice alert">{message(assign.error ?? lessons.error)}</p>}<div><button className="btn" disabled={!lesson || assign.isPending}>{assign.isPending ? 'Assigning mission' : 'Assign mission'}</button></div></form></section>
      <section className="glass panel stack" aria-labelledby="class-invite"><h2 id="class-invite" style={{ fontSize: '1.3rem' }}>Invite learners</h2>{code ? <><p className={styles.code}>{code}</p><div><button className="btn quiet small" onClick={() => { if (navigator.clipboard) void navigator.clipboard.writeText(code).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Code copied' : 'Copy invitation code'}</button></div></> : <p className="muted">The current code cannot be recovered from the server. Generate a new code when you need to invite learners.</p>}<p className="faint">Changing the code prevents future joins with the previous one. Existing learners keep their membership.</p><div><button className="btn quiet small" disabled={rotate.isPending} onClick={() => { if (window.confirm('Replace the current class invitation code? Existing learners will remain in the class.')) rotate.mutate(); }}>{rotate.isPending ? 'Generating code' : 'Generate new invitation code'}</button></div>{rotate.error && <p role="alert" className="notice alert">{message(rotate.error)}</p>}</section>
    </div>}
    <section className="glass panel stack" aria-labelledby="assignments"><div className={styles.bar}><h2 id="assignments" style={{ fontSize: '1.3rem' }}>Assignments</h2><button className="btn ghost small" onClick={() => void assignments.refetch()}>Refresh</button></div>{assignments.isLoading ? <p className="faint">Loading assignments</p> : assignments.error ? <p role="alert" className="notice alert">{message(assignments.error)}</p> : !assignments.data?.length ? <p className="muted">{teacher ? 'No assignments yet. Choose a reviewed mission above.' : 'Your teacher has not assigned a mission yet.'}</p> : <ul className={styles.list}>{assignments.data.map((item) => <li className={`solid ${styles.item}`} key={item.id}><div><h3>{item.title}</h3><p className="faint">{lessons.data?.find((entry) => entry.id === item.lesson_id)?.name ?? item.lesson_id}{item.due_at ? `, due ${when(item.due_at)}` : ', no due date'}</p>{item.due_at && new Date(item.due_at).getTime() < Date.now() && <span className="chip">Past due date</span>}</div><Link className="btn quiet small" href={`/learn/${item.lesson_id}`}>{teacher ? 'Preview mission' : 'Open mission'}</Link></li>)}</ul>}</section>
    {teacher && <section className="glass panel stack" aria-labelledby="class-progress"><div className={styles.bar}><h2 id="class-progress" style={{ fontSize: '1.3rem' }}>Learner progress</h2><div className="row"><button className="btn ghost small" onClick={() => void progress.refetch()}>Refresh progress</button><button className="btn quiet small" disabled={!progress.data?.length} onClick={exportProgress}>Export CSV</button></div></div><p className="faint">Scores reflect attempts after a learner joined and the assignment was created. Earlier personal work is not counted here. Up to 1,000 assignment records are shown.</p>{progress.isLoading ? <p className="faint">Loading class progress</p> : progress.error ? <p role="alert" className="notice alert">{message(progress.error)}</p> : !progress.data?.length ? <p className="muted">Progress appears once the class has learners and assignments.</p> : <div className="table-scroll" role="region" aria-label="Class assignment progress" tabIndex={0}><table className={styles.table}><thead><tr><th>Learner</th><th>Assignment</th><th>Best score</th><th>Attempts</th><th>Last attempt</th></tr></thead><tbody>{progress.data.map((row) => <tr key={`${row.user_id}:${row.assignment_id}`}><td>{row.display_name}</td><td>{assignments.data?.find((item) => item.id === row.assignment_id)?.title ?? row.lesson_id}</td><td>{score(row.best_score)}</td><td>{row.attempts}</td><td>{row.last_attempt ? when(row.last_attempt) : 'Not attempted'}</td></tr>)}</tbody></table></div>}
      {members.length > 0 && <details className="more"><summary>Manage learners with assignment records</summary><ul className={styles.list}>{members.map((person) => <li className={styles.item} key={person.user_id}><strong>{person.display_name}</strong><button className="btn ghost small" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove ${person.display_name} from this class? Their personal learning history will remain.`)) remove.mutate(person.user_id); }}>Remove from class</button></li>)}</ul></details>}{remove.error && <p role="alert" className="notice alert">{message(remove.error)}</p>}
    </section>}
    <section className="glass panel stack"><h2 style={{ fontSize: '1.25rem' }}>{teacher ? 'Classroom settings' : 'Class membership'}</h2><p className="faint">{teacher ? 'Archiving closes this classroom and its invitation code. Personal experiment and learning records remain with each learner.' : 'Leaving removes your classroom membership. Your personal experiment and learning records remain in your account.'}</p><div>{teacher ? <button className="btn ghost small" disabled={archive.isPending} onClick={() => { if (window.confirm('Archive this classroom and close access for its learners?')) archive.mutate(); }}>Archive classroom</button> : <button className="btn ghost small" disabled={leave.isPending} onClick={() => { if (window.confirm('Leave this classroom? Your personal learning history will remain.')) leave.mutate(); }}>Leave classroom</button>}</div>{(archive.error || leave.error) && <p role="alert" className="notice alert">{message(archive.error ?? leave.error)}</p>}</section>
  </div>;
}
