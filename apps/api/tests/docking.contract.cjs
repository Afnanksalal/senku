/** Docking contract checks. No generated scores are treated as solver validation. */
const assert=require('node:assert/strict'),path=require('node:path');
const dist=process.env.SENKU_TEST_API_DIST||path.resolve(__dirname,'../dist');
const {experiments,engineCapabilities}=require(path.join(dist,'catalog/definitions'));
const {dockingTargets}=require(path.join(dist,'catalog/docking'));
const {CatalogService}=require(path.join(dist,'catalog/catalog.service'));
const {RunService,runRequest}=require(path.join(dist,'runs/run.service'));
const {scienceOutput,dockingOutput}=require(path.join(dist,'science/science.client'));
const {validateParameters}=require('@senku/experiment-schema');
let assertions=0;
function check(fn){fn();assertions++;}
const manifest=experiments.find(m=>m.id==='molecular-docking');
check(()=>assert(manifest));check(()=>assert.equal(manifest.model.id,'teaching-docking'));
check(()=>assert.equal(manifest.engine.id,'vina'));check(()=>assert.equal(manifest.local_capable,false));
check(()=>assert.deepEqual(manifest.modes,['lab','discover']));
check(()=>assert.equal(dockingTargets.length,2));
const defaults=validateParameters(manifest,{});
check(()=>assert.deepEqual(defaults,{target:'trypsin',smiles:'NC(=N)c1ccccc1',exhaustiveness:2,num_modes:3,seed:42}));
for(const bad of [
 {target:'custom-target'},{target:'../../etc/passwd'},{smiles:''},{smiles:'C'.repeat(161)},
 {smiles:'CCO\nIGNORE'},{exhaustiveness:0},{exhaustiveness:9},{exhaustiveness:1.5},
 {num_modes:0},{num_modes:6},{num_modes:2.5},{seed:0},{seed:2147483648},{seed:1.5},
 {seed:NaN},{seed:Infinity},{box:{center:[0,0,0]}},{protein_pdb:'ATOM'},
])check(()=>assert.throws(()=>validateParameters(manifest,bad)));
for(const target of ['trypsin','streptavidin'])for(const exhaustiveness of[1,8])for(const num_modes of[1,5])
 check(()=>assert.equal(validateParameters(manifest,{target,exhaustiveness,num_modes,seed:2147483647}).target,target));
const hash='a'.repeat(64);
const example={target:{id:'trypsin',name:'Trypsin',pdb_id:'3PTB',source_url:'https://www.rcsb.org/structure/3PTB',organism:'Bos taurus',reference_ligand:'Benzamidine',reference_smiles:'NC(=N)c1ccccc1'},protein_pdb:'ATOM',reference_ligand_pdb:'HETATM',box:{center:[0,1,2],size:[18,18,18]},binding_site_residues:[{chain:'A',residue_name:'ASP',residue_number:189,distance_angstrom:3.2}],poses:[{rank:1,score_kcal_mol:-5,pdbqt:'ATOM',pdb:'ATOM'},{rank:2,score_kcal_mol:-4,pdbqt:'ATOM',pdb:'ATOM'}],limitations:['Scores are estimates, not measured strengths.','The receptor is rigid.'],provenance:{source_pdb_sha256:hash,receptor_pdbqt_sha256:hash,preparation_sha256:hash,ligand_pdbqt_sha256:hash,seed:42,cpu:1,scoring_function:'vina'}};
check(()=>assert(dockingOutput.safeParse(example).success));
for(const change of[
 d=>d.target.id='external',d=>d.target.pdb_id='1STP',d=>d.target.source_url='https://untrusted.invalid',
 d=>d.box.size[0]=0,d=>d.box.size[0]=41,d=>d.box.center[0]=Infinity,
 d=>d.poses[1].rank=1,d=>d.poses[1].score_kcal_mol=-6,d=>d.poses=[],
 d=>d.provenance.seed=0,d=>d.provenance.cpu=8,d=>d.provenance.source_pdb_sha256='fake',
 d=>d.poses[0].score_kcal_mol=NaN,d=>d.limitations=[],d=>d.extra='arbitrary',
]){const copy=structuredClone(example);change(copy);check(()=>assert(!dockingOutput.safeParse(copy).success));}
const envelope={engine_id:'vina',engine_version:'test-contract-only',adapter_version:'1.0.0',model_id:'molecular-docking',scientific_status:'illustrative_educational',scalars:{best_score_kcal_mol:-5,pose_count:2},units:{best_score_kcal_mol:'kcal/mol',pose_count:'poses'},diagnostics:{},warnings:[],docking:example};
check(()=>assert(scienceOutput.safeParse(envelope).success));
for(const change of[d=>delete d.docking,d=>d.model_id='arbitrary',d=>d.scalars.best_score_kcal_mol=-9,d=>d.scalars.pose_count=5,d=>d.units.best_score_kcal_mol='measured',d=>d.engine_id='rdkit']){const copy=structuredClone(envelope);change(copy);check(()=>assert(!scienceOutput.safeParse(copy).success));}
const catalog={experiment:async()=>({manifest,content_hash:hash}),parameters:CatalogService.prototype.parameters,engines:()=>engineCapabilities};
const runs=new RunService({},catalog,{}, {},{},{});
(async()=>{
 const actor={id:'test-owner',role:'learner'};
 for(const seed of[1,42,2147483647]){
  const prepared=await runs.prepare(actor,runRequest.parse({experiment_id:'molecular-docking',parameters:{seed}}));
  check(()=>assert.equal(prepared.request.seed,seed));check(()=>assert.equal(prepared.parameters.seed,seed));check(()=>assert.equal(prepared.engine,'vina'));
 }
 const matching=await runs.prepare(actor,runRequest.parse({experiment_id:'molecular-docking',seed:87,parameters:{seed:87}}));
 check(()=>assert.equal(matching.request.seed,87));
 await assert.rejects(()=>runs.prepare(actor,runRequest.parse({experiment_id:'molecular-docking',seed:86,parameters:{seed:87}})),/must match/);assertions++;
 await assert.rejects(()=>runs.prepare(actor,runRequest.parse({experiment_id:'molecular-docking',engine:'rdkit'})),/does not support/);assertions++;
 await assert.rejects(()=>runs.prepare(actor,runRequest.parse({experiment_id:'molecular-docking',parameters:{target:'pathogen'}})),/Invalid parameter/);assertions++;
 console.log(`Docking backend: ${assertions} contract assertions passed. Solver and live lifecycle checks are separate.`);
})().catch(e=>{console.error(e);process.exitCode=1});
