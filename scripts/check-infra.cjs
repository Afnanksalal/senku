const { Client } = require('pg');
const Redis = require('ioredis');
const { Queue } = require('bullmq');
const { S3Client, CreateBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue('bootstrap-smoke', { connection: redis });
  const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: 'us-east-1', forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
  try {
    await pg.connect();
    const { rows } = await pg.query('SELECT 1 AS value');
    if (rows[0].value !== 1) throw new Error('PostgreSQL query failed');
    if (await redis.ping() !== 'PONG') throw new Error('Redis ping failed');
    const job = await queue.add('dependency-check', { bootstrap: true });
    if (!await queue.getJob(job.id)) throw new Error('BullMQ persistence failed');
    await job.remove();
    const Bucket = 'senku-local';
    try { await s3.send(new CreateBucketCommand({ Bucket })); }
    catch (error) { if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error.name)) throw error; }
    const Key = `bootstrap/${crypto.randomUUID()}.txt`;
    await s3.send(new PutObjectCommand({ Bucket, Key, Body: 'senku-bootstrap' }));
    const object = await s3.send(new GetObjectCommand({ Bucket, Key }));
    if (await object.Body.transformToString() !== 'senku-bootstrap') throw new Error('S3 object round-trip failed');
    await s3.send(new DeleteObjectCommand({ Bucket, Key }));
    console.log('PASS: PostgreSQL query, Redis ping, BullMQ job round-trip, S3 object round-trip.');
  } finally { await queue.close(); redis.disconnect(); await pg.end(); s3.destroy(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
