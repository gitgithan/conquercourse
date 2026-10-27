import { DT, GRAVITY } from './units';

// The warped wall: a quarter-circle of radius = wall height H, flat at the bottom, vertical at the top.
// Speed turns into height; the wall cannot add any. Friction is a share `loss` of the energy spent climbing.
export interface WallParams {
  height: number; // m, wall top above the run-up ground
  hipHeight: number; // m, hips above the feet while running
  reach: number; // m, hands above the hips when stretched up (spec: 2.1)
  loss: number; // friction loss as a share of the climb energy (starting value)
  gravity: number;
}

export const DEFAULT_WALL: WallParams = { height: 4.3, hipHeight: 1.0, reach: 2.1, loss: 0.1, gravity: GRAVITY };

export interface WallResult {
  grabbed: boolean;
  heightGained: number; // m, highest the feet got up the curve
  needed: number; // m the feet must rise so the hands reach the top: height - hip - reach
  margin: number; // heightGained - needed: positive = hands over the edge, negative = short by this much
  grabTick: number | null; // tick (from entering the curve) when the hands reached the top
  path: { x: number; y: number }[]; // feet position each tick: up the curve, then the slide back if it failed
  exitSpeed: number; // m/s on returning to the base (0 if grabbed)
}

// Height the feet reach on the curve from entry speed v: v² / (2 g (1 + loss)).
export const climbHeight = (v: number, p: WallParams = DEFAULT_WALL): number => (v * v) / (2 * p.gravity * (1 + p.loss));

export function runWall(entrySpeed: number, p: WallParams = DEFAULT_WALL): WallResult {
  const R = p.height;
  const needed = p.height - p.hipHeight - p.reach;
  // Along the arc: s'' = -g sin(s / R) (1 + loss * sign(v)); friction always opposes the motion,
  // so going up costs (1 + loss) and sliding down gives back only (1 - loss).
  const acc = (pos: number, vel: number) => -p.gravity * Math.sin(pos / R) * (1 + p.loss * Math.sign(vel));
  let s = 0;
  let v = entrySpeed;
  let peak = 0;
  let grabTick: number | null = null;
  const path: { x: number; y: number }[] = [];
  for (let tick = 0; tick < 120 * 30; tick++) {
    const th = s / R;
    const y = R * (1 - Math.cos(th));
    path.push({ x: R * Math.sin(th), y });
    peak = Math.max(peak, y);
    if (y >= needed) { grabTick = tick; break; }
    // RK2 (midpoint) on (s, v)
    const a1 = acc(s, v);
    const sm = s + v * DT / 2;
    const vm = v + a1 * DT / 2;
    const a2 = acc(sm, vm);
    s += vm * DT;
    v += a2 * DT;
    if (s <= 0) { s = 0; if (v < 0) break; }
    if (s >= (Math.PI / 2) * R) { s = (Math.PI / 2) * R; v = Math.min(v, 0); }
  }
  const grabbed = grabTick !== null;
  return { grabbed, heightGained: peak, needed, margin: peak - needed, grabTick, path, exitSpeed: grabbed ? 0 : Math.max(0, -v) };
}
