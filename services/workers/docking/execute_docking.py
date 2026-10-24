"""Bounded rigid-receptor teaching docking on two immutable binding sites."""
import hashlib,importlib.metadata,json,math,pathlib
DATA=pathlib.Path(__file__).resolve().parent/'data'
LIMITATIONS=[
 'Vina scores are estimates, not measured binding strengths.',
 'The protein is treated as rigid; it cannot change shape during this search.',
 'Water, other bound molecules and ions are omitted. Protonation, solvent and assembly preparation affect the result.',
 'Only the supplied protonation and tautomer state is tested; this search does not model pH or changing chemical states.',
 'This is a teaching comparison, not a prediction of biological activity, safety, dose or treatment.',
 'The crystal pose shows one experimentally observed structure; a similar pose does not establish binding affinity.',
]
def sha(raw):return hashlib.sha256(raw).hexdigest()
def integer(p,k,a,b):
 v=p[k]
 if type(v) is not int or not a<=v<=b:raise ValueError(k)
 return v
def pdb_from_pdbqt(text):
 elements={'A':'C','C':'C','N':'N','NA':'N','NS':'N','OA':'O','OS':'O','O':'O','SA':'S','S':'S','P':'P','F':'F','Cl':'Cl','H':'H','HD':'H'}
 lines=[]
 for l in text.splitlines():
  if l.startswith(('ATOM  ','HETATM')):
   element=elements.get(l.split()[-1])
   if element is None:raise RuntimeError('Unrecognized prepared atom type')
   lines.append(l[:66].ljust(76)+element.rjust(2))
 if not lines:raise RuntimeError('Empty docking pose')
 return '\n'.join(lines)+'\nEND\n'
def dock(job):
 from rdkit import Chem
 from rdkit.Chem import AllChem,rdMolDescriptors
 from meeko import MoleculePreparation,PDBQTWriterLegacy
 from vina import Vina
 if job['model_id']!='molecular-docking':raise ValueError('model')
 p=job['parameters'];target=p['target']
 if target not in ('trypsin','streptavidin'):raise ValueError('target')
 effort=integer(p,'exhaustiveness',1,8);count=integer(p,'num_modes',1,5);seed=integer(p,'seed',1,2147483647)
 if job['seed']!=seed:raise ValueError('seed')
 smiles=p['smiles']
 if not isinstance(smiles,str) or not 1<=len(smiles)<=160:raise ValueError('smiles')
 mol=Chem.MolFromSmiles(smiles)
 if mol is None or not 1<=mol.GetNumHeavyAtoms()<=32 or len(Chem.GetMolFrags(mol))!=1 or any(a.GetAtomicNum() not in (1,6,7,8,9,15,16,17) or a.GetNumRadicalElectrons() for a in mol.GetAtoms()) or abs(Chem.GetFormalCharge(mol))>2 or rdMolDescriptors.CalcNumRotatableBonds(mol)>8:raise ValueError('molecule outside teaching limits')
 canonical=Chem.MolToSmiles(mol);formula=rdMolDescriptors.CalcMolFormula(mol)
 mol=Chem.AddHs(mol);embedding=AllChem.ETKDGv3();embedding.randomSeed=seed;embedding.maxIterations=200
 if AllChem.EmbedMolecule(mol,embedding)!=0:raise ValueError('conformer preparation')
 if not AllChem.MMFFHasAllMoleculeParams(mol):raise ValueError('unsupported molecule preparation')
 status=AllChem.MMFFOptimizeMolecule(mol,maxIters=500)
 if status!=0:raise ValueError('conformer minimization did not converge')
 setups=MoleculePreparation().prepare(mol)
 if len(setups)!=1:raise ValueError('ambiguous ligand preparation')
 ligand,ok,error=PDBQTWriterLegacy.write_string(setups[0])
 if not ok:raise ValueError('ligand preparation')
 meta=json.loads((DATA/(target+'.json')).read_text())
 receptor=DATA/(target+'.pdbqt')
 if sha(receptor.read_bytes())!=meta['receptor_pdbqt_sha256']:raise RuntimeError('Receptor hash mismatch')
 engine=Vina(sf_name='vina',cpu=1,seed=seed,verbosity=0)
 engine.set_receptor(str(receptor));engine.set_ligand_from_string(ligand)
 engine.compute_vina_maps(center=meta['box']['center'],box_size=meta['box']['size'])
 engine.dock(exhaustiveness=effort,n_poses=count)
 energies=engine.energies(n_poses=count,energy_range=100.0)
 raw=engine.poses(n_poses=count,energy_range=100.0)
 models=[]
 for piece in raw.split('MODEL')[1:]:
  body=piece.split('\n',1)[1].split('ENDMDL')[0].strip()+'\n'
  if 'ATOM' in body:models.append(body)
 if not models or len(models)!=len(energies):raise RuntimeError('Docking returned no consistent poses')
 poses=[]
 for i,(text,energy) in enumerate(zip(models,energies)):
  score=float(energy[0])
  if not math.isfinite(score):raise RuntimeError('Nonfinite score')
  poses.append({'rank':i+1,'score_kcal_mol':score,'pdbqt':text,'pdb':pdb_from_pdbqt(text)})
 target_meta={k:meta[k] for k in ('id','name','pdb_id','source_url','organism','reference_ligand','reference_smiles')}
 provenance={k:meta[k] for k in ('source_pdb_sha256','receptor_pdbqt_sha256','preparation_sha256')}
 provenance.update(ligand_pdbqt_sha256=sha(ligand.encode()),seed=seed,cpu=1,scoring_function='vina')
 result={'target':target_meta,'protein_pdb':(DATA/(target+'.pdb')).read_text(),'reference_ligand_pdb':(DATA/(target+'-reference.pdb')).read_text(),'box':meta['box'],'binding_site_residues':meta['binding_site_residues'],'poses':poses,'limitations':LIMITATIONS,'provenance':provenance}
 return dict(engine_id='vina',engine_version=importlib.metadata.version('vina'),adapter_version='1.0.0',model_id=job['model_id'],scientific_status='illustrative_educational',scalars={'best_score_kcal_mol':poses[0]['score_kcal_mol'],'pose_count':len(poses)},units={'best_score_kcal_mol':'kcal/mol','pose_count':'count'},series=[],frames=[],diagnostics={'canonical_smiles':canonical,'formula':formula,'exhaustiveness':effort,'requested_pose_count':count,'returned_pose_count':len(poses),'seed':seed,'cpu':1,'receptor_preparation':meta['preparation'],'rdkit_version':importlib.metadata.version('rdkit'),'meeko_version':importlib.metadata.version('meeko'),'docking_adapter_sha256':sha(pathlib.Path(__file__).read_bytes())},warnings=LIMITATIONS,docking=result)
