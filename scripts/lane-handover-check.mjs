// CC-91: the lane the map proved arrives in the editor with the pieces (it used to start on turn 0, sideways 0, level 0).
// A ready place (no map server needed): Build, Open in the editor, read the lane the editor verifies, and wait for the proof.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5191';
const out = 'data/eval/cc-91-lane';
const slug = process.env.PLACE ?? 'valletta-harbour-malta';
const place = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}, notes = [];
try {
  await new Promise((r) => setTimeout(r, 3000));
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: flags });
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  await page.route(/overpass|maps\.mail\.ru/, (r) => r.abort());
  await page.goto(`http://localhost:${port}/?mode=map&lat=${place.lat}&lon=${place.lon}&z=16`);
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => notes.push('map style slow'));
  const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.click('#build');
  await page.waitForSelector('#openeditor:not([hidden])', { timeout: 60000 });
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('cc.map.piece') ?? 'null'));
  checks.laneStoredWithThePiece = !!stored?.lane && stored.lane.from === 'place';
  await page.click('#openeditor');
  await page.waitForFunction(() => new URLSearchParams(location.search).get('mode') === 'editor', null, { timeout: 30000 });
  await page.waitForFunction(() => document.documentElement.dataset.lane, null, { timeout: 60000 });
  const lane = JSON.parse(await page.evaluate(() => document.documentElement.dataset.lane));
  const want = { angle: (place.lane.turnDeg * Math.PI) / 180, offset: place.lane.sidewaysM, level: place.lane.levelM };
  checks.editorStartsOnTheMapLane = Math.abs(lane.angle - want.angle) < 1e-6 && Math.abs(lane.offset - want.offset) < 1e-6 && Math.abs(lane.level - want.level) < 1e-6;
  checks.editorSaysWhereTheLaneCameFrom = (await page.evaluate(() => document.documentElement.dataset.laneFrom)) === 'place';
  notes.push(`lane in the editor ${JSON.stringify(lane)}, the map's ${JSON.stringify(want)}`);
  await page.waitForFunction(() => /simulator can clear|cannot find|could not finish/.test(document.documentElement.dataset.verdict ?? ''), null, { timeout: 280000 });
  const verdict = await page.evaluate(() => document.documentElement.dataset.verdict);
  checks.editorProofClears = /simulator can clear/.test(verdict);
  notes.push(`editor verdict: ${verdict}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/editor-after-handover-${slug}.png` });
  await browser.close();
} catch (e) { checks.threw = String(e).slice(0, 200); }
server.kill();
writeFileSync(`${out}/handover-check-${slug}.json`, JSON.stringify({ checks, notes }, null, 2) + '\n');
console.log(JSON.stringify({ checks, notes }, null, 2));
process.exit(Object.values(checks).every((v) => v === true) ? 0 : 1);
