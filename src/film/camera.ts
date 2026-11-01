// The film camera: scripted shots for the demo video (CC-130). Each shot is a pure function of the time in seconds, so a film frame is the same every run.
// It only runs with ?film=<shot> in the address; play never loads it.

export type FilmShot = 'flyover' | 'orbit' | 'follow' | 'push' | 'hero' | 'macro' | 'spin' | 'skyline' | 'dive' | 'eyes' | 'aerial' | 'side' | 'tour' | 'close' | 'rig' | 'clean' | 'eyesC' | 'matrix';
export const FILM_SHOTS: FilmShot[] = ['flyover', 'orbit', 'follow', 'push', 'hero', 'macro', 'spin', 'skyline', 'dive', 'eyes', 'aerial', 'side', 'tour', 'close', 'rig', 'clean', 'eyesC', 'matrix'];

export interface Pose { pos: [number, number, number]; look: [number, number, number]; fov: number; hideBody?: boolean }
export interface FilmCtx {
  finishX: number; // the end of the course, m
  focusX: number; // the thing a shot is about (an obstacle or a real object), m
  focusY: number; // and its height, m
  runnerX: number; runnerY: number;
  macroDist?: number; // macro only: how far the camera stands from the part, m
  airborne: number; // 0 on the ground to 1 in the air; the caller eases it, so the follow shot zooms in at take-off and out at landing
  rig?: Record<string, number>; // rig shot only: the numbers from the address (see rig below)
}

export const SHOT_SECONDS: Record<FilmShot, number> = { flyover: 12, orbit: 8, follow: 10, push: 7, hero: 11, macro: 4, spin: 1.1, skyline: 7.2, dive: 4.8, eyes: 3.6, aerial: 7.2, side: 60, tour: 12, close: 60, rig: 1, clean: 1, eyesC: 2.4, matrix: 7.2 };

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
// It stops where the stored buildings stop (about x 46) and swings round to face them, so the second half is backdrop and not bare decks (CC-238).
function skyline(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.skyline);
  return around([mix(2, Math.min(c.finishX - 6, 46), u), mix(2.5, 5, u), 0], mix(30, 21, u), mix(0.22, 0.02, u), rad(mix(7, -22, u)), 44);
}

// The dive: from high behind the start, looking down the course, one descending arc that settles into the plain side view at the start line (film: flyover into the run).
// One move, constant direction, caused by the reveal; it ends where the side run begins, so the two takes cut together.
function dive(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.dive);
  // it ends exactly on the plain side view (target 5 m ahead of the runner and 2.5 m up, camera 1.5 m higher and 25 m out, field of view 40), so the run that follows needs no cut in the picture
  return around([mix(c.runnerX + 16, c.runnerX + 5, u), mix(c.runnerY + 1.1, c.runnerY + 2.5, u), 0], mix(34, Math.hypot(1.5, 25), u), mix(1.15, 0, u), mix(rad(28), Math.asin(1.5 / Math.hypot(1.5, 25)), u), mix(44, 40, u));
}

// The aerial: high over the whole course from behind the start to above the finish, the lane opening out below (the owner's fly-over). The runner waits at the start (?timescale=0).
function aerial(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.aerial);
  return around([mix(6, c.finishX - 10, u), 4, 0], mix(50, 58, Math.sin(Math.PI * u)), mix(0.62, -0.38, u), mix(rad(52), rad(38), u), 40);
}

// The plain side view as the Course draws it (the runner 5 m from the middle of the picture, a little above), but a pure function of the runner, so the film has no lag to jitter.
let sideY = NaN, sideT = -1;
function side(t: number, c: FilmCtx): Pose {
  const want = c.runnerY + 2.5;
  const dt = sideT < 0 ? 1 : Math.max(0, t - sideT);
  sideY = Number.isNaN(sideY) || Math.abs(want - sideY) > 4 ? want : sideY + (want - sideY) * (1 - Math.exp(-dt / 0.15));
  sideT = t;
  return { pos: [c.runnerX + 5, sideY + 1.5, 25], look: [c.runnerX + 5, sideY, 0], fov: 40 };
}

// The eyes: from the plain side view the camera swings round behind the runner and flies in to the eyes, ending on the same view as the First person camera (C key).
// One move with one cause (the runner), at a steady rate: the distance closes at a constant ratio and the turn eases, so nothing speeds up or wobbles.
function eyes(t: number, c: FilmCtx): Pose {
  const u = clamp01(t / SHOT_SECONDS.eyes), turn = ease(u), reach = clamp01((u - 0.25) / 0.75);
  const head: [number, number, number] = [c.runnerX + 0.15, c.runnerY + 1.62, 0.1];
  const dist = 26 * Math.pow(0.12 / 26, reach); // 26 m to 0.12 m at a constant ratio
  const yaw = (Math.PI / 2) * turn; // 0 = the side view (camera in front of the screen), 90 degrees = straight behind the runner
  const pitch = rad(mix(8, 1.5, turn));
  const flat = dist * Math.cos(pitch);
  const pos: [number, number, number] = [head[0] - flat * Math.sin(yaw), head[1] + dist * Math.sin(pitch), head[2] + flat * Math.cos(yaw)];
  const ahead = ease(clamp01((u - 0.3) / 0.6)); // the look point moves from the runner to the way ahead
  const look: [number, number, number] = [mix(head[0] + 4, head[0] + 10, ahead), mix(head[1] - 0.6, head[1] - 0.4, ahead), 0.1];
  return { pos, look, fov: mix(40, 75, ease(clamp01((u - 0.5) / 0.5))), hideBody: dist < 1.0 };
}

// Into the runner's eyes (version C of the film): the camera leaves the side view, swings round behind the runner on a steady arc, closes in and ends at the eyes, looking down the course.
// One move with one cause (the runner keeps running); the runner's body is hidden once the camera is inside the head, as in the game's own first-person view.
function eyesC(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.eyesC);
  const head: [number, number, number] = [c.runnerX + 0.15, c.runnerY + 1.62, 0.1];
  const side: [number, number, number] = [c.runnerX + 5, c.runnerY + 2.5, 0]; // where the game's own side camera looks, so the shot starts exactly where the side view was
  const target: [number, number, number] = [mix(side[0], head[0], u), mix(side[1], head[1], u), mix(side[2], head[2], u)];
  const yaw = -u * Math.PI * 0.5; // from the side (+z) round behind the runner (running to the right)
  const dist = 25 * Math.pow(1 - u, 2.2);
  const pitch = mix(0.06, 0.03, u);
  const pos: [number, number, number] = [target[0] + dist * Math.cos(pitch) * Math.sin(yaw), target[1] + dist * Math.sin(pitch), target[2] + dist * Math.cos(pitch) * Math.cos(yaw)];
  const ahead: [number, number, number] = [head[0] + 10, head[1] - 0.4, head[2]];
  const aim = ease(Math.max(0, (u - 0.35) / 0.65)); // the gaze swings from the runner to the course ahead late in the move
  const look: [number, number, number] = [mix(target[0], ahead[0], aim), mix(target[1], ahead[1], aim), mix(target[2], ahead[2], aim)];
  return { pos, look, fov: mix(40, 75, u) };
}

// The matrix orbit (film shot 6): one slow, steady turn round the runner from straight behind, through the side, to 45 degrees in front of him (running to the right).
// The look point is the runner himself, so he stays in the middle of the picture the whole way; the field of view never changes and the distance only grows, smoothly, so there is no zoom jerk and no shake.
export const MATRIX_YAW: [number, number] = [-Math.PI / 2, Math.PI / 4]; // behind ... front-45
function matrix(t: number, c: FilmCtx): Pose {
  const u = ease(t / SHOT_SECONDS.matrix);
  return around([c.runnerX, c.runnerY + 0.6, 0], mix(6.5, 9.5, u), mix(MATRIX_YAW[0], MATRIX_YAW[1], u), rad(mix(5, 9, u)), 38);
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

// A closer follow for fast cuts: the runner fills a third of the picture, the distance stays the same (no zoom), a little more in the air.
function close(t: number, c: FilmCtx): Pose {
  const a = ease(c.airborne);
  return around([c.runnerX + 2.2, c.runnerY + 1.1, 0], mix(6.5, 5.8, a), 0.3 + 0.08 * Math.sin(t * 0.3), mix(rad(8), rad(5), a), 38);
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


// The rig (film B): a camera that rides with the runner at a set angle and distance, glides from one setting to another at a constant ease, and can end inside the runner's head (first person).
// Numbers from the address, each with an end value `<name>2`: d (m from the runner), yaw (rad, 0 = plain side view, negative = from behind), pitch (deg), fov, lead (m ahead of the runner), ty (m above the runner).
// rt0 and rt1 are the seconds the glide starts and ends; eye0 and eye1 are the seconds the camera swings round behind the runner and into the eyes, looking down the course (the side view turning into first person).
// The aim point follows the runner with a short smoothing (sm seconds), so the view is steady while the runner bobs; the state depends on film time only, so every run of the same frames is the same.
const rigState = { t: -1, x: 0, y: 0 };
function rig(t: number, c: FilmCtx): Pose {
  const p = c.rig ?? {};
  const g = (k: string, d: number) => (p[k] ?? d);
  const mixk = (k: string, d: number, u: number) => mix(g(k, d), g(k + '2', g(k, d)), u);
  const u = ease((t - g('rt0', 0)) / Math.max(0.001, g('rt1', 1e9) - g('rt0', 0)));
  const sm = g('sm', 0.2), dt = t - rigState.t;
  if (rigState.t < 0 || dt <= 0 || dt > 0.5) { rigState.x = c.runnerX; rigState.y = c.runnerY; } else { const a = 1 - Math.exp(-dt / sm); rigState.x += (c.runnerX - rigState.x) * a; rigState.y += (c.runnerY - rigState.y) * a; }
  rigState.t = t;
  const tx = rigState.x + mixk('lead', 0, u), ty = rigState.y + mixk('ty', 1.1, u);
  const dist = mixk('d', 10, u), yaw = mixk('yaw', 0, u), pitch = rad(mixk('pitch', 6, u)), fov = mixk('fov', 38, u);
  const side = around([tx, ty, 0], dist, yaw, pitch, fov);
  const e = ease((t - g('eye0', 1e9)) / Math.max(0.001, g('eye1', 1e9) - g('eye0', 1e9)));
  if (e <= 0) return side;
  const head: [number, number, number] = [c.runnerX, c.runnerY + 1.55, 0.08];
  const ahead: [number, number, number] = [c.runnerX + 14, c.runnerY + 1.1, 0];
  (window as unknown as { __filmEye?: number }).__filmEye = e; // the Course hides the body once the eyes are in the head
  const dd = e < 0.6 ? mix(dist, Math.min(dist, 3), e / 0.6) : mix(Math.min(dist, 3), 0.25, (e - 0.6) / 0.4); // out round the runner, then in behind the head
  const swing = around([head[0], head[1], 0], dd, mix(yaw, -Math.PI / 2, e), mix(pitch, rad(2), e), mix(fov, 70, e));
  const look: [number, number, number] = [mix(tx, ahead[0], e), mix(ty, ahead[1], e), 0];
  return { pos: [swing.pos[0], mix(swing.pos[1], head[1], e * e), mix(swing.pos[2], head[2], e * e)], look, fov: swing.fov };
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
    case 'matrix': return matrix(t, c);
    case 'follow': return follow(t, c);
    case 'push': return push(t, c);
    case 'hero': return hero(t, c);
    case 'macro': return macro(t, c);
    case 'spin': return spin(t, c);
    case 'skyline': return skyline(t, c);
    case 'dive': return t >= SHOT_SECONDS.dive ? side(t, c) : dive(t, c);
    case 'eyes': return eyes(t, c);
    case 'eyesC': return eyesC(t, c);
    case 'clean': return dive(0, c); // not used: the Course keeps its own camera for 'clean'
    case 'aerial': return aerial(t, c);
    case 'side': return side(t, c);
    // the owner's script in one move: dive onto the start in side view (4.8 s), run in side view (3.6 s), then round behind the runner and into the eyes (3.6 s)
    case 'close': return close(t, c);
    case 'tour': return t < 4.8 ? dive(t, c) : t < 8.4 ? side(t, c) : eyes(t - 8.4, c);
    case 'rig': return rig(t, c);
  }
}

// ?film=orbit (or any shot name) turns the film camera on; anything else leaves play alone.
export function filmShotOf(search: string): FilmShot | null {
  const v = new URLSearchParams(search).get('film');
  return (FILM_SHOTS as string[]).includes(v ?? '') ? (v as FilmShot) : null;
}
