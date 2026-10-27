import { DT, GRAVITY } from './units';

// A trampoline bed: a spring with damping under the runner. A press at the bottom of the bounce adds speed.
export interface TrampolineParams {
  stiffness: number; // 1/s², spring constant per unit mass
  damping: number; // 1/s, damping per unit mass
  pump: number; // m/s added by a well-timed press
  pumpWindow: number; // s either side of the deepest point in which a press counts
  gravity: number;
}

export const DEFAULT_TRAMPOLINE: TrampolineParams = { stiffness: 400, damping: 2, pump: 1.5, pumpWindow: 0.04, gravity: GRAVITY };

export interface Bounce {
  vyOut: number; // m/s upward when the feet leave the bed
  maxCompression: number; // m
  ticksOnBed: number;
  pumped: boolean;
  path: number[]; // feet height relative to the rest surface, per tick
}

// Feet land on the bed at rest height with downward speed `vyIn`; `pressAtTick` is when the press happened (ticks after contact).
export function bounce(vyIn: number, p: TrampolineParams = DEFAULT_TRAMPOLINE, pressAtTick: number | null = null): Bounce {
  let y = 0;
  let v = -Math.abs(vyIn);
  let deepest = 0;
  let deepestTick = 0;
  const path = [0];
  let tick = 0;
  // y'' = -g + k (-y) - c y'   while y < 0 (bed compressed)
  const a = (yy: number, vv: number) => -p.gravity + (yy < 0 ? -p.stiffness * yy - p.damping * vv : 0);
  while (tick < 120 * 5) {
    const yPrev = y, vPrev = v;
    // RK4
    const k1y = v, k1v = a(y, v);
    const k2y = v + 0.5 * DT * k1v, k2v = a(y + 0.5 * DT * k1y, v + 0.5 * DT * k1v);
    const k3y = v + 0.5 * DT * k2v, k3v = a(y + 0.5 * DT * k2y, v + 0.5 * DT * k2v);
    const k4y = v + DT * k3v, k4v = a(y + DT * k3y, v + DT * k3v);
    y += (DT / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    v += (DT / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    tick++;
    path.push(y);
    if (y < deepest) { deepest = y; deepestTick = tick; }
    if (y >= 0 && v > 0) {
      // left the bed inside this step: take the speed at the moment the feet reach rest height
      const frac = yPrev / (yPrev - y);
      v = vPrev + (v - vPrev) * frac;
      break;
    }
  }
  const near = pressAtTick !== null && Math.abs(pressAtTick - deepestTick) * DT <= p.pumpWindow;
  return { vyOut: v + (near ? p.pump : 0), maxCompression: -deepest, ticksOnBed: tick, pumped: near, path };
}
