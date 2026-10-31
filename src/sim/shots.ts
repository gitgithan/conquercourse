import { SLIDE_BODY_HIGH, SLIDE_BODY_LOW } from './slide';
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
  stopX?: number; // m: a wall's face; the ball is gone once it reaches it (a ball that flies left stops at x <= stopX)
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
  const x = s.x + s.vx * t;
  if (s.stopX !== undefined && (s.vx < 0 ? x <= s.stopX : x >= s.stopX)) return null; // it hit the wall
  return { x, y: s.y + (s.vy ?? 0) * t - 0.5 * gravity * t * t };
}

/** How far a launcher has charged at tick t, from 0 (just fired) to 1 (firing now): the plunger of the fire meter, tail to muzzle. The first charge starts at the tick 0. */
export function charge(s: ShotLauncher, tick: number): number {
  const now = tick * DT;
  const k = Math.max(0, Math.ceil((now - s.phase) / s.every - 1e-9)); // the next shot
  const next = s.phase + k * s.every, from = Math.max(0, next - s.every);
  return Math.min(1, Math.max(0, (now - from) / Math.max(next - from, 1e-9)));
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
export function hitsBody(b: { x: number; y: number; r: number }, x: number, y: number, sliding = false): boolean {
  const hi = sliding ? SLIDE_BODY_HIGH : BODY_HIGH, lo = sliding ? SLIDE_BODY_LOW : BODY_LOW; // a sliding body is low: a ball flying at head height passes over it
  const cy = Math.min(y + hi, Math.max(y + lo, b.y)); // the nearest point on the body's spine
  return Math.hypot(b.x - x, b.y - cy) < b.r + BODY_R;
}

/** The first ball that touches a runner at (x, y) at tick t, or null. */
export function ballHit(shots: ShotLauncher[], tick: number, x: number, y: number, gravity = GRAVITY, sliding = false): FlyingBall | null {
  return ballsAt(shots, tick, gravity).find((b) => hitsBody(b, x, y, sliding)) ?? null;
}

/** The switch: ?balls=1 adds the timed balls to the First Course. They are off by default: no beat was found that keeps every checkpoint start clear (docs/timed-balls.md). */
export const ballsOn = (params: URLSearchParams): boolean => params.get('balls') === '1';

/** The three launchers of the First Course: a low one before the rope, a mid-height one before the trampoline, and one over the last deck. y is the muzzle height above the sea. */
export const BALL_LAUNCHERS: ShotLauncher[] = [
  { x: 24, y: 0.55, vx: -20, vy: 2, every: 12, phase: 2 }, // knee height over the precision block: only a jump clears it
  { x: 52, y: 1.5, vx: -25, vy: 2, every: 12, phase: 5 }, // head height: a slide or a jump clears it
  { x: 76, y: 5.8, vx: -25, vy: 2, every: 12, phase: 4 }, // head height over the last deck (4.3 m): a slide or a jump clears it
];

/** The Cannonballs course: the same launchers plus a low ball fired together with the head-height one at x = 52, and a climbable wall in front of them (the ball is gone at the wall's face). */
export const CANNON_WALL = { x0: 40, x1: 42, top: 2 }; // m; 2 m is under the standing climb's reach (2.2 m)
export const CANNON_STACK: ShotLauncher = { x: 52, y: 0.55, vx: -25, vy: 2, every: 12, phase: 5 };

export function cannonLaunchers(base: ShotLauncher[] = BALL_LAUNCHERS): ShotLauncher[] {
  const withWall = base.map((s) => (s.x === 52 ? { ...s, stopX: CANNON_WALL.x1 } : s));
  const pair = withWall.find((s) => s.x === 52)!;
  return [...withWall, { ...CANNON_STACK, every: pair.every, phase: pair.phase, stopX: CANNON_WALL.x1 }];
}

/** The First Course's flat stretch 33 to 55 m split to carry the wall. */
export function withCannonWall<C extends { terrain: { platforms: { x0: number; x1: number; top: number }[] } }>(c: C): C {
  const w = CANNON_WALL;
  const platforms = c.terrain.platforms.flatMap((p) => (p.x0 < w.x0 && p.x1 > w.x1 ? [{ ...p, x1: w.x0 }, { ...p, x0: w.x0, x1: w.x1, top: w.top }, { ...p, x0: w.x1 }] : [p]));
  return { ...c, terrain: { ...c.terrain, platforms } };
}
