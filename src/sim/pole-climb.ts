import { DT } from './units';
import { DEFAULT_HANG, EASE_TICKS, type Hang } from './holds';

// The pole climb (CC-133, fork): a standing pole, like a lamp post with a string of bulbs. Hold E next to it to climb at a steady pace; let go of E and you slide
// back down. At the top, with E still held, the hands pass on to the first bar of the bar row.
// Where the numbers come from (Earth, the Rookie's arms):
//   a person climbs a vertical pole hand over hand at about 0.5 to 1 m/s, so the pace is a fixed POLEC_UP = 1.0 m/s: the key sets the direction, never the speed
//   the legs and arms spend energy as height: POLEC_COST_PER_M of the store for each metre gained, so a tall pole is a real effort and an empty store stops the climb
//   a slide with the hands brushing the pole speeds up by POLEC_SLIDE_ACC (less than gravity: the grip rubs) to at most POLEC_SLIDE_MAX, so the drop back to the ground is gentle and never hurts
export const POLEC_REACH_X = 0.6; // m: the hands close on a pole this near on the ground
export const POLEC_UP = 1.0; // m/s: the pace of the climb
export const POLEC_COST_PER_M = 0.045; // of the energy store, for each metre climbed
export const POLEC_SLIDE_ACC = 4; // m/s^2
export const POLEC_SLIDE_MAX = 3; // m/s
export const POLEC_EASE = 0.025; // m a tick: the body eases sideways onto the pole (no jump)

/** What a course says about a climbing pole: where it stands and how high the hands reach at the top (where the bar row begins). */
export interface ClimbPole {
  x: number;
  top: number; // m over the ground at the foot: the height of the top hand hold
  toHold?: number; // index into the course's holds: the first bar of the row the top hands over to
}

export interface PoleClimbState {
  pole: number; // index into the course's climbPoles
  h: number; // m the feet are over the ground at the foot
  v: number; // m/s sliding down (0 while climbing or holding)
  base: number; // ground height at the foot
  x: number; // m, where the body hangs (eases onto the pole)
  topped: boolean; // the hands are at the top
}

export const feetTop = (p: ClimbPole): number => p.top - DEFAULT_HANG.handHeight; // m the feet are over the foot when the hands are at the top

/** The pole whose foot is within the hands' reach of x, or -1. */
export function poleNear(poles: ClimbPole[], x: number): number {
  let best = -1, bd = Infinity;
  poles.forEach((p, i) => { const d = Math.abs(p.x - x); if (d <= POLEC_REACH_X && d < bd) { bd = d; best = i; } });
  return best;
}

export const startPoleClimb = (pole: number, x: number, ground: number): PoleClimbState => ({ pole, h: 0, v: 0, base: ground, x, topped: false });

export interface PoleClimbStep { s: PoleClimbState; spent: number; end: 'none' | 'ground' | 'top' }

/** One tick. held: E is down. energy: the store left (an empty store stops the climb, the hands still hold). */
export function stepPoleClimb(s: PoleClimbState, p: ClimbPole, held: boolean, energy: number): PoleClimbStep {
  const x = s.x + Math.max(-POLEC_EASE, Math.min(POLEC_EASE, p.x - s.x));
  const top = feetTop(p);
  if (held) {
    if (s.h >= top - 1e-9) return { s: { ...s, x, h: top, v: 0, topped: true }, spent: 0, end: 'top' };
    if (energy <= 0) return { s: { ...s, x, v: 0 }, spent: 0, end: 'none' };
    const h = Math.min(top, s.h + POLEC_UP * DT);
    return { s: { ...s, x, h, v: 0, topped: h >= top - 1e-9 }, spent: (h - s.h) * POLEC_COST_PER_M, end: h >= top - 1e-9 ? 'top' : 'none' };
  }
  const v = Math.min(POLEC_SLIDE_MAX, s.v + POLEC_SLIDE_ACC * DT);
  const h = s.h - v * DT;
  if (h <= 0) return { s: { ...s, x: p.x, h: 0, v: 0, topped: false }, spent: 0, end: 'ground' };
  return { s: { ...s, x, h, v, topped: false }, spent: 0, end: 'none' };
}

/** The bar hang the top hands over to: hanging still from the bar, the hands easing the last bit sideways (nothing jumps). */
export function topHang(bar: { x: number }, p: ClimbPole, s: PoleClimbState): Hang {
  return { hold: p.toHold ?? 0, theta: 0, omega: 0, ox: s.x - bar.x, oy: 0, et: EASE_TICKS };
}
