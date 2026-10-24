import { z } from 'zod';

export const dockingParametersSchema=z.object({target:z.enum(['trypsin','streptavidin']),smiles:z.string().min(1).max(160),exhaustiveness:z.number().int().min(1).max(8),num_modes:z.number().int().min(1).max(5),seed:z.number().int().min(1).max(2147483647)});
const point=z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]);
export const dockingTargetSchema=z.object({id:z.enum(['trypsin','streptavidin']),name:z.string(),pdb_id:z.string(),source_url:z.string().url(),organism:z.string(),reference_ligand:z.string(),reference_smiles:z.string(),description:z.string().optional()});
export const dockingDataSchema=z.object({
 target:dockingTargetSchema,protein_pdb:z.string().min(1).max(2_000_000),reference_ligand_pdb:z.string().min(1).max(100_000),
 box:z.object({center:point,size:point}),
 binding_site_residues:z.array(z.object({chain:z.string(),residue_name:z.string(),residue_number:z.union([z.string(),z.number()]),distance_angstrom:z.number().finite()})).max(300),
 poses:z.array(z.object({rank:z.number().int().positive(),score_kcal_mol:z.number().finite(),pdbqt:z.string().max(100_000),pdb:z.string().min(1).max(100_000)})).min(1).max(5),
 limitations:z.array(z.string()).max(30),provenance:z.record(z.string(),z.unknown()),
});
export type DockingData=z.infer<typeof dockingDataSchema>;
export type DockingTarget=z.infer<typeof dockingTargetSchema>;
export type DockingTargets={items:DockingTarget[];defaults:{target:string;smiles:string;exhaustiveness:number;num_modes:number;seed:number};limits:{max_smiles_length:number;max_heavy_atoms:number;max_rotatable_bonds:number};limitations:string[]};
export type Atom={serial:number;name:string;element:string;residue:string;number:string;chain:string;position:[number,number,number]};
/** Read coordinates from the saved PDB only. No model-generated geometry. */
export function pdbAtoms(pdb:string):Atom[]{
 return pdb.split(/\r?\n/).filter(line=>line.startsWith('ATOM  ')||line.startsWith('HETATM')).flatMap(line=>{
  const position=[Number(line.slice(30,38)),Number(line.slice(38,46)),Number(line.slice(46,54))] as [number,number,number];
  const element=(line.slice(76,78).trim()||line.slice(12,16).trim().replace(/^[0-9]/,'').slice(0,1)).toUpperCase();
  if(!position.every(Number.isFinite)||element==='H')return[];
  return[{serial:Number(line.slice(6,11)),name:line.slice(12,16).trim(),element,residue:line.slice(17,20).trim(),number:line.slice(22,26).trim(),chain:line.slice(21,22).trim(),position}];
 }).slice(0,12000);
}
const radii:Record<string,number>={C:.76,N:.71,O:.66,S:1.05,P:1.07,F:.57,CL:1.02,BR:1.2,I:1.39};
/** Display-only proximity bonds when a PDB has no explicit connection records. */
export function coordinateBonds(atoms:Atom[]):[number,number][]{
 const bonds:[number,number][]=[];
 for(let a=0;a<atoms.length;a++)for(let b=a+1;b<atoms.length;b++){
  const d=Math.hypot(...atoms[a].position.map((v,i)=>v-atoms[b].position[i]));
  if(d>.4&&d<(radii[atoms[a].element]??.76)+(radii[atoms[b].element]??.76)+.35)bonds.push([a,b]);
 }
 return bonds;
}
export function dockingResult(value:unknown):DockingData|null{const result=dockingDataSchema.safeParse(value);return result.success?result.data:null;}

/** Common API idempotency keys permit letters, digits, underscore and hyphen only. */
export function dockingReflectionKey(runId:string,attemptId?:string){return `docking-reflection-${runId}${attemptId?`-${attemptId}`:''}`;}
