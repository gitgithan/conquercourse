// diagnosis: records a page, logs console/page errors with timestamps and screenshots every 0.5 s (so a black picture can be tied to a time and a message)
import { readFileSync, mkdirSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage(); const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(1);
p.on('pageerror', (e) => console.log(ts(), 'pageerror', e.message.slice(0, 300)));
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(ts(), m.type(), m.text().slice(0, 300)); });
await p.goto(spec.url);
await p.waitForSelector('html[data-ready=true]', { timeout: 120000 }).catch(() => console.log('not ready'));
await p.waitForFunction('window.__filmRunner', null, { timeout: 90000 }).catch(() => console.log('no runner'));
await p.waitForTimeout(2000); await p.evaluate(() => window.__filmZero?.());
mkdirSync(out, { recursive: true }); const T = Date.now();
for (let i = 0; i < spec.seconds * 2; i++) {
  await p.screenshot({ path: `${out}/f${String(i).padStart(3, '0')}.png`, clip: { x: 0, y: 0, width: 960, height: 540 } });
  const info = await p.evaluate(() => JSON.stringify({ r: window.__filmRunner, mode: document.documentElement.dataset.mode }));
  console.log(((Date.now() - T) / 1000).toFixed(1), info);
  const w = 500 - ((Date.now() - T) % 500); await p.waitForTimeout(w);
}
await b.close();
