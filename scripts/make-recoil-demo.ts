// Writes the recoil demo course: a gap no run-up can jump, a pad that clips on a launcher, and the proved line (where to fire and where to jump).
// `npx tsx scripts/make-recoil-demo.ts [gap=10.5] [out=public/assets/demo/recoil.course.json]`
import { writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';

const gap = Number(process.argv[2] ?? 10.5);
const out = process.argv[3] ?? 'public/assets/demo/recoil.course.json';
const edge = 16, far = Math.round((edge + gap) * 100) / 100;
const course: CourseData = {
  version: 1,
  name: 'Recoil: the ball goes back, you go forward',
  startX: 0,
  finishX: far + 12,
  jumpSpeed: 4.5,
  terrain: { waterY: -4, platforms: [{ x0: -10, x1: edge, top: 0 }, { x0: far, x1: far + 40, top: 0 }] },
  recoil: { x0: 2.5, x1: 5, kind: 'cannon', ballMass: 12, muzzle: 30, angle: 0, charMass: 70, shots: 1 },
  zones: [{ id: 'recoil', name: 'Recoil gap', x0: 2, x1: far + 2 }],
  checkpoints: [{ id: 'recoil', x: 0 }],
};
const res = searchIdealRun(course);
console.log(`gap ${gap} m: cleared ${res.cleared}`, JSON.stringify(res.plan), res.windows.map((w) => `${w.obstacle} ${w.lo}..${w.hi}`).join('; '));
if (res.cleared) course.plan = res.plan;
writeFileSync(out, JSON.stringify(course, null, 2) + '\n');
