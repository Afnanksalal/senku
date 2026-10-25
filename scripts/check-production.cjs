// No dependency install required. --proxy additionally needs Docker and a built API image.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
const production = read('compose.production.yaml');
const base = read('compose.yaml');
const nginx = read('infra/nginx.production.conf');
const caddy = read('infra/Caddyfile');
const config = read('apps/api/src/config.ts');
const main = read('apps/api/src/main.ts');
check(/image: caddy:[^\n]+@sha256:[a-f0-9]{64}/.test(production), 'TLS image must be immutable');
check(/ports: \["80:80", "443:443", "443:443\/udp"\]/.test(production), 'Only ingress exposes HTTP/TLS');
check(/caddy-data:\/data/.test(production) && /caddy-config:\/config/.test(production), 'Certificate state must persist');
check(/SENKU_HOST: \$\{SENKU_HOST:\?/.test(production), 'TLS hostname must be explicit');
check(/SENKU_SITE_URL: \$\{SENKU_SITE_URL:\?/.test(production), 'Web public origin must be explicit');
check(/NODE_ENV: production/.test(production), 'API must select production guards');
check(/AUTO_MIGRATE: "false"/.test(production), 'Runtime must not migrate');
check(/S3_CREATE_BUCKET: "false"/.test(production), 'Runtime must not create buckets');
check(/CORS_ORIGINS: \$\{SENKU_SITE_URL:\?/.test(production), 'CORS must use exact public origin');
check(/TRUST_PROXY: "true"/.test(production), 'API must trust gateway');
check(/API_DOCS: "false"/.test(production), 'Operator docs must not be public by default');
check(/jobs:\n\s+environment: \*production-backend/.test(production), 'Jobs must share production gates');
check(/nginx.production.conf:\/etc\/nginx\/nginx.conf:ro/.test(production), 'Production gateway config must replace local config');
check(/aliases: \[senku-gateway\]/.test(production), 'Ingress upstream must have unique alias');
check(/read_only: true/.test(production) && /cap_drop: \[ALL\]/.test(production), 'Ingress must restrict its filesystem and capabilities');
check(/max-size: "10m"/.test(production), 'Ingress logs must rotate');
for (const port of ['3000:8080', '3001:3001', '9001:9001']) check(base.includes(`127.0.0.1:${port}`), `${port} must be loopback only`);
check(/data: \{internal: true\}/.test(base) && /compute: \{internal: true\}/.test(base), 'Data and compute networks must remain internal');
check(/header_up X-Forwarded-For \{remote_host\}/.test(caddy), 'Ingress must overwrite spoofed client IP');
check(/header_up X-Forwarded-Proto https/.test(caddy), 'Ingress must record TLS origin');
check(/proxy_set_header X-Forwarded-For \$http_x_forwarded_for;/.test(nginx), 'Gateway must retain trusted scalar client IP');
check(/proxy_set_header X-Forwarded-Proto https;/.test(nginx), 'Gateway must retain HTTPS origin');
check(/proxy_set_header Origin \$http_origin;/.test(nginx) && /location \/socket.io\//.test(nginx), 'Socket origins and upgrade route must remain');
check(/app\.set\('trust proxy', config\.TRUST_PROXY \? 1 : false\)/.test(main), 'API must trust exactly its gateway hop');
check(/Production CORS origins require HTTPS/.test(config), 'Production origins must reject plaintext');
check(/Production migrations and bucket creation must run as separate deployment operations/.test(config), 'Production bootstrap guard must remain');
check(/target: \/var\/run\/secrets\/google\/adc.json/.test(read('compose.gemini.yaml')), 'ADC must remain a runtime file');
console.log(`PASS: ${checks} production configuration invariants`);

if (process.argv.includes('--proxy')) proxyTest().catch((error) => { console.error(error.message); process.exitCode = 1; });

async function proxyTest() {
  const id = `senku-proxy-test-${crypto.randomBytes(6).toString('hex')}`;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), `${id}-`));
  const names = [];
  let networkCreated = false;
  const docker = (...args) => execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).trim();
  try {
    const image = process.env.SENKU_PROXY_TEST_API_IMAGE || docker('compose', 'images', '-q', 'api').split(/\r?\n/)[0];
    check(Boolean(image), 'Build API image before running --proxy');
    docker('network', 'create', '--internal', id); networkCreated = true;
    fs.writeFileSync(path.join(temporary, 'nginx.conf'), nginx);
    // Same real ingress directives; HTTP-only inside this disposable test network avoids public ACME traffic.
    fs.writeFileSync(path.join(temporary, 'Caddyfile'), caddy.replace('{$SENKU_HOST}', 'http://:8080'));
    const echo = "const express=require('express');const app=express();app.set('trust proxy',1);app.use((req,res)=>res.json({ip:req.ip,protocol:req.protocol,xff:req.headers['x-forwarded-for'],origin:req.headers.origin||null,upgrade:req.headers.upgrade||null}));app.listen(3001,'0.0.0.0')";
    const start = (name, args) => { names.push(name); docker('run', '-d', '--name', name, '--network', id, ...args); };
    start(`${id}-api`, ['--network-alias', 'api', '--entrypoint', 'node', image, '-e', echo]);
    start(`${id}-gateway`, ['--network-alias', 'senku-gateway', '--mount', `type=bind,source=${path.join(temporary, 'nginx.conf')},target=/etc/nginx/nginx.conf,readonly`, '--entrypoint', 'nginx', 'nginx:stable-alpine@sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951', '-g', 'daemon off;']);
    start(`${id}-ingress`, ['--mount', `type=bind,source=${path.join(temporary, 'Caddyfile')},target=/etc/caddy/Caddyfile,readonly`, 'caddy:2.11.2-alpine@sha256:834468128c7696cec0ceea6172f7d692daf645ae51983ca76e39da54a97c570d']);
    const probe = "(async()=>{for(let i=0;i<30;i++){try{const r=await fetch('http://" + `${id}-ingress` + ":8080/backend/check',{headers:{'X-Forwarded-For':'203.0.113.222','X-Forwarded-Proto':'http','Origin':'https://senku.example'}});if(r.ok){console.log(await r.text());return}}catch{}await new Promise(r=>setTimeout(r,200))}process.exit(1)})()";
    const response = JSON.parse(docker('run', '--rm', '--network', id, '--entrypoint', 'node', image, '-e', probe));
    check(response.ip !== '203.0.113.222' && /^\d+\.\d+\.\d+\.\d+$/.test(response.ip), 'Ingress must reject attacker client IP');
    check(response.xff === response.ip && !response.xff.includes(','), 'Express must see exactly the actual scalar client IP');
    check(response.protocol === 'https', 'TLS origin must survive both proxies despite spoofed plaintext header');
    check(response.origin === 'https://senku.example', 'Browser Origin must survive gateway unchanged');
    console.log('PASS: actual Caddy -> nginx -> Express trusted forwarding and spoof rejection');
  } finally {
    for (const name of names.reverse()) { try { docker('rm', '-f', name); } catch {} }
    if (networkCreated) { try { docker('network', 'rm', id); } catch {} }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
