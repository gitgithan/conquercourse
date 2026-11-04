// CC-133 check: in the World Slicer, a click on a street-photo dot at the DEFAULT 72 degree tilt opens the photo panel (with credit and licence).
// Usage: PORT=5461 node scripts/check-photo-dot-click.mjs [outDir]   (a Vite dev server must already run on PORT; needs the local Mapillary key)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const port = process.env.PORT ?? '5461', out = process.argv[2] ?? 'docs/evidence/cc-133-photo-dot-click';
const PREVIEW = ''; // empty: the local dev server answers /api/photos itself (its Mapillary key is read from the owner's private env file)
mkdirSync(out, { recursive: true });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const W = 1920, H = 1020;
const base = `http://localhost:${port}`;

async function open(browser, slug) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
  await page.route(/overpass|maps\.mail\.ru/, (r) => r.abort());
  if (PREVIEW) await page.route('**/api/photos**', async (r) => { try { const u = new URL(r.request().url()); const res = await fetch(PREVIEW + u.pathname + u.search); r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); } catch { r.fulfill({ status: 503, body: '{}' }); } });
  await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
  const place = slug ? JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8')) : null;
  await page.goto(`${base}/?mode=map${place ? `&lat=${place.lat}&lon=${place.lon}&z=16` : ''}&hooks=1`);
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 120000 }).catch(() => {});
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
  return page;
}

async function slice(browser, slug) {
  const page = await open(browser, slug);
  const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('#slice:not([disabled])', { timeout: 120000 });
  await page.click('#slice');
  await page.waitForFunction(() => document.documentElement.dataset.sliceLane, null, { timeout: 120000 });
  await page.waitForFunction(() => document.documentElement.dataset.flightDone === '1', null, { timeout: 120000 }); // the camera has finished tilting
  await page.waitForFunction(() => document.documentElement.dataset.sliceLane !== 'working', null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return page;
}


const browser = await chromium.launch({ args: flags });
let ok = false;
try {
  const p = await slice(browser, 'shibuya-tokyo');
  const pitch = await p.evaluate(async () => { const m = window.__ccMap.map; m.jumpTo({ pitch: 72 }); await new Promise((r) => setTimeout(r, 2500)); return m.getPitch(); });
  const cv = await p.evaluate(() => { const c = window.__ccMap.map.getCanvas().getBoundingClientRect(); return { l: c.left, t: c.top }; });
  const dots = await p.evaluate(() => { const m = window.__ccMap.map, seen = new Set(); return m.querySourceFeatures('pd-dot').filter((f) => !seen.has(f.properties.id) && seen.add(f.properties.id)).map((f) => { const q = m.project(f.geometry.coordinates); return { x: q.x, y: q.y }; }); });
  const d = dots.map((q) => ({ x: Math.round(cv.l + q.x), y: Math.round(cv.t + q.y) })).filter((q) => q.x > 60 && q.x < 1350 && q.y > 100 && q.y < 960).sort((a, b) => Math.hypot(a.x - 700, a.y - 500) - Math.hypot(b.x - 700, b.y - 500))[Number(process.env.DOT_INDEX ?? 0)];
  console.log('pitch', pitch, 'dots', dots.length, 'click', JSON.stringify(d));
  if (d) {
    await p.mouse.move(d.x, d.y, { steps: 4 }); await p.mouse.down(); await p.mouse.up();
    ok = await p.waitForSelector('#photodotpanel img', { timeout: 60000 }).then(() => true).catch(() => false);
    const txt = await p.evaluate(() => document.querySelector('#photodotpanel')?.textContent ?? '');
    ok = ok && /Photo by/.test(txt) && /CC BY/.test(txt);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/slicer-photo-dot-click-72.png` });
  }
  console.log(ok && pitch >= 70 ? 'PASS: photo opened at 72 degrees' : 'FAIL');
} finally { await browser.close(); }
process.exit(ok ? 0 : 1);
