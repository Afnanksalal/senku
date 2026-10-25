/* Senku explicitly prepared offline lessons. Never cache account, run or AI responses. */
const CACHE = 'senku-offline-v1';
const SHELL = 'senku-shell-v4';
const MASCOT_ASSETS = ['wave', 'think', 'cheer', 'puzzled'].map(mood => `/art/mascot-${mood}.webp`);
const META = '/__senku_offline_meta__';
const MAX_ENTRIES = 400;
self.addEventListener('install', (event) => event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(['/offline.html', ...MASCOT_ASSETS]))));
self.addEventListener('activate', (event) => event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('senku-shell-')&&name!==SHELL)await caches.delete(name);await self.clients.claim();})()));
const publicData = (url) => /^\/backend\/v1\/(subjects|lessons(?:\/[a-z0-9-]+)?|experiments(?:\/[a-z0-9-]+\/versions\/\d+\.\d+\.\d+)?|offline\/packs\/[a-z0-9-]+)$/.test(url.pathname);
const staticAsset = (url) => url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/art/') || url.pathname.startsWith('/icons/');
async function put(cache, request, response, required = false) {
  if (!response.ok || response.type === 'opaque') { if (required) throw new Error('A lesson resource could not be downloaded.'); return; }
  if (!(await cache.match(request)) && (await cache.keys()).length >= MAX_ENTRIES) { if (required) throw new Error('Offline storage is full. Remove old browser site data before preparing more lessons.'); return; }
  await cache.put(request, response.clone());
}
async function meta(cache) { const response = await cache.match(META); return response ? response.json() : { lessons: [] }; }
function assetLinks(text) { return [...new Set([...text.matchAll(/["'(](\/_next\/static\/[^"')\s<>]+)["')]/g)].map((m) => m[1].replaceAll('&amp;', '&')))]; }
async function cacheLesson(data) {
  if (!/^[a-z][a-z0-9-]{1,99}$/.test(data.lessonId) || !/^[a-z][a-z0-9-]{1,63}$/.test(data.experimentId) || !/^\d+\.\d+\.\d+$/.test(data.version)) throw new Error('The lesson identifier is invalid.');
  const cache = await caches.open(CACHE);
  const urls = ['/', '/offline', `/learn/${data.lessonId}`, ...MASCOT_ASSETS, '/backend/v1/subjects', '/backend/v1/lessons', `/backend/v1/lessons/${data.lessonId}`, '/backend/v1/experiments?limit=100&after=', `/backend/v1/experiments/${data.experimentId}/versions/${data.version}`, `/backend/v1/offline/packs/${data.lessonId}`];
  const seen = new Set();
  while (urls.length) {
    const path = urls.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const response = await fetch(path, { cache: 'reload', credentials: 'same-origin' });
    await put(cache, path, response, true);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') || contentType.includes('text/css')) urls.push(...assetLinks(await response.clone().text()));
  }
  const record = await meta(cache);
  record.lessons = [...new Set([...record.lessons, `/learn/${data.lessonId}`])];
  await cache.put(META, new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } }));
}
self.addEventListener('message', (event) => {
  if(event.data?.type==='SKIP_WAITING'){self.skipWaiting();return;}
  if (event.data?.type !== 'CACHE_LESSON' || !event.ports[0]) return;
  event.waitUntil(cacheLesson(event.data).then(() => event.ports[0].postMessage({ ok: true })).catch((error) => event.ports[0].postMessage({ ok: false, error: error.message || 'Offline preparation failed.' })));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization') || request.headers.has('RSC') || url.searchParams.has('_rsc')) return;
  if (staticAsset(url)) {
    event.respondWith((async () => { const prepared = await caches.open(CACHE); const shell=await caches.open(SHELL); const prior = await prepared.match(request) || await shell.match(request); if (prior) return prior; const response = await fetch(request); if(response.ok&&response.type!=='opaque'){await shell.put(request,response.clone());const keys=await shell.keys();for(const key of keys.filter(k=>new URL(k.url).pathname!=='/offline.html').slice(0,Math.max(0,keys.length-180)))await shell.delete(key);} return response; })());
  } else if (publicData(url)) {
    event.respondWith((async () => { const cache = await caches.open(CACHE); try { const response = await fetch(request); if (response.ok) await put(cache, request, response); return response; } catch { return await cache.match(request) || new Response(JSON.stringify({ error: { code: 'offline_pack_unavailable', message: 'This content has not been prepared for offline use. Connect and save its lesson pack.' } }), { status: 503, headers: { 'Content-Type': 'application/json' } }); } })());
  } else if (request.mode === 'navigate') {
    event.respondWith((async () => { const cache = await caches.open(CACHE); const record = await meta(cache); const allowed = ['/', '/offline', ...record.lessons].includes(url.pathname); try { const response = await fetch(request); if (allowed && response.ok) await put(cache, request, response); return response; } catch { const prior = allowed ? await cache.match(url.pathname) : undefined; if (prior) return prior; return await (await caches.open(SHELL)).match('/offline.html') || new Response('Senku is offline. Reconnect or open a prepared lesson.',{status:503,headers:{'Content-Type':'text/plain'}}); } })());
  }
});
