import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { CONFIG, Config } from '../config';
import { sha256 } from '../common/crypto';

export const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
@Injectable()
export class StorageService implements OnModuleDestroy {
  readonly client: S3Client;
  constructor(@Inject(CONFIG) private readonly config: Config) {
    this.client = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      forcePathStyle: true,
      maxAttempts: 2,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  async initialize() {
    if (this.config.S3_CREATE_BUCKET) {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.config.S3_BUCKET }));
      } catch (error) {
        if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes((error as Error).name))
          throw error;
      }
    }
    await this.ready();
  }
  async ready() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.S3_BUCKET }), {
      abortSignal: AbortSignal.timeout(5000),
    });
  }
  async put(owner: string, run: string, data: unknown) {
    const body = Buffer.from(JSON.stringify(data));
    if (body.byteLength > MAX_ARTIFACT_BYTES) throw new Error('Artifact exceeds the output budget');
    const id = randomUUID(),
      key = `runs/${owner}/${run}/${id}.json`,
      hash = sha256(body);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        Metadata: { sha256: hash },
      }),
      { abortSignal: AbortSignal.timeout(10000) },
    );
    return {
      id,
      object_key: key,
      sha256: hash,
      byte_length: body.byteLength,
      content_type: 'application/json',
      kind: 'document',
    };
  }
  async putStructure(id: string, body: Buffer) {
    if (!body.length || body.length > MAX_ARTIFACT_BYTES)
      throw new Error('Structure exceeds the output budget');
    const hash = sha256(body),
      key = `structures/${id}/${hash}.cif`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'chemical/x-mmcif',
        Metadata: { sha256: hash },
      }),
      { abortSignal: AbortSignal.timeout(10000) },
    );
    return {
      object_key: key,
      sha256: hash,
      byte_length: body.length,
      content_type: 'chemical/x-mmcif',
    };
  }
  async get(artifact: { object_key: string; sha256: string; byte_length: number }) {
    if (artifact.byte_length > MAX_ARTIFACT_BYTES) throw new Error('Invalid artifact length');
    const output = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.S3_BUCKET,
        Key: artifact.object_key,
        Range: `bytes=0-${artifact.byte_length}`,
      }),
      { abortSignal: AbortSignal.timeout(10000) },
    );
    if (!output.Body) throw new Error('Artifact body missing');
    const reader = output.Body.transformToWebStream().getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > MAX_ARTIFACT_BYTES) throw new Error('Artifact output exceeded its budget');
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const data = Buffer.concat(chunks);
    if (data.length !== artifact.byte_length || sha256(data) !== artifact.sha256)
      throw new Error('Artifact integrity check failed');
    return data;
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.S3_BUCKET, Key: key }), {
      abortSignal: AbortSignal.timeout(10000),
    });
  }
  async objects(cursor?: string) {
    return this.client.send(
      new ListObjectsV2Command({
        Bucket: this.config.S3_BUCKET,
        Prefix: 'runs/',
        MaxKeys: 100,
        ContinuationToken: cursor,
      }),
      { abortSignal: AbortSignal.timeout(10000) },
    );
  }
  onModuleDestroy() {
    this.client.destroy();
  }
}
