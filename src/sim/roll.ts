import { DEFAULT_LANDING } from './landing';
import type { RunnerState } from './runner';
import type { Terrain } from './terrain';
import { groundAt } from './terrain';
import { DT } from './units';

// The ground roll (X on the ground, standing or running): the body tucks, rolls forward along the ground and comes up on its feet.
// It is the same move as the landing roll, so it takes the same time (0.5 s to roll out, 0.2 s to get up) and keeps the same share of the speed.
export const GROUND_ROLL_TIME = DEFAULT_LANDING.rollStopTime + 0.2; // s
export const GROUND_ROLL_KEEP = DEFAULT_LANDING.rollKeep; // 85 % of the speed is still there when the roll ends
// From a stand the legs push for about 0.4 s at the sprint's grip-limited pull (about 0.6 g): 0.6 x 9.81 x 0.4 = 2.4 m/s, so a roll from standing
// starts at 2.5 m/s, ends at 85 % of it and covers about 1.6 m. A runner already faster than that keeps its own speed.
export const GROUND_ROLL_PUSH = 2.5; // m/s
// A roll is effort like a vault, and the body needs a moment to be ready again: it cannot be spammed.
export const GROUND_ROLL_COST = 0.02; // share of a full energy store (a vault is 0.025, a jump 0.06)
export const GROUND_ROLL_RECOVERY = 0.3; // s after getting up before the next roll can start
export const ROLL_BODY_HEIGHT = 0.55; // m, how tall the body is while rolled (a later 'duck under' obstacle can use it; nothing does yet)

export interface GroundRoll {
  start: number; // tick the roll began
  end: number; // tick the roll ends (start + GROUND_ROLL_TIME)
  v0: number; // m/s along the roll's direction at the start
  vEnd: number; // m/s at the end
  dir: 1 | -1;
}

// Starts from the runner's speed and the way it faces (the way it runs, or the key held, or forward from a stand).
export function startGroundRoll(s: RunnerState, dir: 1 | -1 | 0): GroundRoll {
  const d: 1 | -1 = Math.abs(s.vx) > 0.3 ? (s.vx < 0 ? -1 : 1) : dir !== 0 ? dir : 1;
  const v0 = Math.max(Math.abs(s.vx), GROUND_ROLL_PUSH);
  return { start: s.tick + 1, end: s.tick + 1 + Math.round(GROUND_ROLL_TIME / DT), v0, vEnd: v0 * GROUND_ROLL_KEEP, dir: d };
}

// One tick of the roll: the speed falls evenly from v0 to vEnd. A roll that comes to an edge, or to the face of something it cannot roll over, ends there.
export function stepGroundRoll(s: RunnerState, g: GroundRoll, t: Terrain): { runner: RunnerState; ended: boolean } {
  const tick = s.tick + 1;
  const k = Math.min(1, (tick - g.start) / Math.max(1, g.end - g.start));
  const v = g.v0 + (g.vEnd - g.v0) * k;
  const x = s.x + g.dir * v * DT, floor = groundAt(t, x);
  if (floor < s.y - 1e-6 || floor > s.y + 0.05) return { runner: { ...s, tick, vx: 0, vy: 0 }, ended: true }; // an edge or a wall: the roll ends where it is
  const done = tick >= g.end;
  return { runner: { ...s, tick, x, y: floor, vx: done ? g.dir * g.vEnd : g.dir * v, vy: 0, grounded: true }, ended: done };
}
