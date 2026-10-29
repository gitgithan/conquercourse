// Times other shapes of the buildings question (CC-152): same places, same servers, only the query text changes.
// Usage: npx tsx scripts/osm-query-variants.ts [outdir=data/eval/cc-152-osm-speed/variants]   (needs the network; run on VM2)
// Each variant asks all servers at once, first good answer wins (like the game), 40 s limit; the answer's building ids are compared with the baseline.
import { mkdirSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { buildingsQuery, OVERPASS_MIRRORS, USER_AGENT } from '../src/world/places';

const out = process.argv[2] ?? 'data/eval/cc-152-osm-speed/variants';
mkdirSync(out, { recursive: true });
const PLACES = [
  { slug: 'midtown-new-york', lat: 40.758, lon: -73.9855, radius: 120 },
  { slug: 'midtown-new-york-300', lat: 40.758, lon: -73.9855, radius: 300 },
  { slug: 'copacabana-rio', lat: -22.9711, lon: -43.1822, radius: 120 },
  { slug: 'khan-el-khalili-cairo', lat: 30.0478, lon: 31.2625, radius: 120 },
  { slug: 'chinatown-singapore', lat: 1.2833, lon: 103.8443, radius: 120 },
  { slug: 'soho-london', lat: 51.5136, lon: -0.1318, radius: 120 },
  { slug: 'zocalo-mexico-city', lat: 19.4326, lon: -99.1332, radius: 120 },
];
type P = (typeof PLACES)[number];
const bbox = (p: P) => { const dLat = p.radius / 111320, dLon = p.radius / (111320 * Math.cos((p.lat * Math.PI) / 180)); return `${(p.lat - dLat).toFixed(6)},${(p.lon - dLon).toFixed(6)},${(p.lat + dLat).toFixed(6)},${(p.lon + dLon).toFixed(6)}`; };
const VARIANTS: Record<string, (p: P) => string> = {
  baseline: (p) => buildingsQuery(p.lat, p.lon, p.radius),
  'no-relations': (p) => `[out:json][timeout:25];way["building"](around:${p.radius},${p.lat},${p.lon});out geom tags;`,
  bbox: (p) => `[out:json][timeout:25];(way["building"](${bbox(p)});relation["building"](${bbox(p)}););out geom tags;`,
  'bbox-no-relations': (p) => `[out:json][timeout:25];way["building"](${bbox(p)});out geom tags;`,
  qt: (p) => `[out:json][timeout:25];(way["building"](around:${p.radius},${p.lat},${p.lon});relation["building"](around:${p.radius},${p.lat},${p.lon}););out geom tags qt;`,
  'bbox-qt-no-relations': (p) => `[out:json][timeout:25];way["building"](${bbox(p)});out geom tags qt;`,
  'bbox-no-meta': (p) => `[out:json][timeout:25][bbox:${bbox(p)}];way["building"];out geom;`, // geometry only, no tags
};

async function ask(url: string, query: string, ms: number, stop: AbortController) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': USER_AGENT }, body: 'data=' + encodeURIComponent(query), signal: AbortSignal.any([stop.signal, AbortSignal.timeout(ms)]) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { elements?: { type: string; id: number }[]; remark?: string };
    if (!Array.isArray(j.elements) || (j.remark && !j.elements.length)) throw new Error('empty or remark');
    return { host: new URL(url).host, ids: j.elements.map((e) => `${e.type}${e.id}`) };
  } catch (e) { throw new Error(`${new URL(url).host}: ${(e as Error).message}`); }
}
async function race(query: string) {
  const t = performance.now(), stop = new AbortController();
  try { const got = await Promise.any(OVERPASS_MIRRORS.map((u) => ask(u, query, 40000, stop))); stop.abort(); return { ms: Math.round(performance.now() - t), mirror: got.host, ids: got.ids }; }
  catch { stop.abort(); return { ms: Math.round(performance.now() - t), mirror: null, ids: [] as string[] }; }
}

const rows: unknown[] = [];
const base: Record<string, Set<string>> = {};
for (const p of PLACES) for (const [name, make] of Object.entries(VARIANTS)) {
  const r = await race(make(p));
  if (name === 'baseline') base[p.slug] = new Set(r.ids);
  const b = base[p.slug], same = b && b.size ? r.ids.filter((i) => b.has(i)).length : null;
  const row = { place: p.slug, variant: name, ms: r.ms, mirror: r.mirror, elements: r.ids.length, baselineElements: b?.size ?? 0, sharedWithBaseline: same };
  rows.push(row); console.log(JSON.stringify(row));
}
writeFileSync(`${out}/variants.json`, JSON.stringify(rows, null, 2) + '\n');
writeFileSync(`${out}/run.json`, JSON.stringify({ script: 'scripts/osm-query-variants.ts', date: new Date().toISOString(), host: hostname(), node: process.version, note: 'bbox is the square around the pin; relations are building outlines made of several ways' }, null, 2) + '\n');
console.log('saved', out);
