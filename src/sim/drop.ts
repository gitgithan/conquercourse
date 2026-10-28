import type { CourseData } from '../course/course';
import { DEFAULT_LANDING, safeDrop } from './landing';
import { groundAt } from './terrain';
import { GRAVITY } from './units';
import type { WorldState } from './world';

// How far a drop can be and still be survived, from the landing physics (src/sim/landing.ts): the lane builders and the generator use these.
export const SQUAT_CLEAN_DROP = safeDrop('squat').clean; // m: a squat lands this far down with no stumble
export const ROLL_SURVIVE_DROP = safeDrop('roll').survive; // m: a roll survives this far down
export const LANE_DROP = Math.floor(ROLL_SURVIVE_DROP * 0.8 * 10) / 10; // m: lanes allow this much drop, so the ideal run has room to spare

// Where the runner is about to land and how hard: the fall in the next quarter of a second (null when not falling toward the ground).
function comingFall(w: WorldState, course: CourseData): { v: number; tau: number } | null {
  const r = w.runner;
  if (r.grounded || w.mode !== 'run' || r.vy >= 0) return null;
  const under = (x: number) => Math.max(course.terrain.waterY, groundAt(course.terrain, x)); // over a gap there is no ground: the water is the floor
  let floor = under(r.x), tau = 0;
  for (let i = 0; i < 8; i++) { // the landing spot and the fall time depend on each other (an edge or a gap below): iterate until they agree
    const d = r.y - floor;
    tau = d <= 0 ? 0 : (r.vy + Math.sqrt(r.vy * r.vy + 2 * GRAVITY * d)) / GRAVITY; // time to fall d metres from the speed vy (negative is down)
    const next = under(r.x + r.vx * tau);
    if (next === floor) break;
    floor = next;
  }
  return { v: Math.sqrt(r.vy * r.vy + 2 * GRAVITY * Math.max(0, r.y - floor)), tau };
}

// Is the runner about to land from a fall a squat would not take cleanly? Then a roll is needed: pressed within the last quarter second it counts.
export function rollNeeded(w: WorldState, course: CourseData): boolean {
  const f = comingFall(w, course);
  const limit = safeDrop('squat', DEFAULT_LANDING).clean;
  return !!f && f.tau <= 0.2 && f.v * f.v / (2 * GRAVITY) > limit * 0.9;
}

// Would landing with straight legs and no roll stumble or hurt? (about 1.8 m of fall, from the same landing physics) Then the drum lane shows the X drum:
// every landing that can cause a warning (a stumble) or a failure (a hard landing) has the key that avoids it on the strip, not only the landings that need it to survive.
export function rollAdvised(w: WorldState, course: CourseData): boolean {
  const f = comingFall(w, course);
  const limit = safeDrop('stiff', DEFAULT_LANDING).clean;
  return !!f && f.tau <= 0.2 && f.v * f.v / (2 * GRAVITY) > limit;
}
