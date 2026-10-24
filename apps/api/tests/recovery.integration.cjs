require('reflect-metadata');
const assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { loadConfig } = require('./apps/api/dist/config'),
  { Database } = require('./apps/api/dist/database/database'),
  { CatalogService } = require('./apps/api/dist/catalog/catalog.service'),
  { BudgetService } = require('./apps/api/dist/budgets/budget.service'),
  { Idempotency } = require('./apps/api/dist/common/idempotency'),
  { Connections } = require('./apps/api/dist/common/events'),
  { StorageService } = require('./apps/api/dist/artifacts/storage.service'),
  { RunService, runRequest } = require('./apps/api/dist/runs/run.service'),
  { JobRuntime } = require('./apps/api/dist/runs/job.runtime'),
  { InvestigationService } = require('./apps/api/dist/investigations/investigation.service'),
  { MaintenanceService } = require('./apps/api/dist/operations/maintenance.service');
const config = loadConfig(process.env),
  db = new Database(config),
  connections = new Connections(config),
  storage = new StorageService(config),
  catalog = new CatalogService(db),
  budget = new BudgetService(db, config),
  idem = new Idempotency(db),
  runs = new RunService(db, catalog, budget, idem, connections, storage),
  maintenance = new MaintenanceService(db, storage, config);
let executions = 0;
const science = {
  execute: async () => {
    executions++;
    throw Error('Expired work must not execute');
  },
};
const investigations = new InvestigationService(db, runs, {}, budget, idem, config, {}),
  runtime = new JobRuntime(
    db,
    connections,
    budget,
    science,
    storage,
    investigations,
    maintenance,
    config,
  );
const base = 'http://127.0.0.1:3001';
let lastRequestId;
async function api(path, token, body, status = body ? 201 : 200, key) {
  const requestId = randomUUID();
  lastRequestId = requestId;
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'X-Request-ID': requestId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  return value;
}
(async () => {
  const account = await api('/v1/auth/register', null, {
      email: `recovery-${randomUUID()}@example.test`,
      password: 'correct horse battery staple',
      display_name: 'Recovery fixture',
    }),
    actor = account.user,
    token = account.access_token;
  const group = (
    await db.query(
      "INSERT INTO budget_groups(name,daily_units,member_daily_units) VALUES('Recovery fixtures',30,30) RETURNING id",
    )
  )[0];
  await db.query('INSERT INTO budget_members(user_id,group_id) VALUES($1,$2)', [
    actor.id,
    group.id,
  ]);
  const prepared = await runs.prepare(actor, runRequest.parse({ experiment_id: 'cell-energy' }));
  const queued = await db.transaction(async (tx) => {
    const run = await runs.insert(tx, actor, prepared);
    await tx.query('DELETE FROM outbox WHERE job_id=$1', [run.id]);
    await tx.query(
      "UPDATE experiment_runs SET created_at=now()-interval '16 minutes' WHERE id=$1",
      [run.id],
    );
    return run;
  });
  await runtime.run({ id: queued.id });
  assert.equal((await runs.get(actor, queued.id)).error_code, 'execution_window_expired');
  assert.equal(executions, 0);
  assert.equal(
    (await db.query('SELECT state FROM usage_reservations WHERE id=$1', [queued.id]))[0].state,
    'released',
  );
  const stale = await db.transaction(async (tx) => {
    const run = await runs.insert(tx, actor, prepared);
    await tx.query('DELETE FROM outbox WHERE job_id=$1', [run.id]);
    await tx.query(
      "UPDATE experiment_runs SET status='running',started_at=now()-interval '6 minutes' WHERE id=$1",
      [run.id],
    );
    await budget.consume(tx, run.id);
    return run;
  });
  await runtime.run({ id: stale.id });
  assert.equal((await runs.get(actor, stale.id)).status, 'failed');
  assert.equal(executions, 0);
  const inv = randomUUID();
  await db.transaction(async (tx) => {
    await budget.reserve(tx, actor, inv, 1, 'investigation');
    await tx.query(
      "INSERT INTO investigations(id,owner_id,question,request,status,created_at) VALUES($1,$2,'Expired test workflow','{}','queued',now()-interval '16 minutes')",
      [inv, actor.id],
    );
    await tx.query(
      "INSERT INTO agent_tasks(investigation_id,role,status) VALUES($1,'planner','pending')",
      [inv],
    );
  });
  await investigations.process(inv);
  assert.equal((await investigations.get(actor, inv)).error_code, 'execution_window_expired');
  const retained = await api(
    '/v1/runs',
    token,
    { experiment_id: 'cell-energy' },
    202,
    randomUUID(),
  );
  const audit = (
    await db.query(
      "SELECT request_id::text FROM audit_log WHERE action='run.created' AND resource_id=$1",
      [retained.id],
    )
  )[0];
  assert.equal(audit.request_id, lastRequestId);
  let result;
  for (let i = 0; i < 200; i++) {
    result = await api('/v1/runs/' + retained.id, token);
    if (result.status === 'completed') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(result.status, 'completed');
  await db.query("UPDATE experiment_runs SET finished_at=now()-interval '100 days' WHERE id=$1", [
    retained.id,
  ]);
  await db.query("UPDATE run_artifacts SET created_at=now()-interval '100 days' WHERE run_id=$1", [
    retained.id,
  ]);
  await maintenance.cleanup();
  const expired = await api('/v1/runs/' + retained.id, token);
  assert.equal(expired.status, 'completed');
  assert.equal(expired.result_available, false);
  assert.equal(expired.result, null);
  assert.deepEqual(await api(`/v1/runs/${retained.id}/artifacts`, token), []);
  await api(
    '/v1/learning/attempts',
    token,
    {
      event_id: randomUUID(),
      lesson_id: 'cell-energy-mission',
      lesson_version: '1.0.0',
      prediction: 'increase',
      answer_index: 0,
      reflection: 'This result expired, so a fresh model execution is needed.',
      run_id: retained.id,
    },
    400,
  );
  console.log(
    JSON.stringify({
      recovery_and_retention: 'passed',
      checks: [
        'expired_queued_run',
        'interrupted_run',
        'expired_investigation',
        'no_stale_execution',
        'reservation_release',
        'real_output_retention',
        'expired_evidence_rejection',
      ],
    }),
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    storage.onModuleDestroy();
    await connections.onModuleDestroy();
    await db.onModuleDestroy();
  });
