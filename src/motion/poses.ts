// Pure geometry for the poses the clips do not cover (CC-77): the seated rider, the hurt body and the giant swing's legs.
// No page and no model here, so the unit tests can check the numbers directly.
import { Vector3 } from 'three/webgpu';

export const SEAT_HIPS = 0.34; // m, the hips of a seated rider above the cart's floor
export const BAR_AHEAD = 0.5; // m, the cart's grab bar in front of the rider's hips ...
export const BAR_HEIGHT = 0.72; // m, ... and above the cart's floor (src/render/track.ts draws it there)

// The thigh goes forward and up by this pitch (rad) and the shin hangs down, leaning forward by `shinLean`, so the feet land on the floor
// when the hips are `hipsHeight` above it: thigh sin(pitch) - shin cos(lean) = -hipsHeight.
export function seatThighPitch(thigh: number, shin: number, hipsHeight: number, shinLean = 0.05): number {
  const s = (shin * Math.cos(shinLean) - hipsHeight) / thigh;
  return Math.asin(Math.min(1, Math.max(-1, s)));
}

// A hard landing in three parts: the body crumples, stays down, then gets up slowly. The simulator ends the run at the landing,
// so these times are the picture's own; they only have to be long enough to read.
export const HURT_FALL_S = 0.8;
export const HURT_STAY_S = 1.2;
export const HURT_RISE_S = 2.5;
export const HURT_TICKS = Math.round((HURT_FALL_S + HURT_STAY_S + HURT_RISE_S) * 120);

export type HurtPhase = { phase: 'fall' | 'down' | 'rise'; t: number }; // t runs 0..1 inside the phase
// `fallS` is how long the crumple takes: the built fall's own time, or the clip's length at its own speed.
export function hurtPhase(ticksSince: number, fallS = HURT_FALL_S): HurtPhase {
  const s = Math.max(0, ticksSince) / 120;
  if (s < fallS) return { phase: 'fall', t: s / fallS };
  if (s < fallS + HURT_STAY_S) return { phase: 'down', t: (s - fallS) / HURT_STAY_S };
  return { phase: 'rise', t: Math.min(1, (s - fallS - HURT_STAY_S) / HURT_RISE_S) };
}
export const hurtTotalTicks = (fallS = HURT_FALL_S): number => Math.round((fallS + HURT_STAY_S + HURT_RISE_S) * 120);

export const smooth = (t: number): number => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

export interface LegIndex { hip: number; knee: number; foot: number; toe: number }

// The legs of a body hanging from a bar, for a swing that goes round (the joints are in the unturned local frame, x forward, hips at joints[hips]):
// - the legs lag behind the swing: a body swinging forward trails its feet back, more the faster it goes
// - over the top (the body above the bar) the knees come up and the legs tuck, and open out again on the way down
// `theta` and `omega` are in the body's own frame (positive = forward).
export function giantSwingLegs(joints: Vector3[], legs: LegIndex[], hips: number, theta: number, omega: number): void {
  const tuck = smooth((-Math.cos(theta) - 0.1) / 0.7);
  const lag = Math.max(-0.45, Math.min(0.45, -0.07 * omega));
  const z = new Vector3(0, 0, 1);
  for (const l of legs) {
    const top = joints[l.hip];
    const thigh = joints[l.knee].distanceTo(top);
    const shin = joints[l.foot].distanceTo(joints[l.knee]);
    const toeOff = joints[l.toe].clone().sub(joints[l.foot]);
    const a1 = 1.1 * tuck, a2 = a1 - 2.0 * tuck;
    const knee = new Vector3(top.x + thigh * Math.sin(a1), top.y - thigh * Math.cos(a1), joints[l.knee].z);
    const foot = new Vector3(knee.x + shin * Math.sin(a2), knee.y - shin * Math.cos(a2), joints[l.foot].z);
    const toe = foot.clone().add(toeOff.applyAxisAngle(z, a2));
    for (const [i, p] of [[l.knee, knee], [l.foot, foot], [l.toe, toe]] as const) {
      joints[i].copy(p.clone().sub(joints[hips]).applyAxisAngle(z, lag).add(joints[hips]));
    }
  }
}
