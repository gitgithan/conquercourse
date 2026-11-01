// Shot 4, part 1 (CC-143): the photo-to-3D lift, one frame per step of a pure function of time (shot4-lift.html), every frame captured.
// The stand-in is made from real saved files: the CC-38 photo of the iron railing, its box, the box crop (the cut-out) and the baked railing-iron.glb.
// usage: node shot4-lift.mjs <playwright> <stage-dir> <out-dir> <from-frame> <to-frame> [fps=30]
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
const [pw, stage, out, f0, f1, fpsArg] = process.argv.slice(2);
const fps = Number(fpsArg ?? 30);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const srv = createServer((q, r) => { try { const f = join(stage, q.url === '/' ? 'index.html' : q.url.split('?')[0]); r.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f)); } catch { r.writeHead(404); r.end(); } }).listen(0);
const port = srv.address().port;
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.error('pageerror', e.message)); p.on('console', (m) => m.type() === 'error' && console.error('console', m.text()));
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction('window.__ready === true', null, { timeout: 120000 });
mkdirSync(out, { recursive: true });
for (let i = Number(f0); i < Number(f1); i++) {
  await p.evaluate((t) => window.__t(t), i / fps);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.screenshot({ path: join(out, `l${String(i).padStart(5, '0')}.png`) });
}
await b.close(); srv.close(); console.log('lift frames', f0, f1);
