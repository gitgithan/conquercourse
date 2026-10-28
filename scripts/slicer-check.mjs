// Walks the Slicer (CC-73) on Montmartre with saved Overpass and terrain answers (no network but the map tiles):
// pin, Slice, drag the cut height to three levels, switch the contour ladder on, and check that what the player sees changes.
// Screenshots go to data/eval/cc-72-atlas/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = 'data/eval/cc-72-atlas';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}; const notes = []; const levels = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  await page.goto(`http://localhost:${port}/?mode=map&lat=48.8867&lon=2.3431&z=17&flight=0`);
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).then(() => { checks.mapStyleLoaded = true; }, () => { checks.mapStyleLoaded = false; notes.push('map style did not load in time (network)'); });
  const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 10000 });
  const [lat, lon] = (await page.evaluate(() => document.documentElement.dataset.pin)).split(',').map(Number);
  const overpass = JSON.parse(readFileSync('tests/fixtures/overpass-montmartre.json', 'utf8'));
  const ground = JSON.parse(readFileSync('tests/fixtures/ground-montmartre.json', 'utf8'));
  await page.evaluate(([a, b, ka, kb]) => { sessionStorage.setItem(ka, a); sessionStorage.setItem(kb, b); },
    [JSON.stringify({ elements: overpass.elements }), JSON.stringify(ground), `cc.map.overpass:${lat.toFixed(4)},${lon.toFixed(4)},120`, `cc.map.ground:${lat.toFixed(4)},${lon.toFixed(4)},120`]);
  // the buildings come from /api/places now (CC-78): answer it with the saved answer, and do not snap to the ready Montmartre
  await page.route('**/api/places*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: overpass.elements, source: 'fixture', cache: 'miss' }) }));
  await page.evaluate(() => (document.getElementById('useready').checked = false));
  await page.$eval('#shrink', (el) => { el.value = '0.1'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }); // a lane that clears needs the place shrunk enough
  checks.sliceButtonEnabled = !(await page.$eval('#slice', (b) => b.disabled));
  await page.click('#slice');
  await page.waitForFunction(() => document.documentElement.dataset.sliceReady === '1', null, { timeout: 60000 }).then(() => { checks.sliceReady = true; }, () => { checks.sliceReady = false; });
  const range = Number(await page.evaluate(() => document.documentElement.dataset.sliceRange));
  checks.sliderReachesAboveTheHill = range >= 39;
  const d = (k) => page.evaluate((kk) => document.documentElement.dataset[kk], k);
  // three cut heights: low, middle, high
  for (const [name, c] of [['low', 5], ['mid', 20], ['high', 35]]) {
    await page.$eval('#cut', (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, c);
    await page.waitForFunction(() => ['clearable', 'not-clearable', 'none'].includes(document.documentElement.dataset.sliceLane), null, { timeout: 240000 }).then(() => {}, () => notes.push(`lane search still running at ${c} m`));
    await page.waitForTimeout(1500);
    levels[name] = { cut: c, cutBuildings: Number(await d('sliceCutBuildings')), below: Number(await d('sliceBelowBuildings')), contourSegs: Number(await d('sliceContourSegs')), lane: await d('sliceLane'), laneLength: await d('sliceLaneLength') ?? null, readout: await page.textContent('#sliceread') };
    await page.screenshot({ path: `${out}/slice-${name}-${c}m.png`, timeout: 180000 });
  }
  checks.cutBuildingsFallAsThePlaneRises = levels.low.cutBuildings >= levels.mid.cutBuildings && levels.mid.cutBuildings >= levels.high.cutBuildings && levels.low.cutBuildings > levels.high.cutBuildings;
  checks.contourLinesAppear = levels.low.contourSegs > 0 && levels.mid.contourSegs > 0;
  checks.contourChangesWithHeight = new Set([levels.low.contourSegs, levels.mid.contourSegs, levels.high.contourSegs]).size >= 2;
  checks.readoutChanges = new Set([levels.low.readout, levels.mid.readout, levels.high.readout]).size === 3;
  checks.readoutSaysCutHeight = Object.values(levels).every((l) => /^Cut at \d+(\.\d)? m:/.test(l.readout));
  checks.someHeightIsClearable = Object.values(levels).some((l) => l.lane === 'clearable');
  checks.someHeightHasAnAnswer = Object.values(levels).some((l) => ['clearable', 'not-clearable', 'none'].includes(l.lane));
  await page.click('#ladder');
  await page.waitForTimeout(800);
  const ladder = Number(await d('ladderLines'));
  checks.ladderHasSixToTenLines = ladder >= 6 && ladder <= 10;
  notes.push(`ladder lines: ${ladder}`);
  await page.screenshot({ path: `${out}/slice-ladder.png`, timeout: 180000 });
  await browser.close();
} finally { server.kill(); }
const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ checks, levels, notes, pass }, null, 2));
writeFileSync(`${out}/run.json`, JSON.stringify({ checks, levels, notes, pass }, null, 2) + '\n');
process.exit(pass ? 0 : 1);
