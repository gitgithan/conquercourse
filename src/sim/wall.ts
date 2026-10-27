import { DT, GRAVITY } from './units';

// The warped wall: a quarter-circle of radius = wall height H, flat at the bottom, vertical at the top.
// Speed turns into height; the wall cannot add any. Friction is a share `loss` of the energy spent climbing.
export interface WallParams {
  height: number; // m, wall top above the run-up ground
  radius?: number; // m, curve radius (default: the wall height); the Dojo keeps it constant so height does not change the curve
  stopAtGrab?: boolean; // default true: the run ends when the hands reach the top; false follows the climb to its peak
  hipHeight: number; // m, hips above the feet while running
  reach: number; // m, hands above the hips when stretched up (1.3: about what a body can stretch; was 2.1 in the spec)
  loss: number; // friction loss as a share of the climb energy (starting value)
  gravity: number;
}

export const DEFAULT_WALL: WallParams = { height: 4.3, hipHeight: 1.0, reach: 1.3, loss: 0.1, gravity: GRAVITY };

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
  const R = p.radius ?? p.height;
  const arcLen = (Math.PI / 2) * R;
  const stopAtGrab = p.stopAtGrab ?? true;
  const needed = p.height - p.hipHeight - p.reach;
  // Along the arc: s'' = -g sin(s / R) (1 + loss * sign(v)); friction always opposes the motion,
  // so going up costs (1 + loss) and sliding down gives back only (1 - loss).
  const acc = (pos: number, vel: number) => -p.gravity * Math.sin(Math.min(pos / R, Math.PI / 2)) * (1 + p.loss * Math.sign(vel));
  let s = 0;
  let v = entrySpeed;
  let peak = 0;
  let grabTick: number | null = null;
  const path: { x: number; y: number }[] = [];
  for (let tick = 0; tick < 120 * 30; tick++) {
    const th = Math.min(s / R, Math.PI / 2);
    const y = R * (1 - Math.cos(th)) + Math.max(0, s - arcLen); // past the arc the wall is vertical
    path.push({ x: R * Math.sin(th), y });
    peak = Math.max(peak, y);
    if (y >= needed && grabTick === null) { grabTick = tick; if (stopAtGrab) break; }
    // RK2 (midpoint) on (s, v)
    const a1 = acc(s, v);
    const sm = s + v * DT / 2;
    const vm = v + a1 * DT / 2;
    const a2 = acc(sm, vm);
    s += vm * DT;
    v += a2 * DT;
    if (s <= 0) { s = 0; if (v < 0) break; }
  }
  const grabbed = grabTick !== null;
  return { grabbed, heightGained: peak, needed, margin: peak - needed, grabTick, path, exitSpeed: grabbed ? 0 : Math.max(0, -v) };
}
