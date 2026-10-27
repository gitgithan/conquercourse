import { DT, GRAVITY } from './units';

// Holds: bars hanging in the air (a game, not real: they need no frame). The runner grabs one with the hands (Q and/or E)
// when the hands are within reach, hangs from it as a pendulum, pumps the swing with the arrow keys, and lets go to fly.
// Everything is a metre or a second; the pendulum is integrated with RK4 at the fixed step, like the rope.
export interface Hold { x: number; y: number } // the bar, seen from the side: where along the run and how high

export interface HangParams {
  handHeight: number; // m, hands above the feet when the arms are stretched up
  bodyLength: number; // m, from the hands to the centre of the body (the pendulum's length is 2/3 of the hands-to-feet length for a rod)
  reach: number; // m, how close the hands must be to the bar to grab it
  catchKeep: number; // share of the speed along the swing that the arms keep when they catch (the rest is absorbed)
  pump: number; // rad/s^2, how hard the body can drive the swing with the arrow keys
  drag: number; // 1/s, air and grip losses
  gravity: number;
}

export const DEFAULT_HANG: HangParams = { handHeight: 2.1, bodyLength: 1.1, reach: 0.45, catchKeep: 0.7, pump: 1.5, drag: 0.04, gravity: GRAVITY };

export interface Hang {
  hold: number; // index into the course's holds
  theta: number; // rad from hanging straight down; positive swings forward (toward +x)
  omega: number; // rad/s
}

// The effective pendulum length of a stretched body hanging by the hands (a uniform rod of length handHeight: 2/3 of it).
export const pendulumLength = (p: HangParams = DEFAULT_HANG): number => (2 / 3) * p.handHeight;

// Where the feet are while hanging.
export function feetOf(h: Hold, s: Hang, p: HangParams = DEFAULT_HANG): { x: number; y: number } {
  return { x: h.x + p.handHeight * Math.sin(s.theta), y: h.y - p.handHeight * Math.cos(s.theta) };
}

// The velocity of the body's middle (what flies on when the hands let go).
export function bodyVelocity(s: Hang, p: HangParams = DEFAULT_HANG): { vx: number; vy: number } {
  const v = s.omega * p.bodyLength;
  return { vx: v * Math.cos(s.theta), vy: v * Math.sin(s.theta) };
}

// Grab: the hands (above the feet at x, y) must be within reach of the bar. The arms keep part of the speed along the swing.
export function tryGrab(holds: Hold[], x: number, y: number, vx: number, vy: number, p: HangParams = DEFAULT_HANG): Hang | null {
  const hx = x, hy = y + p.handHeight;
  let best = -1, bd = Infinity;
  holds.forEach((h, i) => { const d = Math.hypot(hx - h.x, hy - h.y); if (d <= p.reach && d < bd) { bd = d; best = i; } });
  if (best < 0) return null;
  // hang from the bar: the body hangs straight down from the hands, moving with the tangent speed at the bottom of the swing
  const theta = 0;
  return { hold: best, theta, omega: (vx * p.catchKeep) / p.bodyLength + 0 * vy };
}

// One step. pump is +1 (forward key), -1 (back key) or 0: pressing the way the body is already moving adds energy, pressing against it takes energy out.
export function hangStep(s: Hang, pump: -1 | 0 | 1, p: HangParams = DEFAULT_HANG): Hang {
  const L = pendulumLength(p);
  const f = (th: number, w: number) => -(p.gravity / L) * Math.sin(th) + p.pump * pump - p.drag * w;
  const k1t = s.omega, k1w = f(s.theta, s.omega);
  const k2t = s.omega + 0.5 * DT * k1w, k2w = f(s.theta + 0.5 * DT * k1t, k2t);
  const k3t = s.omega + 0.5 * DT * k2w, k3w = f(s.theta + 0.5 * DT * k2t, k3t);
  const k4t = s.omega + DT * k3w, k4w = f(s.theta + DT * k3t, k4t);
  return { hold: s.hold, theta: s.theta + (DT / 6) * (k1t + 2 * k2t + 2 * k3t + k4t), omega: s.omega + (DT / 6) * (k1w + 2 * k2w + 2 * k3w + k4w) };
}

// Letting go: the feet are where they were, the body flies on with its own velocity.
export function releaseHang(h: Hold, s: Hang, p: HangParams = DEFAULT_HANG) {
  const f = feetOf(h, s, p), v = bodyVelocity(s, p);
  return { x: f.x, y: f.y, vx: v.vx, vy: v.vy };
}

// Measured small-swing period (for the tests and the Dojo): time between two returns to the same side, no pumping, no drag.
export function measureHangPeriod(theta0: number, p: HangParams = { ...DEFAULT_HANG, drag: 0 }): number {
  let s: Hang = { hold: 0, theta: theta0, omega: 0 };
  let t = 0, prev = s.theta, first = 0, crossings = 0;
  while (t < 60) {
    s = hangStep(s, 0, p); t += DT;
    if (prev > 0 && s.theta <= 0) { const tc = t - DT + (DT * prev) / (prev - s.theta); if (crossings === 0) first = tc; else return tc - first; crossings++; }
    prev = s.theta;
  }
  return NaN;
}
