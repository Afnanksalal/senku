import type { RunRecord } from '../lib/runs';
import { resultLanguage, learnerUnit } from '../lib/learner-language';

export type SceneCell={id:number;position:[number,number,number];radius:number;physicalPosition:number[];volume:number};
export type SceneMetric={name:string;value:number;unit:string;maximum:number};
export type SceneData={kind:'cells'|'grid'|'bars';title:string;caption:string;time?:number;times:number[];index:number;cells?:SceneCell[];grid?:number[][];maximum:number;metrics:SceneMetric[]};

const finite=(n:number)=>Number.isFinite(n);
const supported=new Set(['cell-energy','enzyme-explorer','population-dynamics','ecosystem-rescue','genetics-lab']);

/** Geometry is only an encoding of retained result values. It never creates solver facts. */
export function scientificSceneData(run:RunRecord,index:number):SceneData|null {
  if(run.status!=='completed'||!run.result)return null;
  const result=run.result;
  const cellFrames=result.frames?.filter(f=>Array.isArray(f.cells))??[];
  if(cellFrames.length) {
    const safeIndex=Math.min(Math.max(0,index),cellFrames.length-1);
    const all=cellFrames.flatMap(f=>f.cells??[]).filter(c=>c.position_um.length>=3&&c.position_um.every(finite)&&finite(c.volume_um3)&&c.volume_um3>0);
    const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
    for(const cell of all) {const r=Math.cbrt(3*cell.volume_um3/(4*Math.PI));for(let a=0;a<3;a++){minimum[a]=Math.min(minimum[a],cell.position_um[a]-r);maximum[a]=Math.max(maximum[a],cell.position_um[a]+r);}}
    const center=minimum.map((v,a)=>finite(v)?(v+maximum[a])/2:0);
    const extent=Math.max(1,...maximum.map((v,a)=>finite(v)?v-minimum[a]:1));
    const scale=7/extent;
    const frame=cellFrames[safeIndex];
    const cells=(frame.cells??[]).filter(c=>c.position_um.length>=3&&c.position_um.every(finite)&&finite(c.volume_um3)&&c.volume_um3>0).slice(0,1000).map(c=>({id:c.id,position:[(c.position_um[0]-center[0])*scale,(c.position_um[2]-center[2])*scale,(c.position_um[1]-center[1])*scale] as [number,number,number],radius:Math.cbrt(3*c.volume_um3/(4*Math.PI))*scale,physicalPosition:c.position_um,volume:c.volume_um3}));
    return {kind:'cells',title:'Spatial cell population',caption:'Cell centers use the saved x/y/z coordinates. Sphere radii are calculated from saved cell volumes. The 2D model plane is displayed horizontally; no cell motion is invented between frames.',time:frame.time_min,times:cellFrames.map(f=>f.time_min),index:safeIndex,cells,maximum:extent,metrics:[{name:'Cells in this frame',value:cells.length,unit:'cells',maximum:Math.max(1,...cellFrames.map(f=>f.cells?.length??0))}]};
  }
  const gridFrames=result.frames?.filter(f=>Array.isArray(f.concentration)&&f.concentration.length)??[];
  if(gridFrames.length) {
    const safeIndex=Math.min(Math.max(0,index),gridFrames.length-1);
    const frame=gridFrames[safeIndex];
    const maximum=Math.max(0,...gridFrames.flatMap(f=>f.concentration!.flat()).filter(finite));
    const grid=frame.concentration!.map(row=>row.map(v=>finite(v)?Math.max(0,v):0));
    return {kind:'grid',title:'Diffusion concentration surface',caption:'Each column corresponds to one saved grid cell. Height and color encode its concentration using the same scale across all saved frames. Height is a data encoding, not physical elevation.',time:frame.time_min,times:gridFrames.map(f=>f.time_min),index:safeIndex,grid,maximum,metrics:[{name:'Highest concentration',value:Math.max(0,...grid.flat()),unit:frame.unit??'',maximum:maximum||1}]};
  }
  if(!supported.has(run.experiment_id))return null;
  const series=result.series?.find(s=>s.columns.length>1&&s.data.length&&s.data.every(row=>row.every(finite)));
  if(series) {
    const safeIndex=Math.min(Math.max(0,index),series.data.length-1);
    const row=series.data[safeIndex];
    const maximum=Math.max(1,...series.data.flatMap(r=>r.slice(1)));
    return {kind:'bars',title:'Model state, schematic',caption:'Column heights encode the saved model quantities at the selected time. The arrangement is a schematic, not a simulation of spatial positions or individual organisms.',time:row[0],times:series.data.map(r=>r[0]),index:safeIndex,maximum,metrics:series.columns.slice(1).map((name,i)=>({name:resultLanguage(run.experiment_id,name).name,value:row[i+1],unit:learnerUnit(series.units[i+1]),maximum}))};
  }
  const metrics=Object.entries(result.scalars).filter(([,value])=>finite(value));
  if(!metrics.length)return null;
  const maximum=run.experiment_id==='cell-energy'?100:Math.max(1,...metrics.map(([,v])=>v));
  return {kind:'bars',title:'Model result, schematic',caption:run.experiment_id==='cell-energy'?'The column encodes the saved energy index on a 0–100 scale. It does not represent ATP molecules or a spatial cell simulation.':'Column heights encode the saved scalar values. This is a schematic comparison, not spatial geometry or a newly computed trajectory.',times:[],index:0,maximum,metrics:metrics.map(([name,value])=>({name:resultLanguage(run.experiment_id,name).name,value,unit:learnerUnit(result.units?.[name]),maximum}))};
}
