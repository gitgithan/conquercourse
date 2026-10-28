// Writes the cannon demo course: a 32 m gap with a 4 m drop onto the far deck, a pad that clips on a big aimed cannon, and the proved line (the barrel angle, where to fire and the roll).
// `npx tsx scripts/make-cannon-demo.ts [gap=32] [drop=4] [out=public/assets/demo/cannon.course.json]`
import { writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';
import { DEFAULT_CANNON } from '../src/sim/recoil';

const gap = Number(process.argv[2] ?? 32), drop = Number(process.argv[3] ?? 4);
const out = process.argv[4] ?? 'public/assets/demo/cannon.course.json';
const edge = 18, far = Math.round((edge + gap) * 100) / 100;
const course: CourseData = {
  version: 1,
  name: 'Cannon: aim it, fire it, roll out of the landing',
  startX: 0,
  finishX: far + 14,
  jumpSpeed: 4.5,
  terrain: { waterY: -(drop + 6), platforms: [{ x0: -10, x1: edge, top: 0 }, { x0: far, x1: far + 40, top: -drop }] },
  recoil: { x0: 2.5, x1: 5.5, ...DEFAULT_CANNON, charMass: 70, energy: 40000, shots: 1 },
  zones: [{ id: 'recoil', name: 'Cannon gap', x0: 2, x1: far + 2 }],
  checkpoints: [{ id: 'recoil', x: 0 }],
};
const t0 = Date.now();
const res = searchIdealRun(course);
console.log(`gap ${gap} m, drop ${drop} m: cleared ${res.cleared} in ${((Date.now() - t0) / 1000).toFixed(1)} s`, JSON.stringify(res.plan), res.windows.map((w) => `${w.obstacle} ${w.lo}..${w.hi}`).join('; '));
if (res.cleared) course.plan = res.plan;
writeFileSync(out, JSON.stringify(course, null, 2) + '\n');
