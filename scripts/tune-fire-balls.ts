// CC-240: the beat for balls that fire every 20 s or less. Launchers are added one by one (the pair at x = 52 together); each takes the shortest gap, then the phase, that
// leaves the ideal run AND a start at every checkpoint clear on both the Cannonballs course (with its wall) and the First Course (?balls=1). Prints the chosen list.
// The moves are searched once per start (they do not depend on the balls); only the wait at the start is searched per beat.
import course from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { searchIdealRun, startDelayFor } from '../src/sim/ideal';
import { BALL_LAUNCHERS, CANNON_STACK, CANNON_WALL, withCannonWall, type ShotLauncher } from '../src/sim/shots';

const first = course as unknown as CourseData;
const cannon = withCannonWall(first);
const GAPS = (process.env.GAPS ?? '12,14,16,18,20').split(',').map(Number);
const STEP = Number(process.env.STEP ?? 1);
const starts = (c: CourseData) => [c.startX, ...(c.checkpoints ?? []).map((cp) => cp.x)];
const plains = (c: CourseData) => starts(c).map((x) => { const r = searchIdealRun({ ...c, startX: x, shots: undefined }); return r.cleared ? r.plan : null; });
const plainsFirst = plains(first), plainsCannon = plains(cannon);
if (plainsFirst.includes(null) || plainsCannon.includes(null)) throw new Error('a plain start does not clear');
const clears = (c: CourseData, ps: typeof plainsFirst, shots: ShotLauncher[]): boolean => starts(c).every((x, i) => !!startDelayFor({ ...c, startX: x, shots }, ps[i]!));

const isStack = (s: ShotLauncher) => s.x === CANNON_STACK.x && s.y === CANNON_STACK.y;
const forCannon = (l: ShotLauncher[]) => l.map((s) => (s.x === 52 ? { ...s, stopX: CANNON_WALL.x1 } : s)); // the wall's face stops the two balls from x = 52
const forFirst = (l: ShotLauncher[]) => l.filter((s) => !isStack(s));
let chosen: ShotLauncher[] = [];
const groups: ShotLauncher[][] = [[BALL_LAUNCHERS[0]], [BALL_LAUNCHERS[1], CANNON_STACK], [BALL_LAUNCHERS[2]]];
for (const g of groups) {
  let pick: { every: number; phase: number } | null = null;
  outer: for (const every of GAPS) for (let phase = 0; phase < every; phase += STEP) {
    const all = [...chosen, ...g.map((s) => ({ ...s, every, phase }))];
    if (clears(cannon, plainsCannon, forCannon(all)) && clears(first, plainsFirst, forFirst(all))) { pick = { every, phase }; break outer; }
  }
  console.log('launcher group at', g.map((s) => s.x), pick ? `every ${pick.every} phase ${pick.phase}` : 'NONE clears; left out');
  if (pick) chosen = [...chosen, ...g.map((s) => ({ ...s, ...pick! }))];
}
console.log('RESULT', JSON.stringify(chosen.filter((s) => !isStack(s))), 'stack', JSON.stringify(chosen.filter(isStack)));
console.log('DONE');
