// Shot 11 (CC-143): the group photo, captured frame by frame on the stepped clock (the page's own window.__groupAt(t)), so ten rigs on a slow renderer cannot make it choppy.
// usage: node group.mjs <playwright> <outdir> <spec.json>   spec: {url, fps, seconds}
import { readFileSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
p.on('pageerror', (e) => console.error('pageerror', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text().slice(0, 200)); });
await p.goto(spec.url);
await p.waitForSelector('html[data-ready=true]', { timeout: 240000 }).catch(() => console.error('not ready'));
const n = Math.round(spec.seconds * spec.fps);
for (let i = 0; i < n; i++) {
  await p.evaluate((t) => window.__groupAt(t), i / spec.fps);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.screenshot({ path: `${out}/${String(i + 1).padStart(4, '0')}.png` });
}
console.log(JSON.stringify({ frames: n }));
await b.close();
