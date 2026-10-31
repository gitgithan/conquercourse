// World Slicer beats for film A on the stepped clock (the map page, real tiles and real buttons).
// Usage: node scripts/film-a-map.mjs --part open|slice [--slug montmartre-paris] [--out films-a] [--fps 30] [--base URL] [--width 1280 --height 720] [--globe 1]
// The map only moves when the script steps the clock; after each step the script waits until the tiles it needs have arrived, so a slow network or a slow GPU makes the capture longer and never choppier.
import { Shot, arg } from './film-lib.mjs';
import { writeFileSync } from 'node:fs';

const part = arg('part', 'open'), slug = arg('slug', 'montmartre-paris'), out = arg('out', 'films-a'), fps = Number(arg('fps', 30)), base = arg('base', 'http://localhost:5173');
const shot = new Shot({ name: arg('name', `map-${part}`), outDir: out, fps, width: Number(arg('width', 1280)), height: Number(arg('height', 720)) });
const page = await shot.open(`${base}/?mode=map&hooks=1&places=all&welcome=0`, { cursor: true, noTransitions: false });
shot.sub = 1;
const ease = (u) => u * u * (3 - 2 * u);
// trapezoid speed: ramp up over r of the time, run at constant speed, ramp down over r (position 0..1)
const flow = (u, r) => { const k = 1 / (1 - r); return u < r ? (k * u * u) / (2 * r) : u > 1 - r ? 1 - (k * (1 - u) * (1 - u)) / (2 * r) : k * (u - r / 2); };
// run clock steps until the map says its tiles are in (real time passes while the network works; the stepped clock does not)
async function settle(maxMs = 20000) {
  const t0 = Date.now();
  for (;;) {
    await page.evaluate(() => { window.__stepClock(16); window.__tick(); });
    await shot.twoFrames();
    const ok = await page.evaluate(() => { const m = window.__ccMap?.map; return !m || m.areTilesLoaded(); });
    if (ok || Date.now() - t0 > maxMs) { if (Date.now() - t0 > 2500) shot.log(`settle ${ok ? 'ok' : 'TIMEOUT'} after ${Date.now() - t0} ms`); return ok; }
    await page.waitForTimeout(150);
  }
}
async function until(fn, arg0, stepMs = 100, maxS = 120) { // step the clock in small pieces until a page condition holds
  const t0 = Date.now();
  while (Date.now() - t0 < maxS * 1000) {
    if (await page.evaluate(fn, arg0)) return true;
    await shot.step(stepMs); await shot.twoFrames(); await page.waitForTimeout(60);
  }
  return false;
}
// every picture must come from a map that has really drawn the new camera: count the map's own draws and step until one lands after the move
async function drawCount() { return page.evaluate(() => { const m = window.__ccMap?.map; if (!m) return 0; if (window.__draws === undefined) { window.__draws = 0; m.on('render', () => { window.__draws++; }); } return window.__draws; }); }
async function frames(n, perFrame) { // one picture per frame, the clock stepped one picture's worth, tiles settled
  for (let i = 0; i < n; i++) {
    const d0 = await drawCount();
    if (perFrame) await perFrame(i, n);
    await shot.step(shot.stepMs); await settle();
    for (let k = 0; k < 60 && (await drawCount()) <= d0; k++) { await page.evaluate(() => { window.__ccMap.map.triggerRepaint(); window.__stepClock(4); window.__tick(); }); await shot.twoFrames(); if (k > 5) await page.waitForTimeout(100); }
    await shot.grab({ expectMotion: false });
  }
}
await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 120000 });
await until(() => document.documentElement.dataset.mapready === 'true', null, 100, 120);
await page.waitForSelector('#ready .card', { timeout: 90000 });
shot.log('ready; slugs ' + (await page.$$eval('#ready button[data-slug]', (b) => b.slice(0, 60).map((x) => x.dataset.slug + (x.offsetParent ? '' : '(hidden)')).join(','))).slice(0, 400));
await page.evaluate(() => { const d = document.querySelector('#ready'); if (d) d.open = true; });
const secs = (s) => Math.round(s * fps);
if (part === 'open') {
  // the whole Earth as a globe, then down to the street with the real buildings (filming-only: the app's own map is flat; the globe is a MapLibre setting)
  await page.click(`button[data-slug="${slug}"]`);
  await until(() => !!document.documentElement.dataset.pin, null, 100, 60);
  await settle(60000);
  const target = await page.evaluate(() => { const m = window.__ccMap.map; const c = m.getCenter(); return { lng: c.lng, lat: c.lat, zoom: m.getZoom(), pitch: m.getPitch(), bearing: m.getBearing() }; });
  shot.log('target ' + JSON.stringify(target));
  // the picture is just the map: the side panel and the Feedback button are hidden, the map takes the whole window
  await page.evaluate(() => {
    const st = document.createElement('style'); st.textContent = '.mp{grid-template-columns:1fr !important}.mp .side{display:none !important}#film-cursor{display:none !important}';
    document.head.appendChild(st);
    document.querySelectorAll('body *').forEach((e) => { if (/^\s*Feedback\s*$/.test(e.textContent || '') && e.children.length === 0) e.style.display = 'none'; });
    window.__ccMap.map.resize();
  });
  await page.evaluate(() => { const m = window.__ccMap.map; try { m.setProjection({ type: 'globe' }); } catch (e) { console.warn(e); } });
  await page.evaluate((t) => { window.__ccMap.map.jumpTo({ center: [t.lng - 40, 25], zoom: 1.1, pitch: 0, bearing: 0 }); }, target);
  await settle(60000);
  const dur = Number(arg('dur', 7)); // seconds of film
  const n = secs(dur);
  await page.evaluate(([t, n2]) => { window.__path = { t, n2 }; }, [target, n]);
  await frames(n, async (i) => {
    const u = flow((i + 1) / n, 0.18); // a constant-speed move with short eased ends, so no stretch of frames stands still
    await page.evaluate(([t, u2]) => {
      const m = window.__ccMap.map;
      // zoom runs on a constant ratio (log space), the point it looks at slides from the open globe to the street, the tilt arrives last
      const p = Math.min(1, u2 * 4), z = 1.1 + (t.zoom - 1.1) * u2, lng = (t.lng - 40) + 40 * p, lat = 25 + (t.lat - 25) * p; // the view settles over the street early, so the zoom dives onto it
      m.jumpTo({ center: [lng, lat], zoom: z, pitch: t.pitch * Math.max(0, (u2 - 0.5) * 2), bearing: t.bearing * u2 });
    }, [target, u]);
  });
}
if (part === 'slice') {
  const btn = `button[data-slug="${slug}"]`;
  await page.evaluate(() => document.querySelectorAll('body *').forEach((e) => { if (/^\s*Feedback\s*$/.test(e.textContent || '') && e.children.length === 0) e.style.display = 'none'; }));
  await page.click(btn);
  await until(() => !!document.documentElement.dataset.pin, null, 100, 60);
  await settle(60000);
  // the pin lands: hold for a beat so the street map reads
  await frames(secs(1.2));
  const glide = async (x, y, n) => { const a = shot.pointer ?? [x, y]; await frames(n, async (i) => { const u = ease((i + 1) / n); await page.mouse.move(a[0] + (x - a[0]) * u, a[1] + (y - a[1]) * u); }); shot.pointer = [x, y]; };
  // the radius slider: grab it at its value and drag it bigger
  const rb = await page.locator('#radius').boundingBox();
  const y = rb.y + rb.height / 2, at = (v) => rb.x + (rb.width * (v - 80)) / 170;
  const v0 = Number(await page.$eval('#radius', (e) => e.value));
  await glide(at(v0), y, secs(0.8));
  await page.mouse.down();
  await glide(at(Math.min(230, v0 + 70)), y, secs(1.2));
  await page.mouse.up();
  await frames(secs(0.4));
  shot.mark('radius set');
  // Slice: the buildings rise out of the flat map (the real flight)
  const sb = await page.locator('#slice').boundingBox();
  await glide(sb.x + sb.width / 2, sb.y + sb.height / 2, secs(0.8));
  await page.click('#slice');
  shot.mark('slice clicked');
  const flightSecs = Number(arg('flight', 7));
  for (let i = 0; i < secs(flightSecs); i++) { await frames(1); if (i % 15 === 0 && await page.evaluate(() => document.documentElement.dataset.flightDone === '1')) break; }
  if (!(await page.evaluate(() => document.documentElement.dataset.flightDone === '1'))) { await page.click('#flightskip').catch(() => {}); }
  await until(() => document.documentElement.dataset.flightDone === '1', null, 100, 120);
  shot.mark('flight done');
  await frames(secs(1.0));
  // deselect two buildings with real clicks
  const mapBox = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
  const pts = await page.evaluate(() => {
    const m = window.__ccMap, map = m.map, picked = new Set([...m.picked()].map(Number));
    const c = map.getCanvas(), w = c.clientWidth, h = c.clientHeight, chosen = [];
    for (let y = Math.floor(h * 0.45); y < h * 0.9; y += 25) for (let x = Math.floor(w * 0.15); x < w * 0.85; x += 25) {
      let fs = []; try { fs = map.queryRenderedFeatures([x, y], { layers: ['sl-below', 'sl-face', 'sl-above', 'sl-out'] }); } catch { continue; }
      for (const f of fs) { const i = Number(f.properties?.i); if (Number.isFinite(i) && picked.has(i) && !chosen.some((p) => p.i === i || Math.hypot(p.x - x, p.y - y) < 110)) { chosen.push({ x, y, i }); break; } }
      if (chosen.length >= 6) break;
    }
    return chosen;
  });
  const before = await page.evaluate(() => window.__ccMap.picked().length);
  for (const p of pts.slice(0, 3)) {
    await glide(mapBox.x + p.x, mapBox.y + p.y, secs(0.7));
    await page.mouse.click(mapBox.x + p.x, mapBox.y + p.y);
    await frames(secs(0.5));
    if (before - (await page.evaluate(() => window.__ccMap.picked().length)) >= 2) break;
  }
  shot.mark(`deselected ${before} -> ${await page.evaluate(() => window.__ccMap.picked().length)}`);
  // the lane search runs on a worker in real time; the clock waits
  await until(() => ['clearable', 'not-clearable', 'none'].includes(document.documentElement.dataset.sliceLane), null, 100, 300);
  await until(() => document.documentElement.dataset.sliceStripDone === '1', null, 100, 600);
  shot.mark('lane found');
  const strip = JSON.parse(await page.evaluate(() => document.documentElement.dataset.sliceStrip || '[]'));
  const green = strip.find(([, st]) => st === 'ok');
  // the horizontal cut: drag the cut slider to a green height
  const cb = await page.locator('#cut').boundingBox();
  if (green && cb) {
    const mn = Number(await page.$eval('#cut', (e) => e.min)), mx = Number(await page.$eval('#cut', (e) => e.max)), cv = Number(await page.$eval('#cut', (e) => e.value));
    const cx = (v) => cb.x + (cb.width * (v - mn)) / (mx - mn), cy = cb.y + cb.height / 2;
    await glide(cx(cv), cy, secs(0.8));
    await page.mouse.down(); await glide(cx(green[0]), cy, secs(1.4)); await page.mouse.up();
    await frames(secs(1.0));
  }
  shot.mark('cut set');
  const tb = await page.locator('#tilt').boundingBox().catch(() => null);
  if (tb) {
    const mn = Number(await page.$eval('#tilt', (e) => e.min)), mx = Number(await page.$eval('#tilt', (e) => e.max)), tv = Number(await page.$eval('#tilt', (e) => e.value));
    const tx = (v) => tb.x + (tb.width * (v - mn)) / (mx - mn), ty = tb.y + tb.height / 2;
    await glide(tx(tv), ty, secs(0.6)); await page.mouse.down(); await glide(tx(Math.min(mx, 80)), ty, secs(1.4)); await page.mouse.up();
    await frames(secs(1.2));
  }
  shot.mark('tilted');
}
await shot.close();
writeFileSync(`${out}/${shot.name}/path.json`, JSON.stringify({ part }) + '\n');
process.exit(0);
