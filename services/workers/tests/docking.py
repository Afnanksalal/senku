"""Real worker tests, executed inside the isolated vina container."""
import concurrent.futures,json,math,os,pathlib,time,urllib.request,urllib.error,uuid
TOKEN=os.environ['SCIENCE_TOKEN'];BASE='http://127.0.0.1:8080';checks=0
def check(condition,label):
 global checks
 assert condition,label
 checks+=1
def request(path,body,token=TOKEN):
 req=urllib.request.Request(BASE+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+token})
 try:
  with urllib.request.urlopen(req,timeout=70) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def job(target='trypsin',smiles='NC(=N)c1ccccc1',seed=42,effort=1,count=3):
 return {'job_id':str(uuid.uuid4()),'model_id':'molecular-docking','parameters':{'target':target,'smiles':smiles,'exhaustiveness':effort,'num_modes':count,'seed':seed},'seed':seed,'input':{},'timeout_seconds':60}
def geometry_rmsd(result):
 from rdkit import Chem
 from rdkit.Chem import AllChem,rdMolAlign
 d=result['docking'];template=Chem.MolFromSmiles(d['target']['reference_smiles'])
 ref=Chem.MolFromPDBBlock(d['reference_ligand_pdb'],removeHs=True)
 probe=Chem.MolFromPDBBlock(d['poses'][0]['pdb'],removeHs=True)
 ref=AllChem.AssignBondOrdersFromTemplate(template,ref)
 probe=AllChem.AssignBondOrdersFromTemplate(template,probe)
 # CalcRMS keeps the original crystal frame and handles symmetry; no superposition.
 return rdMolAlign.CalcRMS(probe,ref)
def main():
 metrics=[]
 for target,smiles in [('trypsin','NC(=N)c1ccccc1'),('streptavidin','C1[C@H]2[C@@H]([C@@H](S1)CCCCC(=O)O)NC(=O)N2')]:
  start=time.monotonic();status,a=request('/v1/execute',job(target,smiles));elapsed=time.monotonic()-start
  check(status==200,f'{target} real docking status {status}: {a}')
  status,b=request('/v1/execute',job(target,smiles));check(status==200,f'{target} repeated docking')
  check(a['docking']==b['docking'],f'{target} exact deterministic seed replay')
  d=a['docking'];poses=d['poses']
  check(1<=len(poses)<=3,f'{target} bounded pose count')
  check(a['scalars']['best_score_kcal_mol']==poses[0]['score_kcal_mol'],f'{target} scalar equals evidence')
  check(a['units']['best_score_kcal_mol']=='kcal/mol',f'{target} score units')
  check(all(math.isfinite(p['score_kcal_mol']) for p in poses),f'{target} finite scores')
  check([p['score_kcal_mol'] for p in poses]==sorted(p['score_kcal_mol'] for p in poses),f'{target} ranked scores')
  check(d['target']['id']==target and d['protein_pdb'].startswith('ATOM'),f'{target} curated geometry')
  check(len(d['binding_site_residues'])>0,f'{target} binding site residues')
  check(all(r['distance_angstrom']<=5 for r in d['binding_site_residues']),f'{target} reference neighborhood')
  check(d['box']['size']==[18,18,18],f'{target} immutable box')
  check('rigid' in ' '.join(d['limitations']) and 'not measured' in ' '.join(d['limitations']),f'{target} honest limitations')
  check(all(len(d['provenance'][k])==64 for k in ('source_pdb_sha256','receptor_pdbqt_sha256','preparation_sha256','ligand_pdbqt_sha256')),f'{target} hashes')
  rmsd=geometry_rmsd(a);check(math.isfinite(rmsd),f'{target} reference comparison')
  metrics.append({'target':target,'elapsed_seconds':round(elapsed,3),'score':poses[0]['score_kcal_mol'],'returned_poses':len(poses),'crystal_frame_symmetry_rmsd_angstrom':round(rmsd,3)})
  pathlib.Path('/tmp/'+target+'-docking-result.json').write_text(json.dumps(a))
 for parameter,value in [('target','unapproved'),('smiles','not smiles'),('smiles','C.C'),('smiles','C'*161),('smiles','[Fe]'),('smiles','C'*33),('smiles','[CH3]'),('exhaustiveness',9),('num_modes',6),('seed',0),('num_modes',True)]:
  j=job();j['parameters'][parameter]=value;status,result=request('/v1/execute',j)
  check(status in (400,422) and result.get('error',{}).get('code')=='invalid_input',f'reject {parameter} {value!r}')
 j=job();j['parameters']['box_center']='1,2,3';status,_=request('/v1/execute',j);check(status==400,'reject arbitrary box')
 j=job();j['input']={'receptor':'custom'};status,_=request('/v1/execute',j);check(status==400,'reject custom receptor')
 status,_=request('/v1/execute',job(),token='invalid');check(status==401,'unauthenticated worker rejected')
 j=job('streptavidin','C1[C@H]2[C@@H]([C@@H](S1)CCCCC(=O)O)NC(=O)N2',effort=8,count=5)
 with concurrent.futures.ThreadPoolExecutor() as pool:
  running=pool.submit(request,'/v1/execute',j);time.sleep(.6)
  status,cancel=request('/v1/jobs/'+j['job_id']+'/cancel',{})
  check(status==202 and cancel['cancellation_requested'],'active cancellation accepted')
  status,result=running.result();check(status==409 and result['error']['code']=='cancelled','subprocess cancelled and reaped')
 j=job('streptavidin','C1[C@H]2[C@@H]([C@@H](S1)CCCCC(=O)O)NC(=O)N2',effort=8,count=5);j['timeout_seconds']=1
 status,result=request('/v1/execute',j);check(status==409 and result['error']['code']=='timed_out','wall deadline enforced')
 print(json.dumps({'assertions':checks,'reference_metrics':metrics},indent=2))
if __name__=='__main__':main()
