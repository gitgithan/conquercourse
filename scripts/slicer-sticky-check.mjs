// The Simulator card and "Your place" stay at the top of the World Slicer side panel however far it scrolls (1280 px).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
const port = process.env.PORT ?? '5393', slug = process.env.PLACE ?? 'shibuya-tokyo';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
let ok = true;
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('test-results/slicer-sticky', { recursive: true });
  const place = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.route(/overpass|maps\.mail\.ru/, (r) => r.abort());
  await page.goto(`http://localhost:${port}/?mode=map&lat=${place.lat}&lon=${place.lon}&z=16`);
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => {});
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
  const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('#slice:not([disabled])', { timeout: 90000 }); await page.click('#slice');
  await page.waitForFunction(() => document.documentElement.dataset.sliceLane, null, { timeout: 90000 }); await page.waitForTimeout(3000);
  await page.evaluate(() => { const s = document.querySelector('.mp .side'); s.scrollTop = s.scrollHeight; });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const b = (q) => { const e = document.querySelector(q); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; }; return { scroll: document.querySelector('.mp .side').scrollTop, yp: b('#yourplace'), sim: b('.mp .simsays') }; });
  console.log(JSON.stringify(r));
  ok = r.scroll > 100 && r.yp && r.yp[0] >= 0 && r.yp[0] < 150 && r.sim && r.sim[0] >= 0 && r.sim[0] < 150;
  await page.screenshot({ path: 'test-results/slicer-sticky/scrolled.png' });
  await browser.close();
} finally { server.kill(); }
console.log(ok ? 'ok' : 'FAILED'); process.exit(ok ? 0 : 1);
