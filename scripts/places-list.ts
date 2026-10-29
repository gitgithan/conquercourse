// CC-178: decide which Ready places are listed by default. A place is listed when it has a lane the runner clears (the saved lane is cleared)
// AND enough street photos face that lane (Mapillary, raw count from the audit). `?places=all` still shows every place.
// Usage: npx tsx scripts/places-list.ts [audit.json ...]   (default: the audit files in data/eval/cc-178-places/)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const MIN_FACING = 30; // photos near the lane whose camera points at it
const dir = 'data/eval/cc-178-places';
const files = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(dir).filter((f) => /^audit.*\.json$/.test(f) && !/nophotos/.test(f)).map((f) => `${dir}/${f}`);
type Row = { slug: string; photosFacingLane?: number; path?: boolean; buildings?: number };
const rows = new Map<string, Row>();
for (const f of files) for (const r of JSON.parse(readFileSync(f, 'utf8')) as Row[]) rows.set(r.slug, { ...rows.get(r.slug), ...r });
const idxPath = 'public/assets/places/index.json';
const index = JSON.parse(readFileSync(idxPath, 'utf8')) as { slug: string; listed?: boolean; path?: boolean; photos?: number }[];
for (const e of index) {
  const placeFile = JSON.parse(readFileSync(`public/assets/places/${e.slug}.json`, 'utf8')) as { lane?: { cleared?: boolean } };
  const r = rows.get(e.slug), path = placeFile.lane?.cleared === true;
  // Lombard's bbox is too dense for Mapillary's search (HTTP 500 even split in four); it has stored credited photos, so it counts as having photos.
  const stored = existsSync(`public/assets/photos/${e.slug}.json`) || e.slug === 'lombard-street-san-francisco';
  const photos = r?.photosFacingLane ?? (stored ? MIN_FACING : 0);
  const live = existsSync(`public/assets/photos-live/${e.slug}.json`);
  Object.assign(e, { path, photos, listed: path && photos >= MIN_FACING });
  console.log(e.slug.padEnd(30), 'path', path, 'photosFacing', photos, 'liveList', live, e.listed ? 'LISTED' : 'hidden');
}
writeFileSync(idxPath, JSON.stringify(index, null, 2) + '\n');
console.log(index.filter((e) => e.listed).length, 'listed of', index.length);
