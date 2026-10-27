import type { CourseData } from '../course/course';
import { DEFAULT_PARAMS, NO_INPUT, startState, step } from './runner';
import { heightAt, groundAt, type Terrain } from './terrain';
import { DEFAULT_WALL, runWall, type WallParams } from './wall';

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
    const rise = heightAt(n, n.x0) - heightAt(p, p.x1); // from where the feet leave to where they arrive
    out.push({ x: p.x1, width, rise, needed: minSpeedToCross(width, rise, course.jumpSpeed), name: `gap at ${p.x1} m` });
  });
  return out;
}
export { groundAt };

// Least speed (m/s) at the foot of the wall for the hands to reach the top.
export function minSpeedForWall(p: Partial<WallParams> = {}): number {
  const wp = { ...DEFAULT_WALL, ...p };
  let lo = 0.5, hi = 20;
  if (!runWall(hi, wp).grabbed) return Infinity;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (runWall(mid, wp).grabbed) hi = mid; else lo = mid; }
  return hi;
}

// What a jump does from a given place and speed: the flight path and where it ends. Used by the Course's replay
// to draw the player's flight and the flight that would have worked.
export interface Flight { pts: { x: number; y: number }[]; landed: boolean; x: number }
export function flightPath(t: Terrain, x: number, y: number, vx: number, jumpSpeed: number): Flight {
  let s = { ...startState(x), y, vx };
  s = step(s, { ...NO_INPUT, jump: true, jumpSpeed }, DEFAULT_PARAMS, t);
  const pts = [{ x: s.x, y: s.y }];
  for (let i = 0; i < 120 * 20 && !s.grounded && !s.splashed; i++) { s = step(s, NO_INPUT, DEFAULT_PARAMS, t); pts.push({ x: s.x, y: s.y }); }
  return { pts, landed: s.grounded && !s.splashed, x: s.x };
}

// The stretch before an edge where pressing jump at this speed still clears the gap (null: no press does).
export function pressBand(t: Terrain, edgeX: number, edgeY: number, width: number, speed: number, jumpSpeed: number): { lo: number; hi: number } | null {
  let lo = Infinity, hi = -Infinity;
  for (let p = edgeX - 6; p <= edgeX + 1e-9; p += 0.05) {
    const f = flightPath(t, p, edgeY, speed, jumpSpeed);
    if (f.landed && f.x >= edgeX + width) { lo = Math.min(lo, p); hi = Math.max(hi, p); }
  }
  return hi < lo ? null : { lo, hi };
}
