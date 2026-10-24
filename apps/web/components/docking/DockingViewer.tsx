'use client';
import dynamic from 'next/dynamic';
import { Component,useCallback,useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import { pdbAtoms,type DockingData } from '../../lib/docking';
import type { DockingCameraCommand } from './DockingCanvas';
import s from '../../app/docking/docking.module.css';
const Canvas=dynamic(()=>import('./DockingCanvas'),{ssr:false,loading:()=> <p className={s.viewerMessage} role="status">Opening your molecular view…</p>});
class Boundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true}}componentDidCatch(){this.props.onFailure()}render(){return this.state.failed?null:this.props.children}}
function Flat({data,poseIndex,reference,box}:{data:DockingData;poseIndex:number;reference:boolean;box:boolean}){
 const pose=useMemo(()=>pdbAtoms(data.poses[poseIndex].pdb),[data,poseIndex]),crystal=useMemo(()=>pdbAtoms(data.reference_ligand_pdb),[data.reference_ligand_pdb]);
 const sx=360/Math.max(data.box.size[0],data.box.size[1],1),pos=(v:number,i:number)=>180+(v-data.box.center[i])*sx;
 return <svg viewBox="-30 -30 420 420" className={s.flat} role="img" aria-label={`Top-down coordinates of pose ${data.poses[poseIndex].rank}${reference?' and the deposited molecule':''}. Depth is not represented.`}>
  {box&&<rect x={180-data.box.size[0]*sx/2} y={180-data.box.size[1]*sx/2} width={data.box.size[0]*sx} height={data.box.size[1]*sx} fill="none" stroke="var(--ink-soft)" strokeDasharray="5 5"/>}
  {reference&&crystal.map((a,i)=><circle key={`r${i}`} cx={pos(a.position[0],0)} cy={pos(a.position[1],1)} r={5} fill="var(--pollen)"><title>Crystal {a.element}: {a.position.join(', ')} Å</title></circle>)}
  {pose.map((a,i)=><circle key={i} cx={pos(a.position[0],0)} cy={pos(a.position[1],1)} r={6} fill="var(--chlorophyll)" stroke="var(--paper)" strokeWidth={1}><title>Pose {a.element}: {a.position.join(', ')} Å</title></circle>)}
 </svg>;
}
export default function DockingViewer({data,poseIndex}:{data:DockingData;poseIndex:number}){
 const [reference,setReference]=useState(true),[box,setBox]=useState(false),[backbone,setBackbone]=useState(false),[mode,setMode]=useState<'3d'|'2d'>('3d'),[failed,setFailed]=useState(false),[visible,setVisible]=useState(true),[command,setCommand]=useState<DockingCameraCommand>({id:0,action:'reset'});const host=useRef<HTMLDivElement>(null);
 const fail=useCallback(()=>{setFailed(true);setMode('2d')},[]);
 useEffect(()=>{const el=host.current;if(!el)return;let intersects=true;const update=()=>setVisible(intersects&&!document.hidden),observer=new IntersectionObserver(entries=>{intersects=entries[0]?.isIntersecting??true;update()},{rootMargin:'200px'});observer.observe(el);document.addEventListener('visibilitychange',update);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update)}},[]);
 const camera=(action:DockingCameraCommand['action'])=>setCommand(c=>({id:c.id+1,action}));
 return <section className={s.viewerSection} aria-label="Binding pose comparison">
  <div className={s.viewerBar}><div><h3>Take a closer look</h3><p className="faint">Pose {data.poses[poseIndex].rank} in the fixed binding site</p></div><div className="segmented" role="group" aria-label="Coordinate view"><button type="button" className="btn ghost small" aria-pressed={mode==='3d'} disabled={failed} onClick={()=>setMode('3d')}>3D</button><button type="button" className="btn ghost small" aria-pressed={mode==='2d'} onClick={()=>setMode('2d')}>2D</button></div></div>
  {failed&&<p className="notice warn" role="status">3D is unavailable on this device. The same saved coordinates are shown in 2D.</p>}
  <div className={s.viewport} ref={host} role="group" aria-label="Molecular coordinates" aria-describedby="docking-view-help">
   {mode==='2d'?<Flat data={data} poseIndex={poseIndex} reference={reference} box={box}/>:visible?<Boundary onFailure={fail}><Canvas data={data} poseIndex={poseIndex} reference={reference} box={box} backbone={backbone} command={command} onFailure={fail}/></Boundary>:<p className={s.viewerMessage}>Preview paused while out of view.</p>}
  </div>
  <div className={s.legend}><span><i style={{background:'var(--chlorophyll)'}}/>Your pose</span><span><i style={{background:'var(--pollen)'}}/>Crystal molecule</span><span><i style={{background:'var(--hema)'}}/>Protein pocket</span></div>
  <div className={s.viewOptions}><label><input type="checkbox" checked={reference} onChange={e=>setReference(e.target.checked)}/>Compare crystal molecule</label>{mode==='3d'&&<label><input type="checkbox" checked={backbone} onChange={e=>setBackbone(e.target.checked)}/>Protein outline</label>}<label><input type="checkbox" checked={box} onChange={e=>setBox(e.target.checked)}/>Show search area</label></div>
  {mode==='3d'&&<div className={s.camera} role="group" aria-label="Molecular camera controls">{([['left','Left'],['right','Right'],['up','Up'],['down','Down'],['in','Zoom in'],['out','Zoom out'],['reset','Reset']] as const).map(([action,label])=><button type="button" className="btn quiet small" key={action} onClick={()=>camera(action)}>{label}</button>)}</div>}
  <p id="docking-view-help" className="faint">{mode==='3d'?'Drag to rotate, or use the camera buttons. Pinch or scroll to zoom.':'Top-down projection: atoms at different depths can overlap.'} {mode==='3d'?'Carbon colors distinguish your pose and the crystal molecule; oxygen is pink and nitrogen is blue.':'Your pose is green; the crystal molecule is yellow.'} Ligand connections are a display aid inferred from atom distances. The deposited molecule is a comparison, not a predicted answer for a different molecule.</p>
 </section>;
}
