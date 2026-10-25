'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dockingResult } from '../../lib/docking';
import { useExperiment } from '../../lib/catalog';
import { useSession } from '../../lib/session';
import type { MolecularScreen, ScreenMember } from '../../lib/molecular-workspace';
import { molecularApi, proteinNames, screenCsv, saveWorkspaceFile } from '../../lib/molecular-workspace';
import type { RunRecord } from '../../lib/runs';
import { shortId, statusText, runError } from '../../lib/format';
import { SelectField } from '../SelectField';
import { Glyph } from '../Glyph';
import { Provenance } from '../RunResult';
import { RunExports } from '../RunExports';
import { CompanionChat } from '../CompanionChat';
import { DockingReflection } from '../docking/DockingReflection';
import { ScreenReflection } from './ScreenReflection';
import s from '../../app/molecules/molecules.module.css';

const DockingViewer = dynamic(() => import('../docking/DockingViewer'), { ssr: false, loading: () => <div className={s.loading} role="status">Opening the saved coordinates…</div> });
function PoseResult({ member, allowReflection }: { member: ScreenMember; allowReflection: boolean }) {
  const owner = useSession(state => state.user?.id);
  const experiment = useExperiment('molecular-docking');
  const [poseIndex, setPoseIndex] = useState(0), [reflect, setReflect] = useState(false);
  const query = useQuery({ queryKey: ['molecular-result', owner, member.run_id], queryFn: async ({ signal }) => ({ ...await molecularApi<Omit<RunRecord, 'origin'>>(owner, `/v1/runs/${member.run_id}`, { auth: true, signal }), origin: 'server' as const }), enabled: !!owner && member.status === 'completed' });
  const data = dockingResult(query.data?.result?.docking);
  if (query.isPending) return <div className={s.loading} role="status">Opening {member.compound_name}…</div>;
  if (query.error || !query.data) return <div className="notice alert"><p>The saved coordinates could not load.</p><button className="btn quiet small" onClick={() => void query.refetch()}>Try again</button></div>;
  if (!data) return <div className="notice warn"><p>This result no longer has readable saved coordinates. Its run record and settings remain available.</p><Provenance run={query.data}/></div>;
  const index = Math.min(poseIndex, data.poses.length - 1), pose = data.poses[index];
  return <section className={s.posePanel} aria-label={`${member.compound_name} saved poses`}>
    <div className={s.sectionHeading}><div><span className={s.kicker}>{proteinNames[member.target]}</span><h3>{member.compound_name}</h3></div><span className="chip">Run {shortId(member.run_id)}</span></div>
    <div className={s.field}><label htmlFor={`pose-${member.run_id}`}>Which pose?</label><SelectField id={`pose-${member.run_id}`} label={`Pose for ${member.compound_name}`} value={String(index)} onValueChange={value => setPoseIndex(Number(value))} options={data.poses.map((p, i) => ({ value: String(i), label: `Pose ${p.rank} · ${p.score_kcal_mol.toFixed(2)} kcal/mol` }))}/></div>
    <DockingViewer data={data} poseIndex={index}/>
    <p className={s.help}>Every view uses the saved protein coordinate frame. These scores are estimates, not measured binding strengths. The protein is rigid.</p>
    <details className={s.details}><summary>Site, coordinates and provenance</summary><div className={s.detailBody}>
      <dl className={s.facts}><div><dt>Reference structure</dt><dd><a href={data.target.source_url} target="_blank" rel="noreferrer">{data.target.pdb_id} · {data.target.reference_ligand}</a></dd></div><div><dt>Search center</dt><dd>{data.box.center.map(n => n.toFixed(2)).join(', ')} Å</dd></div><div><dt>Fixed box</dt><dd>{data.box.size.join(' × ')} Å</dd></div><div><dt>Seed</dt><dd>{query.data.seed}</dd></div></dl>
      <h4>Reference-site residues</h4><p className={s.help}>Neighbors of the crystal molecule, not proof of a new interaction.</p><div className={s.chips}>{data.binding_site_residues.map(r => <span className="chip" key={`${r.chain}:${r.residue_number}`}>{r.residue_name} {r.residue_number} · {r.chain} · {r.distance_angstrom.toFixed(2)} Å</span>)}</div>
      <div className={s.actionRow}><button className="btn quiet small" onClick={() => saveWorkspaceFile(`pose-${pose.rank}-${shortId(member.run_id)}.pdb`, pose.pdb, 'chemical/x-pdb')}>Pose PDB</button><button className="btn quiet small" onClick={() => saveWorkspaceFile(`pose-${pose.rank}-${shortId(member.run_id)}.pdbqt`, pose.pdbqt, 'chemical/x-pdbqt')}>Pose PDBQT</button><button className="btn quiet small" onClick={() => saveWorkspaceFile(`${data.target.pdb_id}-reference.pdb`, data.reference_ligand_pdb, 'chemical/x-pdb')}>Crystal molecule</button></div>
      <Provenance run={query.data}/><RunExports run={query.data}/>
    </div></details>
    {allowReflection && <><section className={s.senkuPrompt}><Glyph name="spark" size={24}/><div><h4>What can you notice?</h4><p>Let Senku interpret this saved fit and its limits.</p></div>{!reflect && <button className="btn quiet small" onClick={() => setReflect(true)}>Make sense of it · 1 lab unit</button>}</section>{reflect && <DockingReflection run={query.data}/>} {experiment.data && <CompanionChat experiment={experiment.data} run={query.data}/>}</>}
  </section>;
}

export function ScreenResults({ screen, onCancel, cancelling }: { screen: MolecularScreen; onCancel: () => void; cancelling: boolean }) {
  const [selected, setSelected] = useState<string>(), [comparison, setComparison] = useState(''), [downloadError, setDownloadError] = useState('');
  const members = screen.members ?? [], completed = members.filter(m => m.status === 'completed');
  const focus = completed.find(m => m.run_id === selected) ?? completed[0];
  const alternatives = focus ? completed.filter(m => m.target === focus.target && m.run_id !== focus.run_id) : [];
  const second = alternatives.find(m => m.run_id === comparison);
  const done = members.filter(m => m.status !== 'queued' && m.status !== 'running').length;
  const active = done < members.length;
  const download = (csv: boolean) => { try { setDownloadError(''); saveWorkspaceFile(`senku-comparison-${shortId(screen.id)}.${csv ? 'csv' : 'json'}`, csv ? screenCsv(screen) : JSON.stringify({ ...screen, limitations: ['Estimated docking scores, not measured binding strengths.', 'Proteins are rigid. Do not rank compounds across different proteins.'] }, null, 2), csv ? 'text/csv' : 'application/json'); } catch { setDownloadError('The download could not start. Please try again.'); } };
  return <section className={s.resultSection} aria-label="Saved molecular comparison">
    <div className={s.sectionHeading}><div><p className={s.kicker}>YOUR SAVED COMPARISON</p><h2>{screen.name}</h2><p className={s.help}>{screen.collection_name} · {done} of {members.length} searches finished</p></div><div className={s.actionRow}><button className="btn quiet small" onClick={() => download(true)}>Scores CSV</button><button className="btn quiet small" onClick={() => download(false)}>Comparison JSON</button>{active && <button className="btn quiet small" disabled={cancelling} onClick={onCancel}>{cancelling ? 'Stopping…' : 'Stop unfinished searches'}</button>}</div></div>
    {members.length > 0 && <progress className={s.progress} value={done} max={members.length} aria-label={`${done} of ${members.length} searches finished`}/>}
    <div className={s.honesty}><Glyph name="info" size={21}/><p>Scores are estimates, not measured binding strengths. The proteins are rigid. Compare rows within the same protein only. This does not establish medicine effectiveness, safety or a cellular outcome.</p></div>
    {!active && completed.length > 0 && <ScreenReflection screenId={screen.id}/>}
    {downloadError && <p className="notice alert" role="alert">{downloadError}</p>}
    <div className={s.targetResults}>{['trypsin', 'streptavidin'].filter(target => members.some(m => m.target === target)).map(target => <section key={target} className={s.targetGroup} aria-label={`${proteinNames[target]} results`}><div className={s.sectionHeading}><h3>{proteinNames[target]}</h3><span className={s.help}>Estimated kcal/mol</span></div><div className={s.resultRows}>{members.filter(m => m.target === target).sort((a, b) => (a.best_score_kcal_mol ?? Infinity) - (b.best_score_kcal_mol ?? Infinity)).map(member => <button key={member.run_id} className={s.resultRow} disabled={member.status !== 'completed'} aria-pressed={focus?.run_id === member.run_id} onClick={() => { setSelected(member.run_id); setComparison(''); }}><span className={s.resultName}><strong>{member.compound_name}</strong><small>{member.status === 'failed' || member.status === 'timed_out' ? runError(member.error_code) : statusText[member.status]}</small></span><span className={s.score}>{typeof member.best_score_kcal_mol === 'number' && Number.isFinite(member.best_score_kcal_mol) ? member.best_score_kcal_mol.toFixed(2) : 'No score'}<small>{member.pose_count ? `${member.pose_count} ${member.pose_count === 1 ? 'pose' : 'poses'}` : 'No score yet'}</small></span><Glyph name={focus?.run_id === member.run_id ? 'check' : 'next'} size={18}/></button>)}</div></section>)}</div>
    {focus ? <><div className={s.compareToolbar}><div><h3>Explore a saved fit</h3><p className={s.help}>Choose any finished row above. Compare two molecules in the same protein frame.</p></div>{alternatives.length > 0 && <div className={s.field}><label htmlFor="molecular-comparison">Second view</label><SelectField id="molecular-comparison" label="Second molecule to compare" value={comparison} onValueChange={setComparison} options={[{ value: '', label: 'One view' }, ...alternatives.map(m => ({ value: m.run_id, label: m.compound_name }))]}/></div>}</div><div className={`${s.poseGrid} ${second ? s.twoPoses : ''}`}><PoseResult key={focus.run_id} member={focus} allowReflection/>{second && <PoseResult key={second.run_id} member={second} allowReflection={false}/>}</div></> : <div className={s.loading} role="status"><Glyph name="flask" size={26}/><p>{active ? 'Your searches are running. Finished fits will appear here as they arrive.' : 'No finished poses in this comparison. Inspect each search status above, adjust the setup, and try again.'}</p></div>}
    <p className={s.help}>Keep individual run exports for the full coordinates and preparation details. <Link href="/docking">Open the single-search laboratory</Link></p>
  </section>;
}
