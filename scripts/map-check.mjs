// Walks the map mode (CC-48): the map and its credit show, a click drops a pin, "Build this place" fetches the buildings
// (Overpass, or the saved answer if it is unreachable), and the editor opens with the place as a piece.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = 'data/eval/cc-48-map-mode';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}; const notes = [];
try {
  await new Promise((r) => setTimeout(r, 3000));
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  // Circular Quay, Sydney: the pin lands in the middle of the map
  await page.goto(`http://localhost:${port}/?mode=map&lat=-33.861&lon=151.2111&z=16`);
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
  checks.mapCanvas = true;
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).then(() => { checks.tilesStyleLoaded = true; }, () => { checks.tilesStyleLoaded = false; notes.push('map style did not load in time (network)'); });
  await page.waitForTimeout(3000);
  const attr = await page.textContent('.maplibregl-ctrl-attrib');
  checks.attribution = /OpenStreetMap contributors/.test(attr) && /OpenFreeMap/.test(attr);
  await page.screenshot({ path: `${out}/1-map.png` });
  const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 10000 });
  checks.pinDropped = !(await page.$eval('#build', (b) => b.disabled));
  await page.screenshot({ path: `${out}/2-pin.png` });
  // The buildings come from /api/places (CC-78). The public map servers are not part of this check: /api/places is answered by the saved answer,
  // and with MAP_REAL=1 it is asked for real. Build no longer jumps to the editor: it shows the steps, and the editor opens on a button.
  const fixture = JSON.parse(readFileSync('tests/fixtures/overpass-quay.json', 'utf8'));
  if (process.env.MAP_REAL !== '1') await page.route('**/api/places*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: fixture.elements, source: 'fixture', cache: 'miss' }) }));
  await page.evaluate(() => (document.getElementById('useready').checked = false)); // the ready place would answer first
  await page.click('#build');
  await page.waitForSelector('#openeditor:not([hidden])', { timeout: 150000 });
  notes.push(process.env.MAP_REAL === '1' ? 'the map servers answered for real' : 'saved answer used');
  await page.click('#openeditor');
  const landed = await page.waitForFunction(() => new URLSearchParams(location.search).get('mode') === 'editor', null, { timeout: 60000 }).then(() => true, () => false);
  checks.landedInEditor = landed;
  await page.waitForFunction(() => document.documentElement.dataset.pieces === '1', null, { timeout: 60000 }).then(() => { checks.pieceInEditor = true; }, () => { checks.pieceInEditor = false; });
  await page.waitForTimeout(2500);
  checks.keyRemoved = (await page.evaluate(() => sessionStorage.getItem('cc.map.piece'))) === null;
  checks.notSaved = !(await page.evaluate(() => (localStorage.getItem('cc.world.v1') ?? '').includes('map:')));
  await page.screenshot({ path: `${out}/3-editor.png` });
  await browser.close();
} finally { server.kill(); }
const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ checks, notes, pass }, null, 2));
writeFileSync(`${out}/run.json`, JSON.stringify({ checks, notes, pass }, null, 2) + '\n');
process.exit(pass ? 0 : 1);
