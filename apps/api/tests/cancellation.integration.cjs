const assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto'),
  { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${process.env.DB_SCHEMA},public`,
});
const base = 'http://127.0.0.1:3001';
async function api(path, token, body, expected = body ? 201 : 200, key) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  assert.equal(response.status, expected, JSON.stringify({ path, value }));
  return value;
}
(async () => {
  const account = await api('/v1/auth/register', null, {
      email: `cancel-${randomUUID()}@example.test`,
      password: 'correct horse battery staple',
      display_name: 'Cancellation fixture',
    }),
    token = account.access_token;
  await pool.query("UPDATE users SET role='admin' WHERE id=$1", [account.user.id]);
  const group = await api('/v1/admin/budget-groups', token, {
      name: 'Cancelled reservations',
      daily_units: 4,
      member_daily_units: 4,
    }),
    invite = await api('/v1/admin/invitations', token, {
      group_id: group.id,
      max_uses: 1,
      expires_in_hours: 1,
    });
  await api('/v1/invitations/redeem', token, { code: invite.code });
  const input = { experiment_id: 'cell-energy' };
  const run = await api('/v1/runs', token, input, 202, randomUUID());
  assert.equal((await api('/v1/runs/' + run.id, token)).status, 'queued');
  await api(`/v1/runs/${run.id}/cancel`, token, {}, 202);
  assert.equal((await api('/v1/runs/' + run.id, token)).status, 'cancelled');
  const batch = await api(
    '/v1/simulation-batches',
    token,
    { runs: [input, input] },
    202,
    randomUUID(),
  );
  await api(`/v1/simulation-batches/${batch.id}/cancel`, token, {}, 202);
  assert.equal((await api('/v1/simulation-batches/' + batch.id, token)).status, 'cancelled');
  const inv = await api(
    '/v1/investigations',
    token,
    { question: 'Which resource limits this educational cell energy model?', runs: [input] },
    201,
    randomUUID(),
  );
  await api(`/v1/investigations/${inv.id}/cancel`, token, {});
  const cancelled = await api('/v1/investigations/' + inv.id, token);
  assert.equal(cancelled.status, 'cancelled');
  assert(cancelled.tasks.every((task) => task.status === 'cancelled'));
  const reservations = await pool.query('SELECT state FROM usage_reservations WHERE user_id=$1', [
    account.user.id,
  ]);
  assert(reservations.rows.every((row) => row.state === 'released'));
  console.log(
    JSON.stringify({
      queued_cancellation: 'passed',
      checks: ['run', 'batch', 'investigation_tasks', 'reservation_release'],
    }),
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
