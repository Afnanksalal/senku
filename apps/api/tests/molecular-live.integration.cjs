/* Real HTTP-to-RDKit-to-Vina molecular workspace verification.
 * Runs only in the strict disposable API/jobs namespace used by test-backend.ps1.
 * No scientific or explanation provider substitutes are used.
 */
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {Pool}=require('pg');
const schema=process.env.DB_SCHEMA;
if(!/^senku_test_[a-f0-9]{32}$/.test(schema||'')||process.env.QUEUE_PREFIX!==schema||process.env.S3_BUCKET!==schema.replaceAll('_','-'))throw Error('Refusing real molecular test outside the checked disposable API/jobs namespace');
if(!['false','0'].includes(String(process.env.ENABLE_GEMINI).toLowerCase()))throw Error('Real molecular worker CI must keep the external explanation provider disabled');
const base='http://127.0.0.1:3001',pool=new Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema},public`});
let checks=0,account,groupId,other,screenId;
const check=(condition,label)=>{assert(condition,label);checks++;};
async function call(path,{method='GET',token,body,key,status=200}={}){const response=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body!==undefined?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body!==undefined?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const value=await response.json();assert.equal(response.status,status,JSON.stringify({path,status:response.status,error:value?.error?{code:value.error.code,message:value.error.message}:'Unexpected response'}));checks++;return value;}
const post=(path,token,body,key,status=201)=>call(path,{method:'POST',token,body,key,status});
async function waitRun(token,id){const deadline=Date.now()+65000;while(Date.now()<deadline){const run=await call(`/v1/runs/${id}`,{token});if(['completed','failed','cancelled','timed_out'].includes(run.status))return run;await new Promise(resolve=>setTimeout(resolve,500));}throw Error('Real molecular validation run deadline');}
async function used(id){return Number((await pool.query("SELECT coalesce(sum(units),0) AS n FROM usage_reservations WHERE user_id=$1 AND state IN ('reserved','consumed')",[id])).rows[0].n);}
async function cleanupAccount(auth){if(!auth)return;await call('/v1/me',{method:'DELETE',token:auth.access_token});check((await pool.query('SELECT deleted_at IS NOT NULL AS deleted FROM users WHERE id=$1',[auth.user.id])).rows[0]?.deleted,'Disposable learner tombstoned');}
(async()=>{try{
 check((await pool.query('SELECT current_schema() AS schema')).rows[0].schema===schema,'Checked private schema');await call('/ready');
 const suffix=randomUUID();account=await post('/v1/auth/register',undefined,{email:`molecular-live-${suffix}@example.test`,password:`A9-${randomUUID()}-private`,display_name:'Molecular live CI'});other=await post('/v1/auth/register',undefined,{email:`molecular-other-${suffix}@example.test`,password:`A9-${randomUUID()}-private`,display_name:'Molecular isolation CI'});
 groupId=(await pool.query('INSERT INTO budget_groups(name,daily_units,member_daily_units) VALUES($1,30,30) RETURNING id',['Disposable real molecular test'])).rows[0].id;await pool.query('INSERT INTO budget_members(user_id,group_id) VALUES($1,$2)',[account.user.id,groupId]);
 const token=account.access_token,collection=await post('/v1/molecular/collections',token,{name:'Real compound comparison',notes:'CI: real workers, no fake scientific outputs'},randomUUID());
 const compounds=[];
 for(const item of[{name:'Ethanol',smiles:'CCO',formula:'C2H6O',heavy:3},{name:'Benzamidine',smiles:'NC(=N)c1ccccc1',formula:'C7H8N2',heavy:9}]){
  const validation=await post('/v1/molecules/validate',token,{smiles:item.smiles,generate_3d:true,seed:42},randomUUID(),202),run=await waitRun(token,validation.id);
  check(run.status==='completed',`${item.name} actual RDKit validation completed`);check(run.engine_id==='rdkit'&&typeof run.engine_version==='string'&&!run.engine_version.includes('substitute'),`${item.name} real engine provenance`);check(run.result.molecule.formula===item.formula,`${item.name} computed formula`);check(run.result.diagnostics.heavy_atom_count===item.heavy,`${item.name} computed atom limit`);check(typeof run.result.molecule.molblock==='string'&&run.result.molecule.molblock.includes('V2000'),`${item.name} computed conformer`);
  const body={name:item.name,smiles:item.smiles,validation_run_id:run.id,notes:'Validated by the actual worker'},key=randomUUID();const compound=await post(`/v1/molecular/collections/${collection.id}/compounds`,token,body,key),again=await post(`/v1/molecular/collections/${collection.id}/compounds`,token,body,key);
  check(compound.id===again.id&&compound.validation_run_id===run.id,`${item.name} save replay/provenance`);check(compound.canonical_smiles===run.result.molecule.canonical_smiles&&compound.molblock===run.result.molecule.molblock,`${item.name} saved canonical geometry identity`);compounds.push(compound);
 }
 check(await used(account.user.id)===2,'Exactly two real validation units, no hidden save charges');
 await call(`/v1/molecular/collections/${collection.id}`,{token:other.access_token,status:404});
 const body={collection_id:collection.id,compound_ids:compounds.map(c=>c.id),targets:['trypsin','streptavidin'],exhaustiveness:1,num_modes:2,seed:42,name:'Real 2 by 2 comparison'},key=randomUUID(),created=await post('/v1/molecular/screens',token,body,key),again=await post('/v1/molecular/screens',token,body,key);screenId=created.id;
 check(created.id===again.id&&created.run_ids.length===4,'Actual screen replay yields one 2 by 2 matrix');check(await used(account.user.id)===6,'Exactly four atomic docking reservations');
 await call(`/v1/molecular/screens/${screenId}`,{token:other.access_token,status:404});
 const deadline=Date.now()+120000;let screen;
 while(Date.now()<deadline){screen=await call(`/v1/molecular/screens/${screenId}`,{token});if(['completed','completed_with_errors','cancelled'].includes(screen.status))break;await new Promise(resolve=>setTimeout(resolve,500));}
 check(screen?.status==='completed'&&screen.completed_jobs===4&&screen.terminal_jobs===4,'All four actual Vina members completed');check(screen.members.length===4&&new Set(screen.members.map(m=>`${m.compound_id}:${m.target}`)).size===4,'Every requested compound-target pair represented once');
 const outputs=[];for(const member of screen.members){
  check(Number.isFinite(member.best_score_kcal_mol)&&member.pose_count>=1&&member.pose_count<=2,'Actual finite ranked-score summary');
  const run=await call(`/v1/runs/${member.run_id}`,{token});check(run.status==='completed'&&run.engine_id==='vina'&&!run.engine_version.includes('substitute'),'Real saved Vina output');check(run.seed===42&&run.parameters.seed===42&&run.parameters.target===member.target&&run.parameters.smiles===member.canonical_smiles,'Saved input/seed/matrix continuity');
  const docking=run.result.docking;check(docking.target.id===member.target&&docking.poses.length===member.pose_count,'Actual target and pose count');check(docking.poses[0].score_kcal_mol===member.best_score_kcal_mol,'Screen score is the retained actual pose score');check(docking.poses.every((pose,index)=>Number.isFinite(pose.score_kcal_mol)&&pose.rank===index+1&&pose.pdb.includes('ATOM')&&pose.pdbqt.includes('ATOM')),'Real ranked PDB/PDBQT poses');check(docking.box.size.every(n=>n===18)&&docking.binding_site_residues.length>0,'Fixed curated search and site evidence');check(docking.provenance.seed===42&&docking.provenance.cpu===1&&/^[a-f0-9]{64}$/.test(docking.provenance.receptor_pdbqt_sha256),'Receptor and seed provenance');check(docking.limitations.some(s=>s.includes('not measured'))&&docking.limitations.some(s=>s.includes('rigid')),'Required scientific honesty');
  const row=(await pool.query('SELECT attempt_count FROM experiment_runs WHERE id=$1 AND owner_id=$2',[run.id,account.user.id])).rows[0];check(row.attempt_count===1,'Single-slot lease prevents busy retry/failure');outputs.push({target:member.target,compound:member.compound_name,score:member.best_score_kcal_mol,poses:member.pose_count,attempt_count:row.attempt_count});
 }
 const retained=await call(`/v1/runs/${screen.members[0].run_id}/reproducibility`,{token});check(retained.replay.seed===42&&retained.replay.parameters.smiles===screen.members[0].canonical_smiles&&!retained.run.owner_id,'Actual reproducibility export');
 const artifacts=await call(`/v1/runs/${screen.members[0].run_id}/artifacts`,{token});check(artifacts.length===1,'Actual retained private artifact');const artifact=artifacts[0],response=await fetch(base+`/v1/runs/${screen.members[0].run_id}/artifacts/${artifact.id}/content`,{headers:{Authorization:`Bearer ${token}`}});check(response.status===200,'Actual artifact download');const bytes=Buffer.from(await response.arrayBuffer());check(bytes.length===Number(artifact.byte_length)&&createHash('sha256').update(bytes).digest('hex')===artifact.sha256,'Actual artifact byte/hash integrity');check(JSON.parse(bytes).docking.poses[0].score_kcal_mol===screen.members[0].best_score_kcal_mol,'Actual export score identity');
 const beforeDisabled=await used(account.user.id);await post(`/v1/molecular/screens/${screenId}/reflect`,token,{},randomUUID(),503);check(await used(account.user.id)===beforeDisabled,'Disabled explanation service rejects before admission');
 const rename=compounds[0];await call(`/v1/molecular/collections/${collection.id}/compounds/${rename.id}`,{method:'PATCH',token,body:{name:'Changed after search'}});await call(`/v1/molecular/collections/${collection.id}`,{method:'PATCH',token,body:{name:'Changed collection after search'}});const snapshot=await call(`/v1/molecular/screens/${screenId}`,{token});check(snapshot.collection_name==='Real compound comparison'&&snapshot.members[0].compound_name==='Ethanol','Historical names immutable after edits');
 await call(`/v1/molecular/collections/${collection.id}`,{method:'DELETE',token});const detached=await call(`/v1/molecular/screens/${screenId}`,{token});check(detached.collection_id===null&&detached.members.length===4&&detached.members.every(m=>m.compound_id===null),'Deleting library retains historical run-linked matrix');const replay=await post('/v1/molecular/screens',token,body,key);check(replay.id===screenId&&await used(account.user.id)===6,'Replay after edits/deletion never creates work or charges');
 console.log(JSON.stringify({molecular_live:'passed',checks,workers:['real RDKit','real AutoDock Vina'],matrix:outputs,units:await used(account.user.id),external_explanation:'disabled, no provider substitutes'}));
}finally{
 // Only accounts and groups created by this invocation are touched. Outer runner owns namespace cleanup.
 for(const auth of[account,other])if(auth)try{await cleanupAccount(auth)}catch(error){process.exitCode=1;console.error('Disposable account cleanup failed:',error.message)}
 if(groupId)await pool.query('UPDATE budget_groups SET active=false WHERE id=$1',[groupId]);
 await pool.end();
}})().catch(error=>{console.error(error);process.exitCode=1});
