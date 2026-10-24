"""Build-time curation only. Runtime never fetches or accepts a receptor."""
import hashlib,json,math,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parent
DATA=ROOT/'data'
TARGETS=[
 {'id':'trypsin','name':'Bovine trypsin','pdb_id':'3PTB','organism':'Bos taurus','reference_ligand':'Benzamidine','reference_smiles':'NC(=N)c1ccccc1','ligand_code':'BEN','file':'3PTB.pdb','source_pdb_sha256':'288f7954d4d013fa8eab3808e1037e2958e2dcd12c9eca65a3f1014404a9f9a2','source_url':'https://www.rcsb.org/structure/3PTB'},
 {'id':'streptavidin','name':'Streptavidin','pdb_id':'1STP','organism':'Streptomyces avidinii','reference_ligand':'Biotin','reference_smiles':'C1[C@H]2[C@@H]([C@@H](S1)CCCCC(=O)O)NC(=O)N2','ligand_code':'BTN','file':'1STP-assembly1.pdb','source_pdb_sha256':'892478b3fbec8bb38fe9a2c5de12ad2b923b42327a43b61d2884d6c3fc59f3f9','source_url':'https://www.rcsb.org/structure/1STP'},
]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def xyz(line):return [float(line[x:x+8]) for x in (30,38,46)]
def prepare(t):
 source=DATA/t['file']
 if sha(source)!=t['source_pdb_sha256']:raise RuntimeError('Pinned source changed: '+t['file'])
 protein=[];ligand=[];model=1
 for l in source.read_text().splitlines():
  if l.startswith('MODEL'):model=int(l[10:14]);continue
  if l[:6] not in ('ATOM  ','HETATM'):continue
  if l[16:17] not in (' ','A'):continue
  if t['id']=='streptavidin':l=l[:21]+chr(64+model)+l[22:]
  if l.startswith('ATOM'):protein.append(l[:16]+' '+l[17:])
  elif l[17:20]==t['ligand_code'] and model==1:ligand.append(l)
 if not protein or not ligand:raise RuntimeError('Curated structure missing atoms')
 prefix=DATA/t['id'];pdb=prefix.with_suffix('.pdb');pdb.write_text('\n'.join(protein)+'\nEND\n')
 prefix.with_name(t['id']+'-reference.pdb').write_text('\n'.join(ligand)+'\nEND\n')
 points=[xyz(l) for l in ligand if l[76:78].strip()!='H']
 center=[round((min(p[i] for p in points)+max(p[i] for p in points))/2,4) for i in range(3)]
 box={'center':center,'size':[18.0,18.0,18.0]}
 residues={}
 for l in protein:
  if l[76:78].strip()=='H':continue
  pos=xyz(l);distance=min(math.dist(pos,point) for point in points)
  key=(l[21],l[17:20].strip(),int(l[22:26]))
  if distance<=5.0:residues[key]=min(distance,residues.get(key,100))
 binding=[dict(chain=k[0],residue_name=k[1],residue_number=k[2],distance_angstrom=round(d,3)) for k,d in sorted(residues.items())]
 subprocess.run(['mk_prepare_receptor.py','--read_pdb',str(pdb),'-o',str(prefix),'-p'],check=True)
 meta={**{k:v for k,v in t.items() if k not in ('file','ligand_code')},'box':box,'binding_site_residues':binding,'receptor_pdbqt_sha256':sha(prefix.with_suffix('.pdbqt')),'preparation_sha256':sha(pathlib.Path(__file__)),'preparation':{'version':'1.0.0','receptor':'Meeko residue templates, rigid heavy atoms; water, bound ligands and ions removed; hydrogens assigned by preparation templates','assembly':'Biological tetramer, chains A-D' if t['id']=='streptavidin' else 'Monomer, chain A','binding_site':'Protein residues with a heavy atom within 5 angstrom of reference ligand','box':'18 angstrom cube centered on reference heavy-atom bounding box'}}
 prefix.with_suffix('.json').write_text(json.dumps(meta,indent=2)+'\n')
if __name__=='__main__':
 for t in TARGETS:prepare(t)
