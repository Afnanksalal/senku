'use client';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import type { SceneData } from './scientific-scene-data';

export type CameraCommand={id:number;action:'left'|'right'|'up'|'down'|'in'|'out'|'reset'};
type Props={data:SceneData;command:CameraCommand;onFailure:()=>void};

function CameraControls({command,onFailure}:{command:CameraCommand;onFailure:()=>void}) {
  const ref=useRef<ComponentRef<typeof OrbitControls>>(null);
  const invalidate=useThree(s=>s.invalidate);
  const gl=useThree(s=>s.gl);
  useEffect(()=>{const lost=(event:Event)=>{event.preventDefault();onFailure();};gl.domElement.addEventListener('webglcontextlost',lost);return()=>gl.domElement.removeEventListener('webglcontextlost',lost);},[gl,onFailure]);
  useEffect(()=>{
    const controls=ref.current;if(!controls)return;
    if(command.action==='left')controls.setAzimuthalAngle(controls.getAzimuthalAngle()+Math.PI/12);
    if(command.action==='right')controls.setAzimuthalAngle(controls.getAzimuthalAngle()-Math.PI/12);
    if(command.action==='up')controls.setPolarAngle(Math.max(.15,controls.getPolarAngle()-.15));
    if(command.action==='down')controls.setPolarAngle(Math.min(Math.PI*.48,controls.getPolarAngle()+.15));
    if(command.action==='in')controls.dollyIn();
    if(command.action==='out')controls.dollyOut();
    if(command.action==='reset')controls.reset();
    controls.update();invalidate();
  },[command,invalidate]);
  return <OrbitControls ref={ref} makeDefault enableDamping={false} enablePan={false} minDistance={3} maxDistance={24} minPolarAngle={.15} maxPolarAngle={Math.PI*.48} autoRotate={false}/>;
}

function Instances({data,colors}:{data:SceneData;colors:string[]}) {
  const ref=useRef<InstancedMesh>(null);
  const invalidate=useThree(s=>s.invalidate);
  const count=data.kind==='cells'?data.cells!.length:data.kind==='grid'?data.grid!.reduce((sum,row)=>sum+row.length,0):data.metrics.length;
  const scratch=useMemo(()=>new Object3D(),[]);
  const color=useMemo(()=>new Color(),[]);
  useLayoutEffect(()=>{
    const mesh=ref.current;if(!mesh)return;
    let i=0;
    if(data.kind==='cells')for(const cell of data.cells!){scratch.position.set(...cell.position);scratch.scale.setScalar(cell.radius);scratch.rotation.set(0,0,0);scratch.updateMatrix();mesh.setMatrixAt(i,scratch.matrix);mesh.setColorAt(i,color.set(colors[0]));i++;}
    if(data.kind==='grid') {
      const rows=data.grid!.length,cols=Math.max(...data.grid!.map(row=>row.length)),width=7/Math.max(rows,cols);
      data.grid!.forEach((row,y)=>row.forEach((value,x)=>{const ratio=data.maximum>0?value/data.maximum:0,height=ratio*3;scratch.position.set((x-(cols-1)/2)*width,height/2,(y-(rows-1)/2)*width);scratch.scale.set(width*.92,Math.max(.001,height),width*.92);scratch.rotation.set(0,0,0);scratch.updateMatrix();mesh.setMatrixAt(i,scratch.matrix);mesh.setColorAt(i,color.set(colors[Math.min(colors.length-1,Math.floor(ratio*(colors.length-1)))]));i++;}));
    }
    if(data.kind==='bars')data.metrics.forEach((metric,index)=>{const height=Math.max(0,metric.value)/metric.maximum*4;scratch.position.set((index-(data.metrics.length-1)/2)*1.8,height/2,0);scratch.scale.set(1,Math.max(.001,height),1);scratch.rotation.set(0,0,0);scratch.updateMatrix();mesh.setMatrixAt(index,scratch.matrix);mesh.setColorAt(index,color.set(colors[index%colors.length]));});
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();invalidate();
  },[data,colors,scratch,color,invalidate]);
  if(!count)return null;
  return <instancedMesh key={`${data.kind}:${count}`} ref={ref} args={[undefined,undefined,count]}>
    {data.kind==='cells'?<sphereGeometry args={[1,16,10]}/>:data.kind==='grid'?<boxGeometry args={[1,1,1]}/>:<cylinderGeometry args={[.55,.55,1,24]}/>}
    <meshStandardMaterial roughness={.3} metalness={.06}/>
  </instancedMesh>;
}

export default function ScientificCanvas({data,command,onFailure}:Props) {
  const colors=useMemo(()=>{const root=getComputedStyle(document.documentElement);return ['chlorophyll','cobalt','hema','eosin','pollen'].map(name=>root.getPropertyValue(`--${name}`).trim());},[]);
  return <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[7,5,8],fov:42,near:.1,far:100}} gl={{antialias:true,powerPreference:'low-power'}} fallback={<p>3D is unavailable. Use the 2D view.</p>}>
    <ambientLight intensity={1.25}/><directionalLight position={[5,8,5]} intensity={2.3}/><directionalLight position={[-4,3,-2]} intensity={.7}/>
    <group position={[0,data.kind==='cells'?0:-1.5,0]}><Instances data={data} colors={colors}/><gridHelper args={[9,9,'#b8c9c0','#e0e8e2']} position={[0,data.kind==='cells'?-1:-.015,0]}/></group>
    <CameraControls command={command} onFailure={onFailure}/>
  </Canvas>;
}
