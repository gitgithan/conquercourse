// CC-90: the photo strip follows the runner. On a real-place course the ideal-run bot runs the lane; the strip changes as it moves, shows the creator, the licence and the Mapillary credit,
// stays on screen and clear of the other cards; with the photo service down (or no allow-list) the stored CC-85 strip stays. The service is faked here (no token, no network, no real pictures).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const slug = process.env.PLACE ?? 'montmartre-paris';
const out = process.env.OUT ?? 'data/eval/cc-90-photos/live'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}, notes = [];
const overlap = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
const svg = (id, hue) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${['#c0504d', '#4f81bd', '#9bbb59', '#8064a2', '#f79646'][hue % 5]}"/><text x="16" y="110" font-size="28" fill="#fff">${id}</text></svg>`;
const CDN = "https://thumbs.example.test/"; // a stand-in for Mapillary's picture host: the game accepts only https addresses
const fake = (route) => {
  const ids = (new URL(route.request().url()).searchParams.get('id') ?? '').split(',').filter(Boolean);
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: ids.map((id) => ({ id, thumb: `${CDN}${id}.svg`, creator: 'test-creator', capturedAt: Date.UTC(2020, 5, 1), compass: 0 })), cache: 'miss' }) });
};
const sig = (page) => page.$$eval('#placephotos img', (xs) => xs.map((x) => x.getAttribute('src')).join('|'));
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  for (const [vw, vh] of [[1280, 720], [1024, 640]]) {
    const tag = `${slug}@${vw}x${vh}`;
    // 1. live: the bot runs the lane; the strip changes
    const page = await browser.newPage({ viewport: { width: vw, height: vh } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.route(`${CDN}**`, (route) => { const id = /\/(\d+)\.svg/.exec(route.request().url())?.[1] ?? "0"; return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(id.slice(-5), Number(id.slice(-3)) % 360) }); });
    const asked = []; await page.route('**/api/photos**', (route) => { asked.push(route.request().url()); return fake(route); });
    await page.goto(`http://localhost:${port}/?course=/assets/experiments/osm/${slug}.course.json&front=1&bot=ideal&welcome=0`);
    await page.waitForSelector('#placephotos', { timeout: 150000 });
    const first = await sig(page);
    checks[`${tag}: the stored strip shows first`] = /\/assets\/places\//.test(first);
    const measure = async () => { // the moment the first live photo appears, before the end-of-run panel
      const strip = await page.locator('#placephotos').boundingBox();
      checks[`${tag}: strip on screen`] = !!strip && strip.x >= 0 && strip.y >= 0 && strip.x + strip.width <= vw && strip.y + strip.height <= vh;
      const others = await page.$$eval('body > div, body > button, body > select, body > aside', (xs) => xs.filter((x) => getComputedStyle(x).position === 'fixed' && getComputedStyle(x).pointerEvents !== 'none' && x.id !== 'placephotos' && x.offsetWidth > 0).map((x) => ({ id: x.id || x.className || (x.tagName + ':' + (x.textContent || '').trim().slice(0, 24) + '|' + x.outerHTML.slice(0, 90)), ...x.getBoundingClientRect().toJSON() })));
      const hit = others.filter((o) => strip && overlap(strip, o)).map((o) => o.id);
      checks[`${tag}: strip clear of the other cards`] = hit.length === 0; if (hit.length) notes.push(`${tag} overlaps ${hit.join(', ')}`);
      await page.waitForFunction(() => [...document.querySelectorAll('#placephotos img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/${slug}-${vw}x${vh}-live.png` });
    };
    const seen = new Set(); let live = false, measured = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      const s = await sig(page).catch(() => '');
      if (s.includes('thumbs.example.test')) { live = true; seen.add(s); if (!measured) { measured = true; await measure(); } }
      if (seen.size >= 2) break;
      await page.waitForTimeout(500);
    }
    checks[`${tag}: live photos replace the stored ones`] = live;
    checks[`${tag}: the strip changes as the runner moves (${seen.size} different sets)`] = seen.size >= 2;
    if (live) {
      checks[`${tag}: credit under every live photo`] = await page.$$eval('#placephotos .pp-credit', (xs) => xs.length > 0 && xs.length <= 3 && xs.every((x) => /test-creator, CC BY-SA 4\.0/.test(x.textContent ?? '')));
      checks[`${tag}: the line under the strip names Mapillary and the licence`] = /Mapillary/.test((await page.textContent('#placephotos .pp-hint')) ?? '') && /CC BY-SA 4\.0/.test((await page.textContent('#placephotos .pp-hint')) ?? '');
      // the large view opens on a live photo with the Mapillary source link
      await page.locator('#placephotos .pp-thumb').first().click();
      await page.waitForSelector('#placephotos-view');
      checks[`${tag}: large view links to the Mapillary photo`] = await page.$eval('#placephotos-view .pp-licence', (e) => [...e.querySelectorAll('a')].some((a) => /mapillary\.com\/app\/\?pKey=\d+/.test(a.href)));
      await page.keyboard.press('Escape');
    }
    checks[`${tag}: only our own address was asked, ids only, no token`] = asked.length > 0 && asked.every((u) => new URL(u).pathname === '/api/photos' && /^id=[\d,]+$/.test(new URL(u).search.slice(1)));
    checks[`${tag}: at most one lookup every 2 s`] = asked.length <= Math.ceil((Date.now() - t0) / 2000) + 1;
    checks[`${tag}: no page errors`] = errors.length === 0; if (errors.length) notes.push(errors.join(' | '));
    await page.close();
    // 2. offline: the service is down, the stored strip stays
    const off = await browser.newPage({ viewport: { width: vw, height: vh } });
    const offErrors = []; off.on('pageerror', (e) => offErrors.push(e.message));
    await off.route('**/api/photos**', (route) => route.abort());
    await off.goto(`http://localhost:${port}/?course=/assets/experiments/osm/${slug}.course.json&front=1&bot=ideal&welcome=0`);
    await off.waitForSelector('#placephotos', { timeout: 150000 });
    await off.waitForTimeout(20000);
    checks[`${tag}: service down keeps the stored strip`] = /\/assets\/places\//.test(await sig(off)) && (await off.$$('#placephotos .pp-thumb')).length >= 2;
    checks[`${tag}: service down, no page errors`] = offErrors.length === 0;
    if (vw === 1280) await off.screenshot({ path: `${out}/${slug}-${vw}x${vh}-offline.png` });
    await off.close();
  }
  await browser.close();
} finally { server.kill(); }
writeFileSync(`${out}/photos-live-check.json`, JSON.stringify({ slug, checks, notes }, null, 2) + '\n');
const failed = Object.entries(checks).filter(([, v]) => !v);
for (const [k, v] of Object.entries(checks)) console.log(v ? 'ok  ' : 'FAIL', k);
for (const n of notes) console.log('note', n);
process.exit(failed.length ? 1 : 0);
