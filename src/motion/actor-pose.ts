// The pure parts of the Rookie actor (CC-31): which clip a simulator state asks for, and how each clip is timed.
// Nothing here touches three.js or the page, so the unit tests can check it directly.
import { secondsForDistance, type Clip } from './clip';
import type { Next } from './compose';
import { MOTION_TABLE, moveProgress } from './motion-table';

export interface ActorState {
  tick: number; // game ticks of 1/120 s
  x: number; // feet position, metres (the simulator's)
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  mode: 'run' | 'wall' | 'swing' | 'bounce' | 'cart';
  squat: boolean;
  landedTicksAgo: number | null;
  vaultProgress?: number; // 0 to 1 through the vault (WorldState.vault.i / n); only while the runner is over an obstacle
  rolledAt?: number; // tick of the last roll landing (WorldState.rolledAt): the roll plays for the simulator's roll time from here
  wallProgress?: number; // 0..1 along the wall climb
  swingTheta?: number; // rad from straight down; positive swings toward +x
  tilt?: number; // rad the rails rise here; the seated rider in a cart leans with it
  facing: 1 | -1;
  ledge?: { x: number; y: number }; // the top edge of the wall in the world: the hands reach for it, whatever its height
  next?: Next; // the next obstacle ahead and how far: the body gets ready for it before it arrives
}

export type ClipKind = 'stand' | 'run' | 'leap' | 'land' | 'swing' | 'wall-run' | 'wall-reach' | 'bounce' | 'roll' | 'vault' | 'sit';

export const LAND_TICKS = 60; // how long the landing clip is held after touch-down (matches the Rookie demo)
export const REACH_FROM = 0.75; // the reach clip plays over the last quarter of the wall climb
export const STAND_BELOW = 0.25; // m/s: slower than this is standing
export const RUN_FROM = 0.9; // m/s: faster than this is fully running (in between the two poses are blended)

export function chooseClip(s: ActorState): ClipKind {
  if (s.mode === 'cart') return 'sit';
  if (s.mode === 'run' && s.vaultProgress !== undefined) return 'vault';
  if (s.mode === 'run' && s.rolledAt !== undefined && moveProgress(MOTION_TABLE.roll, s.rolledAt, s.tick) !== null) return 'roll';
  if (s.mode === 'swing') return 'swing';
  if (s.mode === 'bounce') return 'bounce';
  if (s.mode === 'wall') return (s.wallProgress ?? 0) >= REACH_FROM ? 'wall-reach' : 'wall-run';
  if (!s.grounded) return 'leap';
  if (s.landedTicksAgo !== null && s.landedTicksAgo >= 0 && s.landedTicksAgo < LAND_TICKS) return 'land';
  return Math.abs(s.vx) < STAND_BELOW ? 'stand' : 'run';
}

// 0 = the still stand pose, 1 = the running clip; smooth in between so starting and stopping do not pop.
export function runWeight(speed: number): number {
  const t = Math.min(Math.max((Math.abs(speed) - STAND_BELOW) / (RUN_FROM - STAND_BELOW), 0), 1);
  return t * t * (3 - 2 * t);
}

// Run clip time for the distance run so far (metres of the Rookie's body): the feet stay planted at any speed.
export function runSeconds(run: Clip, distance: number, scale: number): number {
  return secondsForDistance(run, distance / scale);
}

// How far through its flight a body is, 0 at take-off and 1 at touch-down, from vertical speed alone:
// a symmetric arc has vy going from +v0 to -v0, so progress is (v0 - vy) / (2 v0).
export function flightProgress(v0: number, vy: number): number {
  const v = Math.max(Math.abs(v0), 1);
  return Math.min(Math.max((v - vy) / (2 * v), 0), 1);
}

// Leap clip time from take-off to touch-down for a progress 0..1.
export function leapSeconds(leap: Clip, progress: number): number {
  const a = leap.takeoff! / leap.fps;
  const b = leap.landing! / leap.fps;
  return a + progress * (b - a);
}

// Land clip time: it starts at the touch-down frame and plays at its own speed.
export function landSeconds(land: Clip, ticksAgo: number): number {
  return land.landing! / land.fps + ticksAgo / 120;
}

// Reach clip time over the last quarter of the climb.
export function reachSeconds(reach: Clip, wallProgress: number): number {
  const t = Math.min(Math.max((wallProgress - REACH_FROM) / (1 - REACH_FROM), 0), 1);
  return (t * (reach.frames.length - 1)) / reach.fps;
}

// How much deeper the landing crouch goes: 0..1 over the hold, a smooth dip and recovery, deeper when squatting.
export function crouchDepth(squat: boolean, ticksAgo: number): number {
  const t = Math.min(Math.max(ticksAgo / LAND_TICKS, 0), 1);
  return (squat ? 1 : 0.25) * Math.sin(Math.PI * t);
}

// Mirroring: the clips run toward +x; running left turns the character half a turn about the vertical axis
// (a turn, not a negative scale, so the surfaces keep their front sides).
export const facingYaw = (facing: 1 | -1): number => (facing === 1 ? 0 : Math.PI);

// Tilt angles are measured in the simulator's world; in the character's own frame (forward = +x) they flip with facing.
export const localAngle = (worldAngle: number, facing: 1 | -1): number => worldAngle * facing;

// Run distance for the foot lookup: the signed distance along the direction of travel.
export function advanceDistance(distance: number, prev: { x: number; y: number } | null, s: ActorState): number {
  if (!prev) return s.facing * s.x;
  const dx = s.x - prev.x;
  const dy = s.y - prev.y;
  const d = s.mode === 'wall' ? Math.hypot(dx, dy) : s.facing * dx;
  return Math.abs(d) > 2 ? distance : distance + d; // a teleport (restart, slide-back) keeps the pose
}
