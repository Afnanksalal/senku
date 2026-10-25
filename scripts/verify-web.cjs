/** Real-browser smoke against a running Senku gateway. No paid providers or fixture results. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const origin = new URL(process.env.SENKU_TEST_URL || 'http://localhost:3000').origin;
const publicOrigin = new URL(origin).protocol === 'https:' && !/^(localhost|127\.|0\.0\.0\.0$|\[?::1\]?$)/i.test(new URL(origin).hostname);
const evidence = path.resolve('artifacts/ci/browser');
let checks = 0;
function check(value, message) { assert(value, message); checks++; }
function headAttribute(head, tag, selector, value, attribute) {
  for (const match of head.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(item => [item[1].toLowerCase(), item[2].replace(/&amp;/g, '&')]));
    if (attributes[selector] === value) return attributes[attribute];
  }
}
async function get(url, options) { const response = await fetch(origin + url, options); check(response.ok, `${url} returned ${response.status}`); return response; }
(async () => {
  await fs.mkdir(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], unavailable = [], chargedRequests = [];
  page.on('request', request => { if(request.method()==='POST' && /\/v1\/(runs|molecules\/(?:validate|describe)|companion\/respond|ai\/route|investigations|molecular\/screens(?:\/[0-9a-f-]+\/reflect)?)$/.test(new URL(request.url()).pathname)) chargedRequests.push(new URL(request.url()).pathname); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(origin + '/backend/') && (response.status() >= 500 || response.status() === 429)) unavailable.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  try {
    check((await (await get('/backend/health')).json()).status === 'ok', 'The gateway reaches the actual API');
    const routes = ['/welcome', '/home', '/docking', '/molecules', '/learn', '/challenges', '/discover', '/profile'];
    for (const route of routes) {
      const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
      check(response?.status() === 200, `${route} serves HTML`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
      await expect(page).toHaveTitle(/Senku/);
      for (const width of [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.fonts.ready);
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} fits ${width}px`);
        await page.screenshot({ path: path.join(evidence, `${route.slice(1)}-${width}.png`) });
      }
      if (['/home', '/docking', '/molecules'].includes(route)) {
        for (const width of [320, 375, 768]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(() => document.documentElement.style.fontSize = '200%');
          check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} reflows at ${width}px and 200% text`);
        }
        await page.evaluate(() => document.documentElement.style.fontSize = '');
      }
      if (['/welcome', '/home', '/docking', '/molecules'].includes(route)) {
        check(!/Gemini|Google|AI-powered|AI-guided/.test(await page.locator('body').innerText()), `${route} uses Senku product copy`);
      }
    }
    await page.goto(origin + '/welcome');
    for (const source of ['hero-curiosity.png', 'science-friends.png']) {
      const image = page.locator(`img[src$="${source}"]`);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      checks++;
    }
    const manifestResponse = await get('/manifest.webmanifest');
    check(manifestResponse.headers.get('content-type')?.includes('manifest+json'), 'Manifest has its registered content type');
    const manifest = await manifestResponse.json();
    check(manifest.name === 'Senku' && manifest.display === 'standalone' && manifest.start_url === '/home', 'Install manifest describes the actual app');
    for (const icon of manifest.icons) {
      const bytes = Buffer.from(await (await get(icon.src)).arrayBuffer());
      check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${icon.src} is a real PNG`);
      const [w, h] = icon.sizes.split('x').map(Number);
      check(bytes.readUInt32BE(16) === w && bytes.readUInt32BE(20) === h, `${icon.src} dimensions match its declaration`);
    }
    for (const [image, w, h] of [['/social/senku-og.png', 1200, 630], ['/social/senku-og-square.png', 1200, 1200]]) {
      const bytes = Buffer.from(await (await get(image)).arrayBuffer());
      check(bytes.readUInt32BE(16) === w && bytes.readUInt32BE(20) === h, `${image} is correctly sized raster artwork`);
    }
    for (const agent of ['Twitterbot/1.0', 'facebookexternalhit/1.1', 'Discordbot', 'WhatsApp/2.0']) {
      const html = await (await get('/welcome', { headers: { 'User-Agent': agent } })).text();
      const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
      check(/property="og:image"/.test(head) && /name="twitter:card"/.test(head), `${agent} receives initial-HTML share metadata`);
      check(head.includes('/social/senku-og.png'), `${agent} receives the generated raster preview`);
      check(!/Gemini|Google|AI-powered|AI-guided/.test(head.replace(/<meta\b[^>]*name="googlebot"[^>]*>/gi, '')), `${agent} receives Senku-branded metadata`);
      if (publicOrigin) {
        check(headAttribute(head, 'link', 'rel', 'canonical', 'href') === `${origin}/welcome`, `${agent} receives the deployed canonical URL`);
        check(headAttribute(head, 'meta', 'property', 'og:url', 'content') === `${origin}/welcome`, `${agent} receives the deployed social URL`);
        check(headAttribute(head, 'meta', 'property', 'og:image', 'content') === `${origin}/social/senku-og.png`, `${agent} receives an absolute HTTPS preview image`);
        check(headAttribute(head, 'meta', 'name', 'twitter:image', 'content') === `${origin}/social/senku-og.png`, `${agent} receives an absolute HTTPS card image`);
        check(!/noindex/.test(headAttribute(head, 'meta', 'name', 'robots', 'content') || ''), 'The public welcome page can be indexed');
      }
    }
    const privateHtml = await (await get('/profile?ci-private-sentinel=1')).text();
    const privateHead = privateHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
    check(/noindex/.test(privateHead) && !privateHead.includes('ci-private-sentinel'), 'Private metadata stays unindexed and excludes query data');
    if (/^(localhost|127\.)/.test(new URL(origin).hostname)) {
      check((await (await get('/robots.txt')).text()).includes('Disallow: /'), 'Development origin is not indexable');
    } else if (publicOrigin) {
      const robots = await (await get('/robots.txt')).text();
      check(/^Allow: \/\s*$/m.test(robots) && !/^Disallow: \/\s*$/m.test(robots), 'The public origin permits catalog indexing');
      for (const privatePath of ['/backend/', '/api/', '/home', '/profile', '/rooms', '/shared', '/classroom', '/companion', '/pathways', '/offline']) {
        check(robots.split(/\r?\n/).includes(`Disallow: ${privatePath}`), `Robots excludes private ${privatePath}`);
      }
      check(robots.includes(`Sitemap: ${origin}/sitemap.xml`), 'Robots advertises the deployed HTTPS sitemap');
      const sitemap = await (await get('/sitemap.xml')).text();
      const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
      check(locations.length > 0 && locations.every(url => url.origin === origin && !url.search), 'Every sitemap location uses the deployed public origin without private query data');
      check(locations.some(url => url.pathname === '/molecules') && locations.some(url => url.pathname === '/welcome'), 'The sitemap includes both the studio and welcome page');
      check(!locations.some(url => /^\/(?:home|profile|rooms|shared|classroom|companion|pathways|offline)(?:\/|$)/.test(url.pathname)), 'The sitemap excludes private workspaces');
    }
    const worker = await get('/sw.js');
    check(/no-cache|no-store/.test(worker.headers.get('cache-control') || ''), 'Worker updates are not served as immutable assets');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    checks++;
    const cacheKeys = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(request => request.url)))).flat());
    check(!cacheKeys.some(key => /\/backend\/v1\/(me|auth|runs|companion|ai)(\/|$)/.test(new URL(key).pathname)), 'The worker does not cache private API responses');
    await context.setOffline(true);
    await page.goto(origin + '/profile?ci-offline=1');
    await expect(page.getByRole('heading', { name: 'You are offline', exact: true })).toBeVisible();
    checks++;
    await context.setOffline(false);
    check(errors.length === 0, `Browser exceptions: ${errors.join('; ')}`);
    check(unavailable.length === 0, `Unavailable API requests: ${unavailable.join('; ')}`);
    check(chargedRequests.length === 0, 'Guest browser smoke creates no paid operations');
    const report = { checks, origin, publicOrigin, routes: routes.length, viewportWidths: [320, 375, 768, 1440], chargedRequests, errors, unavailable };
    await fs.writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } catch(error) {
    await fs.writeFile(path.join(evidence, 'failure.json'), JSON.stringify({message:error.message,errors,unavailable,chargedRequests},null,2)+'\n');
    await page.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});
    throw error;
  } finally {
    await context.setOffline(false).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
