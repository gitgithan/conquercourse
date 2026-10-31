// The green lane line: both round end dots and the square in the middle must drag, every time, also after a zoom or a pan, and a drag on a dot must never pan the map.
// Runs the Slicer on the saved Montmartre answers; the screenshot goes to docs/evidence/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5193';
const out = process.env.OUT ?? 'data/eval/slicer-handles';
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  await page.goto(`http://localhost:${port}/?mode=map&lat=48.8867&lon=2.3431&z=16&hooks=1${process.env.FLIGHT === "1" ? "" : "&flight=0"}`);
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
  const dm = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  const state = () => page.evaluate(() => ({ h: window.__ccMap.tourHandles().map((p) => [p.lng, p.lat]), c: (() => { const c = window.__ccMap.map.getCenter(); return [c.lng, c.lat]; })() }));
  await page.click('#linefit');
  const res = [];
  // one real-mouse drag on a dot: the dot must move and the map must stay
  const dragDot = async (i, id, label, dx, dy, mid) => {
    const bb = await (await page.$(id)).boundingBox();
    const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName) : null; }, [cx, cy]);
    const s0 = await state();
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx / 2, cy + dy / 2, { steps: 4 });
    if (mid) await mid();
    await page.mouse.move(cx + dx, cy + dy, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(500);
    const s1 = await state();
    res.push({ step: label, dot: id, topAtCentre: top, moved: dm(s1.h[i], s0.h[i]) > 1e-6, mapMoved: dm(s1.c, s0.c) > 1e-7 });
    await settle(page).catch(() => {});
  };
  const dots = [[0, '#tour-a'], [1, '#tour-b'], [2, '#tour-m']];
  for (const round of [1, 2]) for (const [i, id] of dots) await dragDot(i, id, `round ${round}`, round === 1 ? 30 : -25, round === 1 ? 20 : 15);
  // zoom in and out, pan, show the whole line again, then drag every dot once more
  await page.evaluate(() => window.__ccMap.map.jumpTo({ zoom: window.__ccMap.map.getZoom() + 0.6 }));
  await page.click('#linefit');
  await page.waitForTimeout(300);
  for (const [i, id] of dots) await dragDot(i, id, 'after zoom', 20, -20);
  await page.evaluate(() => window.__ccMap.map.panBy([60, -40], { duration: 0 }));
  await page.click('#linefit');
  await page.waitForTimeout(300);
  for (const [i, id] of dots) await dragDot(i, id, 'after pan', -20, 20);
  // a lane answer that lands while a dot is in the hand (the real bug: the dot was re-added and the drag turned into a map pan)
  const lateAnswer = () => page.$eval('#cut', (el) => { el.value = String(Number(el.value) + 1); el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }).then(() => page.waitForTimeout(1500));
  for (const [i, id] of dots) await dragDot(i, id, 'answer mid-drag', 25, -15, lateAnswer);
  notes.push(JSON.stringify(res));
  await page.screenshot({ path: `${out}/handles.png` });
  checks.everyDotDragsEveryTime = res.every((r) => r.moved && !r.mapMoved);
  checks.dragsDone = res.length === 15;
  await browser.close();
} catch (e) { checks.threw = String(e).slice(0, 300); }
server.kill();
writeFileSync(`${out}/handles-check.json`, JSON.stringify({ checks, notes }, null, 2) + '\n');
console.log(JSON.stringify({ checks, notes }, null, 2));
process.exit(Object.values(checks).every((v) => v === true) ? 0 : 1);
