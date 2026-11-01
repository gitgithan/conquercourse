// Shot 1 as ONE continuous take (CC-143): the Earth zooms to a street in the real World Slicer map, the slicer panel shows,
// the buildings extrude, the camera tilts down toward the ground, the photo strip shows, the OSM credit stays on screen.
// usage: node shot1.mjs <playwright> <outdir> <spec.json>   spec: {url, globe:{secs}, t:{...}, tiltTo, seconds}
import { readFileSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const T = spec.t;
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: out, size: { width: 1920, height: 1080 } } });
const p = await ctx.newPage(); const t0 = Date.now();
p.on('pageerror', (e) => console.error('pageerror', e.message));
await p.goto(spec.url);
await p.waitForSelector('html[data-mapready=true]', { timeout: 120000 }).catch(() => console.error('map not ready'));
await p.waitForFunction('window.__ccMap', null, { timeout: 60000 }).catch(() => console.error('no hooks'));
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important} .maplibregl-ctrl-top-left,.maplibregl-ctrl-top-right{display:none!important} body.globe .side,body.globe aside{visibility:hidden!important}' });
await p.evaluate(() => document.querySelectorAll('button').forEach((x) => { if (/^(Feedback|Sound)/.test(x.textContent.trim())) x.style.display = 'none'; }));
// the side panel is hidden while the Earth is on screen; the globe fills the page
await p.evaluate(() => { document.body.classList.add('globe'); const m = window.__ccMap.map; m.setProjection({ type: 'globe' }); });
const cam = (u, z0 = 0.9, z1 = 15) => p.evaluate(({ u, z0, z1 }) => { const m = window.__ccMap.map; const e = (x) => x * x * (3 - 2 * x); m.jumpTo({ center: [2.1649, 41.3917], zoom: z0 + (z1 - z0) * e(u), pitch: 0, bearing: 0 }); }, { u, z0, z1 });
// silent warm-up so the tiles are loaded
for (let u = 0; u <= 1.001; u += 0.05) { await cam(u); await p.waitForTimeout(450); }
await cam(0); await p.waitForTimeout(1500);
const start = Date.now() - t0; const S = Date.now();
const at = async (s) => { const w = s * 1000 - (Date.now() - S); if (w > 0) await p.waitForTimeout(w); };
// 1. Earth zoom: real time, eased, to street level
await p.evaluate(({ ms }) => new Promise((res) => { const m = window.__ccMap.map, s0 = performance.now(), e = (x) => x * x * (3 - 2 * x); const f = () => { const u = Math.min(1, (performance.now() - s0) / ms); m.jumpTo({ center: [2.1649, 41.3917], zoom: 0.9 + 14.1 * e(u), pitch: 0, bearing: 0 }); u < 1 ? requestAnimationFrame(f) : res(); }; f(); }), { ms: T.zoomEnd * 1000 });
// 2. the slicer panel appears, the pin drops (photo strip), then Slice
await p.evaluate(() => { const m = window.__ccMap.map; document.body.classList.remove('globe'); m.setProjection({ type: 'mercator' }); m.resize(); });
await at(T.pin); const box = await p.evaluate(() => { const r = document.querySelector('canvas.maplibregl-canvas').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await p.mouse.move(box[0], box[1], { steps: 12 }); await p.mouse.click(box[0], box[1]);
await at(T.slice); await p.click('#slice').catch((e) => console.error('slice', e.message.split('\n')[0]));
await p.waitForFunction("document.documentElement.dataset.sliceLane", null, { timeout: 60000 }).catch(() => console.error('no lane'));
await at(T.slice + 3); await p.evaluate(() => { document.querySelector('#slicer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
// 3. tilt from straight down toward the ground, easing in on the blocks
await at(T.tilt);
await p.evaluate(({ ms, to, z }) => { const m = window.__ccMap.map; m.easeTo({ pitch: to, zoom: z, duration: ms, easing: (x) => x * x * (3 - 2 * x) }); }, { ms: T.tiltMs, to: spec.tiltTo, z: spec.tiltZoom });
// 4. show the photo strip while the camera holds low
await at(T.photos); await p.evaluate(() => { document.querySelector('#mapphotos')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
await at(spec.seconds);
const end = Date.now() - t0; console.log(JSON.stringify({ start, end, pitch: await p.evaluate(() => window.__ccMap.map.getPitch()) }));
await ctx.close(); await b.close();
