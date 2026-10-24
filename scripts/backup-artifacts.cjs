// Run inside the API image with a private /backups bind mount. Never expose this through HTTP.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {S3Client,ListObjectsV2Command,GetObjectCommand,PutObjectCommand,CreateBucketCommand,HeadBucketCommand}=require('@aws-sdk/client-s3');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const client=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||'us-east-1',forcePathStyle:true,maxAttempts:2,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});
async function readObject(bucket,key){const response=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(15000)});if(!response.Body||response.ContentLength>4194304)throw Error('Invalid object length');const reader=response.Body.transformToWebStream().getReader(),chunks=[];let total=0;try{for(;;){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>4194304)throw Error('Object budget exceeded');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}return {body:Buffer.concat(chunks),type:response.ContentType||'application/octet-stream',metadata:response.Metadata||{}};}
(async()=>{
 const [mode,directory]=process.argv.slice(2);if(!directory||path.resolve(directory)!=='/backups')throw Error('Use a dedicated /backups mount');
 if(mode==='backup'){
  try{await fs.access(path.join(directory,'manifest.json'));throw Error('Snapshot directory already contains a manifest');}catch(error){if(error.code!=='ENOENT')throw error;}
  const manifest={version:1,source_bucket:process.env.S3_BUCKET||'senku',created_at:new Date().toISOString(),objects:[]};let cursor;
  do{const result=await client.send(new ListObjectsV2Command({Bucket:manifest.source_bucket,ContinuationToken:cursor,MaxKeys:100}));for(const object of result.Contents||[]){if(manifest.objects.length>=100000)throw Error('Snapshot exceeds supported object count');const data=await readObject(manifest.source_bucket,object.Key),sha256=hash(data.body);await fs.writeFile(path.join(directory,sha256+'.bin'),data.body);manifest.objects.push({key:object.Key,sha256,byte_length:data.body.length,content_type:data.type,metadata:data.metadata});}cursor=result.NextContinuationToken;}while(cursor);
  await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});console.log(JSON.stringify({backup:'complete',objects:manifest.objects.length}));
 }else if(mode==='restore'){
  const bucket=process.env.RESTORE_BUCKET;if(!/^senku-restore-[a-z0-9-]{1,40}$/.test(bucket||''))throw Error('Only a new senku-restore-* bucket may be restored');
  const stat=await fs.stat(path.join(directory,'manifest.json'));if(stat.size>64*1024*1024)throw Error('Manifest too large');const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
  if(manifest.version!==1||!Array.isArray(manifest.objects)||manifest.objects.length>100000)throw Error('Invalid manifest');
  try{await client.send(new HeadBucketCommand({Bucket:bucket}));throw Error('Restore bucket already exists');}catch(error){if(error.$metadata?.httpStatusCode!==404)throw error;}
  await client.send(new CreateBucketCommand({Bucket:bucket}));
  for(const object of manifest.objects){if(!/^[a-f0-9]{64}$/.test(object.sha256)||typeof object.key!=='string'||object.key.length>1024||!Number.isInteger(object.byte_length)||object.byte_length<0||object.byte_length>4194304)throw Error('Invalid object entry');const body=await fs.readFile(path.join(directory,object.sha256+'.bin'));if(body.length!==object.byte_length||hash(body)!==object.sha256)throw Error('Backup integrity failure');await client.send(new PutObjectCommand({Bucket:bucket,Key:object.key,Body:body,ContentType:object.content_type,Metadata:object.metadata}));const verified=await readObject(bucket,object.key);if(hash(verified.body)!==object.sha256)throw Error('Restored object integrity failure');}
  console.log(JSON.stringify({restore:'verified',bucket,objects:manifest.objects.length}));
 }else throw Error('Expected backup or restore');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>client.destroy());
