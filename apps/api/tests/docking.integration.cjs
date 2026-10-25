/* Real PostgreSQL, Redis/BullMQ and private object-store integration.
 * Docking computation is an explicit deterministic substitute; this test does not validate scientific scores.
 * Refuses to run without a fresh, matching disposable schema/queue/bucket namespace.
 */
require('reflect-metadata');
const assert=require('node:assert/strict'),path=require('node:path');
const {randomUUID}=require('node:crypto');
if(process.env.SENKU_TEST_SHARED){const Module=require('node:module'),resolve=Module._resolveFilename;Module._resolveFilename=function(name,...rest){return name==='@senku/experiment-schema'?process.env.SENKU_TEST_SHARED:resolve.call(this,name,...rest)}}
const dist=process.env.SENKU_TEST_API_DIST||path.resolve(__dirname,'../dist');
const {Pool}=require('pg');
const {DeleteBucketCommand,ListObjectsV2Command}=require('@aws-sdk/client-s3');
const {loadConfig}=require(path.join(dist,'config'));
const {Database}=require(path.join(dist,'database/database'));
const {CatalogService}=require(path.join(dist,'catalog/catalog.service'));
const {BudgetService}=require(path.join(dist,'budgets/budget.service'));
const {Idempotency}=require(path.join(dist,'common/idempotency'));
const {Connections}=require(path.join(dist,'common/events'));
const {StorageService}=require(path.join(dist,'artifacts/storage.service'));
const {RunService,runRequest}=require(path.join(dist,'runs/run.service'));
const {JobRuntime}=require(path.join(dist,'runs/job.runtime'));
const {scienceOutput}=require(path.join(dist,'science/science.client'));
const {CompanionController}=require(path.join(dist,'companion/companion.controller'));
const schema=process.env.DB_SCHEMA;
if(!/^senku_test_docking_[a-f0-9]{16}$/.test(schema||'')||process.env.QUEUE_PREFIX!==schema||process.env.S3_BUCKET!==schema.replaceAll('_','-'))throw Error('Refusing docking test outside an explicitly isolated namespace');
const config=loadConfig({...process.env,NODE_ENV:'test',ENABLE_GEMINI:'false',S3_CREATE_BUCKET:'true',SCIENCE_CONCURRENCY:'2'});
const admin=new Pool({connectionString:config.DATABASE_URL}),db=new Database(config),catalog=new CatalogService(db),budget=new BudgetService(db,config),idem=new Idempotency(db),connections=new Connections(config),storage=new StorageService(config),runs=new RunService(db,catalog,budget,idem,connections,storage);
let checks=0,ownedSchema=false,ownedBucket=false,started=false,calls=0;
const check=(v,msg)=>{assert(v,msg);checks++};
async function reject(p,status){await assert.rejects(p,e=>e.getStatus?.()===status);checks++}
async function actor(name,group){const id=randomUUID();await db.query('INSERT INTO users(id,role,display_name,email,timezone) VALUES($1,$2,$3,$4,$5)',[id,name==='Guest'?'guest':'learner',name,name==='Guest'?null:`${id}@example.test`,'UTC']);if(group)await db.query('INSERT INTO budget_members(user_id,group_id) VALUES($1,$2)',[id,group]);return{id,role:name==='Guest'?'guest':'learner',display_name:name,email:null}}
async function group(units){return(await db.query('INSERT INTO budget_groups(name,daily_units,member_daily_units) VALUES($1,$2,$2) RETURNING id',['Docking isolated integration',units]))[0].id}
async function used(owner){return Number((await db.query("SELECT coalesce(sum(units),0) AS n FROM usage_reservations WHERE user_id=$1 AND state IN ('reserved','consumed')",[owner.id]))[0].n)}
const input=(params={},extra={})=>runRequest.parse({experiment_id:'molecular-docking',parameters:params,...extra});
const mismatch=new Set(),failure=new Set();
function fixture(request){const hash='a'.repeat(64);return scienceOutput.parse({engine_id:'vina',engine_version:'explicit-test-substitute',adapter_version:'1.0.0',model_id:'molecular-docking',scientific_status:'illustrative_educational',scalars:{best_score_kcal_mol:-5,pose_count:1},units:{best_score_kcal_mol:'kcal/mol',pose_count:'poses'},diagnostics:{test_substitute:true},warnings:['Contract fixture only; these are not calculated docking scores.'],docking:{target:{id:'trypsin',name:'Trypsin',pdb_id:'3PTB',source_url:'https://www.rcsb.org/structure/3PTB',organism:'Bos taurus',reference_ligand:'Benzamidine',reference_smiles:'NC(=N)c1ccccc1'},protein_pdb:'ATOM',reference_ligand_pdb:'HETATM',box:{center:[0,1,2],size:[18,18,18]},binding_site_residues:[{chain:'A',residue_name:'ASP',residue_number:189,distance_angstrom:3.2}],poses:[{rank:1,score_kcal_mol:-5,pdbqt:'ATOM',pdb:'ATOM'}],limitations:['Scores are estimates, not measured binding strengths.','The protein is rigid.'],provenance:{source_pdb_sha256:hash,receptor_pdbqt_sha256:hash,preparation_sha256:hash,ligand_pdbqt_sha256:hash,seed:request.seed,cpu:1,scoring_function:'vina'}}})}
let activeComputations=0,peakComputations=0,holdFirst;const executedIds=new Set();
const heldSearch=new Promise(resolve=>{holdFirst=resolve});
const science={execute:async(engine,request)=>{calls++;executedIds.add(request.job_id);activeComputations++;peakComputations=Math.max(peakComputations,activeComputations);try{check(engine==='vina'&&request.model_id==='molecular-docking','Approved worker identity');check(request.seed===request.parameters.seed,'Seed continuity across compute boundary');if(request.seed===201)await heldSearch;await new Promise(r=>setTimeout(r,75));if(failure.has(request.job_id))throw Error('invalid_input');const output=fixture(request);if(mismatch.has(request.job_id))output.docking.provenance.seed=request.seed+1;return output}finally{activeComputations--}},cancel:async()=>{}};
const runtime=new JobRuntime(db,connections,budget,science,storage,{process:async()=>{throw Error('Unexpected investigation')}},{cleanup:async()=>{}},config);
async function wait(owner,id){for(let i=0;i<200;i++){const run=await runs.get(owner,id);if(['completed','failed','cancelled','timed_out'].includes(run.status))return run;await new Promise(r=>setTimeout(r,75))}throw Error('Docking lifecycle timeout')}
(async()=>{try{
 check(!(await admin.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema])).rowCount,'Fresh schema');ownedSchema=true;await db.migrate();await catalog.seed();check((await db.query('SELECT current_schema() AS s'))[0].s===schema,'Private schema');
 // Storage is in a fresh private bucket; do not adopt an existing bucket.
 try{await storage.ready();throw Error('Disposable bucket already exists')}catch(e){if(e.message==='Disposable bucket already exists')throw e;if(!['NotFound','NoSuchBucket'].includes(e.name)&&e.$metadata?.httpStatusCode!==404)throw e}
 await storage.initialize();ownedBucket=true;
 const g=await group(30),one=await group(1),owner=await actor('Owner',g),other=await actor('Other',g),limited=await actor('Limited',one),denied=await actor('Denied'),guest=await actor('Guest');
 check((await catalog.list()).items.some(e=>e.id==='molecular-docking'),'Published docking catalog');check(!(await catalog.lessons()).some(l=>l.experiment_id==='molecular-docking'),'No unsupported generic docking lesson');
 await reject(runs.create(denied,randomUUID(),input()),403);await reject(runs.create(guest,randomUUID(),input()),403);check(await used(denied)===0&&await used(guest)===0,'No reservation after admission denial');
 const before=await used(owner);
 for(const invalid of[{target:'arbitrary'},{box:'arbitrary'},{protein_pdb:'custom'},{smiles:'C'.repeat(161)},{exhaustiveness:9},{num_modes:6},{seed:0}])await reject(runs.create(owner,randomUUID(),input(invalid)),400);
 await reject(runs.create(owner,randomUUID(),input({seed:42},{seed:43})),400);check(await used(owner)===before,'Invalid inputs rejected before quota');check((await db.query('SELECT count(*)::int AS n FROM outbox'))[0].n===0,'No invalid jobs queued');
 const key=randomUUID(),created=await Promise.all([runs.create(owner,key,input()),runs.create(owner,key,input())]);check(created[0].id===created[1].id,'Concurrent duplicate has one run');check(await used(owner)===before+1,'One reservation for concurrent duplicate');const id=created[0].id;check((await db.query('SELECT count(*)::int AS n FROM outbox WHERE job_id=$1',[id]))[0].n===1,'One outbox record');
 const replay=await runs.create(owner,key,input());check(replay.id===id&&await used(owner)===before+1,'Idempotent replay free');await reject(runs.create(owner,key,input({seed:43})),409);
 await reject(runs.get(other,id),404);await reject(runs.cancel(other,id),404);await reject(runs.reproducibility(other,id),404);await reject(runs.artifacts(other,id),404);
 const queued=await runs.create(owner,randomUUID(),input({seed:2})),usedQueued=await used(owner);check((await runs.cancel(owner,queued.id)).status==='cancelled','Queued cancellation');check(await used(owner)===usedQueued-1,'Queued cancellation releases reservation');check(await connections.redis.get(connections.key(`cancel:${queued.id}`))==='1','Real Redis cancellation flag');check((await runs.cancel(owner,queued.id)).status==='cancelled'&&await used(owner)===usedQueued-1,'Cancellation replay stable');
 await runs.create(limited,randomUUID(),input());await reject(runs.create(limited,randomUUID(),input({seed:2})),429);check(await used(limited)===1,'Daily limit blocks extra reservation');
 const bad=await runs.create(owner,randomUUID(),input({seed:99}));mismatch.add(bad.id);
 const failed=await runs.create(owner,randomUUID(),input({seed:100}));failure.add(failed.id);
 started=true;await runtime.start();const finished=await wait(owner,id);check(finished.status==='completed','Real queue reaches completion');check(finished.result.diagnostics.test_substitute===true,'Fixture output explicitly labeled');check(finished.seed===42&&finished.parameters.seed===42,'Stored seed continuity');check((await db.query('SELECT state FROM usage_reservations WHERE id=$1',[id]))[0].state==='consumed','Started work consumes quota');
 const artifacts=await runs.artifacts(owner,id);check(artifacts.length===1&&artifacts[0].content_type==='application/json','One retained JSON artifact');const bytes=await runs.artifact(owner,id,artifacts[0].id);check(JSON.parse(bytes).docking.poses.length===1,'Actual object-store artifact integrity/export');await reject(runs.artifact(other,id,artifacts[0].id),404);
 const reproducibility=await runs.reproducibility(owner,id);check(reproducibility.manifest.model.id==='teaching-docking','Manifest version in reproducibility export');check(reproducibility.replay.seed===42&&reproducibility.replay.engine==='vina','Replay preserves seed and engine');check(!reproducibility.run.owner_id,'Export omits owner identity');
 let explanationCalls=0,capturedContext,capturedInstruction;
 const provider={generate:async(schema,context,instruction)=>{explanationCalls++;capturedContext=context;capturedInstruction=instruction;return schema.parse({explanation:'The protein stays rigid, and these scores are estimates rather than measured binding strengths.',suggested_parameter:null,reflection_question:'Which shape would you compare first?'})}};
 const companion=new CompanionController({...config,ENABLE_GEMINI:true},catalog,runs,budget,idem,db,provider);
 const explanationKey=randomUUID(),explanationInput={experiment_id:'molecular-docking',experiment_version:'1.0.0',run_id:id,message:'Explain this match',history:[]},explanationUnits=await used(owner);
 const explanation=await companion.respond({user:owner},explanationKey,explanationInput);
 check(explanation.status==='completed'&&explanationCalls===1,'Grounded explanation completes');check(await used(owner)===explanationUnits+1,'Explanation budget accounted separately');
 const compact=capturedContext.run.result.docking;
 check(!Object.hasOwn(compact,'protein_pdb')&&!Object.hasOwn(compact,'reference_ligand_pdb'),'Protein/reference coordinates excluded from language context');
 check(compact.poses.every(p=>Object.keys(p).sort().join(',')==='rank,score_kcal_mol'),'Pose language context includes scores only');
 check(compact.poses[0].score_kcal_mol===finished.result.docking.poses[0].score_kcal_mol&&capturedContext.run.seed===finished.seed,'Explanation uses retained facts');
 check(capturedInstruction.includes('untrusted data')&&capturedInstruction.includes('protein is rigid')&&capturedInstruction.includes('not proof'),'Interpretation guards evidence and untrusted content');
 const explanationReplay=await companion.respond({user:owner},explanationKey,explanationInput);check(explanationReplay.id===explanation.id&&explanationCalls===1&&await used(owner)===explanationUnits+1,'Explanation idempotency has one charge');
 await reject(companion.get({user:other},explanation.id),404);await reject(companion.respond({user:other},randomUUID(),explanationInput),404);
 const again=await runs.create(owner,key,input());check(again.id===id,'Completed run replay stable');check((await runs.get(owner,id)).status==='completed','Replay does not reset state');
 const mismatchRun=await wait(owner,bad.id);check(mismatchRun.status==='failed'&&mismatchRun.error_code==='invalid_output','Wrong output seed rejected');check((await runs.artifacts(owner,bad.id)).length===0,'Wrong output never retained');
 const invalidRun=await wait(owner,failed.id);check(invalidRun.status==='failed'&&invalidRun.error_code==='invalid_input','Compute input failure persists honestly');check((await db.query('SELECT state FROM usage_reservations WHERE id=$1',[failed.id]))[0].state==='consumed','Started invalid compute cannot farm free retries');
 check((await runs.get(owner,queued.id)).status==='cancelled','Queue cannot revive cancelled work');check((await db.query("SELECT type FROM durable_events WHERE resource_id=$1 ORDER BY sequence",[id])).map(x=>x.type).join(',')==='run.queued,run.running,run.completed','Durable ordered lifecycle events');
 // Two queue processors share the one physical docking slot. A waiting member stays
 // queued/reserved and can be cancelled without any simulated computation or charge.
 const held=await runs.create(owner,randomUUID(),input({seed:201}));
 for(let i=0;i<100;i++){if((await runs.get(owner,held.id)).status==='running')break;await new Promise(r=>setTimeout(r,50))}
 check((await runs.get(owner,held.id)).status==='running','First search holds the engine slot');
 const waiting=await runs.create(owner,randomUUID(),input({seed:202}));
 for(let i=0;i<100;i++){const queuedJob=await runtime.queue.getJob(waiting.id);if(queuedJob&&await queuedJob.getState()==='active')break;await new Promise(r=>setTimeout(r,50))}
 check((await runs.get(owner,waiting.id)).status==='queued','Second processor waits without claiming compute');
 check((await db.query('SELECT state FROM usage_reservations WHERE id=$1',[waiting.id]))[0].state==='reserved','Engine wait does not consume reservation');
 check(!executedIds.has(waiting.id),'Waiting search never reaches busy worker');
 await runs.cancel(owner,waiting.id);check((await db.query('SELECT state FROM usage_reservations WHERE id=$1',[waiting.id]))[0].state==='released','Waiting search cancellation releases its reservation');
 holdFirst();check((await wait(owner,held.id)).status==='completed','Held search completes after release');
 const parallel=await Promise.all([203,204,205].map(seed=>runs.create(owner,randomUUID(),input({seed}))));
 const outcomes=await Promise.all(parallel.map(r=>wait(owner,r.id)));
 check(outcomes.every(r=>r.status==='completed'),'Multiple admitted searches complete through one engine slot');
 check(peakComputations===1,'Distributed gate permits only one docking computation');
 check(!executedIds.has(waiting.id),'Cancelled waiting search is never computed');
 for(let i=0;i<50&&await connections.redis.get(connections.key('engine-slot:vina'));i++)await new Promise(r=>setTimeout(r,25));
 check(await connections.redis.get(connections.key('engine-slot:vina'))===null,'Engine lease is released after completed work');
 console.log(JSON.stringify({docking_integration:'passed',checks,real:['PostgreSQL migrations/catalog/transactions','Redis and BullMQ dispatch','private object-store artifacts'],compute:'explicit deterministic substitute; no scientific validation',calls}));
}finally{
 holdFirst?.();
 if(started)await runtime.stop();
 // Remove only keys and objects inside the exact checked disposable namespace.
 assert(/^senku_test_docking_[a-f0-9]{16}$/.test(schema));
 if(connections.redis.status!=='end'){let cursor='0';do{const result=await connections.redis.scan(cursor,'MATCH',`${schema}:*`,'COUNT',100);cursor=result[0];if(result[1].length)await connections.redis.del(...result[1])}while(cursor!=='0')}
 if(ownedBucket){for(;;){const objects=await storage.client.send(new ListObjectsV2Command({Bucket:config.S3_BUCKET,MaxKeys:100}));if(!objects.Contents?.length)break;for(const object of objects.Contents)await storage.remove(object.Key)}await storage.client.send(new DeleteBucketCommand({Bucket:config.S3_BUCKET}));console.log('Deleted checked disposable artifact bucket')}
 storage.onModuleDestroy();await connections.onModuleDestroy();await db.onModuleDestroy();if(ownedSchema){await admin.query(`DROP SCHEMA "${schema}" CASCADE`);console.log('Dropped checked disposable docking schema')}await admin.end();
}})().catch(e=>{console.error(e);process.exitCode=1});
