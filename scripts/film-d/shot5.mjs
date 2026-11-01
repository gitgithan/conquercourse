// Shot 5 part B (CC-143): chase the ghost in the real Course. The runner starts a moment after the ghost, jumps by the game's own tick count,
// then the debug view comes on (B) and the camera cycles (C) to the first-person view.
// usage: node shot5.mjs <playwright> <outdir> <spec.json>   spec: {url, lead, seconds, startAt, jumpTicks:[...], lag, keys:[{t,key}]}
import { readFileSync } from 'node:fs';
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
const tick = () => p.evaluate(() => Number(document.documentElement.dataset.tick || 0));
await p.waitForTimeout((spec.lead || 2) * 1000);
console.error('tick before start', await tick());
const start = Date.now() - t0; const T = Date.now(); const el = () => (Date.now() - T) / 1000;
const log = [];
// keys on the clock
const timed = (async () => { for (const k of [...spec.keys].sort((a, b) => a.t - b.t)) { const w = k.t * 1000 - (Date.now() - T); if (w > 0) await p.waitForTimeout(w); if (k.down) await p.keyboard.down(k.down); else if (k.up) await p.keyboard.up(k.up); else await p.keyboard.press(k.key); log.push([+el().toFixed(2), k.key || k.down || k.up, await tick()]); } })();
// jumps by the game's tick count since the run key went down
let base = null; const jumps = [...spec.jumpTicks];
while (el() < spec.seconds) {
  const tk = await tick();
  if (base === null && log.some((l) => l[1] === 'ArrowRight')) base = log.find((l) => l[1] === 'ArrowRight')[2];
  if (base !== null && jumps.length && tk - base >= jumps[0] + (spec.lags ? (spec.lags[spec.jumpTicks.length - jumps.length] ?? 0) : (spec.lag || 0))) { jumps.shift(); await p.keyboard.press('Space'); log.push([+el().toFixed(2), 'Space', tk]); }
  await p.waitForTimeout(8);
}
await timed;
const end = Date.now() - t0; console.log(JSON.stringify({ start, end, log, outcome: await p.evaluate(() => document.documentElement.dataset.outcome) }));
await ctx.close(); await b.close();
