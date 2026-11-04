// Browser check for the pin speed-up (CC-152): the map servers are slow (the site's answer is held back 6 s), and Build is pressed 8 s after the pin.
//   with the speed-up the buildings were asked when the pin dropped, so Build is at once; with ?speed=0 Build waits the whole 6 s.
//   the lane found for a pin is kept: the same pin again shows its lane at once.
// Overpass is never asked for real: /api/places is answered by the saved Circular Quay answer.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = process.env.OUT ?? 'data/eval/cc-152-osm-speed';
const DELAY = 6000, WAIT = 8000;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}, numbers = {};
const fixture = JSON.parse(readFileSync('tests/fixtures/overpass-quay.json', 'utf8'));
const url = (q = '') => `http://localhost:${port}/?mode=map&lat=-33.861&lon=151.2111&z=16&slice2=old${q}`;

async function open(browser, q) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  let asked = 0;
  await page.route(/overpass|maps\.mail\.ru/, (r) => r.abort());
  await page.route('**/api/places*', async (r) => { asked++; await new Promise((x) => setTimeout(x, DELAY)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: fixture.elements, source: 'fixture', cache: 'miss' }) }).catch(() => {}); });
  await page.goto(url(q));
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => {});
  await page.waitForSelector('#ready button', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => (document.getElementById('useready').checked = false)); // do not snap to Circular Quay
  return { ctx, page, asked: () => asked };
}
const clickMap = async (page) => { const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 10000 }); };
const buildMs = async (page) => { const t0 = Date.now(); await page.click('#build'); await page.waitForSelector('#openeditor:not([hidden])', { timeout: 120000 }); return Date.now() - t0; };

try {
  await new Promise((r) => setTimeout(r, 3000));
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: flags });

  { // the speed-up: asked when the pin drops
    const { ctx, page, asked } = await open(browser, '');
    await clickMap(page);
    await page.waitForTimeout(WAIT);
    numbers.fastBuildMs = await buildMs(page);
    checks.fastUsesEarlyAnswer = (await page.evaluate(() => document.documentElement.dataset.prefetchUsed)) === 'yes';
    checks.fastBuildAtOnce = numbers.fastBuildMs < 3000;
    checks.fastAskedOnce = asked() === 1;
    await page.screenshot({ path: `${out}/after-build-at-once.png` });
    // the lane arrives from the worker, then the same pin again keeps it
    checks.laneArrives = await page.waitForFunction(() => document.documentElement.dataset.lanePhase === 'done', null, { timeout: 300000 }).then(() => true, () => false);
    numbers.laneKeptKey = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cc.lane:')).length);
    checks.laneKept = numbers.laneKeptKey === 1;
    await page.reload();
    await page.waitForSelector('#ready button', { state: 'attached', timeout: 20000 });
    await page.evaluate(() => (document.getElementById('useready').checked = false));
    await clickMap(page);
    await page.waitForTimeout(WAIT);
    await buildMs(page);
    checks.keptLaneAtOnce = await page.waitForFunction(() => document.documentElement.dataset.lanePhase === 'done' && document.documentElement.dataset.laneKept === 'yes', null, { timeout: 5000 }).then(() => true, () => false);
    await ctx.close();
  }

  { // switched off: Build waits for the whole 6 s
    const { ctx, page } = await open(browser, '&speed=0');
    await clickMap(page);
    await page.waitForTimeout(WAIT);
    numbers.slowBuildMs = await buildMs(page);
    checks.offWaitsForTheServers = numbers.slowBuildMs >= DELAY - 500 && (await page.evaluate(() => document.documentElement.dataset.prefetchUsed)) === 'no';
    await page.screenshot({ path: `${out}/before-build-waits.png` });
    await ctx.close();
  }
  await browser.close();
} catch (e) { checks.crashed = false; console.log('CRASH', e.message); }
server.kill();
const ok = Object.values(checks).every(Boolean);
writeFileSync(`${out}/browser-check.json`, JSON.stringify({ ok, checks, numbers, delayMs: DELAY, waitMs: WAIT }, null, 2) + '\n');
console.log(JSON.stringify({ ok, checks, numbers }, null, 2));
process.exit(ok ? 0 : 1);
