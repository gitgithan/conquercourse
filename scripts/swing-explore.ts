// Usage: npx tsx scripts/swing-explore.ts [spacing ...]   (bars at the same height, 2.9 m up)
// For each spacing between two bars: the pump times (ticks, pumping with the swing) after which letting go and holding a hand up catches the second bar,
// the highest pull on the hands seen, and how long the swing takes to reach 90% of the grip. Used to tune pump and grip in src/sim/holds.ts (CC-58).
import type { CourseData } from '../src/course/course';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';
import { DEFAULT_HANG, feetOf, gripLoad } from '../src/sim/holds';

const course = (spacing: number): CourseData => ({
  version: 1, name: 'x', startX: 0, finishX: 80, jumpSpeed: 4.5,
  terrain: { waterY: -6, platforms: [{ x0: -10, x1: 6, top: 0 }, { x0: 9 + spacing + 3, x1: 80, top: 0 }] },
  holds: [{ x: 9, y: 2.9 }, { x: 9 + spacing, y: 2.9 }],
});
function start(c: CourseData): WorldState {
  const w = newWorld(c, 0);
  const f = feetOf(c.holds![0], { hold: 0, theta: 0, omega: 0 });
  return { ...w, mode: 'hang', hang: { hold: 0, theta: 0.05, omega: 0 }, runner: { ...w.runner, x: f.x, y: f.y, grounded: false } };
}
export function tryRelease(c: CourseData, T: number, pump = true) {
  let w = start(c);
  let maxLoad = 0;
  for (let i = 0; i < T && w.mode === 'hang'; i++) {
    const fwd = (w.hang!.omega >= 0);
    w = stepWorld(w, { ...NO_INPUT, handL: true, handR: true, run: pump && fwd, left: pump && !fwd }, c);
    if (w.hang) maxLoad = Math.max(maxLoad, Math.abs(gripLoad(w.hang)));
  }
  if (w.mode !== 'hang') return { ok: false, slipped: true, maxLoad };
  w = stepWorld(w, { ...NO_INPUT }, c);
  for (let i = 0; i < 400; i++) {
    w = stepWorld(w, { ...NO_INPUT, run: true, handR: true }, c);
    if (w.mode === 'hang' && w.hang!.hold === 1) return { ok: true, maxLoad };
    if (w.outcome !== 'running') break;
  }
  return { ok: false, maxLoad };
}
const SP = process.argv.slice(2).map(Number); for (const sp of (SP.length ? SP : [2.5, 3.5, 4.5, 5.5, 6.5, 7.5])) {
  const c = course(sp);
  const oks: number[] = []; let load = 0;
  for (let T = 0; T <= 1500; T += 3) { const r = tryRelease(c, T); load = Math.max(load, r.maxLoad); if (r.ok) oks.push(T); }
  const none: number[] = [];
  console.log(`spacing ${sp}: pumped ok at ${oks.length ? `${oks[0]}..${oks[oks.length - 1]} ticks (${oks.length} values)` : 'never'}; unpumped ${none.length ? 'ok' : 'never'}; peak grip ${load.toFixed(2)} BW`);
}
// energy build: ticks until the grip load first reaches 90% of the limit
let w = start(course(3.5)); let t = 0; for (; t < 5000; t++) { w = stepWorld(w, { ...NO_INPUT, handL: true, run: w.hang!.omega >= 0, left: w.hang!.omega < 0 }, course(3.5)); if (Math.abs(gripLoad(w.hang!)) > 0.9 * DEFAULT_HANG.grip) break; }
console.log('ticks to 90% grip load:', t, (t / 120).toFixed(1), 's');
