// Shot 4, part 2 (CC-143): Rookie A runs the real park-run course on the stepped clock (the railing is the one from the lift), credit on the end frames.
// usage: node shot4-run.mjs <playwright> <out-dir> <spec.json>   spec: {url, fromX, frames, fps, creditFrom, credit}
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const [pw, out, specFile] = process.argv.slice(2);
const s = JSON.parse(readFileSync(specFile, 'utf8'));
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: s.width ?? 1920, height: s.height ?? 1080 } });
p.on('pageerror', (e) => console.error('pageerror', e.message));
await p.addInitScript('(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();');
await p.goto(s.url);
await p.waitForSelector('html[data-ready=true]', { timeout: 180000 });
const step = (ms) => p.evaluate((ms) => { window.__stepClock(ms); return new Promise((r) => requestAnimationFrame(r)); }, ms);
const ms = 1000 / s.fps;
const sm = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const [rf, rt, rr] = s.ramp ?? [0, 0, 1]; // slow motion between output seconds rf and rt at rate rr, eased 0.25 s each way; every frame is still captured
const rate = (sec) => 1 + (rr - 1) * sm((sec - rf) / 0.25) * sm((rt - sec) / 0.25);
for (let k = 0; k < 40 * s.fps; k++) { if (await p.evaluate((x) => (window.__filmRunner?.x ?? -1e9) >= x, s.fromX)) break; await step(ms); }
await p.evaluate(() => window.__filmZero?.());
mkdirSync(out, { recursive: true });
const two = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
for (let i = 0; i < s.frames; i++) {
  if (i === s.creditFrom) await p.evaluate((txt) => { const d = document.createElement('div'); d.id = 'credit'; d.textContent = txt; d.style.cssText = 'position:fixed;left:0;right:0;bottom:36px;text-align:center;color:#fff;font:600 30px system-ui,sans-serif;text-shadow:0 2px 8px #000,0 0 3px #000;z-index:99999'; document.body.appendChild(d); }, s.credit);
  await two();
  await p.screenshot({ path: join(out, `r${String(i).padStart(5, '0')}.png`), timeout: 180000 });
  if (i % 10 === 0) console.log(i, JSON.stringify(await p.evaluate(() => window.__filmRunner)));
  await step(ms * rate(i / s.fps));
}
await b.close(); console.log('run frames', s.frames);
