const assert = require('node:assert/strict'),
  { loadConfig } = require('./apps/api/dist/config'),
  { Database } = require('./apps/api/dist/database/database');
const good = {
  ...process.env,
  NODE_ENV: 'production',
  AUTH_MODE: 'local',
  ALLOW_LOCAL_REGISTRATION: 'true',
  AUTO_MIGRATE: 'false',
  S3_CREATE_BUCKET: 'false',
  GOOGLE_CLOUD_PROJECT: 'senku-config-fixture',
  CORS_ORIGINS: 'https://senku.test',
  SCIENCE_TOKEN: 'a'.repeat(64),
  OFFLINE_SIGNING_KEY: 'b'.repeat(64),
  S3_SECRET_ACCESS_KEY: 'c'.repeat(64),
};
assert.equal(loadConfig(good).NODE_ENV, 'production');
for (const modified of [
  { AUTH_MODE: 'firebase' },
  { AUTO_MIGRATE: 'true' },
  { S3_CREATE_BUCKET: 'true' },
  { CORS_ORIGINS: 'http://senku.test' },
  { CORS_ORIGINS: '*' },
  { ENABLE_GEMINI: 'true', GEMINI_MODEL: '' },
  { SCIENCE_TOKEN: 'short' },
  { DB_SCHEMA: 'public;drop table users' },
])
  assert.throws(() => loadConfig({ ...good, ...modified }));
(async () => {
  const db = new Database(loadConfig(process.env));
  try {
    await db.verifyMigrations();
    const initial = (
      await db.query('SELECT name,sha256 FROM schema_migrations ORDER BY name LIMIT 1')
    )[0];
    try {
      await db.query('UPDATE schema_migrations SET sha256=$2 WHERE name=$1', [
        initial.name,
        '0'.repeat(64),
      ]);
      await assert.rejects(() => db.verifyMigrations());
    } finally {
      await db.query('UPDATE schema_migrations SET sha256=$2 WHERE name=$1', [
        initial.name,
        initial.sha256,
      ]);
    }
    await db.verifyMigrations();
    const malformed = await fetch('http://127.0.0.1:3001/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });
    assert.equal(malformed.status, 400);
    const malformedError = await malformed.json();
    assert(['bad_request', 'invalid_json'].includes(malformedError.error.code));
    assert(!malformedError.error.message.includes('email'));
    const large = await fetch('http://127.0.0.1:3001/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'x'.repeat(200000) }),
    });
    assert.equal(large.status, 413);
    const cors = await fetch('http://127.0.0.1:3001/health', {
      headers: { Origin: 'https://unapproved.invalid' },
    });
    assert.equal(cors.headers.get('access-control-allow-origin'), null);
    console.log(
      JSON.stringify({
        configuration_and_bounds: 'passed',
        checks: [
          'production_guards',
          'migration_integrity',
          'malformed_json',
          'body_limit',
          'exact_cors',
        ],
      }),
    );
  } finally {
    await db.onModuleDestroy();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
