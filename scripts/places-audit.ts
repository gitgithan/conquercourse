// CC-178: an honest table of the ready places: buildings, lane, Mapillary photos near the lane, and whether the real lane search finds a path with the default settings.
// Usage: npx tsx scripts/places-audit.ts [--no-photos] [slug ...]   (--stored uses the lane saved in the place file instead of searching again; token read from ~/.config/ninja/mapillary.env, never printed; writes data/eval/cc-178-places/audit.json)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { buildingsFrom } from '../src/world/osm';
import { laneForPlace, shrinkLadder } from '../src/world/place-lane';
import type { ReadyPlace } from '../src/world/places';
import type { Ground } from '../src/world/terrain';

const dir = 'public/assets/places/', M_LAT = 111320;
const args = process.argv.slice(2), stored = args.includes('--stored'), photos = !args.includes('--no-photos'), want = args.filter((a) => !a.startsWith('--'));
const slugs = (want.length ? want : readdirSync(dir).filter((f) => f.endsWith('.json') && !['index.json', 'photos-index.json'].includes(f)).map((f) => f.replace('.json', '')));
const token = () => { for (const l of readFileSync(`${homedir()}/.config/ninja/mapillary.env`, 'utf8').split('\n')) if (l.startsWith('MAPILLARY_TOKEN=')) return l.slice(16).trim().replace(/^["']|["']$/g, ''); throw new Error('no token'); };
const toLL = (lat0: number, lon0: number, x: number, y: number) => [lat0 - y / M_LAT, lon0 + x / (M_LAT * Math.cos((lat0 * Math.PI) / 180))];
const bearing = (x0: number, y0: number, x1: number, y1: number) => ((Math.atan2(x1 - x0, -(y1 - y0)) * 180) / Math.PI + 360) % 360;
const angDiff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
interface Img { id: string; x: number; y: number; compass: number | null; pano: boolean }

async function images(lat0: number, lon0: number, x0: number, x1: number, y0: number, y1: number, tok: string): Promise<Img[]> {
  const out = new Map<string, Img>(); const todo = [[x0, x1, y0, y1]];
  while (todo.length) {
    const [a, b, c, d] = todo.pop()!; const [la1, lo1] = toLL(lat0, lon0, a, d), [la2, lo2] = toLL(lat0, lon0, b, c);
    let data: any[] | null = null;
    for (let t = 0; t < 5 && !data; t++) {
      try { const r = await fetch(`https://graph.mapillary.com/images?bbox=${lo1.toFixed(6)},${la1.toFixed(6)},${lo2.toFixed(6)},${la2.toFixed(6)}&limit=2000&fields=id,is_pano,compass_angle,computed_compass_angle,geometry,computed_geometry`, { headers: { Authorization: `OAuth ${tok}`, 'User-Agent': 'conquercourse-research/0.1' } }); if (r.status === 500 && b - a > 20) { data = null; break; } if (!r.ok) throw new Error(String(r.status)); data = ((await r.json()) as any).data ?? []; } catch { await new Promise((r) => setTimeout(r, 3000 * (t + 1) * (t + 1))); }
    }
    if (!data) { if (b - a > 20) { const mx = (a + b) / 2, my = (c + d) / 2; todo.push([a, mx, c, my], [mx, b, c, my], [a, mx, my, d], [mx, b, my, d]); continue; } throw new Error('mapillary failed'); } // the server answers 500 for a dense box: ask in four smaller ones
    if (data.length >= 2000 && b - a > 40) { const mx = (a + b) / 2, my = (c + d) / 2; todo.push([a, mx, c, my], [mx, b, c, my], [a, mx, my, d], [mx, b, my, d]); continue; }
    for (const im of data) { const g = (im.computed_geometry ?? im.geometry)?.coordinates; if (!g) continue; out.set(im.id, { id: im.id, x: (g[0] - lon0) * M_LAT * Math.cos((lat0 * Math.PI) / 180), y: -(g[1] - lat0) * M_LAT, compass: im.computed_compass_angle ?? im.compass_angle ?? null, pano: !!im.is_pano }); }
    await new Promise((r) => setTimeout(r, 200));
  }
  return [...out.values()];
}

const rows: Record<string, unknown>[] = [];
const tok = photos ? token() : '';
for (const slug of slugs) {
  const p = JSON.parse(readFileSync(dir + slug + '.json', 'utf8')) as ReadyPlace;
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const bs = buildingsFrom(p.answer, p.lat, p.lon), ladder = shrinkLadder(bs);
  const t0 = Date.now(), lane = stored ? p.lane : laneForPlace(p.answer, p.lat, p.lon, ground), secs = (Date.now() - t0) / 1000;
  const row: Record<string, unknown> = { slug, name: p.name, buildings: bs.length, realHeights: bs.filter((b) => b.real).length, ladder, path: !!lane?.cleared, shrinkFound: lane?.cleared ? lane.shrink : null, rung: lane?.cleared ? ladder.indexOf(lane.shrink) + 1 : null, cutLevelM: lane?.levelM, laneLengthM: lane?.lengthM, gaps: lane?.gaps, steps: lane?.steps, faces: lane?.faces, secs };
  if (photos && lane?.cleared) {
    const [x0, y0, x1, y1] = lane.line, lo = (a: number, b: number) => Math.min(a, b) - 70, hi = (a: number, b: number) => Math.max(a, b) + 70;
    let ims: Img[]; try { ims = await images(p.lat, p.lon, lo(x0, x1), hi(x0, x1), lo(y0, y1), hi(y0, y1), tok); } catch { row.photoError = 'mapillary did not answer'; rows.push(row); console.log(JSON.stringify(row)); continue; }
    let near = 0, facing = 0, pano = 0; const along = new Set<number>();
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (const im of ims) {
      // nearest point on the lane
      const t = Math.max(0, Math.min(1, ((im.x - x0) * (x1 - x0) + (im.y - y0) * (y1 - y0)) / (len * len || 1))), px = x0 + t * (x1 - x0), py = y0 + t * (y1 - y0), d = Math.hypot(im.x - px, im.y - py);
      if (d > 60) continue; near++; if (im.pano) pano++;
      if (im.compass !== null && angDiff(im.compass, bearing(im.x, im.y, px, py)) <= 60) { facing++; along.add(Math.floor(t * len / 10)); }
    }
    Object.assign(row, { photosInBox: ims.length, photosWithin60m: near, photosFacingLane: facing, panos: pano, laneTenMetreStretchesWithPhoto: along.size, laneTenMetreStretches: Math.ceil(len / 10) });
  } else if (photos) Object.assign(row, { photosInBox: null, photosWithin60m: 0, photosFacingLane: 0 });
  rows.push(row); console.log(JSON.stringify(row));
}
mkdirSync('data/eval/cc-178-places', { recursive: true });
if (!want.length) writeFileSync(`data/eval/cc-178-places/audit${stored ? '-stored' : ''}${photos ? '' : '-nophotos'}.json`, JSON.stringify(rows, null, 2) + '\n');
