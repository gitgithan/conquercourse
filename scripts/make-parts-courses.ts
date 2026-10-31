// Parts gallery (docs/parts-gallery.md): one tiny course per basic part, cut from the Training course or made flat, with its ideal run stored.
//   npx tsx scripts/make-parts-courses.ts            writes public/assets/parts/*.course.json
// The gallery plays each file with ?bot=ideal in the real Course, so the card shows the real simulator and the real renderer.
// tests/parts-gallery.test.ts plays every stored plan again and fails if one no longer clears.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { nodePool } from '../src/sim/ideal-pool-node';

const training = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
const P = training.terrain.platforms;
const base = { version: 1 as const, jumpSpeed: training.jumpSpeed, jumpKeep: training.jumpKeep, grabReach: training.grabReach, hazard: training.hazard };

interface Cut { id: string; name: string; startX: number; finishX: number; platforms: number[]; keep: ('wall' | 'rope' | 'holds')[] }
const CUTS: Cut[] = [
  { id: 'gap', name: 'Part: a gap jump', startX: 8, finishX: 36, platforms: [0, 1], keep: [] },
  { id: 'vault', name: 'Part: a vault box', startX: 34, finishX: 60, platforms: [1, 2, 3], keep: [] },
  { id: 'wall', name: 'Part: the warped wall', startX: 62, finishX: 80, platforms: [3, 4], keep: ['wall'] },
  { id: 'climb', name: 'Part: a climb', startX: 84, finishX: 93.5, platforms: [4, 5], keep: [] },
  { id: 'lache', name: 'Part: the lache bars', startX: 113, finishX: 138, platforms: [6, 7], keep: ['holds'] },
  { id: 'rope', name: 'Part: the rope swing', startX: 137, finishX: 160, platforms: [7, 8], keep: ['rope'] },
  { id: 'trampoline', name: 'Part: the trampoline', startX: 167, finishX: 197, platforms: [8, 9, 10], keep: [] },
];

const courses: Record<string, CourseData> = {};
for (const c of CUTS) {
  const out: CourseData = { ...base, name: c.name, startX: c.startX, finishX: c.finishX, terrain: { waterY: training.terrain.waterY, platforms: c.platforms.map((i) => P[i]) } };
  if (c.keep.includes('wall') && training.wall) out.wall = training.wall;
  if (c.keep.includes('rope') && training.rope) out.rope = training.rope;
  if (c.keep.includes('holds') && training.holds) out.holds = training.holds;
  out.zones = [{ id: c.id, name: c.name.replace('Part: ', ''), x0: c.startX, x1: c.finishX }];
  courses[c.id] = out;
}
courses.run = { ...base, name: 'Part: running', startX: 0, finishX: 40, terrain: { waterY: -6, platforms: [{ x0: -10, x1: 60, top: 0 }] }, zones: [{ id: 'run', name: 'Running', x0: 0, x1: 40 }] };
courses.step = { ...base, name: 'Part: a step up', startX: 0, finishX: 30, terrain: { waterY: -6, platforms: [{ x0: -10, x1: 14, top: 0 }, { x0: 14, x1: 40, top: 0.8 }] }, zones: [{ id: 'step', name: 'Step up', x0: 8, x1: 20 }] };

mkdirSync('public/assets/parts', { recursive: true });
const pool = nodePool();
let bad = 0;
for (const [id, c] of Object.entries(courses)) {
  const r = await pool.search(c, undefined, undefined, {});
  if (r.cleared) c.plan = r.plan; else bad++;
  console.log(`${id}: ${r.cleared ? 'plan stored' : 'NOT CLEARED'}`);
  writeFileSync(`public/assets/parts/${id}.course.json`, JSON.stringify(c, null, 2) + '\n');
}
pool.close();
process.exit(bad ? 1 : 0);
