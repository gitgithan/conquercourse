// CC-90: for every allow-list in public/assets/photos-live, how much of its place's lane has an allowed photo that faces it (same rules the game uses).
// Usage: npx tsx scripts/photos-live-share.ts [out.json]   (writes the rows when a file is named; prints a table either way)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pickPhotos, type AllowList, type PlaceLine } from '../src/world/live-photos';
import { laneShare } from '../src/world/photo-status';

const dir = 'public/assets/photos-live';
const rows = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
  const slug = f.replace('.json', ''), list = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as AllowList;
  const place = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8')) as PlaceLine;
  const [x0, y0, x1, y1] = place.lane.line, len = Math.hypot(x1 - x0, y1 - y0);
  const used = new Set<string>(); const n = Math.max(2, Math.floor(len / 10) + 1);
  for (let i = 0; i < n; i++) { const k = i / (n - 1); for (const p of pickPhotos(list.photos, place, { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k }, 99)) used.add(p.id); }
  return { slug, laneRealM: Math.round(len), kept: list.photos.length, facingLane: used.size, per100m: Math.round((100 * used.size) / Math.max(len, 1)), shareOfLane: Math.round(laneShare(list, place) * 100) / 100 };
});
console.table(rows);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(rows, null, 2) + '\n');
