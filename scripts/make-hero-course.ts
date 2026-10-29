// Builds the film's hero course (CC-210): the stored Montmartre rooftop lane, then the Training course's proven rope section,
// with one photo-lifted object on the lane. Usage: npx tsx scripts/make-hero-course.ts [slug]
import { readFileSync, writeFileSync } from 'node:fs';
import { buildingsFrom, extrude } from '../src/world/osm';
import type { Ground } from '../src/world/terrain';
import { bestSlices, laneSamples, sliceProfile, surfaceSamples, laneToCourse } from '../src/slice/slice';
import { centred } from '../src/slice/world';
import { searchIdealRun } from '../src/sim/ideal';
import type { CourseData } from '../src/course/course';

const slug = process.argv[2] ?? 'montmartre-paris';
const place = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
const lane = place.lane, k = lane.shrink;
const bs = buildingsFrom(place.answer, place.lat, place.lon).filter((b) => b.ring.length >= 3 && Math.abs(b.ring.reduce((s, a, i) => { const q = b.ring[(i + 1) % b.ring.length]; return s + a[0] * q[1] - q[0] * a[1]; }, 0)) >= 4);
const m = extrude(bs, k, (place.ground ? { radius: place.radius, ...place.ground } : null) as Ground | null);
const piece = centred({ positions: m.positions, indices: m.indices });
const samples = surfaceSamples(piece, 80);
const cands = bestSlices({ positions: samples }, { top: 3, centre: { x: 0, z: 0 }, reprofile: (c) => { c.offset = Math.round(c.offset * 10) / 10; c.level = Math.round(c.level * 100) / 100; return sliceProfile(laneSamples(piece, c), { x: 0, z: 0 }, c); } });
console.error("cands", cands.length, bs.length, m.indices.length, k);
const best = cands.find((c) => c.profile.cells.filter((x) => x !== null).length / c.profile.cells.length > 0.2)!;
const base = laneToCourse({ cells: [...best.profile.cells], length: best.profile.length, origin: best.profile.origin }, place.name) as CourseData;
const training = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
const park = JSON.parse(readFileSync('public/assets/demo/park-run.course.json', 'utf8')) as CourseData;

const P = base.terrain.platforms, last = P[P.length - 1];
// the proven rope section: the platform at 143..155 (top 4.5), an 8 m gap crossed on the rope (anchor 159, 13.1, length 9), the landing 163..183 (top 6.5)
const gapIn = Number(process.env.GAP ?? 3), dy = last.top - 4.5, x0 = last.x1 + gapIn, dx = x0 - 143;
const run = { x0, x1: x0 + 12, top: +(4.5 + dy).toFixed(2) };
const land = { x0: x0 + 20, x1: x0 + 40, top: +(6.5 + dy).toFixed(2) };
base.terrain.platforms.push(run, land);
(base as { rope?: unknown }).rope = { anchorX: +(159 + dx).toFixed(2), anchorY: +(13.1 + dy).toFixed(2), length: 9 };
base.finishX = +(land.x1 - 6).toFixed(1);
base.terrain.waterY = Math.min(-6, ...P.map((p) => p.top)) - 4;
(base as { hazard?: string }).hazard = 'lava';
base.name = `${place.name}: rooftops to the rope`;
(base as { keepDecks?: boolean }).keepDecks = true; // one photo object on a lane of decks: draw the decks too (CC-234)
// one photo-lifted CC0 object on the lane (from the Bucharest skatepark photo)
const obj = park.scene?.find((s) => /box-skate/.test(s.url));
const mid = P[Math.min(2, P.length - 1)];
if (obj) (base as { scene?: unknown[] }).scene = [{ ...obj, x: +(mid.x0 + (mid.x1 - mid.x0) / 2).toFixed(2), y: mid.top }];
console.log(JSON.stringify({ platforms: base.terrain.platforms, rope: (base as { rope?: unknown }).rope, finishX: base.finishX }));
const r = searchIdealRun(base);
console.log('cleared', r.cleared, JSON.stringify(r.plan));
if (r.cleared) { base.plan = r.plan; writeFileSync(`public/assets/demo/hero-${slug}.course.json`, JSON.stringify(base, null, 2) + '\n'); }
