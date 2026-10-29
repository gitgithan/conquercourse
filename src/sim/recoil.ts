import { DT, GRAVITY } from './units';
import { groundAt, type Terrain } from './terrain';

// Recoil: momentum is conserved. A launcher on the runner throws a heavy ball backward; the runner is pushed the other way by exactly
// the momentum the ball carries away. Heavy and slow, or light and fast: the same push. One law, two pieces (an air launcher and a big aimed cannon).
//
// Everything is a metre, a kilogram or a second. The system before the shot is the runner plus the loaded ball moving together; after it, the
// ball leaves with `muzzle` m/s RELATIVE to the runner (that is how a launcher is rated), backward and DOWN by `angle` (the barrel points backward and down),
// so the push on the runner is forward and UP by `angle` above the horizontal. The law is a vector law:
//   (m_c + m_b) v = m_c v2 + m_b (v2 + rel)   =>   v2 = v + m_b u (cos a, sin a) / (m_c + m_b),   rel = -u (cos a, sin a)
export interface RecoilParams {
  x0: number; x1: number; // the pad: stepping onto it clips the launcher on (one load per visit)
  kind: 'cannon' | 'bigcannon';
  ballMass: number; // kg
  muzzle: number; // m/s of the ball relative to the runner at the moment it leaves
  angle: number; // rad: the angle the runner is pushed above the horizontal (the start aim of a big cannon, which the player changes)
  charMass: number; // kg, the runner and the launcher
  energy?: number; // J the launcher can store (compressed air, or the arms); omitted: only the muzzle speed limits it
  shots: number; // loads per visit to the pad
}
export const DEFAULT_RECOIL: RecoilParams = { x0: 0, x1: 2, kind: 'cannon', ballMass: 12, muzzle: 30, angle: 0, charMass: 70, shots: 1 };
// The big aimed cannon: a wheeled air cannon with a wide barrel and a pressure tank, a heavy ball at 45 m/s against the runner's 70 kg.
export const DEFAULT_CANNON: Pick<RecoilParams, 'kind' | 'ballMass' | 'muzzle' | 'angle'> = { kind: 'bigcannon', ballMass: 80, muzzle: 45, angle: 0.7 };

export const isAimable = (p: Pick<RecoilParams, 'kind'>): boolean => p.kind === 'bigcannon';
export const AIM_MIN = 0, AIM_MAX = 1.35; // rad: level to 77 degrees
export const AIM_RATE = 0.6; // rad per second while a key is held (34 degrees a second)
export const clampAim = (a: number): number => Math.min(AIM_MAX, Math.max(AIM_MIN, a));

export interface Ball { x: number; y: number; vx: number; vy: number; landed: boolean }
// armed: shots left; fired: shots so far; onPad: on the pad last tick; aim: the barrel angle now (rad); balls: in flight
export interface RecoilState { armed: number; fired: number; onPad: boolean; aim?: number; balls: Ball[] }
export const NO_RECOIL: RecoilState = { armed: 0, fired: 0, onPad: false, balls: [] };

const reduced = (p: RecoilParams): number => (p.charMass * p.ballMass) / (p.charMass + p.ballMass); // reduced mass

// The muzzle speed the launcher can really reach: a stored energy E gives the pair (runner, ball) a kinetic energy of 1/2 mu u^2 at most.
export function effectiveMuzzle(p: RecoilParams): number {
  if (p.energy === undefined) return p.muzzle;
  return Math.min(p.muzzle, Math.sqrt((2 * p.energy) / reduced(p)));
}

// The energy the tank must store to throw the ball at its muzzle speed: the energy the shot makes, 1/2 mu u^2 (any running speed, the same).
export const shotEnergy = (p: RecoilParams): number => 0.5 * reduced(p) * p.muzzle * p.muzzle;

// The same energy in plain words: a car of 1000 kg rolling at this speed (km/h) has it, and so does a lift of this many kilograms to this height.
export function energyWords(joules: number): string {
  const kmh = Math.sqrt((2 * joules) / 1000) * 3.6;
  return `${(joules / 1000).toFixed(0)} kJ, the energy of a 1000 kg car rolling at ${kmh.toFixed(0)} km/h`;
}

export interface Shot { dvx: number; dvy: number; ballVx: number; ballVy: number; muzzle: number; angle: number }

// The shot from a runner moving at (vx, vy), aimed at `angle`. A push up always counts (the ground cannot hold you down); a push down only counts in the air.
export function shot(p: RecoilParams, vx: number, vy: number, airborne: boolean, angle: number = p.angle): Shot {
  const u = effectiveMuzzle(p), M = p.charMass + p.ballMass;
  const dvx = (p.ballMass * u * Math.cos(angle)) / M;
  const push = (p.ballMass * u * Math.sin(angle)) / M;
  const dvy = airborne || push > 0 ? push : 0;
  return { dvx, dvy, ballVx: vx + dvx - u * Math.cos(angle), ballVy: vy + dvy - u * Math.sin(angle), muzzle: u, angle };
}

// The forward speed a runner standing still gets, aimed level (the Dojo question).
export const standingPush = (p: RecoilParams): number => shot({ ...p, angle: 0 }, 0, 0, false, 0).dvx;

// The ball's speed against the ground when the runner stood still (the other half of the lesson: the heavy thing goes slow).
export const ballSpeedFromRest = (p: RecoilParams): number => {
  const s = shot({ ...p, angle: 0 }, 0, 0, false, 0);
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

// Where a body launched at speed (vx, vy) from the ground comes back to the same height: the textbook range (the Dojo's check on the simulator).
export const levelRange = (vx: number, vy: number): number => (2 * vx * vy) / GRAVITY;
