// Records the real World Slicer screen for the owner's cut (CC-209): Montmartre, drag the radius bigger, Slice, the buildings rise, deselect a few buildings with real clicks, the cut to a green height, tilt up.
// The building a click lands on is read from the map feature property `i` (src/modes/map.ts pickClick), and every click is checked against the real picked count, so a missed click is retried on the next building.
// Playwright records the page in real time; the marks file says when each step happened (seconds from the start) so the film can pick windows without the waits.
// Usage: PORT=5290 node scripts/film-slicer2.mjs [slug] [out.mp4]       (one browser at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const port = process.env.PORT ?? '5290', slug = process.argv[2] ?? 'montmartre-paris', out = process.argv[3] ?? 'films/ui-slicer2.mp4';
const work = `${out}.frames`; rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const marks = []; const log = (m) => console.log(new Date().toISOString().slice(11, 19), m);
let t0 = 0;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: work, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage(); t0 = Date.now();
  page.on('pageerror', (e) => log('PAGEERROR ' + e.message.slice(0, 160)));
  const mark = (n) => { marks.push([n, (Date.now() - t0) / 1000]); log(n); };
  const pickedCount = () => page.evaluate(() => window.__ccMap?.picked().length ?? -1);
  await page.goto(`http://localhost:${port}/?mode=map&hooks=1&places=all`);
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 90000 });
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 120000 }).catch(() => log('map style slow'));
  await page.waitForSelector('#ready .card', { timeout: 60000 });
  mark('gallery'); await page.waitForTimeout(1500);
  await page.click(`button[data-slug="${slug}"]`);
  await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 30000 });
  mark('place chosen'); await page.waitForTimeout(2000);
  // the radius: drag the real slider from 120 to 170 (range 80 to 250), then check the label kept the value
  const radiusBox = await page.locator('#radius').boundingBox();
  if (radiusBox) {
    const y = radiusBox.y + radiusBox.height / 2, at = (v) => radiusBox.x + (radiusBox.width * (v - 80)) / 170;
    await page.mouse.move(at(120), y); await page.mouse.down(); await page.mouse.move(at(170), y, { steps: 10 }); await page.mouse.up();
  }
  await page.waitForTimeout(600);
  let radiusNow = await page.$eval('#radiusv', (el) => el.textContent).catch(() => '?');
  if (radiusNow !== '170') { await page.$eval('#radius', (el) => { el.value = '170'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }).catch(() => {}); await page.waitForTimeout(600); radiusNow = await page.$eval('#radiusv', (el) => el.textContent).catch(() => '?'); }
  mark(`radius ${radiusNow}`); await page.waitForTimeout(1800);
  await page.click('#slice'); mark('slice clicked');
  // the flight (buildings rise) plays for real; if it is still running after 25 s, press its Skip button so the take stays tight
  const flight = page.waitForFunction(() => document.documentElement.dataset.flightDone === '1', null, { timeout: 240000 });
  const slow = await Promise.race([flight.then(() => false), new Promise((r) => setTimeout(() => r(true), 25000))]);
  if (slow) { await page.click('#flightskip').catch(() => page.getByRole('button', { name: /skip/i }).click().catch(() => log('no skip button'))); await flight.catch(() => log('flight wait gave up')); }
  mark('flight done');
  await page.waitForTimeout(2500);
  // deselect a few buildings with real clicks on the map, before the lane search (the proven recipe from scripts/flight-check.mjs: the pick layers, the middle band of the canvas)
  const mapBox = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
  const before = await pickedCount();
  const pts = await page.evaluate(() => {
    const m = window.__ccMap; if (!m) return [];
    const map = m.map, picked = new Set([...m.picked()].map(Number));
    const c = map.getCanvas(), w = c.clientWidth, h = c.clientHeight;
    const chosen = [];
    for (let y = Math.floor(h * 0.45); y < h * 0.9; y += 25) for (let x = Math.floor(w * 0.2); x < w * 0.85; x += 25) {
      let fs = []; try { fs = map.queryRenderedFeatures([x, y], { layers: ['sl-below', 'sl-face', 'sl-above', 'sl-out'] }); } catch { continue; }
      for (const f of fs) { const i = Number(f.properties?.i); if (Number.isFinite(i) && picked.has(i) && !chosen.some((p) => p.i === i || Math.hypot(p.x - x, p.y - y) < 120)) { chosen.push({ x, y, i }); break; } }
      if (chosen.length >= 8) break;
    }
    return chosen;
  });
  log(`deselect scan: before=${before} points=${pts.length} ${JSON.stringify(pts.slice(0, 3))}`);
  let now = before;
  for (const p of pts) {
    if (before - now >= 3) break;
    await page.mouse.click(mapBox.x + p.x, mapBox.y + p.y); await page.waitForTimeout(900);
    now = await pickedCount(); log(`click building ${p.i}: picked ${now}`);
  }
  if (before - now < 1 && pts.length) { // every click missed the pick layer: clear all, then pick a few back
    await page.click('#pickclear'); await page.waitForTimeout(1200);
    for (const p of pts.slice(0, 4)) { await page.mouse.click(mapBox.x + p.x, mapBox.y + p.y); await page.waitForTimeout(700); }
    log(`fallback clear+pick, picked now ${await pickedCount()}`);
  }
  mark(`deselected: ${before} -> ${await pickedCount()}`); await page.waitForTimeout(2000);
  await page.waitForFunction(() => ['clearable', 'not-clearable', 'none'].includes(document.documentElement.dataset.sliceLane), null, { timeout: 300000 }); mark('lane found');
  await page.waitForFunction(() => document.documentElement.dataset.sliceStripDone === '1', null, { timeout: 600000 }).catch(() => log('strip slow')); mark('strip done');
  await page.waitForTimeout(2500);
  const strip = JSON.parse(await page.evaluate(() => document.documentElement.dataset.sliceStrip || '[]'));
  const green = strip.find(([, s]) => s === 'ok');
  if (green) { await page.$eval('#cut', (el, x) => { el.value = String(x); el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, green[0]); mark('cut moved'); await page.waitForTimeout(4000); }
  await page.$eval('#tilt', (el) => { el.value = '80'; el.dispatchEvent(new Event('input')); }).catch(() => {}); mark('tilted'); await page.waitForTimeout(3000);
  mark('end');
  await page.close(); await ctx.close(); await browser.close();
} catch (e) { log('threw ' + String(e).slice(0, 300)); }
server.kill();
writeFileSync(`${out}.marks.json`, JSON.stringify(marks, null, 2) + '\n');
console.log('video in', work, 'marks', JSON.stringify(marks));
