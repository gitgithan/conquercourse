// Stepped-clock recorder (frame-exact, true game speed). usage: node stepped.mjs <playwright> <outdir> <spec.json>
// spec: {url, skip (game s stepped without pictures), frames, fps, probe (game s to log runner state every 0.1 s, no pictures), keys:[{f (frame, negative = during skip, in s), key|down|up}]}
import { readFileSync, mkdirSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8')); const fps = spec.fps ?? 30;
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)));
await p.addInitScript(`(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`);
await p.goto(spec.url);
await p.waitForSelector('html[data-ready=true]', { timeout: 120000 }).catch(() => console.log('not ready'));
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important}' });
await p.waitForFunction(spec.waitFor || 'window.__filmRunner', null, { timeout: 90000 }).catch(() => console.log('no runner'));
const step = (ms) => p.evaluate((m) => { window.__stepClock(m); return new Promise((r) => requestAnimationFrame(r)); }, ms);
const keys = (spec.keys || []).slice();
const doKeys = async (tNow) => { for (const k of keys) { if (!k.done && tNow >= k.t) { k.done = true; if (k.key) await p.keyboard.press(k.key); if (k.down) await p.keyboard.down(k.down); if (k.up) await p.keyboard.up(k.up); } } };
await mkdirSync(out, { recursive: true });
const total = (spec.probe ?? spec.skip ?? 0);
const n = Math.round(total * fps);
for (let k = 0; k < n; k++) {
  await doKeys(k / fps); await step(1000 / fps);
  if (spec.probe && k % 3 === 0) console.log((k / fps).toFixed(1), JSON.stringify(await p.evaluate(() => ({ r: window.__filmRunner, m: document.documentElement.dataset.mode, h: (document.querySelector('#hint, .hint')?.textContent || '').slice(0, 60) }))));
}
if (!spec.probe) {
  await p.evaluate(() => window.__filmZero?.());
  const base = spec.skip ?? 0;
  for (let i = 0; i < spec.frames; i++) {
    await doKeys(base + i / fps);
    if (spec.perFrame) await p.evaluate(`((i, n) => { ${spec.perFrame} })(${i}, ${spec.frames})`);
    if (spec.settle) await p.waitForTimeout(spec.settle);
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await p.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92, timeout: 180000 });
    await p.evaluate((ms) => window.__stepClock(ms), 1000 / fps);
  }
}
await b.close();
