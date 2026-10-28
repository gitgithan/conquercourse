// Walks the map flight and the picking (CC-79) on Montmartre with saved Overpass and terrain answers:
// the three flight steps frozen for pictures, a real flight to its end, click and box picking, then the hand-over to the editor as separate pieces.
// Screenshots go to data/eval/cc-79-flight/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = 'data/eval/cc-79-flight';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}; const notes = [];
const overpass = JSON.parse(readFileSync('tests/fixtures/overpass-montmartre.json', 'utf8'));
const ground = JSON.parse(readFileSync('tests/fixtures/ground-montmartre.json', 'utf8'));
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });

// open the map on Montmartre, drop the pin in the middle, put the saved answers in the cache, press Slice
async function open(browser, extra = '') {
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  await page.goto(`http://localhost:${port}/?mode=map&lat=48.8867&lon=2.3431&z=16&hooks=1${extra}`);
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => notes.push('map style did not load in time (network)'));
  const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 10000 });
  const [lat, lon] = (await page.evaluate(() => document.documentElement.dataset.pin)).split(',').map(Number);
  await page.evaluate(([a, b, ka, kb]) => { sessionStorage.setItem(ka, a); sessionStorage.setItem(kb, b); },
    [JSON.stringify({ elements: overpass.elements }), JSON.stringify(ground), `cc.map.overpass:${lat.toFixed(4)},${lon.toFixed(4)},120`, `cc.map.ground:${lat.toFixed(4)},${lon.toFixed(4)},120`]);
  await page.$eval('#shrink', (el) => { el.value = '0.1'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  await page.click('#slice');
  return { page, box };
}
const d = (page, k) => page.evaluate((kk) => document.documentElement.dataset[kk], k);

try {
  await new Promise((r) => setTimeout(r, 3000));
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: flags });

  // ---- the three steps, frozen
  const caps = {};
  for (const [name, t] of [['1-birds-eye', 0.5], ['2-painted-in', 2.5], ['3-tilt-down', 5.0]]) {
    const { page } = await open(browser, `&flightat=${t}`);
    await page.waitForFunction(() => document.documentElement.dataset.flightAt !== undefined, null, { timeout: 60000 });
    await page.waitForTimeout(3000);
    caps[name] = await page.textContent('.fcap');
    await shot(page, `flight-${name}`);
    await page.close();
  }
  checks.threeCaptionsDiffer = new Set(Object.values(caps)).size === 3;
  checks.step1SaysHowWideTheCircleIs = /240 m across/.test(caps['1-birds-eye']);
  notes.push(JSON.stringify(caps));

  // ---- a real flight: it ends by itself in under 6 seconds and hands the slider over
  const { page, box } = await open(browser);
  const t0 = Date.now();
  await page.waitForFunction(() => document.documentElement.dataset.flightDone === '1', null, { timeout: 60000 }).then(() => { checks.flightEnds = true; }, () => { checks.flightEnds = false; });
  notes.push(`flight took about ${Math.round((Date.now() - t0) / 100) / 10} s including loading`);
  checks.sliderShownAfterFlight = !(await page.$eval('#slicer', (e) => e.hidden));
  checks.skipButtonGone = await page.$eval('.fskip', (e) => e.hidden);
  await page.waitForTimeout(2500);
  await shot(page, 'flight-end-picking');
  const total = Number(await d(page, 'sliceTotal'));
  checks.allPickedAtFirst = Number(await d(page, 'slicePicked')) === total && total > 20;

  // ---- click a building: find a pixel that shows one (the topmost feature there), click it, it leaves the picked set
  const spot = await page.evaluate(() => {
    const m = window.__ccMap.map, c = m.getCanvas(), w = c.clientWidth, h = c.clientHeight;
    for (let y = Math.floor(h * 0.45); y < h * 0.9; y += 25) for (let x = Math.floor(w * 0.2); x < w * 0.8; x += 25) {
      const f = m.queryRenderedFeatures([x, y], { layers: ['sl-below', 'sl-face', 'sl-above', 'sl-out'] });
      if (f.length) return { x, y, i: Number(f[0].properties.i) };
    }
    return null;
  });
  checks.foundABuildingOnScreen = !!spot;
  if (spot) {
    await page.mouse.click(box.x + spot.x, box.y + spot.y);
    await page.waitForTimeout(500);
    checks.clickLeavesOneOut = Number(await d(page, 'slicePicked')) === total - 1 && !(await page.evaluate(() => window.__ccMap.picked())).includes(spot.i);
    await page.mouse.click(box.x + spot.x, box.y + spot.y);
    await page.waitForTimeout(500);
    checks.clickAgainPutsItBack = Number(await d(page, 'slicePicked')) === total;
  }
  await page.click('#pickclear');
  await page.waitForTimeout(300);
  checks.clearPicksNone = Number(await d(page, 'slicePicked')) === 0;
  await shot(page, 'flight-picks-cleared');

  // ---- drag a box (Shift and drag)
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.65, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.85, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(600);
  const boxed = Number(await d(page, 'slicePicked'));
  checks.boxPicksSome = boxed > 0 && boxed < total;
  notes.push(`box picked ${boxed} of ${total}`);
  await shot(page, 'flight-box-picked');

  // ---- step 4: hand the picked buildings to the editor as separate pieces
  await page.click('#buildpieces');
  await page.waitForFunction(() => new URLSearchParams(location.search).get('mode') === 'editor', null, { timeout: 60000 }).then(() => { checks.opensEditor = true; }, () => { checks.opensEditor = false; });
  await page.waitForFunction((n) => document.documentElement.dataset.pieces === String(n), boxed, { timeout: 60000 }).then(() => { checks.separatePiecesInEditor = true; }, async () => { checks.separatePiecesInEditor = false; notes.push(`editor pieces: ${await d(page, 'pieces')}`); });
  await page.waitForTimeout(2500);
  await shot(page, 'flight-4-editor');
  await browser.close();
} finally { server.kill(); }
const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ checks, notes, pass }, null, 2));
writeFileSync(`${out}/run.json`, JSON.stringify({ checks, notes, pass }, null, 2) + '\n');
process.exit(pass ? 0 : 1);
