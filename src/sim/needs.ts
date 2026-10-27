import type { CourseData } from '../course/course';
import { DEFAULT_PARAMS, NO_INPUT, startState, step } from './runner';
import { groundAt, type Terrain } from './terrain';

// What the Course asks of the player at each gap, found by trying the simulator: how wide it is and the least
// speed at the edge that still clears it. The Dojo and the Course use these same numbers.
export interface GapSpec { x: number; width: number; rise: number; needed: number; name: string }

// Least speed (m/s) at which a jump from the edge reaches a platform `width` away and `rise` higher.
export function minSpeedToCross(width: number, rise: number, jumpSpeed: number): number {
  const terrain: Terrain = { platforms: [{ x0: -50, x1: 0, top: 0 }, { x0: width, x1: width + 60, top: rise }], waterY: -30 };
  const clears = (v: number): boolean => {
    let s = { ...startState(0), vx: v };
    s = step(s, { ...NO_INPUT, jump: true, jumpSpeed }, DEFAULT_PARAMS, terrain);
    for (let i = 0; i < 120 * 20 && !s.grounded && !s.splashed; i++) s = step(s, NO_INPUT, DEFAULT_PARAMS, terrain);
    return s.grounded && !s.splashed && s.x >= width;
  };
  let lo = 0.5, hi = 20;
  if (!clears(hi)) return Infinity;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (clears(mid)) hi = mid; else lo = mid; }
  return hi;
}

export function gapSpecs(course: CourseData): GapSpec[] {
  const ps = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
  const out: GapSpec[] = [];
  ps.forEach((p, i) => {
    const n = ps[i + 1];
    if (!n || n.x0 - p.x1 < 0.01 || p.bouncy) return;
    const width = n.x0 - p.x1;
    const rise = n.top - p.top;
    out.push({ x: p.x1, width, rise, needed: minSpeedToCross(width, rise, course.jumpSpeed), name: `gap at ${p.x1} m` });
  });
  return out;
}
export { groundAt };
