import { DT, GRAVITY } from './units';

// Pole vault (CC-239): the planted pole is a spring leg, the runner a point mass at its top (a spring pendulum).
// The pole adds no energy: speed bends it, the bend gives the height back, and a hold that lasts too long hands the body back to the ground.
// Frame: the planted tip is the origin, x runs toward the bar, y is up; the angle is measured from vertical, negative while the body is still behind the tip.
export interface PoleParams {
  length: number; // m, pole length from tip to the hands
  gripY: number; // m, hand height when the pole is planted (sets the plant angle)
  stiffness: number; // 1/s², spring constant per unit mass
  damping: number; // 1/s, damping per unit mass
  barSlack: number; // m, how far under the bar the centre of mass may pass (the body arches round the bar)
  gravity: number;
}

export const DEFAULT_POLE: PoleParams = { length: 4.5, gripY: 2.6, stiffness: 16, damping: 0.5, barSlack: 0.1, gravity: GRAVITY };

export type PoleOutcome = 'cleared' | 'short' | 'hit_bar' | 'fell_back';

export interface PoleStep { x: number; y: number; r: number; theta: number; held: boolean }
export interface PoleResult {
  outcome: PoleOutcome;
  apexY: number; // m, highest centre of mass reached
  passY: number | null; // m, height as the body crossed the bar line (null if it never did)
  releaseTick: number | null; // ticks after the plant when the key was let go
  landX: number | null; // m past the tip where the body comes down to cushion height
  landVy: number | null; // m/s downward speed there
  barlineTick: number | null;
  path: PoleStep[];
}

export interface Bar { x: number; height: number; cushion?: number }

/** Total energy per unit mass of the spring pendulum: kinetic, height and the bent spring. Constant when damping is 0. */
export function poleEnergy(s: { r: number; dr: number; theta: number; dtheta: number }, p: PoleParams = DEFAULT_POLE): number {
  return 0.5 * (s.dr * s.dr + s.r * s.r * s.dtheta * s.dtheta) + p.gravity * s.r * Math.cos(s.theta) + 0.5 * p.stiffness * (p.length - s.r) ** 2;
}

/** The state at the plant: hands at `gripY`, the pole straight, the body moving at `vx` along the ground. */
export function plantState(vx: number, p: PoleParams = DEFAULT_POLE): { r: number; dr: number; theta: number; dtheta: number } {
  const theta = -Math.acos(Math.min(1, p.gripY / p.length));
  // split the run speed along the pole (compresses it) and across it (swings it)
  return { r: p.length, dr: vx * Math.sin(theta), theta, dtheta: (vx * Math.cos(theta)) / p.length };
}

/** Run at the box at `vx` m/s, plant, hold the key until `releaseTick` (ticks after the plant; null = never let go). */
export function vault(vx: number, bar: Bar, releaseTick: number | null, p: PoleParams = DEFAULT_POLE, maxTicks = 120 * 6): PoleResult {
  let { r, dr, theta, dtheta } = plantState(vx, p);
  // the first tick is before the body has moved: x is measured from the tip, so the body starts behind it
  const accel = (rr: number, d: number, th: number, dth: number): [number, number] => [
    rr * dth * dth - p.gravity * Math.cos(th) + p.stiffness * (p.length - rr) - p.damping * d,
    (p.gravity * Math.sin(th) - 2 * d * dth) / rr,
  ];
  const path: PoleStep[] = [{ x: r * Math.sin(theta), y: r * Math.cos(theta), r, theta, held: true }];
  const cushion = bar.cushion ?? 0.5;
  let apexY = path[0].y, passY: number | null = null, barlineTick: number | null = null, landX: number | null = null, landVy: number | null = null;
  let held = true, released: number | null = null, outcome: PoleOutcome | null = null;
  let x = path[0].x, y = path[0].y, vxb = 0, vyb = 0;
  for (let tick = 1; tick <= maxTicks; tick++) {
    if (held) {
      // RK4 on (r, dr, theta, dtheta)
      const f = (s: number[]) => { const [a, b] = accel(s[0], s[1], s[2], s[3]); return [s[1], a, s[3], b]; };
      const s0 = [r, dr, theta, dtheta];
      const add = (s: number[], k: number[], h: number) => s.map((v, i) => v + h * k[i]);
      const k1 = f(s0), k2 = f(add(s0, k1, DT / 2)), k3 = f(add(s0, k2, DT / 2)), k4 = f(add(s0, k3, DT));
      [r, dr, theta, dtheta] = s0.map((v, i) => v + (DT / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      x = r * Math.sin(theta); y = r * Math.cos(theta);
      // velocity of the body from the polar rates
      vxb = dr * Math.sin(theta) + r * dtheta * Math.cos(theta);
      vyb = dr * Math.cos(theta) - r * dtheta * Math.sin(theta);
      if (dtheta <= 0 && theta < 0 && tick > 10) { outcome = 'fell_back'; path.push({ x, y, r, theta, held }); break; } // the pole stood up and the body is going back
      // held too long: the leaning pole reaches the bar and knocks it off
      if (theta >= Math.atan2(bar.x, bar.height) && r >= Math.hypot(bar.x, bar.height)) { outcome = 'hit_bar'; path.push({ x, y, r, theta, held }); break; }
      if (releaseTick !== null && tick >= releaseTick) { held = false; released = tick; }
    } else {
      vyb -= p.gravity * DT; x += vxb * DT; y += vyb * DT;
    }
    path.push({ x, y, r, theta, held });
    if (y > apexY) apexY = y;
    if (barlineTick === null && x >= bar.x) { barlineTick = tick; passY = y; }
    if (!held && y <= cushion && vyb < 0) { landX = x; landVy = -vyb; break; }
  }
  if (!outcome) {
    if (released === null) outcome = 'fell_back';
    else if (passY === null) outcome = 'short';
    else if (passY < bar.height - p.barSlack) outcome = 'hit_bar';
    else outcome = 'cleared';
  }
  return { outcome, apexY, passY, releaseTick: released, landX, landVy, barlineTick, path };
}

/** The ticks (after the plant) at which a release clears the bar, as a list of [first, last] windows: how forgiving the timing is. */
export function releaseWindow(vx: number, bar: Bar, p: PoleParams = DEFAULT_POLE): { first: number; last: number } | null {
  let first = -1, last = -1;
  for (let t = 1; t <= 120 * 3; t++) {
    if (vault(vx, bar, t, p).outcome === 'cleared') { if (first < 0) first = t; last = t; }
  }
  return first < 0 ? null : { first, last };
}
