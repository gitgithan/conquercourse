// CC-178, CC-90: decide which Ready places are listed by default, and write each place's country, photo count and live-list flag into the index. `?places=all` still shows every place.
// Usage: npx tsx scripts/places-list.ts [audit.json ...]   (default: the audit files in data/eval/cc-178-places/ and data/eval/cc-90-photolanes/)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

// CC-90: the list is a short, spread-out set, not every place that passes a count. A place is listed when it has a proven lane AND is in CURATED
// (chosen from data/eval/cc-90-no-filter/README.md: street photos along its whole lane, at most two per country). Other places stay in the files and open by their old links.
const COUNTRY: Record<string, string> = {
  'montmartre-paris': 'France', 'tuileries-paris': 'France', 'place-des-vosges-paris': 'France',
  'eixample-barcelona': 'Spain', 'ciutadella-barcelona': 'Spain', 'parc-guell-barcelona': 'Spain', 'plaza-mayor-madrid': 'Spain', 'retiro-park-madrid': 'Spain',
  'circular-quay-sydney': 'Australia', 'lombard-street-san-francisco': 'United States', 'dolores-park-san-francisco': 'United States', 'union-square-san-francisco': 'United States',
  'washington-square-new-york': 'United States', 'gas-works-park-seattle': 'United States', 'boston-common-beacon-hill': 'United States',
  'shibuya-tokyo': 'Japan', 'edinburgh-old-town': 'United Kingdom', 'trafalgar-square-london': 'United Kingdom', 'covent-garden-london': 'United Kingdom',
  'positano-italy': 'Italy', 'piazza-san-marco-venice': 'Italy', 'spanish-steps-rome': 'Italy', 'piazza-navona-rome': 'Italy', 'valletta-harbour-malta': 'Malta',
  'speicherstadt-hamburg': 'Germany', 'alfama-lisbon': 'Portugal', 'old-town-square-prague': 'Czechia', 'nyhavn-copenhagen': 'Denmark',
  'jordaan-amsterdam': 'Netherlands', 'stephansplatz-vienna': 'Austria', 'grand-place-brussels': 'Belgium', 'main-square-krakow': 'Poland', 'castle-hill-budapest': 'Hungary',
  'gamla-stan-stockholm': 'Sweden', 'temple-bar-dublin': 'Ireland', 'plaka-athens': 'Greece', 'stradun-dubrovnik': 'Croatia', 'galata-istanbul': 'Turkey',
  'gastown-vancouver': 'Canada', 'zocalo-mexico-city': 'Mexico', 'caminito-buenos-aires': 'Argentina', 'bukchon-seoul': 'South Korea', 'senate-square-helsinki': 'Finland',
  'old-town-tallinn': 'Estonia', 'bo-kaap-cape-town': 'South Africa', 'bryggen-bergen': 'Norway',
};
const CURATED: string[] = [
  'edinburgh-old-town',
  'dolores-park-san-francisco',
  'caminito-buenos-aires',
  'bukchon-seoul',
  'parc-guell-barcelona',
  'alfama-lisbon',
  'stephansplatz-vienna',
  'galata-istanbul',
  'plaka-athens',
  'bryggen-bergen',
  'gamla-stan-stockholm',
  'speicherstadt-hamburg',
  'temple-bar-dublin',
  'main-square-krakow',
  'castle-hill-budapest',
  // restored 2026-11-01 when the person filter was loosened (owner decision; Mapillary's own blur is the base standard)
  'shibuya-tokyo',
  'montmartre-paris',
  'piazza-san-marco-venice',
  'valletta-harbour-malta',
];

const MIN_FACING = 30; // photos near the lane whose camera points at it
const dirs = ['data/eval/cc-178-places', 'data/eval/cc-90-photolanes'];
const files = process.argv.length > 2 ? process.argv.slice(2) : dirs.flatMap((dir) => readdirSync(dir).filter((f) => /^audit.*\.json$/.test(f) && !/nophotos/.test(f)).map((f) => `${dir}/${f}`));
type Row = { slug: string; photosFacingLane?: number; facing?: number; path?: boolean; buildings?: number };
const rows = new Map<string, Row>();
for (const f of files) for (const r of JSON.parse(readFileSync(f, 'utf8')) as Row[]) rows.set(r.slug, { ...rows.get(r.slug), ...r, photosFacingLane: r.photosFacingLane ?? r.facing ?? rows.get(r.slug)?.photosFacingLane });
const idxPath = 'public/assets/places/index.json';
const index = JSON.parse(readFileSync(idxPath, 'utf8')) as { slug: string; listed?: boolean; path?: boolean; photos?: number; live?: boolean; country?: string; kind?: string }[];
for (const e of index) {
  if (e.kind === 'parkour') continue; // CC-133: parkour parks are listed by scripts/make-places.ts (no street-photo list, and a flagged card when no lane is found)
  const placeFile = JSON.parse(readFileSync(`public/assets/places/${e.slug}.json`, 'utf8')) as { lane?: { cleared?: boolean } };
  const r = rows.get(e.slug), path = placeFile.lane?.cleared === true;
  // Lombard's bbox is too dense for Mapillary's search (HTTP 500 even split in four); it has stored credited photos, so it counts as having photos.
  const stored = existsSync(`public/assets/photos/${e.slug}.json`) || e.slug === 'lombard-street-san-francisco';
  const photos = r?.photosFacingLane ? Math.max(r.photosFacingLane, e.photos ?? 0) : e.photos ?? (stored ? MIN_FACING : 0);
  const live = existsSync(`public/assets/photos-live/${e.slug}.json`);
  Object.assign(e, { path, photos, live, country: COUNTRY[e.slug], listed: path && CURATED.includes(e.slug) });
  console.log(e.slug.padEnd(30), (COUNTRY[e.slug] ?? '?').padEnd(14), 'path', path, 'photosFacing', photos, 'liveList', live, e.listed ? 'LISTED' : 'hidden');
}
writeFileSync(idxPath, JSON.stringify(index, null, 2) + '\n');
console.log(index.filter((e) => e.listed).length, 'listed of', index.length);
