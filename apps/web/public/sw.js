/* Senku explicitly prepared offline lessons. Never cache account, run or AI responses. */
const CACHE = 'senku-offline-v1';
const META = '/__senku_offline_meta__';
const MAX_ENTRIES = 400;
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
const publicData = (url) => /^\/backend\/v1\/(subjects|lessons(?:\/[a-z0-9-]+)?|experiments(?:\/[a-z0-9-]+\/versions\/\d+\.\d+\.\d+)?|offline\/packs\/[a-z0-9-]+)$/.test(url.pathname);
const staticAsset = (url) => url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/art/');
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
  const urls = ['/', '/offline', `/learn/${data.lessonId}`, '/backend/v1/subjects', '/backend/v1/lessons', `/backend/v1/lessons/${data.lessonId}`, '/backend/v1/experiments?limit=100&after=', `/backend/v1/experiments/${data.experimentId}/versions/${data.version}`, `/backend/v1/offline/packs/${data.lessonId}`];
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
  if (event.data?.type !== 'CACHE_LESSON' || !event.ports[0]) return;
  event.waitUntil(cacheLesson(event.data).then(() => event.ports[0].postMessage({ ok: true })).catch((error) => event.ports[0].postMessage({ ok: false, error: error.message || 'Offline preparation failed.' })));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return;
  if (staticAsset(url)) {
    event.respondWith((async () => { const cache = await caches.open(CACHE); const prior = await cache.match(request); if (prior) return prior; const response = await fetch(request); await put(cache, request, response); return response; })());
  } else if (publicData(url)) {
    event.respondWith((async () => { const cache = await caches.open(CACHE); try { const response = await fetch(request); if (response.ok) await put(cache, request, response); return response; } catch { return await cache.match(request) || new Response(JSON.stringify({ error: { code: 'offline_pack_unavailable', message: 'This content has not been prepared for offline use. Connect and save its lesson pack.' } }), { status: 503, headers: { 'Content-Type': 'application/json' } }); } })());
  } else if (request.mode === 'navigate') {
    event.respondWith((async () => { const cache = await caches.open(CACHE); const record = await meta(cache); const allowed = ['/', '/offline', ...record.lessons].includes(url.pathname); try { const response = await fetch(request); if (allowed && response.ok) await put(cache, request, response); return response; } catch { const prior = allowed ? await cache.match(url.pathname) : undefined; if (prior) return prior; return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Senku is offline</title><body style="font:18px system-ui;max-width:40rem;margin:3rem auto;padding:1rem;background:#f7faf6;color:#17262e"><h1>This page is not saved offline</h1><p>Open a prepared lesson, or reconnect to continue. No cloud work has been started.</p><a href="/offline">Open saved lessons</a></body></html>', { status: 503, headers: { 'Content-Type': 'text/html' } }); } })());
  }
});
