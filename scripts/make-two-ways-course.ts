// "Two ways" (CC-224): one fork, two ways over the same 12 m. Run this, then `npx tsx scripts/ways-plan.ts` stores the proved line of each way.
// High way: swing over the gap on two bars (the speed is kept, the grab windows are small, the landing is a 2 m drop that needs a roll).
// Low way: drop 4 m to a low floor and roll, jump a short gap, climb a 2 m wall (slow, with room to be late).
import { writeFileSync } from 'node:fs';
const EDGE = 24, JOIN = 36;
const platforms: { x0: number; x1: number; top: number }[] = [
  { x0: -10, x1: EDGE, top: 0 }, // 0 run-up and the fork
  { x0: JOIN, x1: JOIN + 30, top: -2 }, // 1 the join and the run to the finish
  { x0: EDGE + 2, x1: EDGE + 7, top: -4.45 }, // 2 low way: the floor you drop to
  { x0: EDGE + 9.5, x1: JOIN, top: -4.45 }, // 3 low way: after a short gap, the foot of the wall
];
const course = {
  version: 1, name: 'Two ways', startX: 8, finishX: JOIN + 24, jumpSpeed: 4.5, jumpKeep: 0.88,
  terrain: { waterY: -9, platforms },
  holds: [{ x: EDGE + 3, y: 3.4 }, { x: EDGE + 6.5, y: 3.4 }],
  zones: [{ id: 'fork', name: 'The fork: two ways', x0: EDGE - 6, x1: JOIN + 4 }],
  checkpoints: [{ id: 'fork', x: 8 }],
  branches: [{
    id: 'fork', name: 'The fork', forkX: EDGE - 4, joinX: JOIN + 2,
    routes: [
      { id: 'high', name: 'High way: swing on the bars', band: [-3, 99], own: { holds: [0, 1] }, icons: ['lache', 'drop'] },
      { id: 'low', name: 'Low way: drop, roll, jump, climb', band: [-99, -3], own: { platforms: [2, 3] }, icons: ['drop', 'gap', 'climb'] },
    ],
  }],
  hazard: 'lava',
};
writeFileSync('public/assets/demo/two-ways.course.json', JSON.stringify(course, null, 2) + '\n');
