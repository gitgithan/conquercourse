// Usage: node scripts/bake-fork-objects.mjs [liftsDir]   (needs @gltf-transform/core: `npm i --no-save @gltf-transform/core`)
// Bakes the three real lifted objects of demo photo 1 (CC-133) to the sizes the fork course needs, and writes the three GLBs and public/assets/demo/fork-objects/fork-real.json (the factors).
//   Every vertex is still the lifted one: the bake only stretches it (a different factor per axis) and drops the two end posts of the bulb string, and the picture is shrunk to 512 px.
//   bench: the lifted bench (p1_bench_left) is 1.77 m wide; the course wants a 2.4 m top, so the seat, slats and back grow by the same factor on every axis (the bench stays in proportion);
//          the legs below the seat are stretched much longer, because in the course the benches stand in a pit and their legs reach the pit floor, 3 m down.
//   pole: the lifted pole is 4.0 m tall (a guess of the lift); the bar row hangs at 4.3 m, so the whole pole grows by the same factor on every axis.
//   bulbs: the lifted string is 8 m between its posts; the bar row is 14 m long, so the string is stretched along the run (x) and a little in height (y); the posts are cut off because the real pole already stands at the left end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
let core, sharp;
try { core = await import('@gltf-transform/core'); } catch { console.error('Install it first: npm i --no-save @gltf-transform/core'); process.exit(1); }
try { sharp = (await import('sharp')).default; } catch { sharp = null; }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lifts = process.argv[2] ?? resolve(root, '../conquercourse-assets/eval-full/demo-lifts/lifts');
const out = resolve(root, 'public/assets/demo/fork-objects');
const SEAT = { legTop: 0.36, seatTop: 0.43 }; // read off the lifted bench: legs end at 0.36 m, the seat slab tops at 0.43 m (the 0.04 m height histogram of its vertices)
const spec = { benchTop: 0.45, benchWidth: 2.4, pitDepth: 3, barY: 4.3, bulbsX0: 10.4, bulbsX1: 24.4, bulbsYStretch: 1.3, postCut: 4.0 };
const io = new core.NodeIO();
const bounds = (pos) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], v = [0, 0, 0]; for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } } return { lo, hi }; };
const warp = (doc, f) => { // f maps [x,y,z] to [x,y,z]; afterwards the lowest point is moved to y = 0 and the middle to x = z = 0 (the game loader does the same)
  const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION'), v = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); pos.setElement(i, f(v)); }
  const b = bounds(pos);
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); pos.setElement(i, [v[0] - (b.lo[0] + b.hi[0]) / 2, v[1] - b.lo[1], v[2] - (b.lo[2] + b.hi[2]) / 2]); }
  return { shiftY: -b.lo[1] };
};
const dropWhere = (doc, keep) => { // removes triangles whose centre fails keep(x,y,z)
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0], pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), a = idx.getArray(), kept = [], p = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let t = 0; t < a.length; t += 3) { for (let k = 0; k < 3; k++) pos.getElement(a[t + k], p[k]); if (keep((p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3)) kept.push(a[t], a[t + 1], a[t + 2]); }
  idx.setArray(new a.constructor(kept));
};
const shrinkPicture = async (doc) => { if (!sharp) return; for (const t of doc.getRoot().listTextures()) t.setImage(new Uint8Array(await sharp(Buffer.from(t.getImage())).resize(512, 512).jpeg({ quality: 82 }).toBuffer())); };
const factors = {};
// bench
{
  const doc = await io.read(`${lifts}/p1_bench_left/mesh.glb`), W = bounds(doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION'));
  const s = spec.benchWidth / (W.hi[0] - W.lo[0]), legK = (spec.pitDepth + spec.benchTop - (SEAT.seatTop - SEAT.legTop) * s) / SEAT.legTop;
  const seatY = spec.benchTop - (SEAT.seatTop - SEAT.legTop) * s; // where the legs end after the stretch
  const r = warp(doc, ([x, y, z]) => [x * s, y < SEAT.legTop ? seatY - (SEAT.legTop - y) * legK : seatY + (y - SEAT.legTop) * s, z * s]);
  await shrinkPicture(doc); await io.write(`${out}/fork-bench.glb`, doc);
  factors.bench = { lift: 'p1_bench_left', xzAndSeatScale: +s.toFixed(4), legStretch: +legK.toFixed(3), baseShiftY: +r.shiftY.toFixed(4), itemY: +(-(spec.pitDepth)).toFixed(4), note: 'item y puts the legs\' feet 3 m below the bench top height; the seat top lands at 0.45 m' };
}
// pole
{
  const doc = await io.read(`${lifts}/p1_pole/mesh.glb`), W = bounds(doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION'));
  const s = spec.barY / (W.hi[1] - W.lo[1]);
  warp(doc, ([x, y, z]) => [x * s, y * s, z * s]);
  await shrinkPicture(doc); await io.write(`${out}/fork-pole.glb`, doc);
  factors.pole = { lift: 'p1_pole', uniformScale: +s.toFixed(4), itemY: 0 };
}
// bulbs
{
  const doc = await io.read(`${lifts}/p1_light_bulbs/mesh.glb`);
  dropWhere(doc, (x) => Math.abs(x) < spec.postCut);
  const sx = (spec.bulbsX1 - spec.bulbsX0) / (2 * spec.postCut), sy = spec.bulbsYStretch;
  const r = warp(doc, ([x, y, z]) => [x * sx, y * sy, z * sy]);
  // the string's ends hang at about 0.78 m in the lift (the posts' cable height); the item stands so those ends sit at the bar height
  const endY = 0.78 * sy + r.shiftY;
  await shrinkPicture(doc); await io.write(`${out}/fork-bulbs.glb`, doc);
  factors.bulbs = { lift: 'p1_light_bulbs', xStretch: +sx.toFixed(4), yzScale: sy, postsCut: true, itemX: (spec.bulbsX0 + spec.bulbsX1) / 2, itemY: +(spec.barY - endY).toFixed(4) };
}
factors.spec = spec;
writeFileSync(`${out}/fork-real.json`, JSON.stringify(factors, null, 2) + '\n');
console.log(JSON.stringify(factors, null, 2));
