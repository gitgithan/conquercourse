// Walks the new map flow (CC-78): ready places, a pin that snaps, a slow or dead map server, the steps with Cancel, and the explain strip.
// Overpass is never asked for real: /api/places is answered by the saved Circular Quay answer, delayed, or refused, and the three map hosts are blocked.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = 'data/eval/cc-78-map';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}; const notes = [];
const fixture = JSON.parse(readFileSync('tests/fixtures/overpass-quay.json', 'utf8'));
const url = (q = '') => `http://localhost:${port}/?mode=map&lat=-33.861&lon=151.2111&z=16${q}`;
async function open(browser, mode, q = '') {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  // the public map servers are not part of this test
  await page.route(/overpass|maps\.mail\.ru/, (r) => r.abort());
  if (mode === 'fixture') await page.route('**/api/places*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: fixture.elements, source: 'fixture', cache: 'miss' }) }));
  if (mode === 'slow') await page.route('**/api/places*', async (r) => { await new Promise((x) => setTimeout(x, 60000)); r.abort().catch(() => {}); });
  if (mode === 'dead') await page.route('**/api/places*', (r) => r.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ error: 'the map data servers did not answer', readyPlaces: true }) }));
  await page.goto(url(q));
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => notes.push('map style slow'));
  return { ctx, page };
}
const clickMap = async (page, dx = 0, dy = 0) => { const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox(); await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy); await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 10000 }); };
try {
  await new Promise((r) => setTimeout(r, 3000));
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: flags });

  // 1. ready places are listed, and a pin near one says so and loads at once (no map server, no site function)
  {
    const { ctx, page } = await open(browser, 'dead');
    await page.waitForSelector('#ready button', { state: 'attached', timeout: 20000 });
    checks.readyListed = (await page.$$eval('#ready button', (b) => b.length)) >= 12;
    await page.screenshot({ path: `${out}/1-ready-list.png` });
    await clickMap(page); // the middle of the view is Circular Quay, which is a ready place
    checks.pinSnapNote = /ready here/.test(await page.textContent('#say'));
    const t0 = Date.now();
    await page.click('#build');
    await page.waitForSelector('#openeditor:not([hidden])', { timeout: 30000 });
    checks.readyLoadsAtOnce = Date.now() - t0 < 15000 && (await page.evaluate(() => document.documentElement.dataset.placeSource)) === 'ready';
    notes.push(`ready place loaded in ${Date.now() - t0} ms`);
    checks.explainShown = !(await page.$eval('#explain', (e) => e.hidden)) && /buildings found/.test(await page.textContent('#explain')) && /Lane/.test(await page.textContent('#explain'));
    const roles = await page.evaluate(() => ['roleDeck', 'roleStep', 'roleWall', 'roleGapEdge'].map((k) => Number(document.documentElement.dataset[k] ?? 0)));
    checks.roleHighlights = roles.reduce((a, b) => a + b, 0) > 0;
    notes.push(`roles on the map: deck ${roles[0]}, step ${roles[1]}, wall ${roles[2]}, gap edge ${roles[3]}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/2-ready-explain.png` });
    checks.explainInView = await page.$eval('#explain', (e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; });
    await page.click('#openeditor');
    checks.editorOpens = await page.waitForFunction(() => new URLSearchParams(location.search).get('mode') === 'editor', null, { timeout: 30000 }).then(() => true, () => false);
    await ctx.close();
  }

  // 2. a pin far from every ready place, the site answers (the saved answer): the steps run and the explain strip fills in from the worker
  {
    const { ctx, page } = await open(browser, 'fixture');
    await page.evaluate(() => (document.getElementById('useready').checked = false)); // do not snap to Circular Quay
    await clickMap(page);
    await page.click('#build');
    await page.waitForSelector('#openeditor:not([hidden])', { timeout: 120000 });
    checks.siteAnswerUsed = (await page.evaluate(() => document.documentElement.dataset.placeSource)) === 'site';
    checks.stepsShown = (await page.$$eval('#steps li', (l) => l.length)) === 4;
    await page.screenshot({ path: `${out}/3-steps-working.png` });
    checks.laneArrives = await page.waitForFunction(() => document.documentElement.dataset.lanePhase === 'done', null, { timeout: 240000 }).then(() => true, () => false);
    checks.explainHasLane = /cleared it|No lane/.test(await page.textContent('#explain'));
    await page.screenshot({ path: `${out}/4-worker-explain.png` });
    await ctx.close();
  }

  // 3. the site and the map servers are dead: a plain error, and a ready place one click away
  {
    const { ctx, page } = await open(browser, 'dead', '');
    await page.evaluate(() => (document.getElementById('useready').checked = false));
    await clickMap(page);
    await page.click('#build');
    await page.waitForSelector('#offer:not([hidden])', { timeout: 120000 });
    checks.plainError = /did not answer/.test(await page.textContent('#offer'));
    checks.offersReady = (await page.$$eval('#offer button', (b) => b.length)) >= 1;
    await page.screenshot({ path: `${out}/5-error-offers-ready.png` });
    await page.evaluate(() => (document.getElementById('useready').checked = true));
    await page.click('#offer button');
    checks.fallbackWorks = await page.waitForSelector('#openeditor:not([hidden])', { timeout: 60000 }).then(() => true, () => false);
    await ctx.close();
  }

  // 4. the site is slow: Cancel stops the wait at once
  {
    const { ctx, page } = await open(browser, 'slow');
    await page.evaluate(() => (document.getElementById('useready').checked = false));
    await clickMap(page);
    await page.click('#build');
    await page.waitForFunction(() => document.documentElement.dataset.stepAsk === 'doing', null, { timeout: 10000 });
    const t0 = Date.now();
    await page.click('#cancelbuild');
    await page.waitForFunction(() => /Cancelled/.test(document.getElementById('say').textContent), null, { timeout: 10000 });
    checks.cancelWorks = Date.now() - t0 < 5000 && !(await page.$eval('#build', (b) => b.disabled));
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }
const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ checks, notes, pass }, null, 2));
writeFileSync(`${out}/run.json`, JSON.stringify({ checks, notes, pass }, null, 2) + '\n');
process.exit(pass ? 0 : 1);
