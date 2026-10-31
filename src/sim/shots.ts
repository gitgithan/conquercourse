import { DT, GRAVITY } from './units';

// Timed ball launchers: a launcher fires a ball every `every` seconds, starting at `phase` seconds, the same for every player.
// The clock is the simulator's tick, so a ball's place at tick t is a formula of the launcher and t, never of the runner.
// Nothing here is random and nothing reads the player: a run can be replayed and the balls are exactly where they were.
export interface ShotLauncher {
  x: number; y: number; // m: where the ball leaves (y is the height above the sea, not above the deck)
  vx: number; vy?: number; // m/s at the muzzle (vx < 0 flies back toward the runner)
  every: number; // s between two shots
  phase: number; // s: the first shot
  r?: number; // m: the ball's radius
  life?: number; // s: how long a ball flies before it is gone
}

export const BALL_R = 0.25;
export const BALL_LIFE = 6;
// The runner's body for a hit: a capsule from the knees to the head (feet position + these heights).
export const BODY_LOW = 0.35, BODY_HIGH = 1.55, BODY_R = 0.28;

export interface FlyingBall { x: number; y: number; r: number; launcher: number; shot: number }

const radius = (s: ShotLauncher): number => s.r ?? BALL_R;
const life = (s: ShotLauncher): number => s.life ?? BALL_LIFE;

/** Seconds since shot k left launcher s, at tick t (negative before it fires). */
export const flightTime = (s: ShotLauncher, k: number, tick: number): number => tick * DT - (s.phase + k * s.every);

/** Where shot k of launcher s is at tick t: straight along its muzzle speed, bent down by gravity (a closed form, so any tick can be asked at once). */
export function ballAt(s: ShotLauncher, k: number, tick: number, gravity = GRAVITY): { x: number; y: number } | null {
  const t = flightTime(s, k, tick);
  if (t < 0 || t > life(s)) return null;
  return { x: s.x + s.vx * t, y: s.y + (s.vy ?? 0) * t - 0.5 * gravity * t * t };
}

/** Every ball of every launcher in the air at tick t. */
export function ballsAt(shots: ShotLauncher[], tick: number, gravity = GRAVITY): FlyingBall[] {
  const out: FlyingBall[] = [];
  const now = tick * DT;
  shots.forEach((s, launcher) => {
    const first = Math.max(0, Math.ceil((now - life(s) - s.phase) / s.every));
    const last = Math.floor((now - s.phase) / s.every);
    for (let k = first; k <= last; k++) {
      const b = ballAt(s, k, tick, gravity);
      if (b) out.push({ ...b, r: radius(s), launcher, shot: k });
    }
  });
  return out;
}

/** True when a ball touches the body of a runner whose feet are at (x, y). */
export function hitsBody(b: { x: number; y: number; r: number }, x: number, y: number): boolean {
  const cy = Math.min(y + BODY_HIGH, Math.max(y + BODY_LOW, b.y)); // the nearest point on the body's spine
  return Math.hypot(b.x - x, b.y - cy) < b.r + BODY_R;
}

/** The first ball that touches a runner at (x, y) at tick t, or null. */
export function ballHit(shots: ShotLauncher[], tick: number, x: number, y: number, gravity = GRAVITY): FlyingBall | null {
  return ballsAt(shots, tick, gravity).find((b) => hitsBody(b, x, y)) ?? null;
}

/** The switch: ?balls=1 adds the timed balls to the First Course. They are off by default: no beat was found that keeps every checkpoint start clear (docs/timed-balls.md). */
export const ballsOn = (params: URLSearchParams): boolean => params.get('balls') === '1';

/** The three launchers of the First Course: a low one before the rope, a low one before the trampoline, and a high one over the last deck. */
export const BALL_LAUNCHERS: ShotLauncher[] = [
  { x: 24, y: 1.2, vx: -20, vy: 2, every: 30, phase: 3 },
  { x: 52, y: 1.5, vx: -25, vy: 2, every: 30, phase: 3 },
  { x: 76, y: 5.8, vx: -25, vy: 2, every: 30, phase: 3 },
];
