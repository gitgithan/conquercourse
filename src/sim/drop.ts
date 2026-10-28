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
// The roll is pressed inside a tight window: the last 0.15 s before touchdown AND the last 1.2 m above the ground (both at once, so whichever is shorter).
// An earlier press does nothing (there is no hidden buffer: the landing is then a normal one); a press up to 3 ticks after touchdown is forgiven.
export const ROLL_WINDOW_S = 0.15;
export const ROLL_WINDOW_M = 1.2;
export const ROLL_FORGIVE_TICKS = 3;

function comingFall(w: WorldState, course: CourseData): { v: number; tau: number; h: number } | null {
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
  return { v: Math.sqrt(r.vy * r.vy + 2 * GRAVITY * Math.max(0, r.y - floor)), tau, h: Math.max(0, r.y - floor) };
}

// Is the runner inside the roll window right now?
export function rollWindowOpen(w: WorldState, course: CourseData): boolean {
  const f = comingFall(w, course);
  return !!f && f.tau <= ROLL_WINDOW_S + 1e-9 && f.h <= ROLL_WINDOW_M + 1e-9;
}

// The same window on a predicted path (one point per tick, the last point is the landing): the index of the point where the window opens.
export function rollWindowStart(path: { x: number; y: number }[]): number {
  const n = path.length, end = path[n - 1];
  let k = n - 1;
  while (k > 0 && n - 1 - (k - 1) <= Math.round(ROLL_WINDOW_S * 120) && path[k - 1].y - end.y <= ROLL_WINDOW_M + 1e-9) k--;
  return k;
}

// Is the runner about to land from a fall a squat would not take cleanly, and inside the roll window? Then the roll is pressed now (the ideal run does this at the first tick of the window).
const ROLL_NEEDED_ABOVE = safeDrop('squat', DEFAULT_LANDING).clean * 0.9; // worked out once: the search asks this in every simulated step
export function rollNeeded(w: WorldState, course: CourseData): boolean {
  const f = comingFall(w, course);
  return !!f && f.tau <= ROLL_WINDOW_S + 1e-9 && f.h <= ROLL_WINDOW_M + 1e-9 && f.v * f.v / (2 * GRAVITY) > ROLL_NEEDED_ABOVE;
}
