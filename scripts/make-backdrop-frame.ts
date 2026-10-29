// CC-234: write the frame that puts a place's buildings and street furniture around the hero lane.
// It runs the same slice search as scripts/make-hero-course.ts (no ideal run) and keeps the winning slice's turn, offset and level, which the course file does not store.
// Usage: npx tsx scripts/make-backdrop-frame.ts [slug]    writes public/assets/demo/hero-<slug>.backdrop.json
import { readFileSync, writeFileSync } from 'node:fs';
import { buildingsFrom, extrude } from '../src/world/osm';
import type { Ground } from '../src/world/terrain';
import { lowest } from '../src/world/terrain';
import { bestSlices, laneSamples, sliceProfile, surfaceSamples } from '../src/slice/slice';
import { centred } from '../src/slice/world';
import { shiftOf, rigidError, type BackdropFrame } from '../src/world/backdrop';

const slug = process.argv[2] ?? 'montmartre-paris';
const place = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
const hero = JSON.parse(readFileSync(`public/assets/demo/hero-${slug}.course.json`, 'utf8'));
const k = place.lane.shrink;
const bs = buildingsFrom(place.answer, place.lat, place.lon).filter((b) => b.ring.length >= 3 && Math.abs(b.ring.reduce((s, a, i) => { const q = b.ring[(i + 1) % b.ring.length]; return s + a[0] * q[1] - q[0] * a[1]; }, 0)) >= 4);
const ground = (place.ground ? { radius: place.radius, ...place.ground } : null) as Ground | null;
const m = extrude(bs, k, ground);
let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
for (let i = 0; i < m.positions.length; i += 3) { x0 = Math.min(x0, m.positions[i]); x1 = Math.max(x1, m.positions[i]); z0 = Math.min(z0, m.positions[i + 2]); z1 = Math.max(z1, m.positions[i + 2]); }
const piece = centred({ positions: m.positions, indices: m.indices });
const samples = surfaceSamples(piece, 80);
const cands = bestSlices({ positions: samples }, { top: 3, centre: { x: 0, z: 0 }, reprofile: (c) => { c.offset = Math.round(c.offset * 10) / 10; c.level = Math.round(c.level * 100) / 100; return sliceProfile(laneSamples(piece, c), { x: 0, z: 0 }, c); } });
const best = cands.find((c) => c.profile.cells.filter((x) => x !== null).length / c.profile.cells.length > 0.2)!;
const first = hero.uMap[0];
console.error('origin', best.profile.origin, 'course first run u0', first.u0, 'angle', best.angle, 'offset', best.offset, 'level', best.level);
if (Math.abs((best.profile.origin ?? 0) + Math.round((first.u0 - (best.profile.origin ?? 0)) / 0.1) * 0.1 - first.u0) > 0.06) throw new Error('the search found a different slice than the one the course was made from');
const frame: BackdropFrame = {
  slug, k, cx: +((x0 + x1) / 2).toFixed(4), cz: +((z0 + z1) / 2).toFixed(4),
  angle: +best.angle.toFixed(5), offset: best.offset, level: best.level, lowest: lowest(ground),
  shiftX: 0, uMap: hero.uMap, startX: hero.startX, finishX: hero.finishX,
};
frame.shiftX = +shiftOf(frame.uMap).toFixed(3);
console.error('rigid error (m)', rigidError(frame).toFixed(2));
writeFileSync(`public/assets/demo/hero-${slug}.backdrop.json`, JSON.stringify(frame, null, 2) + '\n');
