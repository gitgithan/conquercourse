// The film camera: scripted shots for the demo video (CC-130). Each shot is a pure function of the time in seconds, so a film frame is the same every run.
// It only runs with ?film=<shot> in the address; play never loads it.

export type FilmShot = 'flyover' | 'orbit' | 'follow' | 'push' | 'hero' | 'macro' | 'spin' | 'skyline';
export const FILM_SHOTS: FilmShot[] = ['flyover', 'orbit', 'follow', 'push', 'hero', 'macro', 'spin', 'skyline'];

export interface Pose { pos: [number, number, number]; look: [number, number, number]; fov: number }
export interface FilmCtx {
  finishX: number; // the end of the course, m
  focusX: number; // the thing a shot is about (an obstacle or a real object), m
  focusY: number; // and its height, m
  runnerX: number; runnerY: number;
  macroDist?: number; // macro only: how far the camera stands from the part, m
  airborne: number; // 0 on the ground to 1 in the air; the caller eases it, so the follow shot zooms in at take-off and out at landing
}

export const SHOT_SECONDS: Record<FilmShot, number> = { flyover: 12, orbit: 8, follow: 10, push: 7, hero: 11, macro: 4, spin: 1.1, skyline: 7.2 };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); }; // smooth start and end
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = (deg: number) => (deg * Math.PI) / 180;

// A camera at `dist` from `target`, turned `yaw` about the vertical (0 = straight out of the screen, the normal side view) and raised `pitch` radians.
function around(target: [number, number, number], dist: number, yaw: number, pitch: number, fov: number): Pose {
  const flat = dist * Math.cos(pitch);
  return { pos: [target[0] + flat * Math.sin(yaw), Math.max(0.4, target[1] + dist * Math.sin(pitch)), target[2] + flat * Math.cos(yaw)], look: target, fov };
}

// The drone: from behind the start, up and along the whole course, turning slowly so the lane opens out.
function flyover(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.flyover);
  const tx = mix(-4, c.finishX + 4, u);
  return around([tx, 1.5, 0], mix(34, 26, Math.sin(Math.PI * u)), mix(0.55, -0.35, u), mix(rad(24), rad(38), Math.sin(Math.PI * u)), mix(40, 46, Math.sin(Math.PI * u)));
}

// The skyline: low and nearly level, from the front, drifting along the lane so the buildings behind it stand up (CC-237). The flat cousin of the drone.
function skyline(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.skyline);
  return around([mix(2, c.finishX - 6, u), 2.5, 0], mix(30, 24, u), mix(0.22, -0.12, u), rad(7), 44);
}

// Around one obstacle, from the front-left to the back-right, closing in a little.
function orbit(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.orbit);
  return around([c.focusX, c.focusY + 0.6, 0], mix(10, 6.5, u), mix(-0.9, 1.3, u), mix(rad(10), rad(22), u), 38);
}

// Beside the runner; in the air the camera comes in close, on the ground it stands back.
function follow(t: number, c: FilmCtx): Pose {
  const a = ease(c.airborne);
  return around([c.runnerX + 3, c.runnerY + 1.2, 0], mix(22, 9, a), 0.35 + 0.1 * Math.sin(t * 0.3), mix(rad(10), rad(5), a), mix(40, 34, a));
}

// A slow push in on one thing (a real object), narrowing the view as it goes.
function push(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.push);
  return around([c.focusX, c.focusY + 0.5, 0], mix(16, 4.5, u), mix(0.5, 0.25, u), mix(rad(8), rad(4), u), mix(40, 32, u));
}

// A macro close-up: stays on one part of the runner (a hand, a foot) at arm's length. focusX and focusY are the part's offset from the runner, m.
function macro(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.macro);
  return around([c.runnerX + c.focusX, c.runnerY + c.focusY, 0], (c.macroDist ?? 2) * mix(1.1, 0.9, u), mix(0.35, -0.15, u), rad(6), 28);
}

// The leap look-around (film beat 5): beside the runner, then one slow turn all the way round, at a steady speed so it never fights the runner's own motion.
function spin(t: number, c: FilmCtx): Pose {
  const u = clamp01((t - 0.35) / 0.7); // film seconds are game seconds: the run-up lasts about 0.45 s, the leap to the rope about 0.7 s
  return around([c.runnerX, c.runnerY + 0.9, 0], mix(9, 5.5, ease(t / 0.8)), 2 * Math.PI * u, rad(8), 34);
}

// The hero shot: the camera starts close on the object the photo shows, then flies up and out over the whole course.
export const HERO_PHOTO_HOLD = 2.5; // s the photo is alone on screen
export const HERO_DISSOLVE = 1.5; // s the photo takes to fade into the built place
function hero(t: number, c: FilmCtx): Pose {
  const u = ease((t - HERO_PHOTO_HOLD - HERO_DISSOLVE) / (SHOT_SECONDS.hero - HERO_PHOTO_HOLD - HERO_DISSOLVE));
  const tx = mix(c.focusX, c.finishX * 0.5, u);
  return around([tx, mix(c.focusY + 0.5, 2, u), 0], mix(5, 38, u), mix(0.3, -0.3, u), mix(rad(6), rad(34), u), mix(36, 44, u));
}

// How much of the real photo still covers the scene at time t (1 = only the photo, 0 = only the built place).
export const heroPhotoOpacity = (t: number): number => 1 - ease((t - HERO_PHOTO_HOLD) / HERO_DISSOLVE);

export function filmPose(shot: FilmShot, t: number, c: FilmCtx): Pose {
  switch (shot) {
    case 'flyover': return flyover(t, c);
    case 'orbit': return orbit(t, c);
    case 'follow': return follow(t, c);
    case 'push': return push(t, c);
    case 'hero': return hero(t, c);
    case 'macro': return macro(t, c);
    case 'spin': return spin(t, c);
    case 'skyline': return skyline(t, c);
  }
}

// ?film=orbit (or any shot name) turns the film camera on; anything else leaves play alone.
export function filmShotOf(search: string): FilmShot | null {
  const v = new URLSearchParams(search).get('film');
  return (FILM_SHOTS as string[]).includes(v ?? '') ? (v as FilmShot) : null;
}
