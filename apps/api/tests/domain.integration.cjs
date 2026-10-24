const assert = require('node:assert/strict'),
  { randomUUID, createHash } = require('node:crypto'),
  { Pool } = require('pg');
const { localScalars } = require('@senku/experiment-schema');
// Match the declared model: limiting resource, percentage scale, hard 100 cap.
for (const [parameters, expected] of [
  [{ oxygen: 100, glucose: 100, demand: 1 }, 100],
  [{ oxygen: 100, glucose: 100, demand: 50 }, 100],
  [{ oxygen: 20, glucose: 80, demand: 50 }, 40],
  [{ oxygen: 80, glucose: 20, demand: 50 }, 40],
  [{ oxygen: 0, glucose: 100, demand: 50 }, 0],
]) {
  assert.equal(localScalars('cell-energy', parameters).energy_index, expected);
}
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${process.env.DB_SCHEMA},public`,
  }),
  base = 'http://127.0.0.1:3001';
async function api(path, token, body, status = body ? 201 : 200, key) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify({ path, result }));
  return result;
}
async function wait(token, id) {
  for (let i = 0; i < 400; i++) {
    const result = await api('/v1/runs/' + id, token);
    if (['completed', 'failed', 'cancelled', 'timed_out'].includes(result.status)) return result;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Domain run deadline');
}
(async () => {
  const a = await api('/v1/auth/register', null, {
      email: `domain-${randomUUID()}@example.test`,
      password: 'correct horse battery staple',
      display_name: 'Domain fixture',
    }),
    token = a.access_token;
  await pool.query("UPDATE users SET role='admin' WHERE id=$1", [a.user.id]);
  const g = await api('/v1/admin/budget-groups', token, {
      name: 'Domain checks',
      daily_units: 30,
      member_daily_units: 30,
    }),
    invite = await api('/v1/admin/invitations', token, {
      group_id: g.id,
      max_uses: 1,
      expires_in_hours: 1,
    });
  await api('/v1/invitations/redeem', token, { code: invite.code });
  const graph = {
    name: 'Reference conversion',
    species: [
      { id: 'S0', initial_mM: 2 },
      { id: 'S1', initial_mM: 0 },
    ],
    reactions: [
      {
        id: 'R0',
        reactants: [{ species: 'S0', stoichiometry: 1 }],
        products: [{ species: 'S1', stoichiometry: 1 }],
        rate_constant: 0.2,
      },
    ],
  };
  await api(
    '/v1/pathways/validate',
    token,
    { ...graph, species: [...graph.species, graph.species[0]] },
    400,
  );
  const pathway = await api('/v1/pathways/compile', token, graph, 201, randomUUID());
  assert(pathway.sbml.includes('unitDefinition'));
  for (const engine of ['roadrunner', 'tellurium', 'copasi']) {
    const run = await api(
      '/v1/runs',
      token,
      {
        experiment_id: 'pathway-playground',
        engine,
        pathway_id: pathway.id,
        parameters: { duration: 10 },
      },
      202,
      randomUUID(),
    );
    const result = await wait(token, run.id);
    assert.equal(result.status, 'completed', JSON.stringify(result));
    assert(Math.abs(result.result.scalars.S0 - 2 * Math.exp(-2)) < 1e-4);
    assert(/^[a-f0-9]{64}$/.test(result.diagnostics.adapter_sha256));
  }
  const molecule = await api(
    '/v1/molecules/describe',
    token,
    { smiles: 'CCO', generate_3d: true, seed: 42 },
    202,
    randomUUID(),
  );
  assert.equal((await wait(token, molecule.id)).result.molecule.formula, 'C2H6O');
  const invalid = await api(
    '/v1/molecules/validate',
    token,
    { smiles: 'this is not a molecule' },
    202,
    randomUUID(),
  );
  assert.equal((await wait(token, invalid.id)).error_code, 'invalid_input');
  for (const fixture of [
    { experiment_id: 'cell-energy', parameters: { oxygen: 30, glucose: 60, demand: 50 } },
    {
      experiment_id: 'enzyme-explorer',
      parameters: { substrate_mM: 2, vmax: 1, km_mM: 2, duration: 10 },
    },
    {
      experiment_id: 'population-dynamics',
      parameters: { initial_population: 50, capacity: 1000, growth_rate: 0.2, duration: 20 },
    },
    {
      experiment_id: 'genetics-lab',
      parameters: { parent1: 'Aa', parent2: 'Aa', sample_size: 10000 },
    },
  ]) {
    const seed = 2147483647;
    const submitted = await api('/v1/runs', token, { ...fixture, seed }, 202, randomUUID());
    const result = await wait(token, submitted.id);
    assert.equal(result.status, 'completed');
    const expected = localScalars(fixture.experiment_id, fixture.parameters, seed);
    for (const [name, value] of Object.entries(expected))
      assert(
        Math.abs(result.result.scalars[name] - value) < 1e-8,
        fixture.experiment_id + ':' + name,
      );
  }
  const energy = await api(
    '/v1/runs',
    token,
    { experiment_id: 'cell-energy', parameters: { oxygen: 60, glucose: 60, demand: 50 } },
    202,
    randomUUID(),
  );
  assert.equal((await wait(token, energy.id)).status, 'completed');
  const challenge = { event_id: randomUUID(), run_id: energy.id };
  const reward = await api('/v1/challenges/restore-cell/attempts', token, challenge);
  assert.equal(reward.xp_awarded, 30);
  assert.deepEqual(await api('/v1/challenges/restore-cell/attempts', token, challenge), reward);
  await api(
    '/v1/companion/respond',
    token,
    { message: 'Explain limiting resources', experiment_id: 'cell-energy' },
    503,
    randomUUID(),
  );
  const inv = await api(
    '/v1/investigations',
    token,
    {
      question: 'How does this cell energy model respond to its inputs?',
      runs: [{ experiment_id: 'cell-energy' }],
    },
    201,
    randomUUID(),
  );
  const stream = await fetch(base + `/v1/investigations/${inv.id}/stream`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(stream.status, 200);
  assert(stream.headers.get('content-type').includes('text/event-stream'));
  const reader = stream.body.getReader();
  const readers = [reader];
  let received = '';
  try {
    while (!received.includes('investigation.queued')) {
      const chunk = await reader.read();
      assert(!chunk.done);
      received += Buffer.from(chunk.value).toString();
      assert(received.length < 65536);
    }
    for (let index = 0; index < 2; index++) {
      const extra = await fetch(base + `/v1/investigations/${inv.id}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(extra.status, 200);
      readers.push(extra.body.getReader());
    }
    const denied = await fetch(base + `/v1/investigations/${inv.id}/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(denied.status, 429);
    await denied.body.cancel();
  } finally {
    await Promise.all(readers.map((reader) => reader.cancel()));
  }
  if (process.env.LIVE_SOURCE_TESTS === 'true') {
    const papers = await api('/v1/sources/papers?q=Michaelis%20Menten&limit=2', token);
    assert.equal(papers.items.length, 2);
    assert(papers.next_cursor);
    const nextPapers = await api(
      '/v1/sources/papers?q=Michaelis%20Menten&limit=2&cursor=' +
        encodeURIComponent(papers.next_cursor),
      token,
    );
    assert.equal(nextPapers.items.length, 2);
    assert(!nextPapers.items.some((item) => papers.items.some((first) => first.id === item.id)));
    const structures = await api('/v1/structures/search', token, { query: 'hemoglobin', limit: 2 });
    assert(structures.items.length > 0);
    const structure = await api('/v1/structures/4HHB', token);
    assert.equal(structure.pdb_id, '4HHB');
    for (let i = 0; i < 2; i++) {
      const response = await fetch(base + '/v1/structures/4HHB/file', {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert(bytes.length > 1000);
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        response.headers.get('x-content-sha256'),
      );
    }
  }
  console.log(
    JSON.stringify({
      domain_api: 'passed',
      checks: [
        'pathway_validation',
        'three_native_kinetics',
        'adapter_hash',
        'rdkit',
        'invalid_molecule',
        'challenge_once',
        'unconfigured_ai',
        'sse',
      ],
      live_sources: process.env.LIVE_SOURCE_TESTS === 'true' ? 'passed' : 'skipped',
    }),
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
