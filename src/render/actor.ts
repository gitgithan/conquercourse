// The Rookie as an actor the Course can drive (CC-31): give it the simulator's state every tick, it poses the model.
// Local frame while posing: x forward, y up from the surface under the feet, z toward the camera; the group
// is then moved to the feet position and turned for the direction of travel.
import { Box3, Group, Vector3, type Object3D, type Scene } from 'three/webgpu';
import { clipDuration, loadClip, parseClip, sampleClip, type Clip, type Phase } from '../motion/clip';
import { vaultPose, type VaultRig } from '../motion/vault-pose';
import { MOTION_TABLE, MY_MOVE_BASE, capturedClipsFrom, moveProgress, myMoveFrom, myMoveIsPlayable, rollLookFrom, type RollLook } from '../motion/motion-table';
import { clipToWorld } from '../motion/pose';
import { BAR_AHEAD, BAR_HEIGHT, SEAT_HIPS, giantSwingLegs, hurtPhase, seatThighPitch, smooth } from '../motion/poses';
import { comAboveHips, legLength } from '../motion/timeline';
import {
  advanceDistance, chooseClip, crouchDepth, facingYaw, flightProgress, landSeconds, leapSeconds, localAngle,
  runSeconds, runWeight, type ActorState, type ClipKind,
} from '../motion/actor-pose';
import { loadRookie, type RookieId } from './rookie';
import type { Obstacle } from '../course/collide';
import { anticipation, getReady, ik2, ledgeReach } from '../motion/compose';
import { settleNeck } from '../motion/neck';
import { SLIDE_RISE_TICKS } from '../motion/actor-state';
import { DT } from '../sim/units';
import { BarsPlayer } from '../motion/bars-actor';
import { rigFromFrame } from '../motion/bars-pose';
const SLIDE_DROP_S = 0.2; // the clip's drop is played over this long: the simulator's body is low from the first tick

export type { ActorState } from '../motion/actor-pose';

export interface RookieActor {
  object: Object3D;
  update(s: ActorState): void;
  dispose(): void;
  setObstacle(o: Obstacle | null): void; // body points are pushed out of platforms and the wall
  names(): string[]; // the joint names, in the order joints() gives them
  joints(): Vector3[]; // where the 30 bones are now, world metres (for the plausibility gate and the tests)
  setRollLook(look: RollLook): void; // 'crouch' always shows the tucked fallback, 'clip' the mocap/Kimodo roll, 'auto' the clip when it loaded (the blind A/B)
  hasRollClip(): boolean;
  hasMyMove(): boolean; // the roll slot plays a clip made from the player's own film (?mymove=<id>, CC-222)
  setHurtLook(look: 'auto' | 'bones'): void; // 'bones' always shows the built fall, 'auto' the clip when one loaded (the blind A/B)
  hasHurtClip(): boolean;
  hurtSeconds(): number | undefined; // how long the fall takes with the clip (its own length), undefined for the built fall
}

const BLEND_TICKS = 12;
const HAND_HEIGHT = 2.1; // m, the grip above the feet (the simulator's handHeight)
const WALL_BACK = 0.5; // rad, on the steep top of the curve the body tilts back toward the curve's centre instead, so the head stays out of the wall
const WALL_LEAN = 0.3; // rad, the most the body leans into the slope (at 45 degrees; upright again on the vertical part, where the head would meet the wall)
const ARMS_FROM = 0.3; // the arms start to rise at this share of the wall climb ...
const ARMS_TO = 0.8; // ... and are overhead here (the legs keep running)
const STRETCH = 1.08; // the bounce pose, stretched
const CLIMB_CLIP_FROM = 36, CLIMB_CLIP_TO = 59; // frames of the captured climb the game plays: hands on the ledge to feet on top (contacts in data/eval/motion-vault)
const VAULT_CLIP_FROM = 21, VAULT_CLIP_TO = 69; // frames of the captured vault the game plays: the plant foot lands to the landing and run-on

interface Pose {
  joints: Vector3[]; // local frame, y above the surface
  hipsAbove: number;
}

export async function createRookieActor(scene: Scene, opts: { rookie: RookieId; url?: string; fit?: boolean }): Promise<RookieActor> {
  const phases: Phase[] = ['run', 'leap', 'land', 'swing'];
  const [run, leap, land, swing] = await Promise.all(phases.map((p) => loadClip(p)));
  const reach: Clip = parseClip(await (await fetch('/assets/motion/reach.json')).json());
  // the roll clip is optional: until one passes the gate and the move check, the roll is drawn as a tuck (src/motion/motion-table.ts)
  let rollClip: Clip | null = null;
  try {
    const r = await fetch('/assets/motion/roll.json');
    if (r.ok) rollClip = parseClip(await r.json());
  } catch { /* no roll clip yet */ }
  // "My move" (CC-222): behind ?mymove=<id>, a clip made from the player's film takes the roll slot, but only if it passed the gate and the roll check
  let myMove = false;
  const myId = typeof location === 'undefined' ? null : myMoveFrom(location.search);
  if (myId) {
    try {
      const r = await fetch(`${MY_MOVE_BASE}/${myId}.json`);
      const raw = r.ok ? await r.json() : null;
      if (myMoveIsPlayable(raw)) { rollClip = parseClip(raw); myMove = true; }
    } catch { /* the shipped roll stays */ }
  }
  // the slide clip is optional: without one, the slide is drawn as the bone-built crouch
  let slideClip: Clip | null = null;
  try {
    const r = await fetch('/assets/motion/slide.json');
    if (r.ok) slideClip = parseClip(await r.json());
  } catch { /* no slide clip yet */ }
  // the hurt clip is optional too: without it the fall is built from bones (crumple into the tuck, lie flat, get up slowly)
  let hurtClip: Clip | null = null;
  try {
    const r = await fetch('/assets/motion/hurt.json');
    if (r.ok) hurtClip = parseClip(await r.json());
  } catch { /* no hurt clip yet */ }
  // the captured climb and vault clips play by default; ?clips=0 shows the bone-built poses (the contact-point vault and the hang-to-stand climb)
  const capturedClips = typeof location === 'undefined' || capturedClipsFrom(location.search);
  // the captured climb and vault clips are optional too: without one, the climb is the hang-to-stand blend and the vault the contact-point pose
  let climbClip: Clip | null = null;
  try {
    if (!capturedClips) throw new Error('off');
    const r = await fetch('/assets/motion/climb.json');
    if (r.ok) climbClip = parseClip(await r.json());
  } catch { /* no climb clip yet */ }
  let vaultClip: Clip | null = null;
  try {
    if (!capturedClips) throw new Error('off');
    const r = await fetch('/assets/motion/vault.json');
    if (r.ok) vaultClip = parseClip(await r.json());
  } catch { /* no vault clip yet */ }
  let hurtLook: 'auto' | 'bones' = typeof location === 'undefined' ? 'auto' : new URLSearchParams(location.search).get('hurt') === 'bones' ? 'bones' : 'auto';
  let rollLook: RollLook = typeof location === 'undefined' ? 'auto' : rollLookFrom(location.search);
  const rookie = await loadRookie(opts.rookie, run.names, run.parents, undefined, opts.url, opts.fit ?? false);
  const group = new Group();
  group.add(rookie.object);
  scene.add(group);

  const names = run.names;
  const ix = (n: string) => names.indexOf(n);
  const scale = rookie.legLength / legLength(names, (i) => new Vector3(...run.frames[0][i]));
  const footBones = names.map((n, i) => (/Foot$|ToeBase$/.test(n) ? i : -1)).filter((i) => i >= 0);

  // the bone lengths of the vault pose: the stand recipe's (the clips' lengths), scaled to the Rookie
  const vaultRig: VaultRig = (() => {
    const f = land.frames[13];
    return { names, parents: land.parents, len: names.map((_, i) => (i === 0 ? 0 : scale * Math.hypot(...f[i].map((v, k) => v - f[land.parents[i]][k])))) };
  })();

  // How high the lowest foot bone sits above the sole when the Rookie stands in its rest pose.
  rookie.object.updateMatrixWorld(true);
  const soleY = new Box3().setFromObject(rookie.object).min.y;
  const footClear = Math.max(0, Math.min(...footBones.map((i) => rookie.rig.bones[i].restPos.y)) - soleY);
  const armLength = (side: 'Left' | 'Right') => {
    const p = (n: string) => rookie.rig.bones[ix(side + n)].restPos;
    return p('Arm').distanceTo(p('ForeArm')) + p('ForeArm').distanceTo(p('Hand'));
  };
  const reachLen = (armLength('Left') + armLength('Right')) / 2;

  // clip joints at a time, as hips-relative game-axes vectors scaled to the Rookie, and the hips' height above the lowest joint
  const sample = (clip: Clip, seconds: number, loop: boolean): { rel: Vector3[]; hipsAbove: number; com: number } => {
    const j = sampleClip(clip, seconds, loop);
    const hips = j[0];
    const minY = Math.min(...j.map((p) => p[1]));
    return {
      rel: j.map((p) => clipToWorld([p[0] - hips[0], p[1] - hips[1], p[2] - hips[2]]).multiplyScalar(scale)),
      hipsAbove: scale * (hips[1] - minY),
      com: scale * comAboveHips(names, j),
    };
  };
  // when the slide clip is lowest (seconds): the drop is played up to here, the rise from here
  let slideLow: number | null = null;
  const slideLowAt = (): number => {
    if (slideLow !== null) return slideLow;
    let best = Infinity; slideLow = 0;
    for (let t = 0; t <= clipDuration(slideClip!); t += 1 / 60) { const y = sampleClip(slideClip!, t, false)[0][1]; if (y < best) { best = y; slideLow = t; } }
    return slideLow;
  };
  const place = (rel: Vector3[], hipsAbove: number): Pose => ({ joints: rel.map((p) => p.clone().add(new Vector3(0, hipsAbove, 0))), hipsAbove });
  // a stretch of a clip (frame from..to) stretched over a move's progress 0..1: the simulator stays the master clock
  const sampleSegment = (clip: Clip, from: number, to: number, p: number): ReturnType<typeof sample> =>
    sample(clip, (from + Math.min(Math.max(p, 0), 1) * (to - from)) / clip.fps, false);

  const takeoffFrame = leap.frames[leap.takeoff!];
  const takeoffCom = scale * (takeoffFrame[0][1] - Math.min(...takeoffFrame.map((p) => p[1]))) + scale * comAboveHips(names, takeoffFrame);

  // The ready stance, built bone by bone (clip axes: +z forward, +x left, y up): straight up, no lean,
  // knees soft, feet under the hips, shoulders from the model's T-pose (relaxed, a touch back), arms hanging straight down.
  const stand = (() => {
    const f = land.frames[13]; // only for the bone lengths and the face details
    const len = (i: number) => Math.hypot(...f[i].map((v, k) => v - f[land.parents[i]][k]));
    const out: number[][] = f.map(() => [0, 0, 0]);
    const LEAN = 0; // rad: stand straight, no lean
    const up = (a: number) => new Vector3(0, Math.cos(a), Math.sin(a));
    names.forEach((n, i) => {
      if (i === 0) return;
      const par = out[land.parents[i]], side = n.startsWith('Left') ? 1 : -1;
      let d: Vector3 | null = null;
      if (/^(Spine1|Spine2|Chest|Neck1|Neck2)$/.test(n)) d = up(LEAN);
      else if (n === 'Head') d = up(0);
      else if (/Shoulder$|Arm$/.test(n) && !/Fore/.test(n)) {
        // from the model's own T-pose, so the shoulders sit relaxed and level, then a touch back
        d = rookie.rig.bones[i].restPos.clone().sub(rookie.rig.bones[land.parents[i]].restPos);
        d.y = Math.min(d.y, 0);
      }
      else if (/ForeArm$/.test(n)) d = new Vector3(side * 0.03, -1, 0);
      else if (/Hand$/.test(n)) d = new Vector3(0, -1, 0);
      else if (/ThumbEnd$/.test(n)) d = new Vector3(side * 0.2, -1, 0.15);
      else if (/MiddleEnd$/.test(n)) d = new Vector3(0, -1, 0);
      else if (/Leg$/.test(n)) d = new Vector3(side * 0.9, -0.5, 0);
      else if (/Shin$/.test(n)) d = new Vector3(0, -1, 0.1);
      else if (/Foot$/.test(n)) d = new Vector3(0, -1, -0.06);
      else if (/ToeBase$/.test(n)) d = new Vector3(0, -0.3, 1);
      if (d) { d.normalize().multiplyScalar(len(i)); out[i] = [par[0] + d.x, par[1] + d.y, par[2] + d.z]; }
      else out[i] = [par[0] + f[i][0] - f[land.parents[i]][0], par[1] + f[i][1] - f[land.parents[i]][1], par[2] + f[i][2] - f[land.parents[i]][2]]; // jaw, eyes
    });
    return out;
  })();
  const standPose = (): Pose => {
    const rel = stand.map((p) => clipToWorld(p).multiplyScalar(scale));
    return place(rel, -Math.min(...rel.map((p) => p.y)));
  };
  // The tuck: knees to the chest, chin down, arms round the shins. Same recipe as the stand: a direction per joint, the bone lengths of the clips.
  const tuck = (() => {
    const f = land.frames[13];
    const len = (i: number) => Math.hypot(...f[i].map((v, k) => v - f[land.parents[i]][k]));
    const out: number[][] = f.map(() => [0, 0, 0]);
    names.forEach((n, i) => {
      if (i === 0) return;
      const par = out[land.parents[i]], side = n.startsWith('Left') ? 1 : -1;
      let d: Vector3 | null = null;
      if (n === 'Spine1') d = new Vector3(0, 0.62, 0.78);
      else if (n === 'Spine2') d = new Vector3(0, 0.34, 0.94);
      else if (n === 'Chest') d = new Vector3(0, 0.17, 0.98);
      else if (n === 'Neck1') d = new Vector3(0, -0.1, 1);
      else if (n === 'Neck2') d = new Vector3(0, -0.3, 0.95);
      else if (n === 'Head') d = new Vector3(0, -0.6, 0.8);
      else if (/Shoulder$|Arm$/.test(n) && !/Fore/.test(n)) { d = rookie.rig.bones[i].restPos.clone().sub(rookie.rig.bones[land.parents[i]].restPos); d.y = Math.min(d.y, 0); }
      else if (/ForeArm$/.test(n)) d = new Vector3(side * 0.15, -0.55, 0.8);
      else if (/Hand$/.test(n)) d = new Vector3(-side * 0.25, -0.6, 0.6);
      else if (/ThumbEnd$/.test(n)) d = new Vector3(side * 0.1, -0.5, 0.4);
      else if (/MiddleEnd$/.test(n)) d = new Vector3(0, -0.5, 0.6);
      else if (/Leg$/.test(n)) d = new Vector3(side * 0.9, -0.5, 0);
      else if (/Shin$/.test(n)) d = new Vector3(side * 0.1, 0.55, 0.83);
      else if (/Foot$/.test(n)) d = new Vector3(0, -0.85, -0.5);
      else if (/ToeBase$/.test(n)) d = new Vector3(0, -0.5, -0.2);
      if (d) { d.normalize().multiplyScalar(len(i)); out[i] = [par[0] + d.x, par[1] + d.y, par[2] + d.z]; }
      else out[i] = [par[0] + f[i][0] - f[land.parents[i]][0], par[1] + f[i][1] - f[land.parents[i]][1], par[2] + f[i][2] - f[land.parents[i]][2]];
    });
    return out;
  })();
  // The fallback roll: the tuck turned once round its middle, forward, over the simulator's roll time, then opened out into the stand.
  const tuckRoll = (p: number): Vector3[] => {
    const rel = tuck.map((q) => clipToWorld(q).multiplyScalar(scale));
    const mid = rel.reduce((a, q) => a.add(q), new Vector3()).multiplyScalar(1 / rel.length);
    const e = p * p * (3 - 2 * p); // eases in and out
    for (const q of rel) q.sub(mid).applyAxisAngle(new Vector3(0, 0, 1), -2 * Math.PI * e).add(mid);
    const low = Math.min(...rel.map((q) => q.y));
    const body = rel.map((q) => new Vector3(q.x - mid.x, q.y - low, q.z));
    const open = Math.min(Math.max((p - 0.75) / 0.25, 0), 1);
    return open <= 0 ? body : lerpPose({ joints: body, hipsAbove: 0 }, standPose(), open * open * (3 - 2 * open)).joints;
  };
  const lerpPose = (a: Pose, b: Pose, w: number): Pose => ({
    joints: a.joints.map((p, i) => p.clone().lerp(b.joints[i], w)),
    hipsAbove: a.hipsAbove + (b.hipsAbove - a.hipsAbove) * w,
  });

  // Poses built bone by bone like the stand (a direction per joint, the bone lengths of the clips); `dir` returns null to keep the land frame's offset.
  const recipe = (dir: (n: string, side: number, i: number, len: (j: number) => number) => Vector3 | null): Vector3[] => {
    const f = land.frames[13];
    const len = (i: number) => Math.hypot(...f[i].map((v, k) => v - f[land.parents[i]][k]));
    const out: number[][] = f.map(() => [0, 0, 0]);
    names.forEach((n, i) => {
      if (i === 0) return;
      const par = out[land.parents[i]], side = n.startsWith('Left') ? 1 : -1;
      const d = dir(n, side, i, len);
      if (d) { d.normalize().multiplyScalar(len(i)); out[i] = [par[0] + d.x, par[1] + d.y, par[2] + d.z]; }
      else out[i] = [par[0] + f[i][0] - f[land.parents[i]][0], par[1] + f[i][1] - f[land.parents[i]][1], par[2] + f[i][2] - f[land.parents[i]][2]];
    });
    return out.map((q) => clipToWorld(q).multiplyScalar(scale));
  };
  const upDir = (a: number) => new Vector3(0, Math.cos(a), Math.sin(a));
  const armRest = (i: number) => { const d = rookie.rig.bones[i].restPos.clone().sub(rookie.rig.bones[land.parents[i]].restPos); d.y = Math.min(d.y, 0); return d; };
  // both hands to a target (the elbows bend toward `pole`)
  const handsTo = (joints: Vector3[], target: (side: 'Left' | 'Right') => Vector3, pole: Vector3) => {
    for (const side of ['Left', 'Right'] as const) {
      const sh = joints[ix(side + 'Arm')], el = joints[ix(side + 'ForeArm')], hand = joints[ix(side + 'Hand')];
      const r = ik2(sh, target(side), sh.distanceTo(el), el.distanceTo(hand), pole);
      const delta = r.hand.clone().sub(hand);
      joints[ix(side + 'ForeArm')] = r.elbow;
      for (const n of ['Hand', 'HandThumbEnd', 'HandMiddleEnd']) joints[ix(side + n)] = joints[ix(side + n)].clone().add(delta);
    }
  };
  const onFloor = (rel: Vector3[], lift = 0): Vector3[] => { const low = Math.min(...rel.map((p) => p.y)); return rel.map((p) => p.clone().add(new Vector3(0, lift - low, 0))); };
  // The coaster rider: hips on the seat, knees bent, back a little leaning, both hands on the cart's grab bar (src/render/track.ts draws it there).
  const seated = (() => {
    const rel = recipe((n, side, i, len) => {
      if (/^(Spine1|Spine2|Chest|Neck1|Neck2)$/.test(n)) return upDir(-0.12);
      if (n === 'Head') return upDir(0);
      if (/Shoulder$|Arm$/.test(n) && !/Fore/.test(n)) return armRest(i);
      if (/ForeArm$/.test(n)) return new Vector3(side * 0.15, -0.45, 0.88);
      if (/Hand$/.test(n)) return new Vector3(-side * 0.1, 0, 1);
      if (/ThumbEnd$/.test(n)) return new Vector3(side * 0.2, -0.2, 1);
      if (/MiddleEnd$/.test(n)) return new Vector3(0, 0, 1);
      if (/Leg$/.test(n)) return new Vector3(side * 0.9, -0.5, 0);
      if (/Shin$/.test(n)) { const a = seatThighPitch(len(i) * scale, len(ix(n.replace('Shin', 'Foot'))) * scale, SEAT_HIPS); return new Vector3(0, Math.sin(a), Math.cos(a)); }
      if (/Foot$/.test(n)) return new Vector3(0, -Math.cos(0.05), Math.sin(0.05));
      if (/ToeBase$/.test(n)) return new Vector3(0, -0.3, 1);
      return null;
    });
    const out = rel.map((p) => p.clone().add(new Vector3(0, SEAT_HIPS, 0)));
    handsTo(out, (side) => new Vector3(BAR_AHEAD, BAR_HEIGHT - footClear, side === 'Left' ? -0.17 : 0.17), new Vector3(0, -1, 0));
    return out;
  })();
  // The trebuchet rider: tucked in the sling, leaning back, both hands up and forward on the sling lines.
  const slinging = (() => {
    const rel = recipe((n, side, i) => {
      if (/^(Spine1|Spine2|Chest|Neck1|Neck2)$/.test(n)) return upDir(-0.3);
      if (n === 'Head') return upDir(-0.1);
      if (/Shoulder$|Arm$/.test(n) && !/Fore/.test(n)) return armRest(i);
      if (/ForeArm$/.test(n)) return new Vector3(side * 0.2, 0.7, 0.4);
      if (/Hand$/.test(n)) return new Vector3(-side * 0.05, 1, 0.2);
      if (/ThumbEnd$/.test(n)) return new Vector3(side * 0.2, 0.6, 0.4);
      if (/MiddleEnd$/.test(n)) return new Vector3(0, 1, 0.2);
      if (/Leg$/.test(n)) return new Vector3(side * 0.9, -0.5, 0);
      if (/Shin$/.test(n)) return new Vector3(side * 0.08, 0.35, 0.93); // knees up and forward
      if (/Foot$/.test(n)) return new Vector3(0, -0.9, -0.25);
      if (/ToeBase$/.test(n)) return new Vector3(0, -0.4, 0.9);
      return null;
    });
    const out = onFloor(rel);
    handsTo(out, (side) => out[ix(side + 'Arm')].clone().add(new Vector3(0.3, 0.62, 0)), new Vector3(-0.3, -1, 0));
    return out;
  })();
  // After a hard landing: crumple into the tuck, lie flat on the front, then get up slowly (the same way back).
  const lying = onFloor(recipe((n, side, i) => {
    if (/^(Spine1|Spine2|Chest|Neck1|Neck2)$/.test(n)) return new Vector3(0, 0.03, 1);
    if (n === 'Head') return new Vector3(0, 0.08, 1);
    if (/Shoulder$|Arm$/.test(n) && !/Fore/.test(n)) return new Vector3(side * 1, -0.05, 0.25);
    if (/ForeArm$/.test(n)) return new Vector3(side * 0.5, -0.1, 1);
    if (/Hand$/.test(n)) return new Vector3(side * 0.2, 0, 1);
    if (/ThumbEnd$/.test(n)) return new Vector3(side * 0.3, 0, 1);
    if (/MiddleEnd$/.test(n)) return new Vector3(0, 0, 1);
    if (/Leg$/.test(n)) return new Vector3(side * 0.9, -0.1, -0.3);
    if (/Shin$/.test(n)) return new Vector3(side * 0.08, 0.02, -1);
    if (/Foot$/.test(n)) return new Vector3(0, 0.02, -1);
    if (/ToeBase$/.test(n)) return new Vector3(0, -0.5, -0.8);
    return null;
  }), 0.07);
  const crumpled = onFloor(tuck.map((q) => clipToWorld(q).multiplyScalar(scale)));
  const mix = (a: Vector3[], b: Vector3[], w: number) => a.map((p, i) => p.clone().lerp(b[i], w));
  let hurtStart: number | null = null;
  const hurtClipPose = (t: number): Vector3[] => { const a = sample(hurtClip!, t * clipDuration(hurtClip!), false); return place(a.rel, a.hipsAbove).joints; };
  function hurtPose(ticksSince: number): Vector3[] {
    const useClip = hurtClip !== null && hurtLook !== 'bones';
    const { phase, t } = hurtPhase(ticksSince, useClip ? clipDuration(hurtClip!) : undefined); // the clip plays at its own speed
    const stand = standPose().joints;
    const down = useClip ? hurtClipPose(1) : lying;
    if (phase === 'fall') return useClip ? hurtClipPose(t) : t < 0.5 ? mix(stand, crumpled, smooth(t * 2)) : mix(crumpled, down, smooth(t * 2 - 1));
    if (phase === 'down') return down.map((p) => p.clone());
    return t < 0.5 ? mix(down, crumpled, smooth(t * 2)) : mix(crumpled, stand, smooth(t * 2 - 1));
  }
  const legIx = (['Left', 'Right'] as const).map((side) => ({ hip: ix(side + 'Leg'), knee: ix(side + 'Shin'), foot: ix(side + 'Foot'), toe: ix(side + 'ToeBase') }));

  // monkey bars (CC-133): the hands go on the rungs and the body hangs from them (src/motion/bars-pose.ts)
  const barsPlayer = new BarsPlayer(rigFromFrame(names, run.parents, run.frames[13].map((p) => p.map((v) => v * scale))));
  const barsHere = (s: ActorState): boolean => s.mode === 'swing' && s.bars !== undefined;

  let obstacle: Obstacle | null = null;
  const shift = { x: 0, y: 0 }; // how far the whole body is moved out of an obstacle (local axes: x along the run)

  // memory between updates (the actor is driven one tick at a time; a jump in ticks just restarts the easing)
  let prev: { x: number; y: number; tick: number } | null = null;
  let distance = 0;
  let kind: ClipKind | null = null;
  let kindSince = 0;
  let last: Vector3[] | null = null;
  let blendFrom: Vector3[] | null = null;
  let v0 = 3;
  let slope = 0;
  let lean = 0;

  function build(s: ActorState, k: ClipKind): Vector3[] {
    switch (k) {
      case 'stand':
        return standPose().joints;
      case 'run': {
        const a = sample(run, runSeconds(run, distance, scale), true);
        const running = place(a.rel, a.hipsAbove);
        const w = runWeight(s.vx);
        return w >= 1 ? running.joints : lerpPose(standPose(), running, w).joints;
      }
      case 'leap': {
        const p = flightProgress(v0, s.vy);
        const a = sample(leap, leapSeconds(leap, p), false);
        // in the air the whole body, not the hips, follows the arc; near touch-down the feet take over
        const byCom = takeoffCom - a.com;
        const f = Math.min(Math.max((p - 0.8) / 0.2, 0), 1);
        return place(a.rel, byCom + (a.hipsAbove - byCom) * (f * f * (3 - 2 * f))).joints;
      }
      case 'land': {
        const a = sample(land, landSeconds(land, s.landedTicksAgo!), false);
        const d = 1 - 0.22 * crouchDepth(s.squat, s.landedTicksAgo!);
        return place(a.rel, a.hipsAbove).joints.map((p) => new Vector3(p.x, p.y * d, p.z));
      }
      case 'bounce': {
        const a = sample(leap, leap.takeoff! / leap.fps, false);
        return place(a.rel, a.hipsAbove).joints.map((p) => new Vector3(p.x, p.y * STRETCH, p.z));
      }
      case 'wall-run':
      case 'wall-reach': {
        // the legs keep running up the curve; the arms start to rise early and are overhead by the top, so the reach is not a late snap
        const a = sample(run, runSeconds(run, distance, scale), true);
        const body = place(a.rel, a.hipsAbove).joints;
        if (s.ledge) return body; // the arms reach for the real ledge after the pose is tilted (below)
        const p = s.wallProgress ?? 0;
        const t = Math.min(Math.max((p - ARMS_FROM) / (ARMS_TO - ARMS_FROM), 0), 1);
        if (t <= 0) return body;
        const w = t * t * (3 - 2 * t);
        const r = sample(reach, (t * (reach.frames.length - 1)) / reach.fps, false);
        for (const side of ['Left', 'Right']) {
          const sh = ix(side + 'Arm');
          for (const n of ['ForeArm', 'Hand', 'HandThumbEnd', 'HandMiddleEnd']) {
            const i = ix(side + n);
            const target = body[sh].clone().add(r.rel[i]).sub(r.rel[sh]); // the reach clip's arm, hung from the running body's shoulder
            body[i] = body[i].clone().lerp(target, w);
          }
        }
        return body;
      }
      case 'swing': {
        if (barsHere(s)) {
          const b = barsPlayer.pose({ ...s.bars!, theta: s.swingTheta ?? 0, omega: s.swingOmega ?? 0 }, s, s.tick, s.facing, footClear);
          return b.joints.map((p) => new Vector3(p[2], p[1], -p[0])); // the clips' axes to the game's
        }
        const h = hanging(sample(swing, s.tick / 120, true).rel);
        // on a bar the legs lag behind a fast swing and tuck over the top (giant swing); the rope keeps the plain hang
        if (s.swingOmega !== undefined) giantSwingLegs(h, legIx, 0, localAngle(s.swingTheta ?? 0, s.facing), localAngle(s.swingOmega, s.facing));
        return h;
      }
      case 'sling':
        return slinging.map((q) => q.clone());
      case 'hurt':
        return hurtPose(s.tick - (hurtStart ?? s.tick));
      case 'climb': {
        const p = s.climbProgress ?? 0;
        if (climbClip) {
          // the captured pull-up stretched over the simulator's climb; reachLedge below holds the hands on the real edge, whatever its height
          const a = sampleSegment(climbClip, CLIMB_CLIP_FROM, CLIMB_CLIP_TO, p);
          return place(a.rel, a.hipsAbove).joints;
        }
        // hanging by the hands from the edge (the swing clip straightened: arms up, body hanging), then the body folds up and stands on the top;
        // the hands are held on the real edge afterwards by reachLedge, so only the body has to change from hanging to standing
        const hangEnd = 30 / 132, t = Math.min(1, Math.max(0, (p - hangEnd) / (1 - hangEnd)));
        const w = Math.min(1, Math.max(0, (t - 0.25) / 0.6)), e = w * w * (3 - 2 * w);
        const hang = hanging(sample(swing, 0, false).rel);
        if (e <= 0) return hang;
        const stand = standPose().joints;
        return hang.map((q, i) => q.clone().lerp(stand[i], e));
      }
      case 'vault': {
        if (!s.vaultContact) return build(s, 'run');
        const p = s.vaultProgress ?? 1;
        if (vaultClip) {
          // the captured vault stretched over the simulator's vault; the hands are pinned on this obstacle's contact point, not the filmed one
          const a = sampleSegment(vaultClip, VAULT_CLIP_FROM, VAULT_CLIP_TO, p);
          const joints = place(a.rel, a.hipsAbove).joints;
          pinVaultHands(joints, s, p);
          return joints;
        }
        // the hands on the obstacle: the pose is built from the simulator's contact point (the base is the running pose it starts and ends in)
        const base = build(s, 'run');
        const contact = { x: (s.vaultContact.x - s.x) * s.facing, y: s.vaultContact.y - s.y - footClear }; // (the pose is lifted by footClear below, so the hands land on the surface)
        return vaultPose(vaultRig, { progress: p, contact, base }).joints;
      }
      case 'roll': {
        const p = moveProgress(MOTION_TABLE.roll, s.rolledAt!, s.tick) ?? 1;
        if (rollClip && rollLook !== 'crouch') {
          const a = sample(rollClip, p * clipDuration(rollClip), false); // the simulator's roll time stretched over the clip
          return place(a.rel, a.hipsAbove).joints;
        }
        return tuckRoll(p);
      }
      case 'slide': { // low on the hip, carried along the ground by the simulator's slide: the Kimodo clip drops fast, holds at its lowest, and rises when the slide ends; without the clip, the bone-built crouch
        if (!slideClip) return crumpled.map((q) => q.clone());
        const dur = clipDuration(slideClip), low = slideLowAt();
        const smoothU = (u: number): number => { const c = Math.min(Math.max(u, 0), 1); return c * c * (3 - 2 * c); };
        const t = s.slideRisingTicks !== undefined ? low + smoothU(s.slideRisingTicks / SLIDE_RISE_TICKS) * (dur - low) : smoothU((s.slideTicks ?? 0) * DT / SLIDE_DROP_S) * low;
        const a = sample(slideClip, t, false);
        return place(a.rel, a.hipsAbove).joints;
      }
      case 'sit': // seated in a cart, hands on the grab bar
        return seated.map((q) => q.clone());
    }
  }

  // The swing clip with the hands put on the grip point and the arms straight up: the body hangs from the hands.
  // The clip's own body is folded (it is a swing seat), so the trunk and legs are straightened to hang.
  function hanging(rel: Vector3[]): Vector3[] {
    const shoulder = rel[ix('LeftArm')].clone().add(rel[ix('RightArm')]).multiplyScalar(0.5);
    const shift = new Vector3(0, HAND_HEIGHT - reachLen, 0).sub(shoulder);
    const out = rel.map((p) => p.clone().add(shift));
    const hips = out[0].clone();
    // trunk and head straight above the hips
    for (const n of ['Spine1', 'Spine2', 'Chest', 'Neck1', 'Neck2', 'Head', 'Jaw', 'LeftEye', 'RightEye', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm']) {
      const p = out[ix(n)];
      p.x = hips.x + (n.includes('Eye') || n === 'Jaw' ? 0.08 : 0);
    }
    for (const [side, z] of [['Left', -0.1], ['Right', 0.1]] as const) {
      const hand = new Vector3(0, HAND_HEIGHT, z);
      const arm = out[ix(side + 'Arm')];
      out[ix(side + 'Hand')] = hand;
      out[ix(side + 'ForeArm')] = arm.clone().lerp(hand, 0.5);
      out[ix(side + 'HandMiddleEnd')] = hand.clone().add(new Vector3(0, 0.09, 0));
      out[ix(side + 'HandThumbEnd')] = hand.clone().add(new Vector3(0.03, 0.05, 0));
      // legs hang from the hips, the knees a little forward
      const thigh = rel[ix(side + 'Leg')].distanceTo(rel[ix(side + 'Shin')]);
      const shin = rel[ix(side + 'Shin')].distanceTo(rel[ix(side + 'Foot')]);
      const top = out[ix(side + 'Leg')].clone();
      const knee = top.clone().add(new Vector3(0.1, -thigh, 0));
      const foot = knee.clone().add(new Vector3(-0.02, -shin, 0));
      out[ix(side + 'Shin')] = knee;
      out[ix(side + 'Foot')] = foot;
      out[ix(side + 'ToeBase')] = foot.clone().add(new Vector3(0.11, -0.04, 0));
    }
    return out;
  }

  // Send both hands to the wall's top edge with two-bone reach. How much depends on how far the edge is from the shoulder,
  // so a taller or shorter wall just starts the reach earlier or later; after the shoulders pass the edge the hands let go.
  function reachLedge(joints: Vector3[], s: ActorState): void {
    const target = new Vector3(s.facing * (s.ledge!.x - s.x) + 0.08, s.ledge!.y - s.y - footClear + 0.03, 0);
    for (const side of ['Left', 'Right']) {
      const sh = joints[ix(side + 'Arm')], el = joints[ix(side + 'ForeArm')], hand = joints[ix(side + 'Hand')];
      const l1 = sh.distanceTo(el), l2 = el.distanceTo(hand);
      const reach = ledgeReach(sh.distanceTo(target), l1 + l2);
      const letGo = 1 - Math.min(1, Math.max(0, (sh.y - target.y) / 0.25));
      const w = reach * letGo;
      if (w <= 0) continue;
      const r = ik2(sh, target, l1, l2, new Vector3(-0.6, -1, 0));
      const delta = r.hand.clone().sub(hand).multiplyScalar(w);
      joints[ix(side + 'ForeArm')] = el.clone().lerp(r.elbow, w);
      for (const n of ['Hand', 'HandThumbEnd', 'HandMiddleEnd']) joints[ix(side + n)] = joints[ix(side + n)].clone().add(delta);
    }
  }

  // Pin both hands on the vault's contact point while the body passes over it: the captured hands were measured on another wall,
  // so they are solved onto this one (full weight while the clip's own hands are down, easing in before and out after).
  function pinVaultHands(joints: Vector3[], s: ActorState, p: number): void {
    const ramp = (a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
    const w = ramp(0.12, 0.22) * (1 - ramp(0.62, 0.78));
    if (w <= 0) return;
    const target = new Vector3((s.vaultContact!.x - s.x) * s.facing, s.vaultContact!.y - s.y - footClear + 0.03, 0);
    for (const side of ['Left', 'Right']) {
      const sh = joints[ix(side + 'Arm')], el = joints[ix(side + 'ForeArm')], hand = joints[ix(side + 'Hand')];
      target.z = hand.z; // each hand lands on the top at its own side, not both on the centre line
      const l1 = sh.distanceTo(el), l2 = el.distanceTo(hand);
      const r = ik2(sh, target, l1, l2, new Vector3(-0.6, -1, 0));
      const delta = r.hand.clone().sub(hand).multiplyScalar(w);
      joints[ix(side + 'ForeArm')] = el.clone().lerp(r.elbow, w);
      for (const n of ['Hand', 'HandThumbEnd', 'HandMiddleEnd']) joints[ix(side + n)] = joints[ix(side + n)].clone().add(delta);
    }
  }

  const rotateZ = (joints: Vector3[], about: Vector3, angle: number) => {
    for (const p of joints) p.sub(about).applyAxisAngle(new Vector3(0, 0, 1), angle).add(about);
  };

  function update(s: ActorState): void {
    const jumped = prev !== null && Math.abs(s.tick - prev.tick) > 30;
    if (jumped || !prev) {
      distance = s.facing * s.x;
      kind = null;
    } else {
      distance = advanceDistance(distance, prev, s);
    }
    const dticks = prev && !jumped ? Math.max(1, s.tick - prev.tick) : 1;

    if (s.hurt) { if (hurtStart === null || s.tick < hurtStart) hurtStart = s.tick; } else hurtStart = null;
    const k = chooseClip(s);
    if (k !== kind) {
      blendFrom = kind && last ? last.map((p) => p.clone()) : null;
      if (k === 'leap') v0 = s.vy;
      kind = k;
      kindSince = s.tick;
    }

    let joints = build(s, k);
    const into = s.tick - kindSince;
    if (blendFrom && into < BLEND_TICKS) {
      const w = (into + 1) / (BLEND_TICKS + 1);
      joints = joints.map((p, i) => blendFrom![i].clone().lerp(p, w));
    }
    // the grab, the let-go and the grab again blend a folded pose into a hang: keep the neck and the shoulders where the trunk says
    if (k === 'climb' || (k === 'swing' && !barsHere(s)) || s.mode === 'wall' || (blendFrom && into < BLEND_TICKS)) settleNeck(joints, standPose().joints, ix);
    last = joints.map((p) => p.clone());

    // tilt: the wall leans the body with the slope under it; the rope turns it about the grip
    if (prev && !jumped && s.mode === 'wall') {
      const dx = s.facing * (s.x - prev.x);
      const dy = s.y - prev.y;
      if (Math.hypot(dx, dy) > 1e-6) slope = Math.atan2(dy, Math.max(dx, 0));
    } else if (s.mode !== 'wall') slope = 0;
    lean += (WALL_LEAN * Math.sin(2 * slope) - WALL_BACK * Math.sin(slope) ** 3 - lean) * (1 - Math.pow(0.9, dticks));
    if (Math.abs(lean) > 1e-4) rotateZ(joints, new Vector3(0, 0, 0), -lean);
    if (s.mode === 'swing' && !barsHere(s)) rotateZ(joints, new Vector3(0, HAND_HEIGHT, 0), localAngle(s.swingTheta ?? 0, s.facing));
    if (s.mode === 'cart') rotateZ(joints, new Vector3(0, 0, 0), localAngle(s.tilt ?? 0, s.facing)); // the cart pitches with the rails

    // composing: the arms reach for the real ledge, and the body gets ready for the next obstacle before it arrives
    if ((s.mode === 'wall' || k === 'climb') && s.ledge && !(k === 'climb' && (s.climbProgress ?? 0) > 0.9)) reachLedge(joints, s);
    else if (s.next && s.mode === 'run') getReady(joints, ix, s.next.kind, anticipation(s.next.distance / Math.max(Math.abs(s.vx), 2)));

    // pose the bones in the unturned frame at the surface, then move the group to the feet
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.updateMatrixWorld(true);
    // carry the foot clearance so the soles, not the ankles, touch the surface
    const lifted = joints.map((p) => p.clone().add(new Vector3(0, footClear, 0)));
    const ob = k === 'vault' ? null : obstacle; // the hands are meant to touch the step: the pose keeps itself above it
    if (ob) {
      // the simulator's feet can sit in a corner (the climb over the wall's edge): move the whole body out of it, eased so it does not pop
      const root = ob(s.x, s.y + 0.15) ?? { dx: 0, dy: 0 };
      const ease = 1 - Math.pow(0.6, dticks);
      shift.x += (root.dx - shift.x) * ease; shift.y += (root.dy - shift.y) * ease;
      for (const p of lifted) { p.x += s.facing * shift.x; p.y += shift.y; }
      // and keep every body point out of the blocks and the curve (the motion need not be exact, but it must not overlap)
      lifted.forEach((p, i) => {
        const out = ob(s.x + s.facing * p.x, s.y + p.y, footBones.includes(i) ? 0.03 : undefined); // feet may touch the surface; the rest keeps its thickness out
        if (out) { p.x += s.facing * out.dx; p.y += out.dy; }
      });
    }
    rookie.apply(lifted, { floor: k !== 'vault' && k !== 'climb' }); // in a vault the feet are over the step, not near the floor of the pose's frame: no lift, so the hands stay on the contact point
    if (s.mode !== 'swing' && k !== 'leap' && k !== 'roll' && k !== 'slide' && k !== 'vault' && k !== 'hurt' && k !== 'climb') {
      const low = Math.min(...footBones.map((i) => rookie.bones[i].getWorldPosition(new Vector3()).y));
      if (low < footClear) {
        const hips = rookie.bones[0].getWorldPosition(new Vector3());
        rookie.bones[0].position.copy(rookie.bones[0].parent!.worldToLocal(hips.add(new Vector3(0, footClear - low, 0))));
        rookie.object.updateMatrixWorld(true);
      }
    }
    group.position.set(s.x, s.y, 0);
    group.rotation.y = facingYaw(s.facing);
    group.updateMatrixWorld(true);
    prev = { x: s.x, y: s.y, tick: s.tick };
  }

  return {
    object: group,
    update,
    setObstacle: (o) => { obstacle = o; },
    names: () => names,
    joints: () => rookie.world(),
    setRollLook: (l) => { rollLook = l; },
    setHurtLook: (l) => { hurtLook = l; },
    hasHurtClip: () => hurtClip !== null,
    hurtSeconds: () => (hurtClip !== null && hurtLook !== 'bones' ? clipDuration(hurtClip) : undefined),
    hasRollClip: () => rollClip !== null,
    hasMyMove: () => myMove,
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        const m = o as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
        else m.material?.dispose();
      });
    },
  };
}
