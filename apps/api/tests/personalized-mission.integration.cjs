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
const { PersonalizedMissionService } = require(path.join(dist, 'learning/personalized-mission.service'));
const { LearningService } = require(path.join(dist, 'learning/learning.service'));
const groups=[], people=[];
let ownedSchema=false,checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
async function rejectsStatus(promise,status){await assert.rejects(promise,e=>e.getStatus?.()===status,`Expected HTTP ${status}`);checks++;}
async function actor(name,role='learner',group){const id=randomUUID();const user={id,role,display_name:name,email:role==='guest'?null:`${name.toLowerCase().replaceAll(' ','-')}-${id}@example.test`,timezone:'UTC'};await db.query('INSERT INTO users(id,role,display_name,email,timezone) VALUES($1,$2,$3,$4,$5)',[id,role,name,user.email,'UTC']);people.push(user);if(group)await db.query('INSERT INTO budget_members(user_id,group_id) VALUES($1,$2)',[id,group]);return user;}
async function group(name,units){const row=(await db.query('INSERT INTO budget_groups(name,daily_units,member_daily_units) VALUES($1,$2,$2) RETURNING id',[name,units]))[0];groups.push(row.id);return row.id;}
async function used(user){return Number((await db.query("SELECT coalesce(sum(units),0) AS used FROM usage_reservations WHERE user_id=$1 AND state IN ('reserved','consumed')",[user.id]))[0].used);}

let calls=0,mode='valid';
const provider={generate:async(schema,context)=>{calls++; if(mode==='fail')throw Error('fixture unavailable');return schema.parse({title:'Explore your model',introduction:'Compare a starting model with one changed condition.',prediction:{question:'How will the output respond?',choices:['More output','Less output','Similar output']},manipulation_instruction:'Run the baseline then change the highlighted control.',observation_question:'What changed between your results?',assessment:{question:'Which conclusion respects the model assumptions?',choices:mode==='duplicate'?['Same','Same','Other']:['Unsupported certainty','No need for evidence','Compare results within model limits'],correct_index:2,explanation:'Use actual model evidence and respect its limitations.'},reflection_question:'Why might the changed resource affect this model?'});}};
const missions=new PersonalizedMissionService(db,catalog,provider,budget,idem),learning=new LearningService(db,catalog,config);
(async()=>{try{
check(!(await admin.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema])).rowCount,'Fresh namespace only');ownedSchema=true;await db.migrate();await catalog.seed();check((await db.query('SELECT current_schema() AS s'))[0].s===schema,'Isolated search path');
const g=await group('Mission fixtures',100),one=await group('One mission',1);const owner=await actor('Owner','learner',g),other=await actor('Other','learner',g),limited=await actor('Limited','learner',one),denied=await actor('Uninvited'),guest=await actor('Guest','guest');
const lessons=await db.query('SELECT * FROM lessons ORDER BY id');check(lessons.length===10,'Ten model lessons');const generated=[];
for(const lesson of lessons){const output=await missions.generate(owner,lesson.id,randomUUID(),{difficulty:'gentle'});generated.push(output);check(output.status==='completed'&&output.source==='gemini','Generated source honest');const {manifest}=await catalog.experiment(lesson.experiment_id,lesson.experiment_version);validateParameters(manifest,output.suggested_parameters);checks++;const baseline=Object.fromEntries(Object.entries(manifest.parameters).map(([k,s])=>[k,s.default]));check(Object.keys(baseline).filter(k=>baseline[k]!==output.suggested_parameters[k]).length===1,'Exactly one approved condition changes');check(!JSON.stringify(output).includes('correct_index')&&!JSON.stringify(output).includes('explanation'),'Public content hides answers and explanation');await rejectsStatus(missions.get(other,lesson.id,output.id),404);}
const first=generated[0],lesson=lessons[0],before=calls,units=await used(owner);const replay=await missions.generate(owner,lesson.id,randomUUID(),{difficulty:'gentle'});check(replay.id===first.id&&calls===before&&await used(owner)===units,'Cross-key cache free and stable');const varied=await missions.generate(owner,lesson.id,randomUUID(),{difficulty:'gentle',variation:randomUUID()});check(varied.id!==first.id&&calls===before+1,'Variation makes a new mission');
for(mode of ['duplicate','fail']){const fallback=await missions.generate(owner,lesson.id,randomUUID(),{difficulty:'stretch',variation:randomUUID()});check(fallback.source==='fallback'&&fallback.reason.includes('not AI-generated'),'Invalid provider explicitly falls back');}
mode='valid';await db.query("UPDATE personalized_missions SET status='running',response=jsonb_set(response,'{source}',to_jsonb('fallback'::text)),created_at=now()-interval '3 minutes' WHERE id=$1",[varied.id]);const preStale=calls,stale=await missions.get(owner,lesson.id,varied.id);check(stale.status==='completed'&&typeof stale.reason==='string'&&calls===preStale,'Stale recovery requires no provider');check(stale.source==='fallback','Stale recovery source must be fallback');
const localLesson=lessons.find(x=>x.experiment_id==='cell-energy'),mission=generated.find(x=>x.lesson_id===localLesson.id);await db.query('DELETE FROM lesson_prerequisites WHERE lesson_id=$1',[localLesson.id]);const evidence={event_id:randomUUID(),lesson_id:localLesson.id,lesson_version:'1.0.0',personalization_id:mission.id,prediction:'increase',answer_index:2,reflection:'The calculated model is useful within its stated limits.',local:{parameters:{oxygen:30,glucose:60,demand:50},seed:12345}};
await rejectsStatus(learning.attempt(other,{...evidence,event_id:randomUUID()}),400);const wrongLesson=lessons.find(x=>x.id!==localLesson.id&&x.experiment_id==='enzyme-explorer');await db.query('DELETE FROM lesson_prerequisites WHERE lesson_id=$1',[wrongLesson.id]);const {manifest:wrongManifest}=await catalog.experiment(wrongLesson.experiment_id,wrongLesson.experiment_version);await rejectsStatus(learning.attempt(owner,{...evidence,event_id:randomUUID(),lesson_id:wrongLesson.id,local:{parameters:Object.fromEntries(Object.entries(wrongManifest.parameters).map(([k,s])=>[k,s.default])),seed:0}}),400);
const scored=await learning.attempt(owner,evidence);check(scored.score===1&&scored.xp_awarded===20&&scored.scalars.energy_index===60,'Personalized answer2 scores real evidence20XP');check(scored.assessment_feedback.includes('actual model evidence'),'Private explanation returned only after scoring');const again=await learning.attempt(owner,evidence);check(again.attempt_id===scored.attempt_id,'Event replay stable');const farm=await learning.attempt(owner,{...evidence,event_id:randomUUID()});check(farm.xp_awarded===0,'No repeat lesson XP');const incorrect=await learning.attempt(owner,{...evidence,event_id:randomUUID(),answer_index:0});check(incorrect.score===0&&incorrect.xp_awarded===0,'Static answer0 cannot win generated answer2');
let beforeDenied=calls;await rejectsStatus(missions.generate(denied,lesson.id,randomUUID(),{difficulty:'gentle'}),403);await rejectsStatus(missions.generate(guest,lesson.id,randomUUID(),{difficulty:'gentle'}),403);check(calls===beforeDenied,'Uninvited/guest denied before provider');await missions.generate(limited,lesson.id,randomUUID(),{difficulty:'gentle'});beforeDenied=calls;await rejectsStatus(missions.generate(limited,lesson.id,randomUUID(),{difficulty:'gentle',variation:randomUUID()}),429);check(calls===beforeDenied&&await used(limited)===1,'Exhausted budget denied before provider');
console.log(JSON.stringify({personalized_mission_contract:'passed',checks,provider:'deterministic substitute; no live Gemini',models:10}));
}finally{await db.onModuleDestroy();if(ownedSchema){assert(/^senku_test_dynamic_[a-f0-9]{16}$/.test(schema));await admin.query(`DROP SCHEMA "${schema}" CASCADE`);console.log('Dropped verified disposable schema');}await admin.end();}})().catch(e=>{console.error(e);process.exitCode=1;});
