// Browser check for the photo dots on the slicer map (CC-133), at 1280 px: dots and cones appear, hide when zoomed out, a click opens the photo live with credit and licence.
// /api/photos is answered from a small file of picture addresses (THUMBS=path, made from Mapillary just before the run); the picture itself is loaded live from Mapillary's own address.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173', out = process.env.OUT ?? 'test-results/cc-133-photo-dots';
const thumbs = JSON.parse(readFileSync(process.env.THUMBS, 'utf8')); // {photos:[{id,thumb,creator,capturedAt,compass,lat,lon}]}
const STAND_IN = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==', 'base64');
const ID = process.env.PHOTO ?? '145481884262053';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const checks = {}, notes = [];
mkdirSync(out, { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  const open = async (q) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage();
    page.on('pageerror', (e) => notes.push('PAGEERROR ' + e.message.slice(0, 200)));
    await page.route(/overpass/, (r) => r.abort());
    await page.route(/thumbs\.example\.test/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: STAND_IN })); // a plain grey picture stands in for Mapillary's host when no token is at hand
    await page.route('**/api/photos*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: thumbs.photos, cache: 'miss' }) }));
    await page.goto(`http://localhost:${port}/?mode=map&hooks=1${q}`);
    await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => notes.push('map style slow'));
    return { ctx, page };
  };
  const dots = (page) => page.evaluate(() => document.querySelector('.maplibregl-map')?.dataset.photodots ?? 'none');
  {
    const { ctx, page } = await open('&lat=55.9490&lon=-3.1890&z=17&photodots=1');
    await page.waitForFunction(() => Number(document.querySelector('.maplibregl-map')?.dataset.photodots) > 0, null, { timeout: 30000 });
    checks.dotsDrawn = Number(await dots(page)) > 0; notes.push(`dots in view set: ${await dots(page)}`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${out}/1-dots-and-cones.png` });
    // click the dot of the chosen photo
    const at = await page.evaluate((id) => { const m = window.__ccMap.map, p = m.querySourceFeatures('pd-dot').find((f) => f.properties.id === id); const r = m.getCanvas().getBoundingClientRect(), q = m.project(p.geometry.coordinates); return { x: r.x + q.x, y: r.y + q.y }; }, ID);
    await page.mouse.click(at.x, at.y);
    await page.waitForSelector('#photodotpanel img', { timeout: 20000 });
    await page.waitForFunction(() => { const i = document.querySelector('#photodotpanel img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 }).catch(() => notes.push('photo did not load'));
    const txt = await page.textContent('#photodotpanel');
    checks.photoOpens = await page.$eval('#photodotpanel img', (i) => i.naturalWidth > 0);
    checks.creditAndLicence = /Photo by pbb/.test(txt) && /CC BY-SA 4\.0/.test(txt) && /on Mapillary/.test(txt);
    checks.noPinDropped = !(await page.evaluate(() => document.documentElement.dataset.pin));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/2-photo-opened.png` });
    // zoomed out: dots hide
    await page.evaluate(() => window.__ccMap.map.setZoom(13)); await page.waitForTimeout(1500);
    checks.hiddenWhenFar = (await dots(page)) === '0';
    await ctx.close();
  }
  {
    const { ctx, page } = await open('&lat=55.9490&lon=-3.1890&z=17&photodots=0');
    await page.waitForTimeout(3000);
    checks.switchOff = (await page.evaluate(() => !window.__ccMap.map.getSource('pd-dot'))) && (await dots(page)) === 'none';
    await ctx.close();
  }
  await browser.close();
} catch (e) { notes.push('FAIL ' + String(e).slice(0, 300)); checks.error = true; }
finally { server.kill(); }
writeFileSync(`${out}/result.json`, JSON.stringify({ checks, notes }, null, 2));
console.log(JSON.stringify({ checks, notes }, null, 2));
process.exit(Object.values(checks).every((v) => v === true) ? 0 : 1);
