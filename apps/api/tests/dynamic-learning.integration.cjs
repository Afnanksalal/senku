// Explicit provider substitute + real PostgreSQL transactions. No live model calls.
require('reflect-metadata');
const path = require('node:path');
const dist = process.env.SENKU_TEST_API_DIST || path.resolve(__dirname, '../dist');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { localScalars, validateParameters } = require('@senku/experiment-schema');
const { loadConfig } = require(path.join(dist, 'config'));
const { Database } = require(path.join(dist, 'database/database'));
const { CatalogService } = require(path.join(dist, 'catalog/catalog.service'));
const { BudgetService } = require(path.join(dist, 'budgets/budget.service'));
const { Idempotency } = require(path.join(dist, 'common/idempotency'));
const { DynamicChallengeService } = require(path.join(dist, 'learning/dynamic-challenge.service'));
const { ChallengeController } = require(path.join(dist, 'learning/challenge.controller'));
const { CompanionController } = require(path.join(dist, 'companion/companion.controller'));
const schema = process.env.DB_SCHEMA;
if (!/^senku_test_dynamic_[a-f0-9]{16}$/.test(schema || '') || process.env.QUEUE_PREFIX !== schema || process.env.S3_BUCKET !== schema.replaceAll('_','-')) throw Error('Refusing dynamic-game test outside an explicit isolated namespace');
const config = loadConfig({...process.env, ENABLE_GEMINI:'false'});
assert.equal(config.DB_SCHEMA, schema);
const admin = new Pool({connectionString:config.DATABASE_URL});
const db = new Database(config);
const budget = new BudgetService(db, config), idem = new Idempotency(db), catalog = new CatalogService(db);
let calls=0, mode='valid';
const provider={generate:async(schema,context)=>{
  calls++;
  await new Promise(resolve=>setTimeout(resolve,15));
  if(mode==='unavailable')throw Error('Explicit fixture provider failure');
  if(context.candidates){
    const index=2,c=context.candidates[index];
    let controls=c.controls.map(x=>({...x}));
    if(mode==='unknown-control')controls[0].key='invented_control';
    if(mode==='duplicate-control')controls=controls.map(()=>({...controls[0]}));
    return schema.parse({candidate_index:mode==='invalid-index'?99:index,title:'A fresh, bounded science puzzle',story:'A cell has a new resource challenge. Change its available conditions and compare the model result.',hint:'Try one change, then compare what happened.',controls});
  }
  const metric=context.goal.metric;
  return schema.parse({explanation:`The approved model returned ${context.result.scalars[metric]} for ${metric}.`,hint:'Change one allowed condition and compare your next result.'});
}};
const dynamic=new DynamicChallengeService(db,provider,budget,idem);
const scores=new ChallengeController(db,dynamic);
const groups=[], people=[];
let ownedSchema=false,checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
async function rejectsStatus(promise,status){await assert.rejects(promise,e=>e.getStatus?.()===status,`Expected HTTP ${status}`);checks++;}
async function actor(name,role='learner',group){const id=randomUUID();const user={id,role,display_name:name,email:role==='guest'?null:`${name.toLowerCase().replaceAll(' ','-')}-${id}@example.test`,timezone:'UTC'};await db.query('INSERT INTO users(id,role,display_name,email,timezone) VALUES($1,$2,$3,$4,$5)',[id,role,name,user.email,'UTC']);people.push(user);if(group)await db.query('INSERT INTO budget_members(user_id,group_id) VALUES($1,$2)',[id,group]);return user;}
async function group(name,units){const row=(await db.query('INSERT INTO budget_groups(name,daily_units,member_daily_units) VALUES($1,$2,$2) RETURNING id',[name,units]))[0];groups.push(row.id);return row.id;}
async function used(user){return Number((await db.query("SELECT coalesce(sum(units),0) AS used FROM usage_reservations WHERE user_id=$1 AND state IN ('reserved','consumed')",[user.id]))[0].used);}
const request=(challenge_id='restore-cell',difficulty='curious',interest='a tiny greenhouse')=>({challenge_id,difficulty,interest});
(async()=>{
  try{
    check(!(await admin.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema])).rowCount,'The test schema must be fresh');
    ownedSchema=true;
    await db.migrate();await catalog.seed();
    check((await db.query('SELECT current_schema() AS schema'))[0].schema===schema,'Database search path must match isolated schema');
    const mainGroup=await group('Dynamic game fixtures',20),oneGroup=await group('One unit fixture',1);
    const owner=await actor('Dynamic owner','learner',mainGroup),other=await actor('Other learner','learner',mainGroup),limited=await actor('Limited learner','learner',oneGroup),uninvited=await actor('No invitation'),guest=await actor('Guest fixture','guest');
    // Every candidate is checked with the canonical kernel, across every supported challenge/difficulty.
    const challengeRows=await db.query('SELECT id,definition FROM challenges ORDER BY id');
    check(challengeRows.length===4,'Expected four published challenge models');
    for(const row of challengeRows){const manifest=await dynamic.manifest(row.definition);for(const difficulty of ['gentle','curious','stretch']){const candidates=dynamic.candidates(manifest,row.definition,difficulty);check(candidates.length===6,'Six bounded choices');for(const c of candidates){const spec=c.spec;const start=localScalars(manifest.id,validateParameters(manifest,spec.parameters),spec.seed)[spec.goal.metric],winner=localScalars(manifest.id,validateParameters(manifest,spec.witness),spec.seed)[spec.goal.metric];check(Number.isFinite(start)&&Number.isFinite(winner),'Canonical finite metrics');check(start<spec.goal.value,'The starting state must not already win');check(winner>=spec.goal.value,'The private witness must reach the target');check(spec.editable.every(k=>Object.hasOwn(manifest.parameters,k)),'Editable keys come from the manifest');check(Object.keys(spec.parameters).filter(k=>!spec.editable.includes(k)).every(k=>spec.parameters[k]===spec.witness[k]),'Witness preserves fixed conditions');const expected=difficulty==='gentle'?.45:difficulty==='curious'?.65:.85;check(Math.abs(spec.goal.value-(start+(winner-start)*expected)) <= (manifest.id==='enzyme-explorer'?.0051:.501),'Difficulty corresponds to actual model headroom');}}}
    await rejectsStatus(dynamic.generate(owner,randomUUID(),request('not-a-real-game')),404);
    await rejectsStatus(dynamic.generate(owner,undefined,request()),400);
    await rejectsStatus(dynamic.generate(uninvited,randomUUID(),request()),403);
    await rejectsStatus(dynamic.generate(guest,randomUUID(),request()),403);
    check(calls===0,'Rejected requests never call the provider');
    check(await used(owner)===0&&await used(uninvited)===0&&await used(guest)===0,'Rejected admission consumes no units');
    // Concurrent repeated generation is one scenario and one charge, with a real persisted claim.
    const key=randomUUID();const [first,duplicate]=await Promise.all([dynamic.generate(owner,key,request()),dynamic.generate(owner,key,request())]);
    check(first.id===duplicate.id,'Concurrent generation deduplicates scenario ID');
    check(calls===1&&await used(owner)===1,'Concurrent replay uses one provider call and one unit');
    const publicScenario=await dynamic.get(owner,first.id),stored=await dynamic.scenario(owner,first.id);
    check(publicScenario.status==='completed'&&publicScenario.source==='gemini','Valid provider produces complete Gemini-labeled puzzle');
    check(!JSON.stringify(publicScenario).includes('"witness"'),'Private winning witness must not reach the public response');
    check(Object.keys(publicScenario.parameters).sort().join(',')===Object.keys(stored.specification.parameters).sort().join(','),'Public starting parameters match persisted model specification');
    const replay=await dynamic.generate(owner,key,request());check(replay.id===first.id&&calls===1&&await used(owner)===1,'Later generation replay is free and stable');
    await rejectsStatus(dynamic.generate(owner,key,request('restore-cell','stretch')),409);
    await rejectsStatus(dynamic.get(other,first.id),404);await rejectsStatus(dynamic.scenario(other,first.id),404);
    const spec=stored.specification,startInput={local:{parameters:spec.parameters,seed:spec.seed}},winningInput={local:{parameters:spec.witness,seed:spec.seed}};
    const startProof=await dynamic.proof(owner,spec,startInput),winningProof=await dynamic.proof(owner,spec,winningInput);
    check(!startProof.passed&&winningProof.passed,'Proof recomputes loss/win from canonical model');
    await rejectsStatus(dynamic.proof(owner,spec,{local:{...winningInput.local,seed:(spec.seed+1)%2147483647}}),400);
    const fixed=Object.keys(spec.parameters).find(k=>!spec.editable.includes(k));
    await rejectsStatus(dynamic.proof(owner,spec,{local:{parameters:{...spec.witness,[fixed]:Number(spec.parameters[fixed])+1},seed:spec.seed}}),400);
    await rejectsStatus(dynamic.proof(owner,spec,{local:{parameters:{...spec.witness,oxygen:999999},seed:spec.seed}}),400);
    await rejectsStatus(scores.attempt({user:other},'restore-cell',{event_id:randomUUID(),scenario_id:first.id,...winningInput}),404);
    await rejectsStatus(scores.attempt({user:owner},'enzyme-saturation',{event_id:randomUUID(),scenario_id:first.id,...winningInput}),400);
    const loss=await scores.attempt({user:owner},'restore-cell',{event_id:randomUUID(),scenario_id:first.id,...startInput});check(!loss.passed&&loss.xp_awarded===0,'Unchanged initial conditions cannot earn XP');
    const event=randomUUID(),evidence={event_id:event,scenario_id:first.id,...winningInput};
    const wins=await Promise.all([scores.attempt({user:owner},'restore-cell',evidence),scores.attempt({user:owner},'restore-cell',evidence)]);
    check(wins[0].passed&&wins[0].xp_awarded===30&&require('node:util').isDeepStrictEqual(wins[0],wins[1]),'Scoring replay returns one authoritative reward');
    await rejectsStatus(scores.attempt({user:owner},'restore-cell',{...evidence,local:{parameters:spec.parameters,seed:spec.seed}}),409);
    const second=await dynamic.generate(owner,randomUUID(),request('restore-cell','stretch'));const secondStored=await dynamic.scenario(owner,second.id);
    const farm=await scores.attempt({user:owner},'restore-cell',{event_id:randomUUID(),scenario_id:second.id,local:{parameters:secondStored.specification.witness,seed:secondStored.specification.seed}});
    check(farm.passed&&farm.xp_awarded===0,'Fresh scenarios cannot farm the base challenge reward');
    check((await db.query("SELECT count(*)::int AS n,sum(xp)::int AS xp FROM learning_rewards WHERE owner_id=$1 AND reward_key='challenge:restore-cell'",[owner.id]))[0].xp===30,'Exactly one base challenge reward persists');
    // Invalid or unavailable generated teaching text falls back to a checked, non-AI-labeled puzzle.
    let fallback;
    for(mode of ['unknown-control','duplicate-control','invalid-index','unavailable']){const result=await dynamic.generate(owner,randomUUID(),request());check(result.status==='completed'&&result.source==='fallback'&&typeof result.reason==='string','Invalid provider output yields explicit usable model fallback');const record=await dynamic.scenario(owner,result.id);check((await dynamic.proof(owner,record.specification,{local:{parameters:record.specification.witness,seed:record.specification.seed}})).passed,'Fallback goal remains reachable');check(!JSON.stringify(result.controls).includes('invented_control'),'Rejected keys never leak to controls');fallback=result;}
    mode='valid';
    const beforeExplain=calls,beforeUnits=await used(owner);
    const answer=await dynamic.explain(owner,first.id,randomUUID(),winningInput);
    check(answer.status==='completed'&&answer.source==='gemini'&&calls===beforeExplain+1,'Feedback uses real proof with explicit provider source');
    const again=await dynamic.explain(owner,first.id,randomUUID(),winningInput);
    check(require('node:util').isDeepStrictEqual(answer,again)&&calls===beforeExplain+1&&await used(owner)===beforeUnits+1,'Same-proof feedback reuses one provider call and quota unit even with a new key');
    const concurrentBefore=calls,concurrentUnits=await used(owner);
    const feedbackPair=await Promise.all([dynamic.explain(owner,second.id,randomUUID(),{local:{parameters:secondStored.specification.witness,seed:secondStored.specification.seed}}),dynamic.explain(owner,second.id,randomUUID(),{local:{parameters:secondStored.specification.witness,seed:secondStored.specification.seed}})]);
    check(feedbackPair.every(x=>['running','completed'].includes(x.status))&&calls===concurrentBefore+1&&await used(owner)===concurrentUnits+1,'Concurrent different-key feedback shares one proof, provider claim and unit');
    const finalFeedback=await dynamic.explain(owner,second.id,randomUUID(),{local:{parameters:secondStored.specification.witness,seed:secondStored.specification.seed}});
    check(finalFeedback.status==='completed'&&finalFeedback.source==='gemini'&&calls===concurrentBefore+1,'Concurrent feedback converges to a completed cached answer');
    await rejectsStatus(dynamic.explain(other,first.id,randomUUID(),winningInput),404);
    // Stale claims remain playable/readable without another provider charge.
    await db.query("UPDATE dynamic_challenges SET status='running',created_at=now()-interval '3 minutes' WHERE id=$1",[fallback.id]);
    const beforeRecovery=calls,recovered=await dynamic.get(owner,fallback.id);
    check(recovered.status==='completed'&&recovered.source==='fallback'&&calls===beforeRecovery,'Interrupted generation recovers to explicit model fallback');
    await db.query("UPDATE dynamic_challenge_feedback SET status='running',response=$3,created_at=now()-interval '3 minutes' WHERE scenario_id=$1 AND owner_id=$2",[first.id,owner.id,JSON.stringify({source:'fallback',explanation:'Your model result remains available.',hint:'Try one allowed control.'})]);
    const recoveredFeedback=await dynamic.explain(owner,first.id,randomUUID(),winningInput);
    check(recoveredFeedback.status==='completed'&&recoveredFeedback.source==='fallback'&&calls===beforeRecovery,'Interrupted feedback recovers without rebilling');
    const limitedFirst=await dynamic.generate(limited,randomUUID(),request());check(limitedFirst.status==='completed'&&await used(limited)===1,'One-unit member admits one generation');
    const beforeBlocked=calls;await rejectsStatus(dynamic.generate(limited,randomUUID(),request()),429);check(calls===beforeBlocked&&await used(limited)===1,'Exhausted budget blocks before provider work');
    let companionCalls=0,capturedContext;
    const companionProvider={generate:async(schema,context)=>{companionCalls++;capturedContext=context;return schema.parse({explanation:'Oxygen is the limiting resource in this model.',suggested_parameter:'oxygen',reflection_question:'What changes if you add oxygen?'});}};
    const companion=new CompanionController({...config,ENABLE_GEMINI:true,GEMINI_MODEL:'explicit-fixture-provider'},catalog,{},budget,idem,db,companionProvider);
    const companionInput={message:'Explain what happened',experiment_id:'cell-energy',experiment_version:'1.0.0',history:[],local:{parameters:{oxygen:30,glucose:60,demand:50},seed:12345}};
    const companionKey=randomUUID(),unitsBeforeCompanion=await used(owner);
    const companionAnswer=await companion.respond({user:owner},companionKey,companionInput);
    check(companionAnswer.status==='completed'&&companionCalls===1,'Device-context companion produces a completed provider answer');
    check(capturedContext.run.origin==='device'&&capturedContext.run.status==='completed','Companion identifies device result provenance honestly');
    check(capturedContext.run.result.scalars.energy_index===60,'Companion context recomputes the approved cell-energy kernel');
    check(capturedContext.run.seed===12345&&require('node:util').isDeepStrictEqual(capturedContext.run.parameters,companionInput.local.parameters),'Companion context preserves the exact validated inputs and sample seed');
    check(capturedContext.run.experiment_id==='cell-energy'&&capturedContext.run.experiment_version==='1.0.0'&&capturedContext.run.evidence.includes('not a retained remote run or measurement'),'Device evidence carries model version and bounded scientific provenance');
    const companionReplay=await companion.respond({user:owner},companionKey,companionInput);
    check(companionReplay.id===companionAnswer.id&&companionCalls===1&&await used(owner)===unitsBeforeCompanion+1,'Companion device replay uses one response, provider call and budget unit');
    await rejectsStatus(companion.respond({user:owner},randomUUID(),{...companionInput,local:{...companionInput.local,parameters:{oxygen:999999,glucose:60,demand:50}}}),400);
    check(companionCalls===1&&await used(owner)===unitsBeforeCompanion+1,'Invalid device parameters fail before provider call or budget admission');
    await rejectsStatus(companion.get({user:other},companionAnswer.id),404);
    console.log(JSON.stringify({dynamic_challenge_contract:'passed',checks,provider:'explicit deterministic substitute; no live Gemini calls',candidate_property_checks:4*3*6,coverage:['reachable_nontrivial_goals','all_four_kernels','fixed_seed_and_conditions','owner_isolation','generation_dedup','output_validation_fallback','scoring_replay','no_xp_farming','feedback_cache','stale_recovery','budget_admission']}));
  }finally{
    await db.onModuleDestroy();
    if(ownedSchema){assert(/^senku_test_dynamic_[a-f0-9]{16}$/.test(schema));await admin.query(`DROP SCHEMA "${schema}" CASCADE`);console.log('Dropped only the verified fresh dynamic-test schema');}
    await admin.end();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
