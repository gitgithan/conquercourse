import type { CourseData } from '../course/course';
import { DEFAULT_LANDING, safeDrop } from './landing';
import { groundAt } from './terrain';
import { GRAVITY } from './units';
import type { WorldState } from './world';

// How far a drop can be and still be survived, from the landing physics (src/sim/landing.ts): the lane builders and the generator use these.
export const SQUAT_CLEAN_DROP = safeDrop('squat').clean; // m: a squat lands this far down with no stumble
export const ROLL_SURVIVE_DROP = safeDrop('roll').survive; // m: a roll survives this far down
export const LANE_DROP = Math.floor(ROLL_SURVIVE_DROP * 0.8 * 10) / 10; // m: lanes allow this much drop, so the ideal run has room to spare

// Is the runner about to land from a fall a squat would not take cleanly? Then a roll is needed: pressed within the last quarter second it counts.
export function rollNeeded(w: WorldState, course: CourseData): boolean {
  const r = w.runner;
  if (r.grounded || w.mode !== 'run' || r.vy >= 0) return false;
  let floor = groundAt(course.terrain, r.x), tau = 0;
  for (let i = 0; i < 3; i++) {
    const d = r.y - floor;
    tau = d <= 0 ? 0 : (r.vy + Math.sqrt(r.vy * r.vy + 2 * GRAVITY * d)) / GRAVITY; // time to fall d metres from the speed vy (negative is down)
    floor = groundAt(course.terrain, r.x + r.vx * tau);
  }
  const v = Math.sqrt(r.vy * r.vy + 2 * GRAVITY * Math.max(0, r.y - floor));
  const limit = safeDrop('squat', DEFAULT_LANDING).clean;
  return tau <= 0.2 && v * v / (2 * GRAVITY) > limit * 0.9;
}
