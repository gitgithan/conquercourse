import { DT, GRAVITY } from './units';

// Holds: bars hanging in the air (a game, not real: they need no frame). The runner grabs one with the hands (Q and/or E)
// when the hands are within reach, hangs from it as a pendulum, pumps the swing with the arrow keys, and lets go to fly.
// Everything is a metre or a second; the pendulum is integrated with RK4 at the fixed step, like the rope.
//
// The body is one stiff rod, hands at the bar and feet at the far end (length handHeight, a uniform rod):
// its middle (the centre of mass) is half a rod from the bar and the swing behaves like a simple pendulum two thirds of a rod long.
// The swing may go over the top and round in full circles; the limit is the grip: the faster the body swings, the harder the bar
// pulls on the hands (weight plus the pull of the circle), and the hands hold only a few body weights.
export interface Hold { x: number; y: number } // the bar, seen from the side: where along the run and how high

export interface HangParams {
  handHeight: number; // m, hands above the feet when the arms are stretched up (the rod's length)
  reach: number; // m, how close the hands must be to the bar to grab it
  catchKeep: number; // share of the speed along the swing that the arms keep when they catch (the rest is absorbed)
  pump: number; // rad/s^2, how hard the body can drive the swing with the arrow keys
  grip: number; // the most the bar may pull on the hands, in body weights; above it the hands open
  drag: number; // 1/s, air and grip losses
  gravity: number;
}

// grip 5.5: strain-gauge bars measured about 3.5 to 3.7 body weights in ordinary forward and backward giant swings (Kopp and Reid 1980),
// an estimate of 4.9 at the top of the pull (Cureton 1939), and 5 to 6.6 for an elite gymnast in strapped grips (Cagran et al. 2009).
export const DEFAULT_HANG: HangParams = { handHeight: 2.1, reach: 0.6, catchKeep: 0.35, pump: 6, grip: 5.5, drag: 0.04, gravity: GRAVITY };

export interface Hang {
  hold: number; // index into the course's holds
  theta: number; // rad from hanging straight down, wrapped to (-pi, pi]; positive swings forward (toward +x)
  omega: number; // rad/s
}

// The effective pendulum length of a stretched body hanging by the hands (a uniform rod of length handHeight: 2/3 of it).
export const pendulumLength = (p: HangParams = DEFAULT_HANG): number => (2 / 3) * p.handHeight;
// How far the body's middle is from the bar.
export const comDistance = (p: HangParams = DEFAULT_HANG): number => p.handHeight / 2;

// Where the feet are while hanging.
export function feetOf(h: Hold, s: Hang, p: HangParams = DEFAULT_HANG): { x: number; y: number } {
  return { x: h.x + p.handHeight * Math.sin(s.theta), y: h.y - p.handHeight * Math.cos(s.theta) };
}

// The radius the body flies away with. The stiff rod swings with kinetic energy 1/2 I w^2 about the bar (I = m L^2 / 3 for a rod of length L),
// and a body that lets go tucked in turns all of it into flight: 1/2 m v^2 = 1/2 I w^2, so v = w L / sqrt(3), a little more than the middle's own
// w L / 2 (the spin the rod had about its middle goes into the throw, not into a tumble). Measured in CC-67: with the middle's speed alone the flight
// had a quarter of the swing's energy missing, and it looked weaker than the whipping body.
export const releaseRadius = (p: HangParams = DEFAULT_HANG): number => p.handHeight / Math.sqrt(3);

// The velocity of the body's middle after the hands let go (also what the runner shows while it swings, so one number everywhere).
export function bodyVelocity(s: Hang, p: HangParams = DEFAULT_HANG): { vx: number; vy: number } {
  const v = s.omega * releaseRadius(p);
  return { vx: v * Math.cos(s.theta), vy: v * Math.sin(s.theta) };
}

// How hard the bar pulls on the hands, in body weights: the weight's share along the arms plus the pull of the circle. Negative at the top
// of a fast swing means the arms are pushing, not pulling.
export function gripLoad(s: Hang, p: HangParams = DEFAULT_HANG): number {
  return Math.cos(s.theta) + (comDistance(p) * s.omega * s.omega) / p.gravity;
}

// How hard the bar would pull at the bottom of the swing with the energy the body has now (the swing's energy never changes by itself,
// so this is the most the hands will ever carry unless the body pumps more in).
export function bottomLoad(s: Hang, p: HangParams = DEFAULT_HANG): number {
  const w2 = s.omega * s.omega + (2 * p.gravity / pendulumLength(p)) * (1 - Math.cos(s.theta)); // omega squared at the bottom
  return 1 + (comDistance(p) * w2) / p.gravity;
}

// Grab: the hands (above the feet at x, y) must be within reach of the bar. The arms keep part of the speed along the swing.
export function tryGrab(holds: Hold[], x: number, y: number, vx: number, vy: number, p: HangParams = DEFAULT_HANG): Hang | null {
  const hx = x, hy = y + p.handHeight;
  let best = -1, bd = Infinity;
  holds.forEach((h, i) => { const d = Math.hypot(hx - h.x, hy - h.y); if (d <= p.reach && d < bd) { bd = d; best = i; } });
  if (best < 0) return null;
  // hang from the bar: the body hangs straight down from the hands, moving with the tangent speed at the bottom of the swing
  const theta = 0;
  return { hold: best, theta, omega: (vx * p.catchKeep) / releaseRadius(p) + 0 * vy };
}

// One step. pump is +1 (forward key), -1 (back key) or 0: pressing the way the body is already moving adds energy, pressing against it takes energy out.
// When the swing already has so much energy that the bar would pull about as hard as the hands can hold at the bottom, pushing the swing further
// does nothing more: that is the top speed of the swing.
export function hangStep(s: Hang, pump: number, p: HangParams = DEFAULT_HANG): Hang {
  const L = pendulumLength(p);
  let drive = p.pump * pump;
  if (drive * s.omega > 0) drive *= Math.max(0, Math.min(1, (0.97 * p.grip - bottomLoad(s, p)) / (0.1 * p.grip)));
  const f = (th: number, w: number) => -(p.gravity / L) * Math.sin(th) + drive - p.drag * w;
  const k1t = s.omega, k1w = f(s.theta, s.omega);
  const k2t = s.omega + 0.5 * DT * k1w, k2w = f(s.theta + 0.5 * DT * k1t, k2t);
  const k3t = s.omega + 0.5 * DT * k2w, k3w = f(s.theta + 0.5 * DT * k2t, k3t);
  const k4t = s.omega + DT * k3w, k4w = f(s.theta + DT * k3t, k4t);
  let theta = s.theta + (DT / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
  const omega = s.omega + (DT / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
  theta -= 2 * Math.PI * Math.round(theta / (2 * Math.PI)); // round and round is the same as turning once
  return { hold: s.hold, theta, omega };
}

// True when the bar pulls harder than the hands can hold: they open.
export const gripSlips = (s: Hang, p: HangParams = DEFAULT_HANG): boolean => Math.abs(gripLoad(s, p)) > p.grip;

// Letting go: the body's middle keeps its place and flies on with the velocity above. The body is upright in flight, so the feet are one
// half rod (the middle's height above the feet) under the middle; this keeps the path continuous (no jump of up to 0.75 m at the moment of release).
export function releaseHang(h: Hold, s: Hang, p: HangParams = DEFAULT_HANG) {
  const d = comDistance(p), v = bodyVelocity(s, p);
  return { x: h.x + d * Math.sin(s.theta), y: h.y - d * Math.cos(s.theta) - d, vx: v.vx, vy: v.vy };
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
