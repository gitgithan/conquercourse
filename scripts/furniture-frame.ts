// Where each stored OSM course sits in the real world (CC-187): the exact move from "metres east and south of the pin" to the game's frame.
// scripts/osm-lane.ts shrank the buildings by k, centred them on the middle of their footprint and dropped the lowest base to 0, then placed that mesh with one scene item.
// This repeats the same steps from the saved map answer, checks them against the stored mesh's size, and writes the numbers the game needs:
//   game x = tx + cos(rot)*(east*k - ox) + sin(rot)*(south*k - oz);  game z = tz - sin(rot)*(east*k - ox) + cos(rot)*(south*k - oz)   (three.js turns about y this way)
//   game height = ty + ground*k - oy
// reachM: the real-world box the buildings cover (east min, east max, south min, south max), so only objects inside it are kept
// Usage: npx tsx scripts/furniture-frame.ts   -> data/eval/cc-furniture/frames.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { groundAt, type Ground } from '../src/world/terrain';

const SLUGS = ['montmartre-paris', 'eixample-barcelona', 'circular-quay-sydney', 'san-francisco-lombard'];
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const area2 = (p: [number, number][]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
const out: Record<string, unknown> = {};
for (const slug of SLUGS) {
  const dir = `data/eval/cc-46-osm-world/${slug}`;
  const r = json(`${dir}/result.json`), osm = json(`${dir}/overpass.json`), course = json(`public/assets/experiments/osm/${slug}.course.json`);
  const k: number = r.shrink, lat: number = r.lat, lon: number = r.lon, radius: number = r.radius;
  const ground: Ground | null = existsSync(`${dir}/elevation.json`) && r.terrain ? ({ radius, ...json(`${dir}/elevation.json`) } as Ground) : null;
  const mLat = 111320, mLon = mLat * Math.cos((lat * Math.PI) / 180);
  const toM = (p: { lat: number; lon: number }): [number, number] => [(p.lon - lon) * mLon, -(p.lat - lat) * mLat];
  const rings: [number, number][][] = [];
  for (const e of osm.elements) {
    if (e.type === 'way' && e.geometry) rings.push(e.geometry.map(toM));
    else if (e.type === 'relation') for (const m of e.members ?? []) if (m.type === 'way' && m.role === 'outer' && m.geometry && m.geometry.length > 3) rings.push(m.geometry.map(toM));
  }
  let xs = [Infinity, -Infinity], zs = [Infinity, -Infinity], oy = Infinity;
  for (let ring of rings) {
    ring = ring.slice(); if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    if (ring.length < 3 || Math.abs(area2(ring)) < 4) continue;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    oy = Math.min(oy, groundAt(ground, cx, cz) * k);
    for (const p of ring) { xs = [Math.min(xs[0], p[0] * k), Math.max(xs[1], p[0] * k)]; zs = [Math.min(zs[0], p[1] * k), Math.max(zs[1], p[1] * k)]; }
  }
  const ox = (xs[0] + xs[1]) / 2, oz = (zs[0] + zs[1]) / 2, it = course.scene[0];
  // check against the stored mesh: half the footprint must match the file's own bounds
  const b = readFileSync(`public/assets/experiments/osm/${slug}.glb`), n = b.readUInt32LE(12), acc = JSON.parse(b.subarray(20, 20 + n).toString()).accessors[0];
  const halfX = (xs[1] - xs[0]) / 2, halfZ = (zs[1] - zs[0]) / 2, err = Math.max(Math.abs(halfX - acc.max[0]), Math.abs(halfZ - acc.max[2]));
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4;
  console.log(slug, 'k', k, 'ox,oz,oy', rnd(ox), rnd(oz), rnd(oy), 'half', rnd(halfX), rnd(halfZ), 'glb', acc.max[0], acc.max[2], 'err', rnd(err));
  out[slug] = { lat, lon, k, ox: rnd(ox), oz: rnd(oz), oy: rnd(oy), rot: it.rotY, tx: it.x, ty: it.y, tz: it.z, scale: it.scale, startX: course.startX, finishX: course.finishX, footprintErrM: rnd(err), reachM: [rnd(xs[0] / k), rnd(xs[1] / k), rnd(zs[0] / k), rnd(zs[1] / k)], hasHills: !!ground };
}
mkdirSync('data/eval/cc-furniture', { recursive: true });
writeFileSync('data/eval/cc-furniture/frames.json', JSON.stringify(out, null, 2) + '\n');
