// CC-178: the extra OpenStreetMap tags a skin needs (parks, water, roads, paving, trees, building colours), one Overpass question per place.
// Usage: npx tsx scripts/skin-fetch.ts [--ground-colour] <slug> [slug...]   (reads public/assets/places/<slug>.json for the pin; writes data/eval/cc-178-places/skin/<slug>-osm.json)
// CC-133 --ground-colour: asks for the extra ground tags (more land uses, parking, squares, sports, surfaces) and writes data/eval/cc-133-ground-colour/skin/<slug>-osm.json, so the saved CC-178 files stay as they were.
// © OpenStreetMap contributors, ODbL. One polite query per place, six servers asked at once (src/world/places.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { OVERPASS_MIRRORS, USER_AGENT } from '../src/world/places';

const GC = process.argv.includes('--ground-colour');
const query = (lat: number, lon: number, r: number) => `[out:json][timeout:60];(
${GC ? `way["amenity"="parking"](around:${r},${lat},${lon});way["place"="square"](around:${r},${lat},${lon});way["leisure"~"track|sports_centre|dog_park|swimming_pool"](around:${r},${lat},${lon});way["landuse"~"industrial|farmland|orchard|vineyard|brownfield|construction|railway|garages|allotments|flowerbed"](around:${r},${lat},${lon});way["natural"~"shingle|mud|wetland|heath|scree|cliff"](around:${r},${lat},${lon});way["man_made"~"pier|bridge"](around:${r},${lat},${lon});` : ''}
way["building"](around:${r},${lat},${lon});relation["building"](around:${r},${lat},${lon});
way["leisure"~"park|garden|pitch|playground|common"](around:${r},${lat},${lon});way["landuse"~"grass|forest|meadow|recreation_ground|village_green|residential|commercial|retail|cemetery"](around:${r},${lat},${lon});
way["natural"~"water|wood|scrub|grassland|sand|beach|bare_rock"](around:${r},${lat},${lon});relation["natural"="water"](around:${r},${lat},${lon});relation["leisure"~"park|garden"](around:${r},${lat},${lon});
way["waterway"~"river|canal|stream"](around:${r},${lat},${lon});
way["highway"](around:${r},${lat},${lon});way["area:highway"](around:${r},${lat},${lon});
node["natural"="tree"](around:${r},${lat},${lon});way["natural"="tree_row"](around:${r},${lat},${lon});
);out geom tags;`;
const keep: string[] = ['building', 'building:colour', 'building:material', 'building:levels', 'height', 'roof:colour', 'roof:shape', 'roof:material', 'leisure', 'landuse', 'natural', 'waterway', 'highway', 'surface', 'area:highway', 'width', 'name'];
if (GC) keep.push('area', 'sport', 'amenity', 'place', 'man_made');
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (const slug of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
  const dir = GC ? 'data/eval/cc-133-ground-colour/skin' : 'data/eval/cc-178-places/skin', out = `${dir}/${slug}-osm.json`;
  if (existsSync(out)) { console.log(slug, 'already fetched'); continue; }
  const p = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
  const body = 'data=' + encodeURIComponent(query(p.lat, p.lon, p.radius));
  let done = false;
  for (let attempt = 1; attempt <= 6 && !done; attempt++) {
    const stops: AbortController[] = [];
    try {
      const got = await Promise.any(OVERPASS_MIRRORS.map(async (url) => {
        const stop = new AbortController(); stops.push(stop); const timer = setTimeout(() => stop.abort(), 90000);
        try {
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': USER_AGENT }, body, signal: stop.signal });
          if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
          const j = await res.json() as { elements?: any[]; remark?: string };
          if (!Array.isArray(j.elements) || (!j.elements.length && j.remark)) throw new Error('bad answer');
          return { j, host: new URL(url).host };
        } finally { clearTimeout(timer); }
      }));
      for (const s of stops) s.abort();
      const r5 = (v: number) => Math.round(v * 1e6) / 1e6;
      const elements = got.j.elements!.map((e) => {
        const tags = Object.fromEntries(Object.entries(e.tags ?? {}).filter(([k]) => keep.includes(k)));
        const g = (a?: { lat: number; lon: number }[]) => (a ?? []).map((q) => ({ lat: r5(q.lat), lon: r5(q.lon) }));
        if (e.type === 'node') return { type: 'node', tags, lat: r5(e.lat), lon: r5(e.lon) };
        if (e.type === 'way') return { type: 'way', tags, geometry: g(e.geometry) };
        return { type: 'relation', tags, members: (e.members ?? []).filter((m: any) => m.type === 'way').map((m: any) => ({ role: m.role, geometry: g(m.geometry) })) };
      });
      mkdirSync(dir, { recursive: true });
      writeFileSync(out, JSON.stringify({ slug, lat: p.lat, lon: p.lon, radius: p.radius, source: `© OpenStreetMap contributors (ODbL), Overpass via ${got.host}`, fetched: new Date().toISOString().slice(0, 10), elements }, null, 2) + '\n');
      console.log(slug, elements.length, 'elements from', got.host); done = true;
    } catch (e) { console.log(slug, 'try', attempt, 'failed'); await pause(8000 * attempt); }
  }
}
