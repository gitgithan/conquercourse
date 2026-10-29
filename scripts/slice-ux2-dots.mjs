// CC-204 (and CC-201..207 checks) in the browser. Origin: CC-92: the Slicer on Montmartre (saved answers) says why a height fails, shows the strip of heights, and the tour line can be dragged.
// Screenshots go to data/eval/slice-ux2/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5193';
const out = 'data/eval/slice-ux2' + (process.env.EXTRA ? '-old' : '');
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
  await page.goto(`http://localhost:${port}/?mode=map&lat=48.8867&lon=2.3431&z=16&hooks=1&flight=0${process.env.EXTRA ?? ""}`);
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
  // ---- Q4: real-mouse drag on each of the three dots; report what sits on top at each dot's centre, whether the dot moved and whether the map moved
  notes.push(`before: dotsInView=${await d(page, 'dotsInView')} lane=${await d(page, 'sliceLane')} zoom=${await page.evaluate(() => window.__ccMap.map.getZoom())} pitch=${await page.evaluate(() => window.__ccMap.map.getPitch())} canvas=${JSON.stringify(box)} projected=${JSON.stringify(await page.evaluate(() => window.__ccMap.tourHandles().map((p) => { const q = window.__ccMap.map.project([p.lng, p.lat]); return [Math.round(q.x), Math.round(q.y)]; })))}`);
  page.on('console', (m) => notes.push('console: ' + m.text().slice(0, 150)));
  if (!process.env.EXTRA) await page.click("#linefit");
  notes.push(`after linefit: dotsInView=${await d(page, 'dotsInView')} projected=${JSON.stringify(await page.evaluate(() => window.__ccMap.tourHandles().map((p) => { const q = window.__ccMap.map.project([p.lng, p.lat]); return [Math.round(q.x), Math.round(q.y)]; })))}`);
  const res = [];
  for (const [i, id] of [[0, '#tour-a'], [1, '#tour-b'], [2, '#tour-m']]) {
    const bb = await (await page.$(id)).boundingBox();
    const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName) : null; }, [cx, cy]);
    const h0 = await page.evaluate(() => window.__ccMap.tourHandles().map((p) => [p.lng, p.lat]));
    const c0 = await page.evaluate(() => { const c = window.__ccMap.map.getCenter(); return [c.lng, c.lat]; });
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 40, cy + 30, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(700);
    const h1 = await page.evaluate(() => window.__ccMap.tourHandles().map((p) => [p.lng, p.lat]));
    const c1 = await page.evaluate(() => { const c = window.__ccMap.map.getCenter(); return [c.lng, c.lat]; });
    const dm = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    res.push({ dot: id, box: [Math.round(bb.x), Math.round(bb.y)], topAtCentre: top, dotMoved: dm(h1[i], h0[i]) > 1e-6, mapMoved: dm(c1, c0) > 1e-7 });
    await settle(page).catch(() => {});
    await page.screenshot({ path: `${out}/drag-${i}.png` });
  }
  notes.push(`drag results: ${JSON.stringify(res)}`);
  checks.allThreeDotsDrag = res.every((r) => r.dotMoved && !r.mapMoved);
  await browser.close();
} catch (e) { checks.threw = String(e).slice(0, 300); }
server.kill();
writeFileSync(`${out}/dots-check.json`, JSON.stringify({ checks, notes }, null, 2) + '\n');
console.log(JSON.stringify({ checks, notes }, null, 2));
process.exit(Object.values(checks).every((v) => v === true) ? 0 : 1);
