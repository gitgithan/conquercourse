// CC-240: rare balls. Adds the three launchers one by one, each with a long gap (20 s or more), keeping the beat that leaves the ideal run and every checkpoint start clear. Prints the chosen list.
import course from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';
import { BALL_LAUNCHERS, type ShotLauncher } from '../src/sim/shots';

const base = course as unknown as CourseData;
let chosen: ShotLauncher[] = [];
for (const l of BALL_LAUNCHERS) {
  let best: { s: ShotLauncher; windows: number } | null = null;
  for (const every of [20, 30, 40]) for (let phase = 0; phase < every; phase += 1.5) {
    const s = { ...l, every, phase }, c = { ...base, shots: [...chosen, s] };
    const full = searchIdealRun(c);
    if (!full.cleared) continue;
    if (!(c.checkpoints ?? []).every((cp) => searchIdealRun({ ...c, startX: cp.x }).cleared)) continue;
    if (!best || full.windows.length > best.windows) best = { s, windows: full.windows.length };
  }
  console.log('launcher at', l.x, best ? `every ${best.s.every} phase ${best.s.phase} windows ${best.windows}` : 'NONE clears; left out');
  if (best) chosen = [...chosen, best.s];
}
console.log('RESULT', JSON.stringify(chosen));
console.log('DONE');
