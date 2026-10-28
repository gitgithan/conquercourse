import { DT, GRAVITY } from './units';
import { groundAt, type Terrain } from './terrain';

// Recoil: momentum is conserved. A launcher on the runner throws a heavy ball (or a crate) backward; the runner is pushed forward by exactly
// the momentum the ball carries away. Heavy and slow, or light and fast: the same push. One law, two pieces (an air cannon and a heavy crate).
//
// Everything is a metre, a kilogram or a second. The system before the shot is the runner plus the loaded ball moving together; after it, the
// ball leaves with `muzzle` m/s RELATIVE to the runner (that is how a launcher is rated), backward and `angle` radians above the horizontal:
//   (m_c + m_b) v = m_c v2 + m_b (v2 + rel)   =>   v2 = v - m_b rel / (m_c + m_b)
export interface RecoilParams {
  x0: number; x1: number; // the pad: stepping onto it clips the launcher on (one load per visit)
  kind: 'cannon' | 'crate';
  ballMass: number; // kg (the crate for the crate piece)
  muzzle: number; // m/s of the ball relative to the runner at the moment it leaves
  angle: number; // rad above the horizontal; the ball goes backward
  charMass: number; // kg, the runner and the launcher
  energy?: number; // J the launcher can store (compressed air, or the arms); omitted: only the muzzle speed limits it
  shots: number; // loads per visit to the pad
}
export const DEFAULT_RECOIL: RecoilParams = { x0: 0, x1: 2, kind: 'cannon', ballMass: 12, muzzle: 30, angle: 0, charMass: 70, shots: 1 };
export const DEFAULT_CRATE: Pick<RecoilParams, 'kind' | 'ballMass' | 'muzzle'> = { kind: 'crate', ballMass: 25, muzzle: 6 };

export interface Ball { x: number; y: number; vx: number; vy: number; landed: boolean }
export interface RecoilState { armed: number; fired: number; onPad: boolean; balls: Ball[] } // armed: shots left; fired: shots so far; onPad: on the pad last tick
export const NO_RECOIL: RecoilState = { armed: 0, fired: 0, onPad: false, balls: [] };

// The muzzle speed the launcher can really reach: a stored energy E gives the pair (runner, ball) a kinetic energy of 1/2 mu u^2 at most.
export function effectiveMuzzle(p: RecoilParams): number {
  if (p.energy === undefined) return p.muzzle;
  const mu = (p.charMass * p.ballMass) / (p.charMass + p.ballMass); // reduced mass
  return Math.min(p.muzzle, Math.sqrt((2 * p.energy) / mu));
}

export interface Shot { dvx: number; dvy: number; ballVx: number; ballVy: number; muzzle: number }

// The shot from a runner moving at (vx, vy). In the air both parts of the push count; on the ground the ground takes the vertical part.
export function shot(p: RecoilParams, vx: number, vy: number, airborne: boolean): Shot {
  const u = effectiveMuzzle(p), M = p.charMass + p.ballMass;
  const dvx = (p.ballMass * u * Math.cos(p.angle)) / M;
  const dvy = airborne ? (-p.ballMass * u * Math.sin(p.angle)) / M : 0;
  return { dvx, dvy, ballVx: vx + dvx - u * Math.cos(p.angle), ballVy: vy + dvy + u * Math.sin(p.angle), muzzle: u };
}

// The forward speed a runner standing still gets (the Dojo question).
export const standingPush = (p: RecoilParams): number => shot(p, 0, 0, false).dvx;

// The ball's speed against the ground when the runner stood still (the other half of the lesson: the heavy thing goes slow).
export const ballSpeedFromRest = (p: RecoilParams): number => {
  const s = shot(p, 0, 0, false);
  return Math.hypot(s.ballVx, s.ballVy);
};

// A ball in flight: gravity only, until it meets the ground or the water.
export function stepBall(b: Ball, t: Terrain): Ball {
  if (b.landed) return b;
  const vy = b.vy - GRAVITY * DT;
  const y = b.y + b.vy * DT - 0.5 * GRAVITY * DT * DT;
  const x = b.x + b.vx * DT;
  const floor = groundAt(t, x);
  if (y <= floor) return { x, y: floor, vx: 0, vy: 0, landed: true };
  if (y < t.waterY) return { x, y: t.waterY, vx: 0, vy: 0, landed: true };
  return { x, y, vx: b.vx, vy, landed: false };
}

export const padHas = (p: RecoilParams, x: number): boolean => x >= p.x0 && x <= p.x1;
