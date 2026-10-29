import type { Terrain } from './terrain';
import { groundAt, heightAt, platformAt } from './terrain';
import { DEFAULT_HANG } from './holds';
import { JUMP_COST } from './energy';
import { GRAVITY } from './units';

// The climb (hold E at a wall): a step too tall to jump or vault. The runner reaches the top edge with both hands (from the ground, or
// at the top of a jump), hangs from it for a moment and pulls up and over, ending on the top at a walking pace. The run speed is lost: the hands
// stop the body at the wall.
//
// Where the limits come from (Earth gravity, the Rookie's reach):
//   the hands are CLIMB_HAND = 2.1 m over the feet with the arms stretched up, and the fingers must get CLIMB_OVER = 0.1 m over the edge,
//   so from the ground a wall up to 2.2 m can be climbed; a jump adds height: the take-off speed v lifts the feet v^2 / (2 g) (1.03 m at 4.5 m/s),
//   but the hands can only close on an edge while the body is slow, so the grab counts only while the upward speed is at most CLIMB_CATCH_VY:
//   the feet are then at most (v^2 - 2^2) / (2 g) = 0.83 m up, the edge at most 2.2 + 0.83 = 3.03 m over the ground; keep a margin of
//   CLIMB_MARGIN = 0.2 m for the arms to start the pull-up: the tallest wall is climbMaxRise(4.5) = 2.83 m.
export const CLIMB_HAND = DEFAULT_HANG.handHeight; // m, hands over the feet, arms up
export const CLIMB_OVER = 0.1; // m, the fingers go this far over the edge
export const CLIMB_STAND_REACH = CLIMB_HAND + CLIMB_OVER; // 2.2 m: the highest edge the hands reach from where the feet are
export const CLIMB_MIN_RISE = 1.0; // m: below this a jump, a vault or a step does it
export const CLIMB_REACH_X = 0.6; // m: the hands reach this far in front of the body
// A near miss still counts (CC-168): a jump that falls just short of a ledge is caught if the hands are almost there. A tolerance, not a new move:
// the hands lunge a little further forward and stretch a little higher than the standing reach, and the pull-up closes the rest of the gap.
export const CLIMB_TOL_X = 0.3; // m: extra forward reach for the hands
export const CLIMB_TOL_Y = 0.25; // m: extra height for the fingers (an edge up to CLIMB_STAND_REACH + this over the feet)
export const CLIMB_CATCH_VY = 2.0; // m/s: the hands can close on an edge only while the body rises no faster than this
export const CLIMB_MARGIN = 0.2; // m
export const CLIMB_COST = 2 * JUMP_COST; // a pull-up spends as much as two jumps
export const CLIMB_EXIT_SPEED = 2; // m/s: the speed on the top (the run speed is gone)
export const CLIMB_HANG_OFF = 0.3; // m: the body hangs this far in front of the wall face, feet clear of it
export const CLIMB_EXIT_OFF = 0.35; // m: the feet come down this far past the edge
export const CLIMB_CATCH_TICKS = 18; // 0.15 s: the hands take the body's weight and stop it
export const CLIMB_HOLD_TICKS = 12; // 0.1 s
export const CLIMB_PULL_TICKS = 102; // 0.85 s: the pull-up and the step onto the top
export const CLIMB_TICKS = CLIMB_CATCH_TICKS + CLIMB_HOLD_TICKS + CLIMB_PULL_TICKS; // 1.1 s

const apex = (jumpSpeed: number, vy = CLIMB_CATCH_VY) => Math.max(0, (jumpSpeed * jumpSpeed - vy * vy) / (2 * GRAVITY));
// The tallest wall (m above the ground the runner jumps from) one jump reaches and the arms can still pull up.
export const climbMaxRise = (jumpSpeed = 4.5): number => CLIMB_STAND_REACH + apex(jumpSpeed) - CLIMB_MARGIN;

export interface Climb {
  edge: number; // x of the wall face
  top: number; // height of the edge
  i: number; // ticks done
  n: number;
  path: { x: number; y: number }[]; // feet position after tick 0..n (continuous: no tick moves further than the hands pull)
  exit: { x: number; y: number };
}

// The ground the runner jumped from, in front of the wall: the ground at x, or the end of the nearest platform behind it over a gap.
function groundRef(t: Terrain, x: number): number {
  const g = groundAt(t, x);
  if (Number.isFinite(g)) return g;
  let best = -Infinity, bx = -Infinity;
  for (const p of t.platforms) if (p.x1 <= x && p.x1 > bx) { bx = p.x1; best = heightAt(p, p.x1); }
  return best;
}

// The feet path of a climb that starts now, from feet at (x, y).
function makePath(x: number, y: number, edge: number, top: number, exit: { x: number; y: number }): { x: number; y: number }[] {
  const xh = edge - CLIMB_HANG_OFF; // hang a hand's length in front of the wall face
  const yh = Math.max(y, top - CLIMB_HAND + 0.05);
  const S = (u: number) => { const c = Math.min(1, Math.max(0, u)); return c * c * (3 - 2 * c); };
  const out: { x: number; y: number }[] = [{ x, y }];
  for (let k = 1; k <= CLIMB_TICKS; k++) {
    if (k <= CLIMB_CATCH_TICKS) { const u = S(k / CLIMB_CATCH_TICKS); out.push({ x: x + (xh - x) * u, y: y + (yh - y) * u }); continue; }
    if (k <= CLIMB_CATCH_TICKS + CLIMB_HOLD_TICKS) { out.push({ x: xh, y: yh }); continue; }
    const t = (k - CLIMB_CATCH_TICKS - CLIMB_HOLD_TICKS) / CLIMB_PULL_TICKS;
    out.push({ x: xh + (exit.x - xh) * S((t - 0.35) / 0.65), y: yh + (exit.y - yh) * S(t) }); // up first, then over the edge
  }
  out[out.length - 1] = { x: exit.x, y: exit.y };
  return out;
}

// The climb that starts now from feet at (x, y) moving (vx, vy), or null. jumpSpeed is the course's take-off speed (the tallest wall depends on it).
export function findClimb(t: Terrain, x: number, y: number, vx: number, vy: number, jumpSpeed = 4.5): Climb | null {
  if (vy > CLIMB_CATCH_VY || vx < -0.1) return null;
  const here = platformAt(t, x);
  for (const p of t.platforms) {
    if (p === here || p.x0 < x - 0.02 || p.x0 - x > CLIMB_REACH_X + CLIMB_TOL_X) continue;
    const top = heightAt(p, p.x0), below = top - y;
    if (below < CLIMB_MIN_RISE || below > CLIMB_STAND_REACH + CLIMB_TOL_Y) continue; // the hands do not meet the edge
    // the limit of one jump from the ground does not bind a body that is higher than any plain jump takes it (a trampoline lifted it): the hands' reach decides
    const base = groundRef(t, x);
    const lifted = Number.isFinite(base) && y - base > (jumpSpeed * jumpSpeed) / (2 * GRAVITY) + 0.05;
    if (!lifted && Number.isFinite(base) && top - base > climbMaxRise(jumpSpeed) + 1e-9) continue; // a wall above the limit
    const xe = Math.min(p.x0 + CLIMB_EXIT_OFF, Math.max(p.x0 + 0.1, (p.x0 + p.x1) / 2));
    const exit = { x: xe, y: heightAt(p, xe) };
    return { edge: p.x0, top, i: 0, n: CLIMB_TICKS, path: makePath(x, y, p.x0, top, exit), exit };
  }
  return null;
}

// Can the runner climb this wall at all, from the ground (the lane builder and the tests ask this)?
export const climbable = (rise: number, jumpSpeed = 4.5): boolean => rise >= CLIMB_MIN_RISE && rise <= climbMaxRise(jumpSpeed) + 1e-9;

// The next wall ahead that the hands and a pull-up can take (for the debug view and the hint): its edge, its top and whether the hands reach it from the ground.
export function climbAhead(t: Terrain, x: number, y: number, within = 10, jumpSpeed = 4.5): { edge: number; top: number; rise: number; standing: boolean } | null {
  const here = platformAt(t, x);
  let best: { edge: number; top: number; rise: number; standing: boolean } | null = null;
  for (const p of t.platforms) {
    if (p === here || p.x0 < x - 0.02 || p.x0 - x > within) continue;
    const top = heightAt(p, p.x0), rise = top - y;
    if (rise < CLIMB_MIN_RISE || rise > climbMaxRise(jumpSpeed) + 1e-9) continue;
    if (!best || p.x0 < best.edge) best = { edge: p.x0, top, rise, standing: rise <= CLIMB_STAND_REACH };
  }
  return best;
}
