// Typed planner/critic fixtures use real queued science and an explicit substitute for Gemini.
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
  { RunService } = require('./apps/api/dist/runs/run.service'),
  {
    InvestigationService,
    investigationInput,
  } = require('./apps/api/dist/investigations/investigation.service');
const config = {
    ...loadConfig(process.env),
    ENABLE_GEMINI: true,
    GEMINI_MODEL: 'explicit-planning-fixture',
  },
  db = new Database(config),
  connections = new Connections(config),
  storage = new StorageService(config),
  catalog = new CatalogService(db),
  budget = new BudgetService(db, config),
  idem = new Idempotency(db),
  runs = new RunService(db, catalog, budget, idem, connections, storage);
let mode = 'valid',
  calls = 0;
const generator = {
  generate: async (schema, context) => {
    calls++;
    if (context.experiments)
      return schema.parse({
        runs: [
          {
            experiment_id: 'cell-energy',
            parameters: { oxygen: mode === 'bounds' ? 999 : 30, glucose: 60, demand: 50 },
            ...(mode === 'private' ? { room_id: randomUUID(), room_version: 0 } : {}),
          },
        ],
        rationale: 'Select the approved educational limiting-resource model.',
      });
    return schema.parse({
      explanation: 'Explicit test narration of recorded model facts.',
      citation_ids: mode === 'citation' ? ['invented-reference'] : [],
    });
  },
};
const investigations = new InvestigationService(db, runs, {}, budget, idem, config, generator);
(async () => {
  const response = await fetch('http://127.0.0.1:3001/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `planning-${randomUUID()}@example.test`,
      password: 'correct horse battery staple',
      display_name: 'Planning fixture',
    }),
  });
  assert.equal(response.status, 201);
  const { user } = await response.json();
  const group = (
    await db.query(
      "INSERT INTO budget_groups(name,daily_units,member_daily_units) VALUES('Planning fixtures',30,30) RETURNING id",
    )
  )[0];
  await db.query('INSERT INTO budget_members(user_id,group_id) VALUES($1,$2)', [user.id, group.id]);
  for (mode of ['valid', 'bounds', 'private', 'citation']) {
    const id = randomUUID(),
      input = investigationInput.parse({
        question: 'Which resource limits this educational energy model?',
        use_ai: true,
      });
    await db.transaction(async (tx) => {
      await budget.reserve(tx, user, id, 1, 'investigation');
      await tx.query(
        "INSERT INTO investigations(id,owner_id,question,request,status) VALUES($1,$2,$3,$4,'queued')",
        [id, user.id, input.question, JSON.stringify(input)],
      );
      for (const role of ['planner', 'librarian', 'simulation', 'analysis', 'critic', 'report'])
        await tx.query(
          "INSERT INTO agent_tasks(investigation_id,role,status) VALUES($1,$2,'pending')",
          [id, role],
        );
    });
    await investigations.process(id);
    const result = await investigations.get(user, id);
    if (mode === 'valid') {
      assert.equal(result.status, 'completed');
      assert.equal(result.result.facts[0].scalars.energy_index, 60);
      assert.equal(result.result.narrative.requires_review, true);
      const before = calls;
      await investigations.process(id);
      assert.equal(calls, before);
    } else {
      assert.equal(result.status, 'failed');
      assert.equal(result.result, null);
      if (mode !== 'citation')
        assert.equal(
          (await db.query('SELECT id FROM simulation_batches WHERE investigation_id=$1', [id]))
            .length,
          0,
        );
    }
  }
  assert.equal(calls, 6);
  console.log(
    JSON.stringify({
      automatic_planning: 'passed',
      live_provider: false,
      real_queued_science: true,
      checks: [
        'approved_plan',
        'bound_rejection',
        'private_id_rejection',
        'citation_rejection',
        'no_terminal_reexecution',
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
