const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const base = 'http://127.0.0.1:3001';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${process.env.DB_SCHEMA},public`,
});
let checks = 0;
async function call(path, { method = 'GET', token, body, key, status = 200 } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  assert.equal(response.status, status, JSON.stringify({ path, status: response.status, value }));
  checks++;
  return value;
}
const post = (path, token, body, key, status = 201) =>
  call(path, { method: 'POST', token, body, key, status });
async function waitRun(token, id) {
  for (let i = 0; i < 200; i++) {
    const run = await call('/v1/runs/' + id, { token });
    if (['completed', 'failed', 'cancelled', 'timed_out'].includes(run.status)) return run;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Run deadline');
}
(async () => {
  await call('/ready');
  const specification = await call('/openapi.json');
  assert(!JSON.stringify(specification).includes('"$schema"'));
  assert(
    specification.paths['/v1/auth/logout'].post.security.some((scheme) =>
      Object.hasOwn(scheme, 'bearer'),
    ),
  );
  const guest = await post('/v1/auth/guest');
  assert(guest.access_token);
  const suffix = randomUUID();
  const account = await post('/v1/auth/register', null, {
    email: `a-${suffix}@example.test`,
    password: 'correct horse battery staple',
    display_name: 'Reference learner',
  });
  const token = account.access_token;
  const other = await post('/v1/auth/register', null, {
    email: `b-${suffix}@example.test`,
    password: 'correct horse battery staple',
    display_name: 'Other learner',
  });
  await pool.query("UPDATE users SET role='admin' WHERE id=$1", [account.user.id]);
  const group = await post('/v1/admin/budget-groups', token, {
    name: 'Integration',
    daily_units: 100,
    member_daily_units: 100,
  });
  const invitation = await post('/v1/admin/invitations', token, {
    group_id: group.id,
    max_uses: 2,
    expires_in_hours: 1,
  });
  await post('/v1/invitations/redeem', token, { code: invitation.code });
  await post('/v1/invitations/redeem', other.access_token, { code: invitation.code });
  const input = {
    experiment_id: 'cell-energy',
    parameters: { oxygen: 30, glucose: 60, demand: 50 },
    seed: 42,
  };
  const key = randomUUID();
  const created = await post('/v1/runs', token, input, key, 202);
  const duplicate = await post('/v1/runs', token, input, key, 202);
  assert.equal(created.id, duplicate.id);
  await post('/v1/runs', token, { ...input, seed: 43 }, key, 409);
  const run = await waitRun(token, created.id);
  assert.equal(run.status, 'completed');
  assert.equal(run.result.scalars.energy_index, 60);
  await call('/v1/runs/' + created.id, { token: other.access_token, status: 404 });
  const artifacts = await call(`/v1/runs/${created.id}/artifacts`, { token });
  assert.equal(artifacts.length, 1);
  const artifact = await fetch(
    base + `/v1/runs/${created.id}/artifacts/${artifacts[0].id}/content`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  assert.equal(artifact.status, 200);
  assert.equal((await artifact.json()).scalars.energy_index, 60);
  const pack = await call('/v1/offline/packs/cell-energy-mission');
  const attempt = {
    event_id: randomUUID(),
    lesson_id: 'cell-energy-mission',
    lesson_version: '1.0.0',
    prediction: 'increase',
    answer_index: 0,
    reflection: 'I compared the limiting resource with the declared energy model.',
    local: { parameters: input.parameters, seed: 42 },
  };
  const scored = await post('/v1/learning/attempts', token, attempt);
  assert.equal(scored.xp_awarded, 20);
  assert.deepEqual(await post('/v1/learning/attempts', token, attempt), scored);
  await post(
    '/v1/learning/attempts',
    token,
    { ...attempt, reflection: 'A changed reflection conflicts with the same event ID.' },
    undefined,
    409,
  );
  const synced = await post('/v1/offline/sync', token, {
    pack,
    events: [{ ...attempt, event_id: randomUUID() }],
  });
  assert.equal(synced.results[0].xp_awarded, 0);
  const tampered = structuredClone(pack);
  tampered.payload.expires_at = '2099-01-01T00:00:00Z';
  await post(
    '/v1/offline/sync',
    token,
    { pack: tampered, events: [{ ...attempt, event_id: randomUUID() }] },
    undefined,
    400,
  );
  const room = await post(
    '/v1/rooms',
    token,
    { experiment_id: 'cell-energy', parameters: {} },
    randomUUID(),
  );
  const share = await post('/v1/shares', token, {
    resource_type: 'room',
    resource_id: room.id,
    role: 'editor',
    expires_in_hours: 1,
  });
  await post(`/v1/shared/${share.token}/join`, other.access_token);
  await call(`/v1/rooms/${room.id}`, {
    method: 'PATCH',
    token: other.access_token,
    body: { expected_version: 0, parameters: input.parameters },
  });
  await call(`/v1/rooms/${room.id}`, {
    method: 'PATCH',
    token,
    body: { expected_version: 0, parameters: {} },
    status: 409,
  });
  await call(`/v1/shares/${share.id}`, { method: 'DELETE', token });
  await call(`/v1/shared/${share.token}`, { status: 404 });
  const inv = await post(
    '/v1/investigations',
    token,
    {
      question: 'How does resource availability affect the illustrative energy index?',
      runs: [input, { ...input, parameters: { oxygen: 60, glucose: 60, demand: 50 } }],
    },
    randomUUID(),
  );
  let investigation;
  for (let i = 0; i < 300; i++) {
    investigation = await call(`/v1/investigations/${inv.id}`, { token });
    if (['completed', 'failed', 'cancelled'].includes(investigation.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(investigation.status, 'completed', JSON.stringify(investigation));
  assert.equal(investigation.result.facts.length, 2);
  assert.equal(investigation.result.narrative.mode, 'deterministic');
  const classroom = await post('/v1/classrooms', token, { name: 'Biology reference group' });
  await post('/v1/classrooms/join', other.access_token, { code: classroom.join_code });
  await post('/v1/classrooms/join', token, { code: classroom.join_code });
  await post(`/v1/classrooms/${classroom.id}/assignments`, token, {
    lesson_id: 'cell-energy-mission',
    title: 'Resource exploration',
  });
  await call(`/v1/classrooms/${classroom.id}/progress`, { token: other.access_token, status: 403 });
  const before = await call(`/v1/classrooms/${classroom.id}/progress`, { token });
  assert.equal(before.find((member) => member.user_id === account.user.id).attempts, 0);
  await post('/v1/learning/attempts', token, { ...attempt, event_id: randomUUID() });
  const after = await call(`/v1/classrooms/${classroom.id}/progress`, { token });
  assert.equal(after.find((member) => member.user_id === account.user.id).attempts, 1);
  const refreshed = await post('/v1/auth/refresh', null, { refresh_token: other.refresh_token });
  await post('/v1/auth/refresh', null, { refresh_token: other.refresh_token }, undefined, 401);
  await call('/v1/me', { token: refreshed.access_token, status: 401 });
  console.log(
    JSON.stringify({
      integration: 'passed',
      http_checks: checks,
      run: created.id,
      investigation: inv.id,
    }),
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
