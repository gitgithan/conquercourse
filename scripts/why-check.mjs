// CC-92 and CC-93 in the browser: the Slicer on Montmartre (saved answers) says why a height fails, shows the strip of heights, and the tour line can be dragged.
// Screenshots go to data/eval/cc-92-why/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5192';
const out = 'data/eval/cc-92-why';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}, notes = [];
const overpass = JSON.parse(readFileSync('tests/fixtures/overpass-montmartre.json', 'utf8'));
const ground = JSON.parse(readFileSync('tests/fixtures/ground-montmartre.json', 'utf8'));
const d = (page, k) => page.evaluate((kk) => document.documentElement.dataset[kk], k);
const settle = (page, ms = 280000) => page.waitForFunction(() => ['clearable', 'not-clearable', 'none'].includes(document.documentElement.dataset.sliceLane), null, { timeout: ms });
const setCut = async (page, v) => { await page.$eval('#cut', (el, x) => { el.value = String(x); el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, v); await page.waitForTimeout(800); };
try {
  await new Promise((r) => setTimeout(r, 3000));
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  await page.goto(`http://localhost:${port}/?mode=map&lat=48.8867&lon=2.3431&z=16&hooks=1&flight=0`);
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => notes.push('map style slow'));
  const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 10000 });
  const [lat, lon] = (await d(page, 'pin')).split(',').map(Number);
  await page.evaluate(([a, b, ka, kb]) => { sessionStorage.setItem(ka, a); sessionStorage.setItem(kb, b); },
    [JSON.stringify({ elements: overpass.elements }), JSON.stringify(ground), `cc.map.overpass:${lat.toFixed(4)},${lon.toFixed(4)},120`, `cc.map.ground:${lat.toFixed(4)},${lon.toFixed(4)},120`]);
  await page.$eval('#shrink', (el) => { el.value = '0.1'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  await page.click('#slice');
  await page.waitForFunction(() => document.documentElement.dataset.flightDone === '1', null, { timeout: 60000 });
  await settle(page);
  // ---- B: the strip of heights appears once the first lane is settled
  await page.waitForFunction(() => document.documentElement.dataset.sliceStrip, null, { timeout: 280000 });
  const strip = JSON.parse(await d(page, 'sliceStrip'));
  checks.stripHasTenHeights = strip.length === 10;
  checks.stripButtonsShown = (await page.$$eval('#cutstrip button', (b) => b.length)) === 10;
  notes.push(`strip: ${JSON.stringify(strip)}`);
  // a height with no cleared lane says why, in plain words, and offers a height that looks crossable
  let found = null;
  for (const [h] of strip) {
    await setCut(page, h); await settle(page);
    if ((await d(page, 'sliceLane')) !== 'clearable') { found = h; break; }
  }
  notes.push(`first height that did not clear: ${found}`);
  if (found !== null) {
    const why = await page.textContent('#slicewhy');
    notes.push(`reason: ${why.replace(/\s+/g, ' ').slice(0, 300)}`);
    checks.reasonInWords = why.trim().length > 20 && /gap|wall|fall|lane/.test(why);
    await page.screenshot({ path: `${out}/slicer-why.png` });
  } else { checks.reasonInWords = 'not tested: every height cleared'; }
  // ---- C: drag and rotate the tour line
  await setCut(page, strip.find(([, k]) => k === 'ok')?.[0] ?? strip[3][0]); await settle(page);
  const before = await d(page, 'sliceLaneLength');
  checks.dotsShown = (await page.$$('#tour-a, #tour-b, #tour-m')).length === 3;
  const h0 = await page.evaluate(() => window.__ccMap.tourHandles().map((p) => [p.lng, p.lat]));
  notes.push(`dots at ${JSON.stringify(h0)}; lane before ${before}`);
  // a real mouse drag on the first dot
  const dot = await (await page.$('#tour-a')).boundingBox();
  await page.evaluate(() => { document.documentElement.dataset.sliceLane = 'working'; });
  await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
  await page.mouse.down(); await page.mouse.move(dot.x + 60, dot.y + 50, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(() => !!document.documentElement.dataset.tourLine, null, { timeout: 20000 }).then(() => { checks.dragMakesAnOwnLine = true; }, () => { checks.dragMakesAnOwnLine = false; });
  await settle(page).catch(() => {});
  checks.resetShown = !(await page.$eval('#tourreset', (e) => e.hidden));
  notes.push(`own line ${await d(page, 'tourLine')}; result ${await d(page, 'sliceLane')} ${await d(page, 'sliceLaneLength') ?? ''}`);
  const h1 = await page.evaluate(() => window.__ccMap.tourHandles().map((p) => [p.lng, p.lat]));
  checks.theDotMoved = Math.abs(h1[0][0] - h0[0][0]) + Math.abs(h1[0][1] - h0[0][1]) > 1e-5 && Math.abs(h1[1][0] - h0[1][0]) < 1e-9;
  await page.screenshot({ path: `${out}/tour-dragged.png` });
  // the middle dot moves the whole line
  await page.evaluate(() => { const [a, b] = window.__ccMap.tourHandles(); window.__ccMap.tourDrag(2, 0, 0); });
  await page.waitForTimeout(500);
  const h2 = await page.evaluate(() => window.__ccMap.tourHandles().map((p) => [p.lng, p.lat]));
  checks.middleDotMovesBothEnds = Math.abs(h2[0][0] - h1[0][0]) + Math.abs(h2[1][0] - h1[1][0]) > 1e-6;
  await settle(page).catch(() => {});
  // back to the suggested line
  await page.click('#tourreset');
  await page.waitForFunction(() => !document.documentElement.dataset.tourLine, null, { timeout: 10000 }).then(() => { checks.resetClearsIt = true; }, () => { checks.resetClearsIt = false; });
  await settle(page).catch(() => {});
  checks.resetHidesButton = await page.$eval('#tourreset', (e) => e.hidden);
  await page.screenshot({ path: `${out}/tour-reset.png` });
  await browser.close();
} catch (e) { checks.threw = String(e).slice(0, 300); }
server.kill();
writeFileSync(`${out}/why-check.json`, JSON.stringify({ checks, notes }, null, 2) + '\n');
console.log(JSON.stringify({ checks, notes }, null, 2));
process.exit(Object.values(checks).every((v) => v === true) ? 0 : 1);
