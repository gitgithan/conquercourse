// Promo v2 photo-lift stage: real saved files of the demo photo (people blurred), boxes, cut-outs, lifted 3D objects, a bench turntable.
// usage: node lift.mjs <playwright> <lifts-dir> <three-dir> <out-dir> [from-frame to-frame]
// ROW=1 (scene 2c): the lifted objects in a row, each on its own turntable, one full turn in 3 s (lift-stage.html?row=1).
// <lifts-dir> = ../conquercourse-assets/eval-full/demo-lifts/lifts (p1_* folders: mask.png, mesh.glb, lift_input.jpg = the blurred photo)
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSession } from './lib.mjs';
const [pw, lifts, three, out, f0, f1] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const map = (u) => {
  if (u.startsWith('/three/')) return join(three, u.slice(7));
  if (u === '/photo.jpg') return join(lifts, 'p1_bench_left/lift_input.jpg');
  let m = u.match(/^\/(p1_[a-z_]+)\.glb$/); if (m) return join(lifts, m[1], 'mesh.glb');
  m = u.match(/^\/(p1_[a-z_]+)-mask\.png$/); if (m) return join(lifts, m[1], 'mask.png');
  return join(here, u === '/' ? 'lift-stage.html' : u.slice(1));
};
const srv = createServer((q, r) => { let f = ''; try { f = map(q.url.split('?')[0]); const b = readFileSync(f); r.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); r.end(b); } catch { console.log('404', q.url, f); r.writeHead(404); r.end(); } }).listen(0);
const S = await openSession({ url: `http://localhost:${srv.address().port}/${process.env.ROW ? '?row=1' : ''}`, out, pw, clock: false, w: 1920, h: 1080, dsf: 1 });
S.p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await S.p.waitForFunction('window.__ready === true', null, { timeout: 120000 });
const dur = await S.p.evaluate(() => window.__dur);
const a = Number(f0 ?? 0), b = Number(f1 ?? Math.round(dur * 30));
for (let i = a; i < b; i++) { await S.p.evaluate((t) => window.__t(t), i / 30); await S.p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); S.n = i; await S.shot(); }
S.n = b; await S.finish(process.env.ROW ? { stage: 'lift-stage.html?row=1', clip: '2c', turns: 1, marks: { start: 0, end: dur } } : { stage: 'lift-stage.html', marks: { photo: 0, boxes: 1.0, masks: 4.6, cutouts: 6.0, models: 8.4, turntable: 12.4, end: dur } }); srv.close();
