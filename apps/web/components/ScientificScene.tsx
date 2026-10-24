'use client';
import dynamic from 'next/dynamic';
import { Component, useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import type { RunRecord } from '../lib/runs';
import { fmt, unitText } from '../lib/format';
import { scientificSceneData, type SceneData } from './scientific-scene-data';
import type { CameraCommand } from './ScientificCanvas';
import styles from './ScientificScene.module.css';

const CanvasView=dynamic(()=>import('./ScientificCanvas'),{ssr:false,loading:()=> <div className="skeleton" style={{height:'100%'}} aria-label="Loading 3D view"/>});

class SceneBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed?null:this.props.children;}
}

function FlatView({data}:{data:SceneData}) {
  if(data.kind==='cells')return <svg className={styles.fallback} viewBox="0 0 500 340" role="img" aria-label={`Top-down cell projection, ${data.cells!.length} saved cells.`}>
    <path d="M30 300H470M40 310V30" stroke="var(--line)"/><text x="450" y="325">x</text><text x="22" y="30">y</text>
    {data.cells!.map(c=><circle key={c.id} cx={250+c.position[0]*40} cy={170+c.position[2]*40} r={Math.max(.5,c.radius*40)} fill="var(--chlorophyll)" fillOpacity={.7} stroke="white" strokeWidth={1}><title>Cell {c.id}: x {fmt(c.physicalPosition[0])}, y {fmt(c.physicalPosition[1])}, z {fmt(c.physicalPosition[2])} µm; volume {fmt(c.volume)} µm³</title></circle>)}
  </svg>;
  if(data.kind==='grid') {const rows=data.grid!.length,cols=Math.max(...data.grid!.map(row=>row.length));return <svg className={styles.fallback} viewBox={`0 0 ${cols} ${rows}`} role="img" aria-label="Saved concentration grid, darker cells have higher concentrations">
    {data.grid!.flatMap((row,y)=>row.map((value,x)=><rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill="var(--hema)" opacity={data.maximum>0?.08+.92*value/data.maximum:.08}><title>Cell {x}, {y}: {fmt(value)}</title></rect>))}
  </svg>;}
  return <svg className={styles.fallback} viewBox="0 0 500 340" role="img" aria-label="Saved model values as proportional columns">
    {data.metrics.map((metric,i)=>{const width=380/data.metrics.length;const height=Math.max(0,metric.value)/metric.maximum*215;return <g key={metric.name}><rect x={60+i*width} y={260-height} width={width*.6} height={height} rx={7} fill={`var(--${['chlorophyll','cobalt','hema','eosin'][i%4]})`}/><text x={60+i*width+width*.3} y={285} textAnchor="middle">{fmt(metric.value)}</text><title>{metric.name}: {fmt(metric.value)} {unitText(metric.unit)}</title></g>;})}
    <path d="M40 260H470" stroke="var(--line)"/>
  </svg>;
}

function ReadyScene({run}:{run:RunRecord}) {
  const [index,setIndex]=useState(0);
  const [mode,setMode]=useState<'3d'|'2d'>('3d');
  const [failed,setFailed]=useState(false);
  const [command,setCommand]=useState<CameraCommand>({id:0,action:'reset'});
  const id=useId();
  const fail=useCallback(()=>{setFailed(true);setMode('2d');},[]);
  const data=useMemo(()=>scientificSceneData(run,index),[run,index]);
  if(!data)return null;
  const camera=(action:CameraCommand['action'])=>setCommand(c=>({id:c.id+1,action}));
  return <section className={styles.root} aria-labelledby={id}>
    <div className={styles.bar}><h3 id={id}>{data.title}</h3><div className="segmented" role="group" aria-label="Visualization mode"><button className="btn ghost small" aria-pressed={mode==='3d'} disabled={failed} onClick={()=>setMode('3d')}>3D</button><button className="btn ghost small" aria-pressed={mode==='2d'} onClick={()=>setMode('2d')}>2D</button></div></div>
    {failed&&<p role="status" className="notice warn">The 3D renderer is unavailable. The same saved data is shown in 2D.</p>}
    <div className={styles.viewport} aria-describedby={`${id}-description`}>
      {mode==='3d'?<SceneBoundary onFailure={fail}><CanvasView data={data} command={command} onFailure={fail}/></SceneBoundary>:<FlatView data={data}/>}
    </div>
    {mode==='3d'&&<div className={styles.controls} role="group" aria-label="3D camera controls">
      <button className="btn quiet small" onClick={()=>camera('left')}>Rotate left</button><button className="btn quiet small" onClick={()=>camera('right')}>Rotate right</button><button className="btn quiet small" onClick={()=>camera('up')}>Look higher</button><button className="btn quiet small" onClick={()=>camera('down')}>Look lower</button><button className="btn quiet small" onClick={()=>camera('in')}>Zoom in</button><button className="btn quiet small" onClick={()=>camera('out')}>Zoom out</button><button className="btn ghost small" onClick={()=>camera('reset')}>Reset view</button>
    </div>}
    {data.times.length>1&&<label className={styles.timeline}><span>Saved frame {data.index+1} of {data.times.length}: <strong>{fmt(data.time!)} min</strong></span><input type="range" min={0} max={data.times.length-1} step={1} value={data.index} onChange={e=>setIndex(Number(e.target.value))} aria-valuetext={`${fmt(data.time!)} minutes`}/></label>}
    <div className={styles.metrics}>{data.metrics.map(metric=><div key={metric.name} className={styles.metric}><span className="faint">{metric.name}</span><strong>{fmt(metric.value)}</strong><span className="faint">{unitText(metric.unit)}</span></div>)}</div>
    <p id={`${id}-description`} className={styles.description}>{data.caption}</p>
    {mode==='3d'&&<p className="faint">Drag to rotate. Use the buttons for keyboard and touch alternatives. The scene stays still until you interact; frame changes show saved samples without interpolating motion.</p>}
    {data.kind==='cells'&&<details className="more"><summary>Cell coordinates and volumes</summary><div className={styles.tableRegion} tabIndex={0} role="region" aria-label="Saved cell coordinates"><table className={styles.table}><thead><tr><th>Cell</th><th>x (µm)</th><th>y (µm)</th><th>z (µm)</th><th>Volume (µm³)</th></tr></thead><tbody>{data.cells!.map(cell=><tr key={cell.id}><th>{cell.id}</th>{cell.physicalPosition.map((v,i)=><td key={i}>{fmt(v)}</td>)}<td>{fmt(cell.volume)}</td></tr>)}</tbody></table></div></details>}
  </section>;
}

export function ScientificScene({run}:{run:RunRecord}) {
  if(!scientificSceneData(run,0))return null;
  return <ReadyScene key={run.id} run={run}/>;
}
