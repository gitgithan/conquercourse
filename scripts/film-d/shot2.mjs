// Shot 2 "A path is searched and found" (CC-143): the real World Slicer map after Slice, camera at 45 degrees with a slow push.
// Thin tried lines grow from the lane start (film overlay, GFX), dead ends fade, and the real proved lane (the slicer's own lane layer) glows.
// usage: node shot2.mjs <playwright> <outdir> <spec.json>
import { readFileSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8')); const T = spec.t;
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: out, size: { width: 1920, height: 1080 } } });
const p = await ctx.newPage(); const t0 = Date.now();
p.on('pageerror', (e) => console.error('pageerror', e.message));
await p.goto(spec.url);
await p.waitForSelector('html[data-mapready=true]', { timeout: 120000 }).catch(() => console.error('map not ready'));
await p.waitForFunction('window.__ccMap', null, { timeout: 60000 }).catch(() => console.error('no hooks'));
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important} .maplibregl-ctrl-top-left,.maplibregl-ctrl-top-right{display:none!important}' });
await p.evaluate(() => document.querySelectorAll('button').forEach((x) => { if (/^(Feedback|Sound)/.test(x.textContent.trim())) x.style.display = 'none'; }));
const C = spec.center;
await p.addStyleTag({ content: '[class*=toast],.stepnote{display:none!important}' });
if (spec.place) { await p.locator(`text=${spec.place}`).first().click({ timeout: 8000 }).catch((e) => console.error('place', e.message.split('\n')[0])); await p.waitForTimeout(2500); await p.click('#slice').catch((e) => console.error('slice', e.message.split('\n')[0])); }
else { await p.evaluate(({ C, z }) => window.__ccMap.map.jumpTo({ center: C, zoom: z, pitch: 0, bearing: 0 }), { C, z: spec.zoom0 }); await p.waitForTimeout(6000);
  const box = await p.evaluate(() => { const r = document.querySelector('canvas.maplibregl-canvas').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.mouse.move(box[0], box[1], { steps: 8 }); await p.mouse.click(box[0], box[1]); await p.waitForTimeout(1500); await p.click('#slice').catch((e) => console.error('slice', e.message.split('\n')[0])); }
let caught = null; for (let i = 0; i < 180 && !caught; i++) { const r = await p.evaluate(() => { const st = document.documentElement.dataset.sliceLane; if (st !== 'clearable') return { st }; const sd = window.__ccMap.map.getSource('sl-lane')?.serialize?.().data; const c = sd?.geometry?.coordinates ?? sd?.features?.[0]?.geometry?.coordinates; return { st, pts: c ?? null }; }); if (i % 20 === 0) console.error('state', i, r.st); if (r.st === 'clearable' && r.pts?.length) caught = r.pts; else await p.waitForTimeout(500); }
console.error('caught lane', caught?.length);
await p.click('text=Skip the flight', { timeout: 3000 }).catch(() => {}); await p.click('text=Got it', { timeout: 2000 }).catch(() => {});
// the real proved lane, from the slicer's own layer
console.error('hooks', await p.evaluate(() => typeof window.__ccMap), await p.evaluate(() => location.href));
const lane = caught ? { n: 1, pts: caught, dt: 'caught' } : await p.evaluate(() => { { const sr = window.__ccMap.map.getSource('sl-lane'); const sd = sr?.serialize?.().data; const c = sd?.geometry?.coordinates ?? sd?.features?.[0]?.geometry?.coordinates; if (c?.length) return { n: 1, pts: c, dt: 'serialize' }; } const m = window.__ccMap.map; const f = m.querySourceFeatures('sl-lane'); const g = f.map((x) => x.geometry); const pts = []; for (const x of g) { if (x.type === 'LineString') pts.push(...x.coordinates); else if (x.type === 'MultiLineString') x.coordinates.forEach((c) => pts.push(...c)); } const s = m.getSource('sl-lane'); const d = s?._data ?? s?._options?.data; return { n: f.length, pts: d?.geometry?.coordinates ?? pts, dt: typeof d }; });
console.error('lane probe', lane.n, lane.pts?.length, lane.dt);
console.error('lane points', lane?.length);
await p.evaluate(({ pitch, z }) => { const m = window.__ccMap.map; m.jumpTo({ pitch, zoom: z }); document.querySelector('#slicer')?.scrollIntoView({ block: 'start' }); }, { pitch: 0, z: spec.zoom0 });
await p.waitForTimeout(1500);
// prepare overlay: tried lines = wander from the lane start; the proved lane is the real one
const setup = await p.evaluate(({ lane, seeds }) => {
  const m = window.__ccMap.map; let L = lane ?? []; if (L.length === 2) { const q = []; for (let i = 0; i <= 40; i++) q.push([L[0][0] + (L[1][0] - L[0][0]) * i / 40, L[0][1] + (L[1][1] - L[0][1]) * i / 40]); L = q; }
  if (!L.length) return 'nolane';
  for (const id of ['sl-lane', 'sl-lane-dash']) m.setLayoutProperty(id, 'visibility', 'none');
  const a = L[0], z = L[L.length - 1]; const dx = z[0] - a[0], dy = z[1] - a[1]; const len = Math.hypot(dx, dy) || 1e-4;
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const tries = seeds.map((ang, i) => { const n = 26, pts = [a]; let h = Math.atan2(dy, dx) + ang; const step = len / 22; let [x, y] = a; const stop = 8 + Math.floor(rnd() * 12);
    for (let k = 0; k < n && k < stop + 4; k++) { h += (rnd() - 0.5) * 0.7; x += Math.cos(h) * step; y += Math.sin(h) * step * 1; pts.push([x, y]); } return { pts, stop }; });
  window.__tries = tries; window.__laneFull = L;
  m.addSource('film-try', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  m.addSource('film-win', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  m.addLayer({ id: 'film-try', type: 'line', source: 'film-try', paint: { 'line-color': '#e8622c', 'line-width': 2.5, 'line-opacity': ['get', 'op'] } });
  m.addLayer({ id: 'film-glow', type: 'line', source: 'film-win', paint: { 'line-color': '#7ff0d4', 'line-width': 22, 'line-blur': 14, 'line-opacity': ['get', 'g'] } });
  m.addLayer({ id: 'film-win', type: 'line', source: 'film-win', paint: { 'line-color': '#0f6b5c', 'line-width': 6 } });
  return 'ok';
}, { lane: lane.pts, seeds: spec.seeds });
console.error('setup', setup);
const start = spec.debug ? 0 : Date.now() - t0; const S = Date.now();
await p.evaluate(({ T, pitch, z0, z1, C, secs }) => new Promise((res) => {
  const m = window.__ccMap.map, s0 = performance.now(); const e = (x) => x * x * (3 - 2 * x); const clamp = (v) => Math.max(0, Math.min(1, v));
  const f = () => { const t = (performance.now() - s0) / 1000, u = clamp(t / secs);
    m.jumpTo({ pitch: pitch * e(clamp(t / 1.2)), zoom: z0 + (z1 - z0) * u });
    // tried lines grow until each stops, then fade
    const feats = window.__tries.map((r, i) => { const grow = clamp((t - T.tries - i * 0.12) / T.growSecs); const k = Math.max(2, Math.round(grow * r.pts.length)); const fade = clamp((t - T.fade - i * 0.1) / 0.9); return { type: 'Feature', properties: { op: grow > 0 ? 0.95 * (1 - fade) : 0 }, geometry: { type: 'LineString', coordinates: r.pts.slice(0, k) } }; });
    m.getSource('film-try').setData({ type: 'FeatureCollection', features: feats });
    const wg = clamp((t - T.win) / 1.1); const L = window.__laneFull; const k = Math.max(2, Math.round(wg * L.length));
    const pulse = 0.55 + 0.35 * Math.sin((t - T.win) * 5);
    m.getSource('film-win').setData({ type: 'FeatureCollection', features: wg > 0 ? [{ type: 'Feature', properties: { g: pulse * wg }, geometry: { type: 'LineString', coordinates: L.slice(0, k) } }] : [] });
    t < secs ? requestAnimationFrame(f) : res(); }; f(); }), { T, pitch: spec.pitch, z0: spec.zoom0, z1: spec.zoom1, C, secs: spec.seconds });
const end = Date.now() - t0; console.log(JSON.stringify({ start, end }));
await ctx.close(); await b.close();
