// "Two ways" (CC-224): one fork, two ways over the same 14 m. Run this, then `npx tsx scripts/ways-plan.ts` stores the proved line of each way.
// High way: swing over the gap on two bars (the speed is kept, the grab windows are small, the landing is a 2 m drop).
// Low way: drop to a deep floor (a hard landing that wants a roll), jump a short gap, then climb twice (a ledge, then the join wall).
// A long jump from the high deck cannot skip the low way: its steps start further out than a jump from the deck reaches (the join is 14 m on).
// Knobs (env, for the tuning sweep scripts/ways-sweep.sh): JOIN, BARS (x of each bar), BAR_Y, LOWTOP (top of the deep floors), LEDGES (steps up to the join, each one a climb).
import { writeFileSync } from 'node:fs';
const EDGE = 24, JOIN = Number(process.env.JOIN ?? 38);
const BARS = (process.env.BARS ?? '27,30.5').split(',').map(Number); // x of each bar on the high way
const NB = BARS.length;
const BAR_Y = Number(process.env.BAR_Y ?? 3.4);
const LOWTOP = Number(process.env.LOWTOP ?? -6.7);
const LEDGES = Number(process.env.LEDGES ?? 1); // steps between the deep floor and the join (each is one climb)
const GATE = process.env.GATE === '1'; // CC-228 (off by default; the shipped course is built without it): the far low floors are solid only after standing on the deep floor, so a jump from the high deck cannot skip the low way
const D1 = process.env.D1 ? Number(process.env.D1) : null; // end of the deep floor (default: set by the join)
const F0 = process.env.F0 ? Number(process.env.F0) : null; // start of the wall foot after the gap (default: set by the join)
const OUT = process.env.OUT ?? 'public/assets/demo/two-ways.course.json';
const platforms: { x0: number; x1: number; top: number }[] = [
  { x0: -10, x1: EDGE, top: 0 }, // 0 run-up and the fork
  { x0: JOIN, x1: JOIN + 30, top: -2 }, // 1 the join and the run to the finish
  { x0: EDGE + 2, x1: D1 ?? Math.min(EDGE + 7, JOIN - 8 - 2.5 * Math.max(0, LEDGES - 1)), top: LOWTOP }, // 2 low way: the deep floor you drop to
  { x0: F0 ?? (LEDGES ? JOIN - 6.5 - 2.5 * (LEDGES - 1) : JOIN - 2.5), x1: LEDGES ? JOIN - 2.5 * LEDGES : JOIN, top: LOWTOP }, // 3 low way: after a short gap, the foot of the first wall
];
for (let k = 1; k <= LEDGES; k++) platforms.push({ x0: JOIN - 2.5 * (LEDGES - k + 1), x1: JOIN - 2.5 * (LEDGES - k), top: LOWTOP + 2.4 * k }); // 4.. low way: steps up, each one a climb
if (GATE) for (let i = 3; i < platforms.length; i++) (platforms[i] as { gate?: number }).gate = 2;
const course = {
  version: 1, name: 'Two ways', startX: 8, finishX: JOIN + 24, jumpSpeed: 4.5, jumpKeep: 0.88,
  terrain: { waterY: Math.min(-9, LOWTOP - 4.5), platforms },
  holds: Array.from({ length: NB }, (_, k) => ({ x: BARS[k], y: BAR_Y })),
  zones: [{ id: 'fork', name: 'The fork: two ways', x0: EDGE - 6, x1: JOIN + 4 }],
  checkpoints: [{ id: 'fork', x: 8 }],
  branches: [{
    id: 'fork', name: 'The fork', forkX: EDGE - 4, joinX: JOIN + 2,
    routes: [
      { id: 'high', name: 'High way: swing on the bars', band: [-3, 99], own: { holds: Array.from({ length: NB }, (_, k) => k) }, icons: ['lache', 'drop'] },
      { id: 'low', name: LEDGES === 2 ? 'Low way: drop, jump, climb three times' : LEDGES === 1 ? 'Low way: drop, jump, climb twice' : 'Low way: drop, jump, climb', band: [-99, -3], own: { platforms: [2, 3, ...Array.from({ length: LEDGES }, (_, k) => 4 + k)] }, icons: ['drop', 'gap', ...Array.from({ length: LEDGES + 1 }, () => 'climb')] },
    ],
  }],
  hazard: 'lava',
};
writeFileSync(OUT, JSON.stringify(course, null, 2) + '\n');
