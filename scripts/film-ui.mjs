// Records the real slicer screen (CC-209): the map page, a place, Slice, the flight, the strip of heights, the cut, at 1280 x 720.
// Playwright records the page in real time; the marks file says when each step happened (seconds from the start) so the waits can be cut out afterwards (scripts/film-ui-cut.sh).
// Usage: PORT=5290 node scripts/film-ui.mjs [slug] [out.mp4]       (run on a VM; one browser at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const port = process.env.PORT ?? '5290', slug = process.argv[2] ?? 'montmartre-paris', out = process.argv[3] ?? 'films/ui-slicer.mp4';
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
  await page.goto(`http://localhost:${port}/?mode=map&hooks=1&flight=0&places=all`);
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 90000 });
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 120000 }).catch(() => log('map style slow'));
  await page.waitForSelector('#ready .card', { timeout: 60000 });
  mark('gallery'); await page.waitForTimeout(1500);
  await page.click(`button[data-slug="${slug}"]`);
  await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 30000 });
  mark('place chosen'); await page.waitForTimeout(2500);
  await page.click('#slice'); mark('slice clicked');
  await page.waitForFunction(() => document.documentElement.dataset.flightDone === '1', null, { timeout: 180000 }); mark('flight done');
  await page.waitForFunction(() => ['clearable', 'not-clearable', 'none'].includes(document.documentElement.dataset.sliceLane), null, { timeout: 300000 }); mark('lane found');
  await page.waitForTimeout(3000);
  await page.waitForFunction(() => document.documentElement.dataset.sliceStripDone === '1', null, { timeout: 600000 }).catch(() => log('strip slow')); mark('strip done');
  await page.waitForTimeout(2500);
  const strip = JSON.parse(await page.evaluate(() => document.documentElement.dataset.sliceStrip || '[]'));
  const green = strip.find(([, s]) => s === 'ok');
  if (green) { await page.$eval('#cut', (el, x) => { el.value = String(x); el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, green[0]); mark('cut moved'); await page.waitForTimeout(4000); }
  await page.$eval('#tilt', (el) => { el.value = '75'; el.dispatchEvent(new Event('input')); }).catch(() => {}); mark('tilted'); await page.waitForTimeout(3000);
  mark('end');
  await page.close(); await ctx.close(); await browser.close();
} catch (e) { log('threw ' + String(e).slice(0, 300)); }
server.kill();
writeFileSync(`${out}.marks.json`, JSON.stringify(marks, null, 2) + '\n');
console.log('video in', work, 'marks', JSON.stringify(marks));
