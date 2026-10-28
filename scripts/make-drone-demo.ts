// Writes the drone ferry demo: a 40 m gap no run-up can jump, a pad with a cargo drone, and the proved line (where to lean back and where to climb down).
// `npx tsx scripts/make-drone-demo.ts [gap=40] [batteryWh=50] [out=public/assets/demo/drone.course.json]`
import { writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';

const gap = Number(process.argv[2] ?? 40);
const battery = Number(process.argv[3] ?? 50);
const out = process.argv[4] ?? 'public/assets/demo/drone.course.json';
const edge = 10, far = edge + gap;
const course: CourseData = {
  version: 1,
  name: 'Drone ferry: carried across a gap',
  startX: 0,
  finishX: far + 12,
  jumpSpeed: 4.5,
  terrain: { waterY: -6, platforms: [{ x0: -10, x1: edge, top: 0 }, { x0: far, x1: far + 40, top: 0 }] },
  drone: { x0: 3, x1: 7, battery },
  zones: [{ id: 'drone', name: 'Drone gap', x0: 2, x1: far + 2 }],
  checkpoints: [{ id: 'drone', x: 0 }],
};
const res = searchIdealRun(course);
console.log(`gap ${gap} m, battery ${battery} Wh: cleared ${res.cleared}`, JSON.stringify(res.plan), res.windows.map((w) => `${w.obstacle} ${w.lo}..${w.hi} (${w.widthMs.toFixed(0)} ms)`).join('; '));
if (res.cleared) course.plan = res.plan;
writeFileSync(out, JSON.stringify(course, null, 2) + '\n');
