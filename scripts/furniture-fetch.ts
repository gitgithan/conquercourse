// Fetch the street objects (Mapillary map_features) for the stored OSM courses and keep a small file per place (CC-187).
// Usage (on a machine with the token in ~/.config/ninja/mapillary.env, never printed): npx tsx scripts/furniture-fetch.ts [slug ...]
// Needs data/eval/cc-furniture/frames.json (scripts/furniture-frame.ts). Writes public/assets/places/furniture/<slug>.json.
// It goes through the same code as the /api/features Pages Function, so what is cached here is what the live function would answer.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { lookupFeatures, WANTED, type Feature } from '../functions/api/features';
import { toXY } from '../src/world/live-photos';
import { groundAt, type Ground } from '../src/world/terrain';

const envFile = `${homedir()}/.config/ninja/mapillary.env`;
const line = existsSync(envFile) ? readFileSync(envFile, 'utf8').split('\n').find((l) => l.startsWith('MAPILLARY_TOKEN=')) : undefined;
if (!line) { console.error('no token file'); process.exit(1); }
const token = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
const frames = JSON.parse(readFileSync('data/eval/cc-furniture/frames.json', 'utf8')) as Record<string, { lat: number; lon: number; reachM: number[]; hasHills: boolean; k: number; ox: number; oz: number; oy: number; rot: number; tx: number; ty: number; tz: number; scale: number; startX: number; finishX: number }>;
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(frames);
mkdirSync('public/assets/places/furniture', { recursive: true });
const mem = new Map<string, string>();
for (const slug of slugs) {
  const f = frames[slug]; if (!f) { console.error('no frame for', slug); continue; }
  const [x0, x1, z0, z1] = f.reachM, r = Math.min(300, Math.ceil(Math.hypot(Math.max(Math.abs(x0), Math.abs(x1)), Math.max(Math.abs(z0), Math.abs(z1)))) + 10);
  const res = await lookupFeatures(new URLSearchParams({ lat: String(f.lat), lon: String(f.lon), r: String(r) }), 'offline', token, { get: async (k) => mem.get(k) ?? null, put: async (k, v) => void mem.set(k, v) }, (u, i) => fetch(u, i) as never);
  if (res.status !== 200) { console.error(slug, 'failed', res.status); continue; }
  const all = (res.body as { features: Feature[] }).features;
  const kept = all.map((a) => ({ a, p: toXY(f.lat, f.lon, a.lat, a.lon) })).filter(({ p }) => p.x >= x0 - 5 && p.x <= x1 + 5 && p.y >= z0 - 5 && p.y <= z1 + 5);
  const dir = `data/eval/cc-46-osm-world/${slug}`, ground: Ground | null = f.hasHills ? ({ radius: 120, ...JSON.parse(readFileSync(`${dir}/elevation.json`, 'utf8')) } as Ground) : null; // the same ground the mesh was built on
  const counts: Record<string, number> = {};
  for (const { a } of kept) counts[WANTED[a.value]] = (counts[WANTED[a.value]] ?? 0) + 1;
  const file = {
    place: slug, generated: new Date().toISOString().slice(0, 10), source: 'Mapillary map_features (object detections, not photos)', licence: 'CC BY-SA 4.0', credit: 'Street objects: Mapillary contributors, CC BY-SA 4.0',
    pin: { lat: f.lat, lon: f.lon }, unit: 'x, z: metres east and south of the pin; h: ground height there in real metres',
    frame: { k: f.k, ox: f.ox, oz: f.oz, oy: f.oy, rot: f.rot, tx: f.tx, ty: f.ty, tz: f.tz, scale: f.scale, startX: f.startX, finishX: f.finishX },
    features: kept.map(({ a, p }) => ({ id: a.id, kind: WANTED[a.value], value: a.value.replace(/^object--|^marking--discrete--/, ''), x: Math.round(p.x * 10) / 10, z: Math.round(p.y * 10) / 10, h: Math.round(groundAt(ground, p.x, p.y) * 10) / 10, seen: a.seen })).sort((u, v) => (u.id < v.id ? -1 : 1)),
  };
  writeFileSync(`public/assets/places/furniture/${slug}.json`, JSON.stringify(file, null, 2) + '\n');
  console.log(slug, `asked r=${r} m`, `answer ${all.length} wanted, kept ${kept.length} inside the buildings' box`, JSON.stringify(counts));
}
