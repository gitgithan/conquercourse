// A place on the map becomes a course (CC-46): OpenStreetMap buildings (Overpass, no key) are extruded to a mesh, shrunk,
// and the best lane is cut with the slice search. Optional ground height from AWS Terrain Tiles (Terrarium, no account).
// Usage: npx tsx scripts/osm-lane.ts <place> <lat> <lon> [radius=120] [shrink=auto] [--terrain]
// Writes data/eval/cc-46-osm-world/<place>/{overpass.json,elevation.json,result.json}
// and public/assets/experiments/osm/<place>.{glb,course.json} (the glb only if under 1.5 MB).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { bestSlices, laneToCourse, surfaceSamples, type Mesh } from '../src/slice/slice';
import { centred } from '../src/slice/world';
import { sceneFor } from '../src/slice/scene';
import { searchIdealRun } from '../src/sim/ideal';
import { fetchGround, groundAt, relief as reliefOf, type Ground } from '../src/world/terrain';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const useTerrain = process.argv.includes('--terrain');
const [place, latS, lonS, radS = '120', shrinkS = 'auto'] = args;
if (!place || !latS || !lonS) { console.error('Usage: npx tsx scripts/osm-lane.ts <place> <lat> <lon> [radius] [shrink] [--terrain]'); process.exit(1); }
const lat = Number(latS), lon = Number(lonS), radius = Number(radS);
const UA = 'ConquerCourse-spike/0.1 (hackathon research; one query per place)';
const dir = `${process.env.OSM_EVAL_DIR ?? 'data/eval/cc-46-osm-world'}/${place}`;
mkdirSync(dir, { recursive: true });

// ---- 1. Overpass: one query per place, cached
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
interface OsmWay { type: 'way'; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }
interface OsmRel { type: 'relation'; tags?: Record<string, string>; members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[] }
async function overpass(): Promise<{ elements: (OsmWay | OsmRel)[] }> {
  const cache = `${dir}/overpass.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'));
  const q = `[out:json][timeout:40];(way["building"](around:${radius},${lat},${lon});relation["building"](around:${radius},${lat},${lon}););out geom tags;`;
  let wait = 5000;
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(60000) });
      if (r.ok) {
        const j = await r.json() as { elements: (OsmWay | OsmRel)[] };
        // keep the cache small: tags that matter only
        const keep = ['building', 'height', 'building:levels', 'min_height', 'name'];
        for (const e of j.elements) if (e.tags) e.tags = Object.fromEntries(Object.entries(e.tags).filter(([k]) => keep.includes(k)));
        writeFileSync(cache, JSON.stringify({ query: q, source: url, elements: j.elements }));
        return j;
      }
      console.log(`${url}: HTTP ${r.status}, waiting ${wait / 1000} s`);
    } catch (e) { console.log(`${url}: ${(e as Error).message}, waiting ${wait / 1000} s`); }
    await new Promise((r) => setTimeout(r, wait)); wait = Math.min(wait * 2, 60000);
  }
  throw new Error('Overpass did not answer');
}

// metres east (x) and south (z) of the centre
const mPerDegLat = 111320, mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
const toM = (p: { lat: number; lon: number }): [number, number] => [(p.lon - lon) * mPerDegLon, -(p.lat - lat) * mPerDegLat];

const num = (s?: string) => { const v = parseFloat((s ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
function heightOf(tags: Record<string, string> = {}): { h: number; real: boolean } {
  const h = num(tags.height); if (h !== null && h > 0) return { h, real: true };
  const l = num(tags['building:levels']); if (l !== null && l > 0) return { h: l * 3, real: true };
  return { h: 9, real: false };
}

// ---- 2. Terrain: Terrarium tiles (shared with the map mode in src/world/terrain.ts)
async function elevationGrid(step = 20): Promise<Ground | null> {
  const cache = `${dir}/elevation.json`;
  if (existsSync(cache)) return { radius, ...JSON.parse(readFileSync(cache, 'utf8')) } as Ground;
  const g = await fetchGround(lat, lon, radius, async (png) => { const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, channels: 3 }; }, { step });
  writeFileSync(cache, JSON.stringify({ step: g.step, n: g.n, h: g.h }));
  return g;
}

// ---- 3. Extrude: walls plus a flat roof, one vertex set per face so the picture has flat shading
const area2 = (p: [number, number][]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
function earClip(p: [number, number][]): number[][] { // returns triangles as index triples; polygon must be counter-clockwise in (x, z) as area2 > 0
  const idx = p.map((_, i) => i), tris: number[][] = [];
  const cross = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 5000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
      const a = p[ia], b = p[ib], c = p[ic];
      if (cross(a, b, c) <= 1e-9) continue;
      const inside = idx.some((i) => i !== ia && i !== ib && i !== ic && cross(a, b, p[i]) >= 0 && cross(b, c, p[i]) >= 0 && cross(c, a, p[i]) >= 0);
      if (inside) continue;
      tris.push([ia, ib, ic]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) { for (let k = 1; k + 1 < idx.length; k++) tris.push([idx[0], idx[k], idx[k + 1]]); return tris; } // degenerate: fan
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}
interface Building { ring: [number, number][]; h: number; real: boolean }

function buildMesh(bs: Building[], ground: Ground | null, k: number) {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]) => { const o = pos.length / 3; for (const v of [a, b, c, d]) { pos.push(...v); nor.push(...n); } idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  for (const b of bs) {
    let ring = b.ring.slice(); if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    if (ring.length < 3 || Math.abs(area2(ring)) < 4) continue;
    if (area2(ring) < 0) ring = ring.reverse(); // counter-clockwise in (x, z)
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const y0 = groundAt(ground, cx, cz) * k, y1 = y0 + b.h * k;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz) || 1;
      // the outward side of a counter-clockwise (x, z) ring is (dz, -dx)
      quad([a[0] * k, y0, a[1] * k], [a[0] * k, y1, a[1] * k], [c[0] * k, y1, c[1] * k], [c[0] * k, y0, c[1] * k], [dz / len, 0, -dx / len]);
    }
    const o = pos.length / 3;
    for (const p of ring) { pos.push(p[0] * k, y1, p[1] * k); nor.push(0, 1, 0); }
    for (const t of earClip(ring)) idx.push(o + t[0], o + t[2], o + t[1]); // wound so the roof faces up
  }
  return { pos, nor, idx };
}

function glb(m: { pos: number[]; nor: number[]; idx: number[] }): Buffer {
  const P = Buffer.alloc(m.pos.length * 4), N = Buffer.alloc(m.nor.length * 4), I = Buffer.alloc(m.idx.length * 4);
  m.pos.forEach((v, i) => P.writeFloatLE(Math.round(v * 100) / 100, i * 4)); m.nor.forEach((v, i) => N.writeFloatLE(Math.round(v * 100) / 100, i * 4)); m.idx.forEach((v, i) => I.writeUInt32LE(v, i * 4));
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.pos[i + k]); hi[k] = Math.max(hi[k], m.pos[i + k]); }
  const bin = Buffer.concat([P, N, I]);
  const json = JSON.stringify({ asset: { version: '2.0', generator: 'conquercourse scripts/osm-lane.ts' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: m.pos.length / 3, type: 'VEC3', min: lo, max: hi }, { bufferView: 1, componentType: 5126, count: m.nor.length / 3, type: 'VEC3' }, { bufferView: 2, componentType: 5125, count: m.idx.length, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: P.length }, { buffer: 0, byteOffset: P.length, byteLength: N.length }, { buffer: 0, byteOffset: P.length + N.length, byteLength: I.length }], buffers: [{ byteLength: bin.length }] });
  const jb = Buffer.from(json + ' '.repeat((4 - (json.length % 4)) % 4));
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jb.length + 8 + bin.length, 8);
  const ch = (len: number, type: number) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(jb.length, 0x4e4f534a), jb, ch(bin.length, 0x004e4942), bin]);
}

// ---- run
const t0 = Date.now();
const osm = await overpass();
const buildings: Building[] = [];
for (const e of osm.elements) {
  const { h, real } = heightOf(e.tags);
  if (e.type === 'way' && e.geometry) buildings.push({ ring: e.geometry.map(toM), h, real });
  else if (e.type === 'relation') for (const m of e.members ?? []) if (m.type === 'way' && m.role === 'outer' && m.geometry && m.geometry.length > 3) buildings.push({ ring: m.geometry.map(toM), h, real }); // holes (courtyards) are ignored
}
const ground = useTerrain ? await elevationGrid().catch((e) => { console.log('terrain skipped:', (e as Error).message); return null; }) : null;
const heights = buildings.map((b) => b.h).sort((a, b) => a - b);
const median = heights[Math.floor(heights.length / 2)] ?? 9;
const relief = reliefOf(ground);
// "auto": start with a typical building about 5 m, then shrink by 0.6 each time until the search finds a lane it can clear (at most 5 tries)
const ladder = shrinkS === 'auto' ? Array.from({ length: 5 }, (_, i) => Math.min(1, Math.max(0.02, 5 / median)) * 0.6 ** i) : [Number(shrinkS)];
const tries: { shrink: number; lanes: number }[] = [];
let shrink = ladder[0], mesh0 = buildMesh([], null, 1), piece: Mesh = { positions: [] }, samples = new Float32Array(0), cands: ReturnType<typeof bestSlices> = [], shrunkHeights: number[] = [];
for (const k of ladder) {
  shrink = k;
  const clamp = !process.argv.includes('--noclamp'); // CC-56 reassess: --noclamp lifts the script's own 8 m rule
  mesh0 = buildMesh(buildings.map((b) => ({ ...b, h: clamp ? Math.min(b.h, 8 / k) : b.h })), ground, k); // no building taller than 8 m once shrunk
  if (!mesh0.idx.length) break;
  piece = centred({ positions: mesh0.pos, indices: mesh0.idx });
  shrunkHeights = buildings.map((b) => (clamp ? Math.min(b.h, 8 / k) : b.h) * k);
  samples = surfaceSamples(piece, 80); // the search samples the surface itself, lighter than its default (a district is big)
  cands = bestSlices({ positions: samples }, { top: 3, centre: { x: 0, z: 0 } });
  tries.push({ shrink: Math.round(k * 1000) / 1000, lanes: cands.length });
  if (cands.length) break;
}
const triCount = mesh0.idx.length / 3;
let result: Record<string, unknown> = { place, lat, lon, radius, terrain: !!ground, terrainRelief_m: Math.round(relief * 10) / 10, buildings: buildings.length, withRealHeight: buildings.filter((b) => b.real).length, medianHeight_m: median, shrink: Math.round(shrink * 1000) / 1000, shrinkTries: tries, triangles: triCount };
if (!triCount) { writeFileSync(`${dir}/result.json`, JSON.stringify(result, null, 2) + '\n'); console.log(result); process.exit(0); }
const cleared = cands.length;
result = { ...result, shrunkHeightRange_m: [Math.round(Math.min(...shrunkHeights) * 10) / 10, Math.round(Math.max(...shrunkHeights) * 10) / 10], samples: samples.length / 3, lanesFound: cleared, secondsTaken: Math.round((Date.now() - t0) / 1000) };
if (!cands.length) { result.note = 'no lane the simulator could clear'; writeFileSync(`${dir}/result.json`, JSON.stringify(result, null, 2) + '\n'); console.log(result); process.exit(0); }
const best = cands[0];
// the proof, said again plainly for the report (bestSlices only returns lanes the search cleared)
const course = laneToCourse({ cells: [...best.profile.cells], length: best.profile.length, origin: best.profile.origin }, `OSM ${place}`);
result.bestLane = { turnDeg: Math.round((best.angle * 180) / Math.PI), sidewaysM: Math.round(best.offset * 10) / 10, levelM: Math.round(best.level * 100) / 100, ...best.report, searchIdealRunCleared: searchIdealRun(course).cleared };
result.candidates = cands.map((c) => ({ turnDeg: Math.round((c.angle * 180) / Math.PI), sidewaysM: Math.round(c.offset * 10) / 10, score: c.report.score }));

// ---- 4. save the mesh (if small) and the course
const out = process.env.OSM_OUT_DIR ?? 'public/assets/experiments/osm';
mkdirSync(out, { recursive: true });
// the centred mesh keeps the per-face normals: re-centre the same way (x, z middle; lowest point y = 0)
let ox = 0, oz = 0, oy = Infinity, xs = [Infinity, -Infinity], zs = [Infinity, -Infinity];
for (let i = 0; i < mesh0.pos.length; i += 3) { xs = [Math.min(xs[0], mesh0.pos[i]), Math.max(xs[1], mesh0.pos[i])]; zs = [Math.min(zs[0], mesh0.pos[i + 2]), Math.max(zs[1], mesh0.pos[i + 2])]; oy = Math.min(oy, mesh0.pos[i + 1]); }
ox = (xs[0] + xs[1]) / 2; oz = (zs[0] + zs[1]) / 2;
const bytes = glb({ pos: mesh0.pos.map((v, i) => v - [ox, oy, oz][i % 3]), nor: mesh0.nor, idx: mesh0.idx });
const url = `/assets/experiments/osm/${place}.glb`;
result.glbBytes = bytes.length;
if (bytes.length <= 1.5e6) {
  writeFileSync(`${out}/${place}.glb`, bytes);
  const scene = sceneFor([{ id: 1, name: place, mesh: piece, x: 0, z: 0, y: 0, yaw: 0, scale: 1 }], best, course.uMap!);
  for (const it of scene) { delete it.mesh; it.url = url; }
  course.scene = scene;
} else result.sceneSkipped = 'mesh over 1.5 MB';
writeFileSync(`${out}/${place}.course.json`, JSON.stringify(course, null, 2) + '\n');
writeFileSync(`${dir}/result.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
