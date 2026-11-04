// Builds the ready places (CC-78): public/assets/places/<slug>.json and index.json.
// Each file holds a place's buildings (trimmed OpenStreetMap answer), its ground heights and the lane summary the search found.
// Usage: npx tsx scripts/make-places.ts [slug ...]   (no names = all). Saved Overpass answers in data/eval/cc-46-osm-world/ are reused.
// Needs the network for places without a saved answer: all map servers are asked at once, with patience (the public ones are slow).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { askMirrors, trimAnswer, type ReadyIndexEntry, type ReadyPlace } from '../src/world/places';
import { laneForPlace, rolesFromSummary } from '../src/world/place-lane';
import { buildingsFrom, type OverpassAnswer } from '../src/world/osm';
import { fetchGround, relief, type Ground } from '../src/world/terrain';

// CC-133: a parkour park carries kind/region/country and the OpenStreetMap element it was checked against (see data/eval/cc-133-parkour-places/README.md); it is saved and listed even when the lane search finds no path, and the card says so.
interface Spec { slug: string; name: string; lat: number; lon: number; radius: number; blurb: string; saved?: string; kind?: 'parkour'; region?: string; country?: string; osm?: string; areaM2?: number; mapped?: 'parkour' | 'enclosing' }
export const PLACES: Spec[] = [
  { slug: 'montmartre-paris', name: 'Montmartre steps, Paris', lat: 48.8867, lon: 2.3431, radius: 120, blurb: 'A hill of stairs and narrow streets.', saved: 'montmartre-paris' },
  { slug: 'eixample-barcelona', name: 'Eixample, Barcelona', lat: 41.3917, lon: 2.1649, radius: 120, blurb: 'A grid of tall blocks with cut corners.', saved: 'eixample-barcelona' },
  { slug: 'circular-quay-sydney', name: 'Circular Quay, Sydney', lat: -33.861, lon: 151.2111, radius: 120, blurb: 'A harbour edge that climbs to the Rocks.', saved: 'circular-quay-sydney' },
  { slug: 'lombard-street-san-francisco', name: 'Lombard Street, San Francisco', lat: 37.8021, lon: -122.4187, radius: 120, blurb: 'The steepest block of the crooked street.', saved: 'san-francisco-lombard' },
  { slug: 'shibuya-tokyo', name: 'Shibuya, Tokyo', lat: 35.6595, lon: 139.7005, radius: 120, blurb: 'Tall, packed blocks around the big crossing.' },
  { slug: 'ciutadella-barcelona', name: 'Ciutadella Park, Barcelona', lat: 41.3888, lon: 2.187, radius: 150, blurb: 'A flat park with a few low halls.' },
  { slug: 'edinburgh-old-town', name: 'Old Town, Edinburgh', lat: 55.9496, lon: -3.1904, radius: 120, blurb: 'A ridge of stone houses falling away on both sides.' },
  { slug: 'positano-italy', name: 'Positano, Italy', lat: 40.628, lon: 14.4871, radius: 120, blurb: 'A hill town stacked down to the sea.' },
  { slug: 'valletta-harbour-malta', name: 'Grand Harbour, Valletta', lat: 35.8989, lon: 14.5146, radius: 120, blurb: 'Fort walls and harbour steps.' },
  { slug: 'speicherstadt-hamburg', name: 'Speicherstadt, Hamburg', lat: 53.5436, lon: 9.9886, radius: 120, blurb: 'Brick warehouses along the canals.' },
  { slug: 'alfama-lisbon', name: 'Alfama, Lisbon', lat: 38.711, lon: -9.1286, radius: 120, blurb: 'A steep old quarter of narrow lanes.' },
  { slug: 'spanish-steps-rome', name: 'Spanish Steps, Rome', lat: 41.906, lon: 12.4828, radius: 120, blurb: 'A wide staircase between old palaces.' },
  // CC-152: parks for the demo, where rails, benches and low walls are the obstacles
  { slug: 'parc-guell-barcelona', name: 'Park Güell, Barcelona', lat: 41.4145, lon: 2.1527, radius: 150, blurb: 'A hill park of curved walls, stairs and the long bench.' },
  { slug: 'tuileries-paris', name: 'Tuileries Garden, Paris', lat: 48.8635, lon: 2.3275, radius: 150, blurb: 'Gravel paths, terrace walls and rows of chairs.' },
  { slug: 'retiro-park-madrid', name: 'Retiro Park, Madrid', lat: 40.4152, lon: -3.6819, radius: 150, blurb: 'A glass palace by a lake, with railings and steps.' },
  { slug: 'gas-works-park-seattle', name: 'Gas Works Park, Seattle', lat: 47.6456, lon: -122.3344, radius: 150, blurb: 'A grassy hill with old iron towers and rails.' },
  { slug: 'dolores-park-san-francisco', name: 'Dolores Park, San Francisco', lat: 37.7596, lon: -122.4269, radius: 150, blurb: 'A steep lawn with palm-lined paths and walls.' },
  // CC-178: candidates for more famous places (squares and parks with buildings and street photos); kept in the list only if they pass scripts/places-audit.ts
  { slug: 'piazza-san-marco-venice', name: 'Piazza San Marco, Venice', lat: 45.434, lon: 12.3386, radius: 120, blurb: 'A huge square of arcades and a bell tower beside the lagoon.' },
  { slug: 'plaza-mayor-madrid', name: 'Plaza Mayor, Madrid', lat: 40.4155, lon: -3.7074, radius: 120, blurb: 'A closed square of red arcades with arched gates.' },
  { slug: 'place-des-vosges-paris', name: 'Place des Vosges, Paris', lat: 48.8556, lon: 2.3659, radius: 120, blurb: 'A square park ringed by brick houses and arcades.' },
  { slug: 'trafalgar-square-london', name: 'Trafalgar Square, London', lat: 51.5081, lon: -0.1281, radius: 120, blurb: 'Steps, fountains and a column in front of the gallery.' },
  { slug: 'covent-garden-london', name: 'Covent Garden, London', lat: 51.5118, lon: -0.1226, radius: 120, blurb: 'A covered market hall and the streets around it.' },
  { slug: 'washington-square-new-york', name: 'Washington Square, New York', lat: 40.7308, lon: -73.9976, radius: 120, blurb: 'A park with a fountain and an arch, walled in by townhouses.' },
  { slug: 'union-square-san-francisco', name: 'Union Square, San Francisco', lat: 37.7879, lon: -122.4075, radius: 120, blurb: 'A plaza with stairs, ringed by tall shops.' },
  { slug: 'old-town-square-prague', name: 'Old Town Square, Prague', lat: 50.0875, lon: 14.4213, radius: 120, blurb: 'A cobbled square of towers and painted houses.' },
  { slug: 'piazza-navona-rome', name: 'Piazza Navona, Rome', lat: 41.8992, lon: 12.4731, radius: 120, blurb: 'A long oval square of fountains and palaces.' },
  { slug: 'nyhavn-copenhagen', name: 'Nyhavn, Copenhagen', lat: 55.6803, lon: 12.5906, radius: 120, blurb: 'A canal lined with narrow coloured houses.' },
  { slug: 'boston-common-beacon-hill', name: 'Beacon Hill, Boston', lat: 42.356, lon: -71.063, radius: 120, blurb: 'Brick rows climbing from the oldest park in the country.' },
  // CC-90: candidates in countries the list did not have yet, for the spread-out street-photo set (kept in the list only if scripts/photos_lane_audit.py finds photos along the whole lane)
  { slug: 'jordaan-amsterdam', name: 'Jordaan canals, Amsterdam', lat: 52.3745, lon: 4.8830, radius: 120, blurb: 'Narrow canals with bridges and leaning brick houses.' },
  { slug: 'stephansplatz-vienna', name: 'Stephansplatz, Vienna', lat: 48.2085, lon: 16.3731, radius: 120, blurb: 'A cathedral square ringed by old palaces and shops.' },
  { slug: 'grand-place-brussels', name: 'Grand Place, Brussels', lat: 50.8467, lon: 4.3525, radius: 120, blurb: 'A cobbled square of guild houses and a tall town hall.' },
  { slug: 'main-square-krakow', name: 'Main Square, Krakow', lat: 50.0617, lon: 19.9373, radius: 120, blurb: 'One of the largest old squares in Europe, with a cloth hall.' },
  { slug: 'castle-hill-budapest', name: 'Castle Hill, Budapest', lat: 47.5019, lon: 19.0340, radius: 120, blurb: 'A hill of palace walls, terraces and steps above the river.' },
  { slug: 'gamla-stan-stockholm', name: 'Gamla Stan, Stockholm', lat: 59.3251, lon: 18.0711, radius: 120, blurb: 'A tiny island of narrow lanes and tall painted houses.' },
  { slug: 'temple-bar-dublin', name: 'Temple Bar, Dublin', lat: 53.3454, lon: -6.2644, radius: 120, blurb: 'Cobbled lanes between brick pubs and shops.' },
  { slug: 'plaka-athens', name: 'Plaka, Athens', lat: 37.9733, lon: 23.7300, radius: 120, blurb: 'Stepped lanes under the rock of the Acropolis.' },
  { slug: 'stradun-dubrovnik', name: 'Stradun, Dubrovnik', lat: 42.6410, lon: 18.1100, radius: 120, blurb: 'A stone main street inside tall sea walls.' },
  { slug: 'galata-istanbul', name: 'Galata, Istanbul', lat: 41.0256, lon: 28.9744, radius: 120, blurb: 'A steep hill of narrow streets around an old tower.' },
  { slug: 'gastown-vancouver', name: 'Gastown, Vancouver', lat: 49.2841, lon: -123.1087, radius: 120, blurb: 'Old brick warehouses along a cobbled street.' },
  { slug: 'zocalo-mexico-city', name: 'Zocalo, Mexico City', lat: 19.4326, lon: -99.1332, radius: 120, blurb: 'A giant square with a cathedral and a palace.' },
  { slug: 'caminito-buenos-aires', name: 'La Boca, Buenos Aires', lat: -34.6392, lon: -58.3629, radius: 120, blurb: 'Bright tin houses along a short lane.' },
  { slug: 'bukchon-seoul', name: 'Bukchon, Seoul', lat: 37.5826, lon: 126.9835, radius: 120, blurb: 'A hillside of low tiled houses and steep alleys.' },
  { slug: 'senate-square-helsinki', name: 'Senate Square, Helsinki', lat: 60.1698, lon: 24.9524, radius: 120, blurb: 'A wide stone square with big steps up to the cathedral.' },
  { slug: 'old-town-tallinn', name: 'Old Town, Tallinn', lat: 59.4370, lon: 24.7454, radius: 120, blurb: 'Medieval lanes under towers and town walls.' },
  { slug: 'bo-kaap-cape-town', name: 'Bo-Kaap, Cape Town', lat: -33.9166, lon: 18.4155, radius: 120, blurb: 'Steep cobbled streets of bright painted houses.' },
  { slug: 'bryggen-bergen', name: 'Bryggen, Bergen', lat: 60.3979, lon: 5.3243, radius: 120, blurb: 'Wooden harbour houses in a row on the old wharf.' },
  // CC-133: parkour parks, each checked against the OpenStreetMap element named in osm (data/eval/cc-133-parkour-places/README.md)
  { slug: 'gerlev-parkour-park', name: 'Gerlev Parkour Park', lat: 55.3519, lon: 11.3271, radius: 200, blurb: 'Built at Gerlev sports school in 2007; the map only has the whole school area.', kind: 'parkour', region: 'Europe', country: 'Denmark', osm: 'way/1274319354', areaM2: 90840, mapped: 'enclosing' },
  { slug: 'regents-park-london', name: "Regent's Park Parkour Hub", lat: 51.5302, lon: -0.1556, radius: 250, blurb: 'The big royal park in London; the map only has the whole park.', kind: 'parkour', region: 'Europe', country: 'United Kingdom', osm: 'relation/1384127', areaM2: 1600000, mapped: 'enclosing' },
  { slug: 'lakeside-garden-skatepark', name: 'Lakeside Garden SkatePark', lat: 1.343, lon: 103.7271, radius: 150, blurb: 'A skate park with a parkour pod, mapped as one pitch beside Jurong Lake.', kind: 'parkour', region: 'Asia', country: 'Singapore', osm: 'way/1159195814', areaM2: 15029, mapped: 'parkour' },
  { slug: 'zollverein-parkour-essen', name: 'Parkour at Zollverein, Essen', lat: 51.4913, lon: 7.0398, radius: 150, blurb: 'A parkour pitch on an old coal mine site.', kind: 'parkour', region: 'Europe', country: 'Germany', osm: 'way/879920257', areaM2: 510, mapped: 'parkour' },
  { slug: 'plaza-parkour-cochabamba', name: 'Plaza Parkour, Cochabamba', lat: -17.4003, lon: -66.1661, radius: 150, blurb: 'A concrete parkour plaza in Cochabamba.', kind: 'parkour', region: 'South America', country: 'Bolivia', osm: 'way/730118541', areaM2: 201, mapped: 'parkour' },
];

const out = 'public/assets/places';
mkdirSync(out, { recursive: true });
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cacheDir = 'data/eval/cc-78-map/overpass';
mkdirSync(cacheDir, { recursive: true });
const fetchOnly = process.argv.includes('--fetch-only'), force = process.argv.includes('--force'), rolesOnly = process.argv.includes('--roles-only');

async function answerFor(s: Spec): Promise<OverpassAnswer> {
  const cached = `${cacheDir}/${s.slug}.json`;
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8')) as OverpassAnswer;
  if (s.saved) {
    const f = `data/eval/cc-46-osm-world/${s.saved}/overpass.json`;
    if (existsSync(f)) return trimAnswer(JSON.parse(readFileSync(f, 'utf8')) as OverpassAnswer);
  }
  let wait = 8000;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const got = await askMirrors({ lat: s.lat, lon: s.lon, radius: s.radius }, { timeoutMs: 90000, queryTimeout: 60 });
      console.log(`  ${s.slug}: ${got.answer.elements.length} elements from ${got.mirror} in ${got.ms} ms (try ${attempt})`);
      writeFileSync(cached, JSON.stringify(got.answer));
      return got.answer;
    } catch (e) { console.log(`  ${s.slug}: try ${attempt} failed: ${(e as Error).message.slice(0, 160)}`); await pause(wait); wait = Math.min(wait * 1.5, 40000); }
  }
  throw new Error(`${s.slug}: no map server answered`);
}

async function groundFor(s: Spec): Promise<Ground | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetchGround(s.lat, s.lon, s.radius, async (png) => { const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, channels: 3 }; });
    } catch (e) { console.log(`  ${s.slug}: terrain try ${attempt} failed: ${(e as Error).message}`); await pause(3000); }
  }
  return null;
}

const oldIndex: ReadyIndexEntry[] = (() => { try { return JSON.parse(readFileSync(`${out}/index.json`, 'utf8')); } catch { return []; } })(); // CC-178: keep the list flags scripts/places-list.ts wrote
const index: ReadyIndexEntry[] = [];
const have = (slug: string) => { try { return JSON.parse(readFileSync(`${out}/${slug}.json`, 'utf8')) as ReadyPlace; } catch { return null; } };
for (const s of PLACES) {
  if (wanted.length && !wanted.includes(s.slug)) { const old = have(s.slug); if (old) index.push(entry(old, readFileSync(`${out}/${s.slug}.json`).length)); continue; }
  if (rolesOnly) { // relabel the footprints of the lanes already found, without searching again
    const old = have(s.slug);
    if (old?.lane) { old.lane.roles = rolesFromSummary(old.answer, old.lat, old.lon, old.ground ? { radius: old.radius, ...old.ground } : null, old.lane); const text = JSON.stringify(old, null, 2) + '\n'; writeFileSync(`${out}/${s.slug}.json`, text); index.push(entry(old, text.length)); console.log(`${s.slug}: ${old.lane.roles.length} footprints relabelled`); }
    continue;
  }
  if (!force && !fetchOnly && existsSync(`${out}/${s.slug}.json`)) { const old = have(s.slug)!; console.log(`${s.slug}: already built`); index.push(entry(old, readFileSync(`${out}/${s.slug}.json`).length)); continue; }
  console.log(`${s.slug}`);
  let answer: OverpassAnswer;
  try { answer = await answerFor(s); } catch (e) { console.log(`  skipped: ${(e as Error).message}`); continue; }
  if (fetchOnly) continue;
  const g = await groundFor(s);
  const ground = g ? { step: g.step, n: g.n, h: g.h } : null;
  const lane = laneForPlace(answer, s.lat, s.lon, g);
  if (!lane?.cleared) { if (s.kind !== 'parkour') { console.log('  not saved: the simulator found no lane (CC-211)'); continue; } } // a place with no path is not written and not listed; a parkour park is kept and flagged (CC-133)
  const place: ReadyPlace = { slug: s.slug, name: s.name, lat: s.lat, lon: s.lon, radius: s.radius, blurb: s.blurb, answer, ground, lane: lane ?? null };
  const text = JSON.stringify(place, null, 2) + '\n'; // tracked JSON is committed pretty-printed (npm run format:json)
  writeFileSync(`${out}/${s.slug}.json`, text);
  console.log(`  ${text.length} bytes, ${buildingsFrom(answer, s.lat, s.lon).length} buildings, hill ${Math.round(relief(g))} m, lane ${lane ? `${lane.lengthM} m at ${lane.shrink} (${lane.secondsTaken} s)` : 'none'}`);
  index.push(entry(place, text.length));
}
function parkour(slug: string, path: boolean): Partial<ReadyIndexEntry> {
  const s = PLACES.find((x) => x.slug === slug);
  return s?.kind === 'parkour' ? { kind: 'parkour', region: s.region, country: s.country, osm: s.osm, areaM2: s.areaM2, visible: (s.areaM2 ?? 0) >= 1500, mapped: s.mapped, path, listed: true, photos: 0, live: false } : {};
}
function entry(p: ReadyPlace, bytes: number): ReadyIndexEntry {
  return { slug: p.slug, name: p.name, lat: p.lat, lon: p.lon, radius: p.radius, hill_m: Math.round(relief(p.ground ? { radius: p.radius, ...p.ground } : null)), buildings: buildingsFrom(p.answer, p.lat, p.lon).length, bytes, blurb: p.blurb, ...Object.fromEntries(Object.entries(oldIndex.find((o) => o.slug === p.slug) ?? {}).filter(([k]) => ['listed', 'path', 'photos', 'live', 'country'].includes(k))), ...parkour(p.slug, p.lane?.cleared === true) };
}
if (fetchOnly) { console.log('answers fetched'); process.exit(0); }
index.sort((a, b) => PLACES.findIndex((p) => p.slug === a.slug) - PLACES.findIndex((p) => p.slug === b.slug));
writeFileSync(`${out}/index.json`, JSON.stringify(index, null, 2) + '\n');
console.log(`${index.length} ready places`);
