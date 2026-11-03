import type { CourseData } from '../course/course';
import { barsFeet, barsRelease, barsSlips, barsStep, barsVelocity, tryGrabBars, type BarsHang } from './bars';
import { DEFAULT_HANG } from './holds';
import type { RunnerState } from './runner';
import type { GameEvent, WorldState } from './world';

// The world's side of the monkey bars (docs/bars.md): the catch from the air and the tick while hanging. Kept out of world.ts so that file only gets two small hooks.
export function tryBarsGrab(course: CourseData, r: RunnerState, again: boolean): BarsHang | null {
  return tryGrabBars(course.bars ?? [], r.x, r.y, r.vx, r.vy, again, undefined, course.grabReach ?? DEFAULT_HANG.reach);
}

export function stepBarsWorld(w: WorldState, input: { handL?: boolean; handR?: boolean; run: boolean; left?: boolean; reachL?: boolean; reachR?: boolean }, course: CourseData): WorldState {
  const tick = w.runner.tick + 1;
  const run = course.bars![w.bars!.run];
  const fly = (s: BarsHang, slipped: boolean): WorldState => {
    const rel = barsRelease(run, s);
    return { ...w, mode: 'run', bars: null, noCatchUntil: tick + 24, events: [{ tick, type: 'bars-release', detail: { vx: rel.vx, vy: rel.vy, slipped } }], runner: { ...w.runner, tick, x: rel.x, y: rel.y, vx: rel.vx, vy: rel.vy, grounded: false } };
  };
  // both hands off the key: let go and fly on (the only way off the bars besides the grip opening on a swing too fast to hold)
  if (!input.handL && !input.handR) return fly(w.bars!, false);
  const pump = (input.run ? 1 : 0) - (input.left ? 1 : 0);
  const { s, events } = barsStep(w.bars!, run, !!input.reachL, !!input.reachR, pump);
  if (barsSlips(s)) return fly(s, true);
  const f = barsFeet(run, s), v = barsVelocity(s);
  const ev: GameEvent[] = events.map((e) => ({ tick, type: e.type, detail: { hand: e.hand, ...(e.rung !== undefined ? { rung: e.rung } : {}), ...(e.why ? { [e.why]: true } : {}) } }));
  return { ...w, bars: s, events: ev, runner: { ...w.runner, tick, x: f.x, y: f.y, vx: v.vx, vy: v.vy, grounded: false } };
}
