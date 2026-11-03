// The monkey-bars pose for the actor (CC-133): which rung each hand holds, which hand is travelling, how the body swings and kips.
// The simulator moves a hand to the next rung in one tick; here the hand takes REACH_TICKS to get there (the body is where the simulator says).
// Plain numbers, no three.js: the unit tests and the film script use it directly. Output is in the clips' axes (z along the travel, x left, y up).
import { barsPose, type BarsPoseOut, type BarsRig, type Reach, type V3 } from './bars-pose';

/** What the world says about the hands: the rung each holds (world metres), the rung height, and the pendulum. */
export interface BarsView { left: number; right: number; y: number; theta: number; omega: number }

export const REACH_TICKS = 12; // a hand takes a tenth of a second to travel to its rung (the quick keys of the demo overlap, so two can travel at once)
export const HAND_X = 0.18; // m: each hand holds the bar this far from the middle, as in the clips
export const KICK_PER_SWING = 0.5; // rad of leg lead per rad of body swing (the legs drive the kip)
export const KICK_PER_SPEED = 0.12; // rad of leg lead per rad/s of swing speed
export const TUCK_SPEED = 3; // rad/s of swing speed at which the knees are fully drawn up in a big swing

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

export class BarsPlayer {
  private held: { left: number; right: number } | null = null;
  private since = { left: -1e9, right: -1e9 };
  private from = { left: 0, right: 0 };
  private last = -1e9;
  constructor(private rig: BarsRig) {}

  /** The pose for one tick. `at` is where the body hangs (the state's x, y: feet) and `lift` the foot clearance the actor adds on top. */
  pose(v: BarsView, at: { x: number; y: number }, tick: number, facing: 1 | -1, lift: number, swingOn = true): BarsPoseOut {
    if (this.held === null || Math.abs(tick - this.last) > 30) { this.held = { left: v.left, right: v.right }; this.since = { left: -1e9, right: -1e9 }; }
    this.last = tick;
    for (const side of ['left', 'right'] as const) {
      if (v[side] !== this.held[side]) { this.from[side] = this.held[side]; this.since[side] = tick; this.held[side] = v[side]; }
    }
    const y = v.y - at.y - lift;
    const rung = (wx: number, side: 'left' | 'right'): V3 => [side === 'left' ? HAND_X : -HAND_X, y, facing * (wx - at.x)];
    const reaches: Reach[] = [];
    for (const side of ['left', 'right'] as const) {
      const p = (tick - this.since[side]) / REACH_TICKS;
      if (p >= 0 && p < 1) reaches.push({ side, from: rung(this.from[side], side), to: rung(v[side], side), progress: p });
    }
    reaches.sort((a, b) => a.progress - b.progress); // the one that has just begun drives the shoulder turn
    const theta = swingOn ? v.theta * facing : 0, omega = v.omega * facing;
    const forward = Math.max(omega, 0);
    return barsPose(this.rig, {
      grips: { left: rung(v.left, 'left'), right: rung(v.right, 'right') },
      reach: reaches[0], reach2: reaches[1],
      swing: theta,
      kick: clamp(KICK_PER_SWING * theta + KICK_PER_SPEED * omega, -0.6, 0.6) * (1 - 0.7 * clamp(Math.abs(theta) / 1.2, 0, 1)), // a big swing already has the legs trailing: less kick on top
      tuck: clamp(forward / TUCK_SPEED, 0, 1) * clamp(Math.abs(theta) / 0.4, 0, 1),
      bodyZ: 0, // the body is where the simulator carries it (it eases onto each new pivot over a few ticks)
    });
  }
}
