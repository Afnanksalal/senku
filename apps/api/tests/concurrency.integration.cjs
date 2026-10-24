const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { io } = require('socket.io-client');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${process.env.DB_SCHEMA},public`,
});
const base = 'http://127.0.0.1:3001';
let checks = 0;
async function api(
  path,
  token,
  body,
  method = body ? 'POST' : 'GET',
  expected = method === 'POST' ? 201 : 200,
  key,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify({ path, result }));
  checks++;
  return result;
}
function socket(token, room, origin = 'http://localhost:3000') {
  return io(base + '/collaboration', {
    transports: ['websocket'],
    auth: { token, room_id: room },
    extraHeaders: { Origin: origin },
    reconnection: false,
    timeout: 3000,
  });
}
function once(client, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Socket deadline ' + name)), 5000);
    client.once(name, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}
(async () => {
  const suffix = randomUUID();
  const a = await api('/v1/auth/register', null, {
    email: `race-${suffix}@example.test`,
    password: 'correct horse battery staple',
    display_name: 'Concurrency learner',
  });
  const token = a.access_token;
  await pool.query("UPDATE users SET role='admin' WHERE id=$1", [a.user.id]);
  const group = await api('/v1/admin/budget-groups', token, {
    name: 'One unit race',
    daily_units: 1,
    member_daily_units: 1,
  });
  const invite = await api('/v1/admin/invitations', token, {
    group_id: group.id,
    max_uses: 1,
    expires_in_hours: 1,
  });
  await api('/v1/invitations/redeem', token, { code: invite.code });
  const input = {
    experiment_id: 'cell-energy',
    parameters: { oxygen: 30, glucose: 60, demand: 50 },
  };
  const submissions = await Promise.all(
    [0, 1].map(async () => {
      const response = await fetch(base + '/v1/runs', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify(input),
      });
      return { status: response.status, body: await response.json() };
    }),
  );
  assert.deepEqual(submissions.map((x) => x.status).sort(), [202, 429]);
  const reservation = await pool.query(
    "SELECT sum(units)::int AS units FROM usage_reservations WHERE user_id=$1 AND state IN ('reserved','consumed')",
    [a.user.id],
  );
  assert.equal(reservation.rows[0].units, 1);
  const attempt = {
    lesson_id: 'cell-energy-mission',
    lesson_version: '1.0.0',
    prediction: 'increase',
    answer_index: 0,
    reflection: 'The energy index follows the limiting resource and declared demand.',
    local: { parameters: input.parameters, seed: 0 },
  };
  const scores = await Promise.all(
    [0, 1, 2, 3].map(() =>
      api('/v1/learning/attempts', token, { ...attempt, event_id: randomUUID() }),
    ),
  );
  assert.equal(
    scores.reduce((sum, x) => sum + x.xp_awarded, 0),
    20,
  );
  const room = await api(
    '/v1/rooms',
    token,
    { experiment_id: 'cell-energy', parameters: {} },
    'POST',
    201,
    randomUUID(),
  );
  const client = socket(token, room.id);
  try {
    const snapshot = await once(client, 'room.snapshot');
    assert.equal(snapshot.id, room.id);
    const edited = await new Promise((resolve, reject) => {
      client
        .timeout(3000)
        .emit(
          'room.edit',
          { expected_version: 0, parameters: input.parameters },
          (error, result) => (error ? reject(error) : resolve(result)),
        );
    });
    assert.equal(edited.ok, true);
    assert.equal(edited.room.version, 1);
    await api('/v1/auth/logout', token, { all_sessions: true });
    await once(client, 'disconnect');
  } finally {
    client.disconnect();
  }
  const logged = await api('/v1/auth/login', null, {
    email: `race-${suffix}@example.test`,
    password: 'correct horse battery staple',
  });
  const denied = socket(logged.access_token, room.id, 'https://unapproved.invalid');
  try {
    await once(denied, 'disconnect');
  } finally {
    denied.disconnect();
  }
  await api('/v1/me', logged.access_token, undefined, 'DELETE');
  await api('/v1/me', logged.access_token, undefined, 'GET', 401);
  console.log(
    JSON.stringify({
      concurrency_and_sockets: 'passed',
      http_checks: checks,
      checks: [
        'quota_race',
        'parallel_xp',
        'socket_edit',
        'revoked_session_disconnect',
        'origin_rejection',
        'account_revocation',
      ],
    }),
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
