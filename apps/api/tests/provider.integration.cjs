// Explicit provider substitute; no cloud call is made by this test.
require('reflect-metadata');
const assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { loadConfig } = require('./apps/api/dist/config'),
  { Database } = require('./apps/api/dist/database/database'),
  { CatalogService } = require('./apps/api/dist/catalog/catalog.service'),
  { BudgetService } = require('./apps/api/dist/budgets/budget.service'),
  { Idempotency } = require('./apps/api/dist/common/idempotency'),
  { CompanionController } = require('./apps/api/dist/companion/companion.controller');
const config = {
  ...loadConfig(process.env),
  DB_POOL_SIZE: 1,
  ENABLE_GEMINI: true,
  GEMINI_MODEL: 'test-provider-fixture',
};
const db = new Database(config),
  catalog = new CatalogService(db),
  budget = new BudgetService(db, config),
  idem = new Idempotency(db);
(async () => {
  const response = await fetch('http://127.0.0.1:3001/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `provider-${randomUUID()}@example.test`,
      password: 'correct horse battery staple',
      display_name: 'Explicit provider fixture',
    }),
  });
  assert.equal(response.status, 201);
  const account = await response.json(),
    req = { user: account.user };
  const group = (
    await db.query(
      "INSERT INTO budget_groups(name,daily_units,member_daily_units) VALUES('Provider test',30,30) RETURNING id",
    )
  )[0];
  await db.query('INSERT INTO budget_members(user_id,group_id) VALUES($1,$2)', [
    account.user.id,
    group.id,
  ]);
  let calls = 0,
    mode = 'valid',
    gate = null;
  const generator = {
    generate: async (schema) => {
      calls++;
      await db.query('SELECT 1');
      if (gate) await gate;
      else await new Promise((resolve) => setTimeout(resolve, 100));
      if (mode === 'throw') throw Error('Explicit provider failure');
      return schema.parse({
        explanation: 'Educational test response',
        suggested_parameter: mode === 'invalid' ? 'not-an-approved-parameter' : 'oxygen',
        reflection_question: 'Which resource is limiting?',
      });
    },
  };
  const controller = new CompanionController(
      config,
      catalog,
      undefined,
      budget,
      idem,
      db,
      generator,
    ),
    input = {
      message: 'Explain this educational model',
      experiment_id: 'cell-energy',
      experiment_version: '1.0.0',
      history: [],
    };
  const key = randomUUID();
  const [first, second] = await Promise.all([
    controller.respond(req, key, input),
    controller.respond(req, key, input),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(calls, 1);
  const replay = await controller.respond(req, key, input);
  assert.equal(replay.status, 'completed');
  assert.equal(calls, 1);
  mode = 'invalid';
  const invalidKey = randomUUID();
  const invalid = await controller.respond(req, invalidKey, input);
  assert.equal(invalid.status, 'failed');
  await controller.respond(req, invalidKey, input);
  assert.equal(calls, 2);
  mode = 'throw';
  const failedKey = randomUUID();
  assert.equal((await controller.respond(req, failedKey, input)).status, 'failed');
  await controller.respond(req, failedKey, input);
  assert.equal(calls, 3);
  mode = 'valid';
  let release;
  gate = new Promise((resolve) => {
    release = resolve;
  });
  const pending = [
    controller.respond(req, randomUUID(), input),
    controller.respond(req, randomUUID(), input),
  ];
  try {
    for (let i = 0; i < 100 && calls < 5; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(calls, 5);
    await assert.rejects(
      () => controller.respond(req, randomUUID(), input),
      (error) => error.getStatus() === 429,
    );
  } finally {
    release();
    await Promise.all(pending);
    gate = null;
  }
  const stale = randomUUID();
  await db.query(
    "INSERT INTO companion_responses(id,owner_id,request,status,created_at) VALUES($1,$2,'{}','running',now()-interval '3 minutes')",
    [stale, account.user.id],
  );
  assert.equal((await controller.get(req, stale)).error_code, 'execution_interrupted');
  const used = (
    await db.query('SELECT count(*)::int AS total FROM usage_reservations WHERE user_id=$1', [
      account.user.id,
    ])
  )[0];
  assert.equal(used.total, 5);
  console.log(
    JSON.stringify({
      provider_boundary: 'passed',
      live_provider: false,
      checks: [
        'single_claim',
        'replay',
        'invalid_suggestion',
        'provider_failure',
        'no_database_connection_held',
        'concurrency',
        'interrupted_state',
        'quota_once',
      ],
    }),
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.onModuleDestroy());
