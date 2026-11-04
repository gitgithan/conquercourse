// CC-133: the four pictures for the README "World Slicer" screen, each saved as its own 1920 x 1020 picture in README_MEDIA/.
//   tile 1: the ready-places gallery, scrolled to the top (street places)
//   tile 2: the gallery scrolled down to the "Parkour parks: Europe" and "Parkour parks: Asia" cards
//   tile 3: a slice of Shibuya (buildings out), camera tilt finished, default zoom, one street photo dot clicked so its photo shows top right
//   tile 4: a slice of the Gerlev parkour park, the side panel scrolled to the bottom to show "Send to the World Editor"
// Usage: PORT=5461 node scripts/readme-shot-slicer.mjs [tile1|tile2|tile3|tile4|all] [outDir]   (a Vite dev server must already run on PORT)
// DOT_INDEX=n picks another photo dot (nearest the middle first); CLICK_PITCH is the tilt used for the click (see tile 3).
// To add a screen, append to TILES below (name, file, run). One browser at a time.
// Big pictures (over 600 KB) are turned into webp afterwards by scripts/readme-media-shrink.py.
// Street photos: the local dev server answers /api/photos with the owner's key (PHOTO_API=<site> forwards it to a site instead, GET only, nothing stored).
// The picture is Mapillary's own blurred version, shown live; only the screenshot of it is kept. DOT_INDEX=n picks another dot if the first shows a close-up person.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const port = process.env.PORT ?? '5461', which = process.argv[2] ?? 'all', out = process.argv[3] ?? 'README_MEDIA';
const PREVIEW = process.env.PHOTO_API ?? ''; // empty: the local dev server answers /api/photos itself (its Mapillary key is read from the owner's private env file)
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

async function gallery(browser) {
  const page = await open(browser, null);
  await page.waitForSelector('#ready-gallery-btn', { timeout: 60000 });
  await page.click('#ready-gallery-btn');
  await page.waitForSelector('#ready-gallery .gal button.card', { timeout: 30000 });
  await page.waitForTimeout(2500); // thumbnails
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

const TILES = {
  tile1: { file: 'slicer-1-gallery-top', run: async (b) => { const p = await gallery(b); await p.evaluate(() => { document.querySelector('#ready-gallery .gal').scrollTop = 0; }); await p.waitForTimeout(500); return p; } },
  tile2: { file: 'slicer-2-gallery-parkour-parks', run: async (b) => {
    const p = await gallery(b);
    await p.evaluate(() => { const g = document.querySelector('#ready-gallery .gal'); const hs = [...g.querySelectorAll('.gh')]; const eu = hs.find((h) => /Parkour parks: Europe/.test(h.textContent)); g.scrollTop = eu.offsetTop - g.offsetTop - 8; });
    await p.waitForTimeout(2500); return p;
  } },
  tile3: { file: 'slicer-3-shibuya-street-photo', run: async (b) => {
    const p = await slice(b, 'shibuya-tokyo');
    // The map cannot hit-test a photo dot at its full tilt (72 degrees), so: tilt back to 60, click a dot, then tilt to the default again; the photo panel stays open.
    // (A finding, not a fake: the same click does nothing at 72 degrees in the game.) Dots are read from the map's own data, never invented.
    const dots = async (pitch) => p.evaluate(async (pt) => {
      const m = window.__ccMap.map; m.jumpTo({ pitch: pt }); await new Promise((r) => setTimeout(r, 2500));
      const cv = m.getCanvas().getBoundingClientRect(), seen = new Set();
      return m.querySourceFeatures('pd-dot').filter((f) => !seen.has(f.properties.id) && seen.add(f.properties.id)).map((f) => { const q = m.project(f.geometry.coordinates); return { x: Math.round(cv.left + q.x), y: Math.round(cv.top + q.y), id: f.properties.id }; }).filter((d) => d.x > 60 && d.x < 1350 && d.y > 100 && d.y < 960);
    }, pitch);
    const found = await dots(Number(process.env.CLICK_PITCH ?? 60));
    console.log('dots', JSON.stringify(found));
    if (!found.length) { console.log('NO PHOTO DOT FOUND'); return p; }
    const d = found.sort((a, b) => Math.hypot(a.x - 700, a.y - 500) - Math.hypot(b.x - 700, b.y - 500))[Number(process.env.DOT_INDEX ?? 0)] ?? found[0];
    await p.mouse.move(d.x - 10, d.y - 10); await p.mouse.move(d.x, d.y, { steps: 4 }); await p.waitForTimeout(300);
    await p.mouse.down(); await p.mouse.up();
    await p.waitForSelector('#photodotpanel img', { timeout: 60000 }).then(() => console.log('photo shown')).catch(async () => console.log('NO PHOTO SHOWN, panel says: ' + (await p.evaluate(() => document.querySelector('#photodotpanel')?.textContent ?? '(none)'))));
    await p.waitForFunction(() => { const i = document.querySelector('#photodotpanel img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 }).catch(() => {});
    await p.evaluate(async () => { window.__ccMap.map.jumpTo({ pitch: 72 }); await new Promise((r) => setTimeout(r, 2500)); });
    await p.waitForTimeout(1500); return p;
  } },
  tile4: { file: 'slicer-4-gerlev-send-to-editor', run: async (b) => {
    const p = await slice(b, 'gerlev-parkour-park');
    await p.evaluate(() => { const s = document.querySelector('.mp .side'); s.scrollTop = s.scrollHeight; });
    await p.waitForTimeout(800); return p;
  } },
};

const browser = await chromium.launch({ args: flags });
try {
  for (const [name, t] of Object.entries(TILES)) {
    if (which !== 'all' && which !== name) continue;
    const page = await t.run(browser);
    await page.screenshot({ path: `${out}/${t.file}.png` });
    console.log(name, 'saved', `${out}/${t.file}.png`);
    await page.context().close();
  }
} finally { await browser.close(); }
