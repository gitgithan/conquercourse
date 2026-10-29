// Times every stage of a pin (CC-152): ask the map servers, read the ground, build the mesh, find the lane.
// Usage: npx tsx scripts/osm-speed.ts [outdir=data/eval/cc-152-osm-speed]   (needs the network; run on VM2)
// Writes <outdir>/places.json (one record per place) and run.json (machine, date, what was timed).
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import sharp from 'sharp';
import { buildingsQuery, OVERPASS_MIRRORS, trimAnswer, USER_AGENT } from '../src/world/places';
import { buildingsFrom, osmToMesh, type OverpassAnswer } from '../src/world/osm';
import { laneForPlace } from '../src/world/place-lane';
import { askMirrors } from '../src/world/places';
import { fetchGround, relief, terrainUrl, TERRAIN_ZOOM, tileXY } from '../src/world/terrain';

const out = process.argv[2] ?? 'data/eval/cc-152-osm-speed';
mkdirSync(out, { recursive: true });

// places that are not ready places, so a pin there is a real new pin
const PLACES = [
  { slug: 'midtown-new-york', lat: 40.758, lon: -73.9855, radius: 120 },
  { slug: 'midtown-new-york-300', lat: 40.758, lon: -73.9855, radius: 300 },
  { slug: 'copacabana-rio', lat: -22.9711, lon: -43.1822, radius: 120 },
  { slug: 'khan-el-khalili-cairo', lat: 30.0478, lon: 31.2625, radius: 120 },
  { slug: 'chinatown-singapore', lat: 1.2833, lon: 103.8443, radius: 120 },
  { slug: 'soho-london', lat: 51.5136, lon: -0.1318, radius: 120 },
  { slug: 'zocalo-mexico-city', lat: 19.4326, lon: -99.1332, radius: 120 },
];

const decode = async (png: ArrayBuffer) => { const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, channels: 3 }; };
const time = async <T>(f: () => Promise<T> | T): Promise<{ v: T; ms: number }> => { const t = performance.now(); const v = await f(); return { v, ms: Math.round(performance.now() - t) }; };

// one mirror alone, so we see which are slow and which refuse
async function oneMirror(url: string, lat: number, lon: number, radius: number) {
  const t = performance.now();
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': USER_AGENT }, body: 'data=' + encodeURIComponent(buildingsQuery(lat, lon, radius)), signal: AbortSignal.timeout(30000) });
    const headersMs = Math.round(performance.now() - t);
    if (!res.ok) return { host: new URL(url).host, ok: false, ms: headersMs, note: `HTTP ${res.status}` };
    const text = await res.text();
    const j = JSON.parse(text) as OverpassAnswer & { remark?: string };
    return { host: new URL(url).host, ok: Array.isArray(j.elements) && !(j.remark && !j.elements.length), ms: Math.round(performance.now() - t), headersMs, bytes: text.length, elements: j.elements?.length ?? 0, note: j.remark?.slice(0, 60) };
  } catch (e) { return { host: new URL(url).host, ok: false, ms: Math.round(performance.now() - t), note: (e as Error).message.slice(0, 80) }; }
}

async function terrainTiles(lat: number, lon: number, radius: number) { // the terrain step, split: network vs decode
  const step = 20, n = Math.ceil((2 * radius) / step) + 1, mLat = 111320, mLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const need = new Set<string>();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const t = tileXY(lat - (-radius + j * step) / mLat, lon + (-radius + i * step) / mLon); need.add(`${Math.floor(t.x)}/${Math.floor(t.y)}`); }
  const t = performance.now(); let bytes = 0;
  const pngs = await Promise.all([...need].map(async (k) => { const [x, y] = k.split('/').map(Number); const r = await fetch(terrainUrl(TERRAIN_ZOOM, x, y), { signal: AbortSignal.timeout(20000) }); const b = await r.arrayBuffer(); bytes += b.byteLength; return b; }));
  const fetchMs = Math.round(performance.now() - t);
  const d = await time(() => Promise.all(pngs.map(decode)));
  return { tiles: need.size, bytes, fetchMs, decodeMs: d.ms };
}

const records: unknown[] = [];
for (const p of PLACES) {
  console.log(`== ${p.slug}`);
  const rec: Record<string, unknown> = { ...p };
  rec.mirrors = [];
  for (const url of OVERPASS_MIRRORS) (rec.mirrors as unknown[]).push(await oneMirror(url, p.lat, p.lon, p.radius)); // one at a time: no mirror steals another's turn
  // the real path: all at once, first good wins, twice (the second shows whether the servers keep an answer)
  const a1 = await time(() => askMirrors(p, { timeoutMs: 40000 }).catch((e: Error) => ({ error: e.message.slice(0, 120) }) as never));
  const a2 = await time(() => askMirrors(p, { timeoutMs: 40000 }).catch((e: Error) => ({ error: e.message.slice(0, 120) }) as never));
  const got = (a1.v as { answer?: OverpassAnswer }).answer;
  rec.askFirst = { ms: a1.ms, mirror: (a1.v as { mirror?: string }).mirror, error: (a1.v as { error?: string }).error };
  rec.askSecond = { ms: a2.ms, mirror: (a2.v as { mirror?: string }).mirror };
  if (!got) { records.push(rec); console.log('  no answer'); continue; }
  const answer = trimAnswer(got);
  rec.elements = answer.elements.length; rec.answerBytes = JSON.stringify(answer).length; rec.buildings = buildingsFrom(answer, p.lat, p.lon).length;
  rec.terrain = await terrainTiles(p.lat, p.lon, p.radius);
  const g = await time(() => fetchGround(p.lat, p.lon, p.radius, decode));
  rec.groundTotalMs = g.ms; rec.reliefM = Math.round(relief(g.v));
  const m = await time(() => osmToMesh(answer, p.lat, p.lon, 0.2, g.v));
  rec.meshMs = m.ms; rec.meshTriangles = m.v.indices.length / 3;
  const l = await time(() => laneForPlace(answer, p.lat, p.lon, g.v));
  rec.laneMs = l.ms; rec.laneCleared = l.v?.cleared ?? null; rec.laneShrink = l.v?.shrink ?? null;
  console.log(`  ask ${a1.ms} ms (${rec.askFirst && (rec.askFirst as { mirror?: string }).mirror}), again ${a2.ms} ms, ground ${g.ms} ms, mesh ${m.ms} ms, lane ${l.ms} ms`);
  records.push(rec);
}
writeFileSync(`${out}/places.json`, JSON.stringify(records, null, 2) + '\n');
writeFileSync(`${out}/run.json`, JSON.stringify({ script: 'scripts/osm-speed.ts', date: new Date().toISOString(), host: hostname(), cpus: cpus().length, load: loadavg(), node: process.version, note: 'timed one stage at a time from this machine; the browser adds its own network distance' }, null, 2) + '\n');
console.log('saved', out);
