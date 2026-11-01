// Shot 6 (the jump nobody sees land): the lache course, the matrix orbit camera, slow motion, a hard cut to black at the release.
// usage: node shot6.mjs <playwright> <outdir> <spec.json>
// spec: {url, zeroX (the film clock starts when the runner passes this x, m), seconds (film length), probe (log the runner every 100 ms), shots: [secs...] (screenshots at these film times)}
import { readFileSync, mkdirSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: out, size: { width: 1920, height: 1080 } } });
const p = await ctx.newPage(); const t0 = Date.now();
p.on('pageerror', (e) => console.error('pageerror', e.message));
await p.goto(spec.url);
await p.waitForSelector('html[data-ready=true]', { timeout: 120000 }).catch(() => console.error('not ready'));
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important}' });
await p.evaluate(() => document.querySelectorAll('button').forEach((x) => { if (/^(Feedback|Sound)/.test(x.textContent.trim())) x.style.display = 'none'; }));
await p.waitForFunction('window.__filmRunner', null, { timeout: 90000 }).catch(() => console.error('no runner'));
const log = [];
const zeroX = spec.zeroX ?? -1e9; let T = null, start = null;
mkdirSync(out + '/shots', { recursive: true });
const shots = (spec.shots || []).slice();
for (;;) {
  const r = await p.evaluate(() => ({ ...window.__filmRunner, f: performance.now() }));
  if (T === null && r.x >= zeroX) { await p.evaluate(() => window.__filmZero?.()); T = Date.now(); start = T - t0; }
  const el = T === null ? -1 : (Date.now() - T) / 1000;
  if (spec.probe || T !== null) log.push([+el.toFixed(2), +r.x.toFixed(2), +r.y.toFixed(2)]);
  if (shots.length && el >= shots[0]) { await p.screenshot({ path: `${out}/shots/s${String(shots.shift())}.png` }).catch(() => {}); }
  if (el >= spec.seconds) break;
  if (Date.now() - t0 > 100000 && T === null) { console.error('never reached zeroX'); break; }
  await p.waitForTimeout(80);
}
console.error(JSON.stringify(log.filter((_, i) => i % 3 === 0)));
console.log(JSON.stringify({ start: start ?? 0, end: Date.now() - t0 }));
await ctx.close(); await b.close();
