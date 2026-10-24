'use client';
import { Canvas,useThree } from '@react-three/fiber';
import { OrbitControls,Line } from '@react-three/drei';
import { useEffect,useLayoutEffect,useMemo,useRef,type ComponentRef } from 'react';
import { Color,InstancedMesh,Object3D,Vector3 } from 'three';
import { pdbAtoms,coordinateBonds,type Atom,type DockingData } from '../../lib/docking';
export type DockingCameraCommand={id:number;action:'left'|'right'|'up'|'down'|'in'|'out'|'reset'};
type Props={data:DockingData;poseIndex:number;reference:boolean;box:boolean;backbone:boolean;command:DockingCameraCommand;onFailure:()=>void};
function Controls({command,onFailure,distance}:{command:DockingCameraCommand;onFailure:()=>void;distance:number}){
 const ref=useRef<ComponentRef<typeof OrbitControls>>(null),invalidate=useThree(s=>s.invalidate),gl=useThree(s=>s.gl);
 useEffect(()=>{const lost=(event:Event)=>{event.preventDefault();onFailure()};gl.domElement.addEventListener('webglcontextlost',lost);return()=>gl.domElement.removeEventListener('webglcontextlost',lost)},[gl,onFailure]);
 useEffect(()=>{const c=ref.current;if(!c)return;switch(command.action){case'left':c.setAzimuthalAngle(c.getAzimuthalAngle()+Math.PI/9);break;case'right':c.setAzimuthalAngle(c.getAzimuthalAngle()-Math.PI/9);break;case'up':c.setPolarAngle(Math.max(.1,c.getPolarAngle()-.2));break;case'down':c.setPolarAngle(Math.min(Math.PI-.1,c.getPolarAngle()+.2));break;case'in':c.dollyIn();break;case'out':c.dollyOut();break;case'reset':c.reset();break;}c.update();invalidate()},[command,invalidate]);
 return <OrbitControls ref={ref} makeDefault enablePan={false} enableDamping={false} autoRotate={false} minDistance={4} maxDistance={distance*3} minPolarAngle={.1} maxPolarAngle={Math.PI-.1}/>;
}
function Atoms({atoms,center,carbon,radius=.36,opacity=1}:{atoms:Atom[];center:number[];carbon:string;radius?:number;opacity?:number}){
 const ref=useRef<InstancedMesh>(null),scratch=useMemo(()=>new Object3D(),[]),color=useMemo(()=>new Color(),[]);
 const palette=useMemo(()=>{const css=getComputedStyle(document.documentElement);return{O:css.getPropertyValue('--eosin').trim(),N:css.getPropertyValue('--cobalt').trim(),S:css.getPropertyValue('--pollen').trim(),P:css.getPropertyValue('--pollen').trim(),C:carbon}},[carbon]);
 useLayoutEffect(()=>{if(!ref.current)return;atoms.forEach((a,i)=>{scratch.position.set(a.position[0]-center[0],a.position[1]-center[1],a.position[2]-center[2]);scratch.scale.setScalar(radius);scratch.updateMatrix();ref.current!.setMatrixAt(i,scratch.matrix);ref.current!.setColorAt(i,color.set(palette[a.element as keyof typeof palette]??carbon))});ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true},[atoms,center,scratch,color,palette,carbon,radius]);
 if(!atoms.length)return null;
 return <instancedMesh ref={ref} args={[undefined,undefined,atoms.length]} frustumCulled={false}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial roughness={.5} transparent={opacity<1} opacity={opacity}/></instancedMesh>;
}
function Bonds({atoms,center,color}:{atoms:Atom[];center:number[];color:string}){
 const bonds=useMemo(()=>coordinateBonds(atoms),[atoms]),ref=useRef<InstancedMesh>(null),scratch=useMemo(()=>new Object3D(),[]);
 useLayoutEffect(()=>{const mesh=ref.current;if(!mesh)return;const up=new Vector3(0,1,0);for(let i=0;i<bonds.length;i++){const[a,b]=bonds[i],p=new Vector3(...atoms[a].position),q=new Vector3(...atoms[b].position),d=q.clone().sub(p);scratch.position.copy(p.add(q).multiplyScalar(.5)).sub(new Vector3(center[0],center[1],center[2]));scratch.quaternion.setFromUnitVectors(up,d.clone().normalize());scratch.scale.set(.11,d.length(),.11);scratch.updateMatrix();mesh.setMatrixAt(i,scratch.matrix)}mesh.instanceMatrix.needsUpdate=true},[atoms,bonds,center,scratch]);
 if(!bonds.length)return null;
 return <instancedMesh ref={ref} args={[undefined,undefined,bonds.length]} frustumCulled={false}><cylinderGeometry args={[1,1,1,8]}/><meshStandardMaterial color={color} roughness={.6}/></instancedMesh>;
}
export default function DockingCanvas({data,poseIndex,reference,box,backbone,command,onFailure}:Props){
 const colors=useMemo(()=>{const css=getComputedStyle(document.documentElement);return{protein:css.getPropertyValue('--hema').trim(),pose:css.getPropertyValue('--chlorophyll').trim(),reference:css.getPropertyValue('--pollen').trim(),ink:css.getPropertyValue('--ink-soft').trim(),paper:css.getPropertyValue('--paper').trim()}},[]);
 const protein=useMemo(()=>pdbAtoms(data.protein_pdb),[data.protein_pdb]),pose=useMemo(()=>pdbAtoms(data.poses[poseIndex].pdb),[data,poseIndex]),crystal=useMemo(()=>pdbAtoms(data.reference_ligand_pdb),[data.reference_ligand_pdb]);
 const pocket=useMemo(()=>{const ids=new Set(data.binding_site_residues.map(r=>`${r.chain}:${r.residue_number}`));return protein.filter(a=>ids.has(`${a.chain}:${a.number}`)).slice(0,700)},[data,protein]);
 const backbones=useMemo(()=>{
  const segments:[number,number,number][][]=[],tails=new Map<string,[number,number,number][]>();
  for(const atom of protein.filter(a=>a.name==='CA')){
   const point=atom.position.map((v,i)=>v-data.box.center[i]) as [number,number,number];
   let row=tails.get(atom.chain);const previous=row?.[row.length-1];
   if(!row||(previous&&Math.hypot(point[0]-previous[0],point[1]-previous[1],point[2]-previous[2])>4.5)){row=[];segments.push(row);tails.set(atom.chain,row)}
   row.push(point);
  }
  return segments.filter(row=>row.length>1);
 },[protein,data.box.center]);
 const distance=Math.max(...data.box.size)*1.1;
 return <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[distance*.65,distance*.45,distance],fov:40,near:.1,far:500}} gl={{antialias:true,powerPreference:'low-power'}} fallback={<p>Use the 2D view to inspect these coordinates.</p>}>
  <color attach="background" args={[colors.paper]}/><ambientLight intensity={1.7}/><directionalLight position={[20,30,20]} intensity={2}/>
  {backbone&&backbones.map((points,i)=><Line key={i} points={points} color={colors.protein} lineWidth={2} transparent opacity={.35}/>)}
  <Atoms atoms={pocket} center={data.box.center} carbon={colors.protein} radius={.22} opacity={.45}/>
  {reference&&<><Atoms atoms={crystal} center={data.box.center} carbon={colors.reference} radius={.28}/><Bonds atoms={crystal} center={data.box.center} color={colors.reference}/></>}
  <Atoms atoms={pose} center={data.box.center} carbon={colors.pose}/><Bonds atoms={pose} center={data.box.center} color={colors.pose}/>
  {box&&<mesh><boxGeometry args={data.box.size}/><meshBasicMaterial color={colors.ink} wireframe transparent opacity={.3}/></mesh>}
  <Controls command={command} onFailure={onFailure} distance={distance}/>
 </Canvas>;
}
