// The film's group photo (shot 11): ten characters on one platform, the two Rookies in the middle, standing; then each does a different move and freezes.
// Everything here is a pure function of the film time, so a stepped capture is the same every run. The page is src/film/group-photo.ts (?demo=groupmoves).
import type { ActorState } from '../motion/actor-pose';
import { ROLL_TICKS } from '../motion/motion-table';

export const FILM_LINK = 'https://conquercourse.pages.dev/';
export const FILM_SLOGAN = 'Train slow. Run fast.';
export const FILM_SECONDS = 7.2; // three bars of 2.4 s
export const CREW_SIZE = 10;
export const ROOKIE_SLOTS = [4, 5] as const; // Pip and Juno stand in the middle of the ten

export type MoveId = 'leap' | 'slide' | 'roll' | 'land' | 'run' | 'climb' | 'wallrun' | 'bounce' | 'reach' | 'swing';
// left to right; the Rookies (slots 4 and 5) take the jump shot and the slide
export const MOVE_OF_SLOT: MoveId[] = ['wallrun', 'run', 'climb', 'roll', 'leap', 'slide', 'bounce', 'swing', 'reach', 'land'];
// the order the freezes land in (one hit of the music each): the Rookies' jump shot first, then outward, left and right in turn
export const HIT_ORDER = [4, 5, 3, 6, 2, 7, 1, 8, 0, 9];
export const MOVE_START = 1.2; // s, the group has stood still until now
export const HIT_GAP = 0.25; // s between two freezes
export const MOVE_SECONDS = 0.8; // s each move plays before it freezes

export const startOf = (slot: number): number => MOVE_START + HIT_GAP * HIT_ORDER.indexOf(slot);
export const freezeOf = (slot: number): number => startOf(slot) + MOVE_SECONDS;
export const lastFreeze = (): number => Math.max(...MOVE_OF_SLOT.map((_, i) => freezeOf(i)));

export type Phase = 'stand' | 'move' | 'frozen';
export interface Moment { phase: Phase; u: number; seconds: number } // u: 0..1 through the move; seconds: time into the move
export function momentOf(slot: number, t: number): Moment {
  const s = startOf(slot);
  if (t < s) return { phase: 'stand', u: 0, seconds: 0 };
  if (t >= s + MOVE_SECONDS) return { phase: 'frozen', u: 1, seconds: MOVE_SECONDS };
  return { phase: 'move', u: (t - s) / MOVE_SECONDS, seconds: t - s };
}

const END_U: Record<MoveId, number> = { leap: 0.52, slide: 1, roll: 0.42, land: 0.5, run: 1, climb: 0.62, wallrun: 0.6, bounce: 1, reach: 1, swing: 1 };
const G = 9.81, V0 = 5.2;
const BASE: ActorState = { tick: 100000, x: 0, y: 0, vx: 0, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 };

export interface Pose { state: ActorState; lift: number; ahead: number } // lift: metres off the platform; ahead: metres toward the camera
export function poseOf(move: MoveId, m: Moment): Pose {
  const u = m.phase === 'stand' ? 0 : END_U[move] * m.u;
  const ticks = Math.round(u * MOVE_SECONDS * 120);
  const tick = BASE.tick + (m.phase === 'stand' ? 0 : Math.round(m.seconds * 120));
  const still = m.phase === 'stand';
  const s: ActorState = { ...BASE, tick };
  if (still) return { state: s, lift: 0, ahead: 0 };
  switch (move) {
    case 'leap': { const T = 2 * V0 / G; s.grounded = false; s.vy = V0 * (1 - 2 * Math.min(u, 1)); return { state: s, lift: V0 * (u * T) - 0.5 * G * (u * T) ** 2, ahead: 0.3 * u }; }
    case 'slide': s.sliding = true; s.slideTicks = Math.round(m.seconds * 120); s.vx = 3; return { state: s, lift: 0, ahead: 0.9 * u };
    case 'roll': s.rolledAt = tick - Math.round(u * ROLL_TICKS); s.vx = 3; return { state: s, lift: 0, ahead: 0.7 * u };
    case 'land': s.landedTicksAgo = Math.min(59, ticks); s.squat = true; return { state: s, lift: 0, ahead: 0 };
    case 'run': s.vx = 4.5; s.x = 4.5 * m.seconds; return { state: s, lift: 0, ahead: 0.5 * m.u };
    case 'climb': s.climbProgress = u; return { state: s, lift: 0, ahead: 0 };
    case 'wallrun': s.mode = 'wall'; s.wallProgress = 0.5; s.grounded = false; s.vx = 3; return { state: s, lift: 0.5 * u, ahead: 0 };
    case 'bounce': s.mode = 'bounce'; s.grounded = false; return { state: s, lift: 0.9 * Math.sin(Math.PI * Math.min(1, m.u * 0.6 + 0.2)), ahead: 0 };
    case 'reach': s.mode = 'wall'; s.wallProgress = 1; s.grounded = false; return { state: s, lift: 0, ahead: 0 };
    case 'swing': s.mode = 'swing'; s.grounded = false; s.swingTheta = 0.5 * Math.sin(Math.PI * Math.min(1, m.u)) * 0.7 + 0.15; return { state: s, lift: 0, ahead: 0 };
  }
}

// Where each of the ten stands: a gentle arc, facing the camera. Slot 0 is the far left.
export function spotOf(slot: number): { x: number; z: number; yaw: number } {
  const radius = 6.5, spread = 1.12, mid = (CREW_SIZE - 1) / 2;
  const a = (slot - mid) * spread / radius;
  return { x: Math.sin(a) * radius, z: radius - Math.cos(a) * radius, yaw: -Math.PI / 2 - a };
}

// Wide, a little low, locked; a slow push-in as they freeze.
export function cameraOf(t: number): { z: number; y: number; fov: number } {
  const u = Math.min(1, Math.max(0, (t - lastFreeze() + 0.6) / 2.2)), e = u * u * (3 - 2 * u);
  return { z: 13.4 - 2.2 * e, y: 1.2 + 0.1 * e, fov: 32 };
}
const ramp = (t: number, a: number, b: number): number => Math.min(1, Math.max(0, (t - a) / (b - a)));
export const dimAt = (t: number): number => ramp(t, 5.3, 5.9); // 0 = lit scene, 1 = dark
export const cardAt = (t: number): number => ramp(t, 5.8, 6.4); // the end card fades in over the dark
