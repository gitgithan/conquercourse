import { DT, GRAVITY } from './units';

// A rope hanging from an anchor. The runner catches it only where the hands really meet it;
// nothing moves the rope to the hands. After the catch the runner swings as a pendulum of the grip length.
export interface RopeParams {
  anchorX: number;
  anchorY: number;
  length: number; // m (spec: 9)
  handHeight: number; // m, hands above the feet when stretched up
  catchReach: number; // m, how close the hands must be to the rope (spec: 0.35)
  catchReachAtEnd: number; // m, allowed near the rope's end (spec: 0.5)
  gravity: number;
}

export const DEFAULT_ROPE: RopeParams = {
  anchorX: 0, anchorY: 10, length: 9, handHeight: 2.1, catchReach: 0.35, catchReachAtEnd: 0.5, gravity: GRAVITY,
};

export interface Swing {
  grip: number; // m from the anchor to the hands
  theta: number; // rad from straight down
  omega: number; // rad/s
}

// Position of the rope at distance r from the anchor when the rope hangs at angle theta.
export const ropePoint = (p: RopeParams, r: number, theta = 0) => ({
  x: p.anchorX + r * Math.sin(theta),
  y: p.anchorY - r * Math.cos(theta),
});

// Where do the hands (at runner position x, y, feet) meet a hanging rope? Returns the grip distance or null.
export function tryCatch(p: RopeParams, x: number, y: number, vx: number, vy: number, theta = 0): Swing | null {
  const handX = x;
  const handY = y + p.handHeight;
  const r = Math.hypot(handX - p.anchorX, handY - p.anchorY);
  if (r > p.length) return null; // below the end of the rope
  // distance from the hands to the rope line at that grip distance
  const point = ropePoint(p, r, theta);
  const reach = r > p.length - 0.5 ? p.catchReachAtEnd : p.catchReach;
  if (Math.hypot(handX - point.x, handY - point.y) > reach) return null;
  if (handY > p.anchorY) return null;
  // Keep the speed along the swing (the tangent); the speed along the rope is absorbed by the rope.
  const tx = Math.cos(theta);
  const ty = Math.sin(theta);
  return { grip: r, theta, omega: (vx * tx + vy * ty) / r };
}

// Pendulum theta'' = -(g / r) sin theta, integrated with RK4 at the fixed step.
export function swingStep(sw: Swing, g = GRAVITY): Swing {
  const f = (th: number) => -(g / sw.grip) * Math.sin(th);
  const k1t = sw.omega, k1w = f(sw.theta);
  const k2t = sw.omega + 0.5 * DT * k1w, k2w = f(sw.theta + 0.5 * DT * k1t);
  const k3t = sw.omega + 0.5 * DT * k2w, k3w = f(sw.theta + 0.5 * DT * k2t);
  const k4t = sw.omega + DT * k3w, k4w = f(sw.theta + DT * k3t);
  return {
    grip: sw.grip,
    theta: sw.theta + (DT / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
    omega: sw.omega + (DT / 6) * (k1w + 2 * k2w + 2 * k3w + k4w),
  };
}

// Letting go: the runner flies off along the swing's velocity.
export function release(p: RopeParams, sw: Swing) {
  const hand = ropePoint(p, sw.grip, sw.theta);
  const speed = sw.omega * sw.grip;
  return { x: hand.x, y: hand.y - p.handHeight, vx: speed * Math.cos(sw.theta), vy: speed * Math.sin(sw.theta) };
}

// Measured period of a swing started at rest from theta0 (time between two returns to the same side).
export function measurePeriod(grip: number, theta0: number): number {
  let sw: Swing = { grip, theta: theta0, omega: 0 };
  let t = 0;
  let crossings = 0;
  let prev = sw.theta;
  let first = 0;
  while (t < 60) {
    sw = swingStep(sw);
    t += DT;
    if (prev > 0 && sw.theta <= 0) {
      // linear interpolation of the zero crossing
      const tc = t - DT + (DT * prev) / (prev - sw.theta);
      if (crossings === 0) first = tc;
      else return tc - first;
      crossings++;
    }
    prev = sw.theta;
  }
  return NaN;
}
