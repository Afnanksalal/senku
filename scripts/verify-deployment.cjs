/* Operator-only acceptance check against the actual public HTTPS origin.
 * Run inside the API container with its normal environment and explicit
 * SENKU_PUBLIC_ACCEPTANCE=true, SENKU_TEST_URL=https://your-host.
 * Uses real workers/provider and a dedicated 40-unit temporary budget.
 * SENKU_TEST_SECTIONS=core,molecules,ai,research,collaboration selects a failed section
 * without repeating successful paid sections. Every invocation cleans its users.
 */
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { io } = require('socket.io-client');
const origin = new URL(process.env.SENKU_TEST_URL || 'http://invalid.local');
if (process.env.SENKU_PUBLIC_ACCEPTANCE !== 'true' || origin.protocol !== 'https:' ||
    origin.origin !== process.env.SENKU_TEST_URL ||
    !(process.env.CORS_ORIGINS || '').split(',').includes(origin.origin))
  throw Error('Explicit acceptance and the configured exact public HTTPS origin are required');
const selected = new Set((process.env.SENKU_TEST_SECTIONS || 'core,molecules,ai,research,collaboration').split(','));
for (const section of selected) if (!['core','molecules','ai','research','collaboration'].includes(section))
  throw Error('Unknown acceptance section');
if ((selected.has('ai') || selected.has('molecules') || selected.has('research')) && process.env.ENABLE_GEMINI !== 'true') throw Error('Real connected service required');
const schema = process.env.DB_SCHEMA || 'public';
if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw Error('Invalid database schema');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
const base = origin.origin + '/backend';
let checks = 0, group, account, other;
const accounts = [], sockets = [], passed = [], facts = {};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(value, label) { assert(value, label); checks++; }
async function request(path, { token, method='GET', body, key, status=200, headers={} }={}) {
  const response = await fetch(base + path, {
    method, headers: { Origin: origin.origin, ...(token ? { Authorization: 'Bearer '+token } : {}),
      ...(body !== undefined ? { 'Content-Type':'application/json' } : {}),
      ...(key ? {'Idempotency-Key': key} : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(115000),
  });
  const result = await response.json().catch(()=>null);
  const safePath=path.split('?')[0].replace(/\/[A-Za-z0-9_-]{43}(?=\/|$)/g,'/[private-token]');
  check(response.status === status, `${method} ${safePath} expected ${status}, received ${response.status}; code=${result?.error?.code || 'none'}`);
  return result;
}
const post = (path, token, body, key=randomUUID(), status=201) => request(path,{token,body,key,status,method:'POST'});
async function until(path, token, done, timeout=150000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline) { const value=await request(path,{token}); if(done(value)) return value; await pause(1500); }
  throw Error('Acceptance deadline: '+path);
}
const terminal = run => ['completed','failed','timed_out','cancelled'].includes(run.status);
const waitRun = (id, token) => until('/v1/runs/'+id,token,terminal);
async function completeRun(input, token=account.access_token) {
  const created=await post('/v1/runs',token,input,randomUUID(),202), run=await waitRun(created.id,token);
  check(run.status==='completed','Actual worker completes '+input.experiment_id);
  check(/^[a-f0-9]{64}$/.test(run.diagnostics.adapter_sha256),'Actual adapter provenance');
  return run;
}
async function usage() {
  return Number((await pool.query("SELECT coalesce(sum(units),0) AS n FROM usage_reservations WHERE user_id=$1 AND state IN ('reserved','consumed')",[account.user.id])).rows[0].n);
}
async function createAccount(suffix) {
  const email=`public-acceptance-${randomUUID()}-${suffix}@example.invalid`, password=randomBytes(24).toString('hex');
  const auth=await post('/v1/auth/register',undefined,{email,password,display_name:'Temporary deployment verification'});
  const entry={...auth,email,password}; accounts.push(entry); return entry;
}
async function verifyArtifact(run, token) {
  const artifacts=await request(`/v1/runs/${run.id}/artifacts`,{token}); check(artifacts.length===1,'Retained artifact exists');
  const item=artifacts[0], response=await fetch(base+`/v1/runs/${run.id}/artifacts/${item.id}/content`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  check(response.status===200,'Artifact download through public TLS');
  const bytes=Buffer.from(await response.arrayBuffer());
  check(bytes.length===Number(item.byte_length)&&createHash('sha256').update(bytes).digest('hex')===item.sha256,'Artifact size/SHA256 match');
  const denied=await fetch(base+`/v1/runs/${run.id}/artifacts/${item.id}/content`,{headers:{Authorization:'Bearer '+other.access_token}});
  check(denied.status===404,'Private artifact owner isolation'); await denied.body.cancel();
}
async function core() {
  const token=account.access_token;
  const updated=await request('/v1/me',{method:'PATCH',token,body:{display_name:'Temporary verification learner',timezone:'Asia/Calcutta'}});
  check(updated.timezone==='Asia/Calcutta','Profile changes persist');
  await request('/v1/me/learning-goal',{method:'PATCH',token,body:{daily_xp_goal:40}});
  check((await request('/v1/me/learning-goal',{token})).daily_xp_goal===40,'Learning goal persists');
  const input={experiment_id:'cell-energy',parameters:{oxygen:30,glucose:60,demand:50},seed:42}, key=randomUUID();
  const created=await post('/v1/runs',token,input,key,202), duplicate=await post('/v1/runs',token,input,key,202);
  check(created.id===duplicate.id,'Public idempotent run admission');
  const run=await waitRun(created.id,token);check(run.status==='completed'&&run.result.scalars.energy_index===60,'Actual energy worker output');
  await request('/v1/runs/'+run.id,{token:other.access_token,status:404}); await verifyArtifact(run,token);
  const pack=await request('/v1/offline/packs/cell-energy-mission');
  const event={event_id:randomUUID(),lesson_id:'cell-energy-mission',lesson_version:'1.0.0',prediction:'increase',answer_index:0,reflection:'I compared the limiting resource against the supplied teaching model.',local:{parameters:input.parameters,seed:42}};
  const sync=await post('/v1/offline/sync',token,{pack,events:[event]});
  check(sync.results[0].xp_awarded===20,'Signed offline evidence reconciles once');
  const again=await post('/v1/offline/sync',token,{pack,events:[event]});
  check(again.results[0].xp_awarded===20,'Same offline event returns stable receipt');
  const fresh=await post('/v1/learning/attempts',token,{...event,event_id:randomUUID()});check(fresh.xp_awarded===0,'No duplicated lesson XP');
  const graph={name:'Temporary public conversion',species:[{id:'S0',initial_mM:2},{id:'S1',initial_mM:0}],reactions:[{id:'R0',reactants:[{species:'S0',stoichiometry:1}],products:[{species:'S1',stoichiometry:1}],rate_constant:0.2}]};
  const pathway=await post('/v1/pathways/compile',token,graph);
  check(pathway.sbml.includes('unitDefinition'),'Actual compiled pathway');
  for(const engine of ['roadrunner','tellurium','copasi']) {
    const output=await completeRun({experiment_id:'pathway-playground',engine,pathway_id:pathway.id,parameters:{duration:10}},token);
    check(Math.abs(output.result.scalars.S0-2*Math.exp(-2))<1e-4,'Actual native kinetics: '+engine);
  }
  const exported=await request('/v1/me/export',{token});check(exported.exported_at&&JSON.stringify(exported).includes('learning_preferences'),'Account export includes persisted learning');
  facts.core={energy_index:run.result.scalars.energy_index,pathway_engines:3,offline_xp:20};
}
async function molecules() {
  const token=account.access_token, collection=await post('/v1/molecular/collections',token,{name:'Temporary public comparison'}), compounds=[];
  for(const molecule of [{name:'Ethanol',smiles:'CCO',formula:'C2H6O'},{name:'Benzamidine',smiles:'NC(=N)c1ccccc1',formula:'C7H8N2'}]) {
    const created=await post('/v1/molecules/validate',token,{smiles:molecule.smiles,generate_3d:true,seed:42},randomUUID(),202),run=await waitRun(created.id,token);
    check(run.status==='completed'&&run.engine_id==='rdkit'&&run.result.molecule.formula===molecule.formula,'Real conformer and formula: '+molecule.name);
    const body={name:molecule.name,smiles:molecule.smiles,validation_run_id:run.id},key=randomUUID();
    const saved=await post(`/v1/molecular/collections/${collection.id}/compounds`,token,body,key),again=await post(`/v1/molecular/collections/${collection.id}/compounds`,token,body,key);
    check(saved.id===again.id&&saved.molblock===run.result.molecule.molblock,'Saved actual geometry, duplicate save stable');compounds.push(saved);
  }
  await request(`/v1/molecular/collections/${collection.id}`,{token:other.access_token,status:404});
  const body={collection_id:collection.id,compound_ids:compounds.map(c=>c.id),targets:['trypsin','streptavidin'],exhaustiveness:1,num_modes:2,seed:42,name:'Temporary actual two by two'},key=randomUUID();
  const created=await post('/v1/molecular/screens',token,body,key),again=await post('/v1/molecular/screens',token,body,key);
  check(created.id===again.id&&created.run_ids.length===4,'Actual four-pair atomic admission, replay stable');
  const screen=await until(`/v1/molecular/screens/${created.id}`,token,s=>['completed','completed_with_errors','cancelled'].includes(s.status),180000);
  check(screen.status==='completed'&&screen.completed_jobs===4,'All four physical docking searches complete');
  facts.matrix=[];
  for(const member of screen.members) {
    const run=await request('/v1/runs/'+member.run_id,{token}),docking=run.result.docking;
    check(run.engine_id==='vina'&&run.status==='completed'&&docking.poses.length>=1,'Actual physical docking result retained');
    check(Number.isFinite(member.best_score_kcal_mol)&&docking.poses[0].score_kcal_mol===member.best_score_kcal_mol,'Summary equals actual saved score');
    check(docking.poses.every(p=>p.pdb.includes('ATOM')&&p.pdbqt.includes('ATOM')),'Real 3D pose coordinates');
    check(docking.box.size.every(n=>n===18)&&docking.binding_site_residues.length>0,'Fixed curated binding site');
    check(docking.limitations.some(s=>s.includes('rigid'))&&docking.limitations.some(s=>s.includes('not measured')),'Scientific limitations included');
    check((await pool.query('SELECT attempt_count FROM experiment_runs WHERE id=$1 AND owner_id=$2',[run.id,account.user.id])).rows[0].attempt_count===1,'Single-slot search starts once');
    facts.matrix.push({protein:member.target,molecule:member.compound_name,score:member.best_score_kcal_mol});
  }
  const run=await request('/v1/runs/'+screen.members[0].run_id,{token});await verifyArtifact(run,token);
  const reproducibility=await request(`/v1/runs/${run.id}/reproducibility`,{token});check(reproducibility.replay.seed===42,'Reproducibility seed retained');
  const summary=await post(`/v1/molecular/screens/${screen.id}/reflect`,token,{});
  check(summary.status==='completed'&&summary.response?.explanation?.length>20,'Actual connected batch interpretation');
  const before=await usage(), replay=await post(`/v1/molecular/screens/${screen.id}/reflect`,token,{});
  check(replay.id===summary.id&&await usage()===before,'Batch reflection deduplicates across fresh client keys');
  await request(`/v1/molecular/collections/${collection.id}/compounds/${compounds[0].id}`,{method:'PATCH',token,body:{name:'Renamed after actual search'}});
  const snapshot=await request(`/v1/molecular/screens/${screen.id}`,{token});check(snapshot.members.some(m=>m.compound_name==='Ethanol'),'Historical molecule snapshots preserved');
  const cancelled=await post('/v1/molecular/screens',token,{...body,name:'Temporary cancellation'});
  await post(`/v1/molecular/screens/${cancelled.id}/cancel`,token,undefined);
  const stopped=await until(`/v1/molecular/screens/${cancelled.id}`,token,s=>s.terminal_jobs===4);
  check(stopped.members.some(m=>m.status==='cancelled'),'Actual queued batch cancellation');
}
async function ai() {
  const token=account.access_token;
  const route=await post('/v1/ai/route',token,{message:'I want to draw a molecule and compare it with another molecule'});
  check(route.status==='completed'&&route.response.source==='gemini'&&route.response.destination==='/molecules','Actual natural question routing');
  const key=randomUUID(),body={difficulty:'gentle',interest:'a little greenhouse on the moon'};
  const mission=await post('/v1/lessons/cell-energy-mission/personalize',token,body,key);
  check(mission.status==='completed'&&mission.source==='gemini'&&mission.prediction.choices.length===3,'Actual personalized mission, no substituted fallback');
  const same=await post('/v1/lessons/cell-energy-mission/personalize',token,body,key);check(same.id===mission.id,'Mission provider replay stable');
  const specification=(await pool.query('SELECT specification FROM personalized_missions WHERE id=$1 AND owner_id=$2',[mission.id,account.user.id])).rows[0].specification;
  const attempt={event_id:randomUUID(),lesson_id:'cell-energy-mission',lesson_version:'1.0.0',personalization_id:mission.id,prediction:'increase',answer_index:specification.correct_index,reflection:'I compared the two model conditions and explained the limiting resource.',local:{parameters:specification.suggested,seed:0}};
  const scored=await post('/v1/learning/attempts',token,attempt);check(scored.score===1&&scored.completed,'Personalized assessment accepted with authoritative answer');
  const scenario=await post('/v1/challenges/dynamic',token,{challenge_id:'restore-cell',difficulty:'gentle',interest:'a small greenhouse'});
  check(scenario.status==='completed'&&scenario.source==='gemini','Actual dynamic game narrative');
  const spec=(await pool.query('SELECT specification FROM dynamic_challenges WHERE id=$1 AND owner_id=$2',[scenario.id,account.user.id])).rows[0].specification;
  // Operator acceptance uses the server's checked witness, never a client-asserted score.
  const proof={local:{parameters:spec.witness,seed:spec.seed}},event={event_id:randomUUID(),scenario_id:scenario.id,...proof};
  const reward=await post('/v1/challenges/restore-cell/attempts',token,event),replay=await post('/v1/challenges/restore-cell/attempts',token,event);
  check(reward.passed&&reward.xp_awarded===30&&replay.xp_awarded===30,'Actual checked game proof, stable 30XP receipt');
  const duplicate=await post('/v1/challenges/restore-cell/attempts',token,{...event,event_id:randomUUID()});check(duplicate.xp_awarded===0,'New event cannot farm game XP');
  const feedback=await post(`/v1/challenges/dynamic/${scenario.id}/explain`,token,proof);check(feedback.source==='gemini'&&feedback.explanation.length>20,'Actual grounded game explanation');
  const companion=await post('/v1/companion/respond',token,{message:'Why do cells need both food and oxygen? Explain it simply.',experiment_id:'cell-energy',local:{parameters:{oxygen:30,glucose:60,demand:50},seed:42}});
  check(companion.status==='completed'&&companion.response.ai_generated&&companion.response.explanation.length>20,'Actual grounded companion');
  facts.ai={mission:'connected',game:'connected',chat:'connected'};
}
async function research() {
  const token=account.access_token;
  const investigation=await post('/v1/investigations',token,{question:'How does oxygen availability change the teaching cell energy model?',experiment_id:'cell-energy',literature_query:'cellular respiration oxygen glucose',use_ai:true});
  const report=await until(`/v1/investigations/${investigation.id}`,token,i=>['completed','failed','cancelled'].includes(i.status),240000);
  if(report.status!=='completed') console.error(JSON.stringify({research_status:report.status,error_code:report.error_code,tasks:(await pool.query('SELECT role,status FROM agent_tasks WHERE investigation_id=$1 ORDER BY role',[investigation.id])).rows}));
  check(report.status==='completed'&&report.result.facts.length>=1,'Actual planned science investigation');
  check(report.result.narrative.mode==='gemini'&&report.result.citations.length>0,'Actual generated research report and retrieved citations');
  check(report.result.narrative.citation_ids.every(id=>report.result.citations.some(c=>c.id===id)),'Research citations grounded in retrieved sources');
  facts.research={facts:report.result.facts.length,citations:report.result.citations.length};
}
function once(client,name) { return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Socket deadline: '+name)),12000);client.once(name,value=>{clearTimeout(timer);resolve(value)});}); }
function socket(token,room,source=origin.origin) {
  const client=io(origin.origin+'/collaboration',{transports:['websocket'],auth:{token,room_id:room},extraHeaders:{Origin:source},reconnection:false,timeout:10000,autoConnect:false});sockets.push(client);return client;
}
async function collaboration() {
  const token=account.access_token,room=await post('/v1/rooms',token,{experiment_id:'cell-energy',parameters:{}}),share=await post('/v1/shares',token,{resource_type:'room',resource_id:room.id,role:'editor',expires_in_hours:1});
  await post(`/v1/shared/${share.token}/join`,other.access_token,undefined);
  const a=socket(token,room.id),b=socket(other.access_token,room.id),snapA=once(a,'room.snapshot'),snapB=once(b,'room.snapshot');a.connect();b.connect();
  check((await snapA).id===room.id&&(await snapB).id===room.id,'Two public authenticated WebSocket clients');
  const result=await new Promise((resolve,reject)=>b.timeout(10000).emit('room.edit',{expected_version:0,parameters:{oxygen:45,glucose:60,demand:50}},(error,value)=>error?reject(Error('WebSocket edit timeout')):resolve(value)));
  check(result.ok&&result.room.version===1,'Editor socket changes authoritative room');
  check((await request(`/v1/rooms/${room.id}`,{token})).parameters.oxygen===45,'Owner sees actual shared settings');
  b.disconnect();const reconnect=socket(other.access_token,room.id),snapshot=once(reconnect,'room.snapshot');reconnect.connect();check((await snapshot).version===1,'Reconnect restores latest authoritative version');
  const denied=socket(other.access_token,room.id,'https://unapproved.invalid'),deniedResult=once(denied,'access.error');denied.connect();await deniedResult;check(true,'Unapproved WebSocket origin rejected');
  await request(`/v1/shares/${share.id}`,{method:'DELETE',token});await request(`/v1/shared/${share.token}`,{status:404});
  const disconnect=once(reconnect,'disconnect');await request(`/v1/rooms/${room.id}/members/${other.user.id}`,{method:'DELETE',token});await disconnect;check(true,'Revoked room membership disconnects active socket');
  const classroom=await post('/v1/classrooms',token,{name:'Temporary deployment classroom'});
  await post('/v1/classrooms/join',other.access_token,{code:classroom.join_code});
  await post(`/v1/classrooms/${classroom.id}/assignments`,token,{lesson_id:'cell-energy-mission',title:'Temporary concept assignment'});
  await request(`/v1/classrooms/${classroom.id}/progress`,{token:other.access_token,status:403});
  check(Array.isArray(await request(`/v1/classrooms/${classroom.id}/progress`,{token})),'Teacher progress while learner access denied');
  await request(`/v1/classrooms/${classroom.id}`,{method:'DELETE',token});
  facts.collaboration={two_clients:true,reconnect:true,revocation:true,classroom_permissions:true};
}
(async()=>{try {
  check((await request('/health')).status==='ok','Public API health');await request('/ready');
  const redirect=await fetch('http://'+origin.host+'/home',{redirect:'manual'});check([301,308].includes(redirect.status)&&redirect.headers.get('location')===origin.origin+'/home','HTTP redirects to trusted HTTPS');
  const approved=await fetch(base+'/health',{headers:{Origin:origin.origin}});check(approved.headers.get('access-control-allow-origin')===origin.origin,'Exact public CORS origin');
  const unapproved=await fetch(base+'/health',{headers:{Origin:'https://unapproved.invalid'}});check(unapproved.headers.get('access-control-allow-origin')!== 'https://unapproved.invalid','Unapproved origin never receives CORS permission');
  account=await createAccount('a');other=await createAccount('b');
  const before=await post('/v1/runs',other.access_token,{experiment_id:'cell-energy'},randomUUID(),403);check(!!before.error,'Uninvited compute denied');
  const promoted=await pool.query("UPDATE users SET role='admin' WHERE id=$1 AND email=$2 AND display_name='Temporary deployment verification' AND deleted_at IS NULL RETURNING id",[account.user.id,account.email]);check(promoted.rowCount===1,'Only this invocation fixture promoted');
  group=await post('/v1/admin/budget-groups',account.access_token,{name:'Temporary public acceptance '+randomUUID(),daily_units:40,member_daily_units:40});
  const invitation=await post('/v1/admin/invitations',account.access_token,{group_id:group.id,max_uses:1,expires_in_hours:1});await post('/v1/invitations/redeem',account.access_token,{code:invitation.code});
  const engines=await request('/v1/admin/operations/engines',{token:account.access_token});
  check(Object.keys(engines).length===9&&Object.values(engines).every(engine=>engine.available),'All nine private scientific environments reachable');
  for(const [name,operation] of Object.entries({core,molecules,ai,research,collaboration}))if(selected.has(name)) {
    console.log(JSON.stringify({section:name,status:'started'}));await operation();passed.push(name);console.log(JSON.stringify({section:name,status:'passed',checks}));
  }
  const refreshed=await post('/v1/auth/refresh',undefined,{refresh_token:other.refresh_token});other.access_token=refreshed.access_token;other.refresh_token=refreshed.refresh_token;
  check((await request('/v1/me',{token:other.access_token})).id===other.user.id,'Rotated refresh session authenticates');
  await post('/v1/auth/logout',other.access_token,{all_sessions:false});await request('/v1/me',{token:other.access_token,status:401});
  const logged=await post('/v1/auth/login',undefined,{email:other.email,password:other.password});other.access_token=logged.access_token;other.refresh_token=logged.refresh_token;
  check(await usage()<=40,'Invocation remains inside 40-unit allowance');
  console.log(JSON.stringify({public_acceptance:'passed',origin:origin.origin,checks,sections:passed,units:await usage(),facts}));
} finally {
  for(const client of sockets)client.disconnect();
  let cleanupFailed=false;
  for(const auth of accounts)try {
    const exists=(await pool.query('SELECT id,deleted_at FROM users WHERE id=$1 AND email=$2',[auth.user.id,auth.email])).rows[0];
    if(!exists||exists.deleted_at)continue;
    const logged=await post('/v1/auth/login',undefined,{email:auth.email,password:auth.password});
    await request('/v1/me',{method:'DELETE',token:logged.access_token});
    check((await pool.query('SELECT deleted_at IS NOT NULL AS deleted FROM users WHERE id=$1',[auth.user.id])).rows[0]?.deleted,'Temporary account deletion verified');
  }catch{cleanupFailed=true;console.error('Temporary acceptance account cleanup failed; operator review required');}
  if(group)await pool.query('UPDATE budget_groups SET active=false WHERE id=$1',[group.id]);
  console.log(JSON.stringify({cleanup:cleanupFailed?'failed':'complete',temporary_accounts:accounts.length,budget_disabled:!!group}));await pool.end();
  if(cleanupFailed)process.exitCode=1;
}})().catch(error=>{console.error('Public acceptance failed: '+String(error.message).slice(0,500));process.exitCode=1});
