const { Pool } = require('pg');
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteBucketCommand,
} = require('@aws-sdk/client-s3');
const Redis = require('ioredis').default;
(async () => {
  const schema = process.env.DB_SCHEMA,
    prefix = process.env.QUEUE_PREFIX,
    bucket = process.env.S3_BUCKET;
  if (
    !/^senku_test_[a-z0-9_]+$/.test(schema) ||
    prefix !== schema ||
    bucket !== schema.replaceAll('_', '-')
  )
    throw Error('Refusing cleanup outside an isolated test namespace');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  try {
    let cursor;
    do {
      const page = await s3.send(
        new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: cursor }),
      );
      if (page.Contents?.length)
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: page.Contents.map((x) => ({ Key: x.Key })) },
          }),
        );
      cursor = page.NextContinuationToken;
    } while (cursor);
    await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
    let scan = '0';
    do {
      const [next, keys] = await redis.scan(scan, 'MATCH', prefix + ':*', 'COUNT', 100);
      if (keys.length) await redis.del(...keys);
      scan = next;
    } while (scan !== '0');
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    console.log('Isolated test schema, queue keys and artifact bucket removed');
  } finally {
    await redis.quit();
    await pool.end();
    s3.destroy();
  }
})().catch((error) => {
  console.error(error.name);
  process.exitCode = 1;
});
