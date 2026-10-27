// The Rookie as an actor the Course can drive (CC-31): give it the simulator's state every tick, it poses the model.
// Local frame while posing: x forward, y up from the surface under the feet, z toward the camera; the group
// is then moved to the feet position and turned for the direction of travel.
import { Box3, Group, Vector3, type Object3D, type Scene } from 'three/webgpu';
import { loadClip, parseClip, sampleClip, type Clip, type Phase } from '../motion/clip';
import { clipToWorld } from '../motion/pose';
import { comAboveHips, legLength } from '../motion/timeline';
import {
  advanceDistance, chooseClip, crouchDepth, facingYaw, flightProgress, landSeconds, leapSeconds, localAngle,
  reachSeconds, runSeconds, runWeight, type ActorState, type ClipKind,
} from '../motion/actor-pose';
import { loadRookie, type RookieId } from './rookie';

export type { ActorState } from '../motion/actor-pose';

export interface RookieActor {
  object: Object3D;
  update(s: ActorState): void;
  dispose(): void;
  joints(): Vector3[]; // where the 30 bones are now, world metres (for the plausibility gate and the tests)
}

const BLEND_TICKS = 12;
const HAND_HEIGHT = 2.1; // m, the grip above the feet (the simulator's handHeight)
const WALL_LEAN = 0.45; // rad, the most the body leans into the slope (at 45 degrees; upright again on the vertical part, where the head would meet the wall)
const STRETCH = 1.08; // the bounce pose, stretched

interface Pose {
  joints: Vector3[]; // local frame, y above the surface
  hipsAbove: number;
}

export async function createRookieActor(scene: Scene, opts: { rookie: RookieId }): Promise<RookieActor> {
  const phases: Phase[] = ['run', 'leap', 'land', 'swing'];
  const [run, leap, land, swing] = await Promise.all(phases.map((p) => loadClip(p)));
  const reach: Clip = parseClip(await (await fetch('/assets/motion/reach.json')).json());
  const rookie = await loadRookie(opts.rookie, run.names, run.parents);
  const group = new Group();
  group.add(rookie.object);
  scene.add(group);

  const names = run.names;
  const ix = (n: string) => names.indexOf(n);
  const scale = rookie.legLength / legLength(names, (i) => new Vector3(...run.frames[0][i]));
  const footBones = names.map((n, i) => (/Foot$|ToeBase$/.test(n) ? i : -1)).filter((i) => i >= 0);

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
  const place = (rel: Vector3[], hipsAbove: number): Pose => ({ joints: rel.map((p) => p.clone().add(new Vector3(0, hipsAbove, 0))), hipsAbove });

  const takeoffFrame = leap.frames[leap.takeoff!];
  const takeoffCom = scale * (takeoffFrame[0][1] - Math.min(...takeoffFrame.map((p) => p[1]))) + scale * comAboveHips(names, takeoffFrame);

  // The ready stance, built bone by bone (clip axes: +z forward, +x left, y up): upright with a slight forward lean,
  // knees soft, feet under the hips, arms hanging with the elbows bent forward and the hands loose.
  const stand = (() => {
    const f = land.frames[13]; // only for the bone lengths and the face details
    const len = (i: number) => Math.hypot(...f[i].map((v, k) => v - f[land.parents[i]][k]));
    const out: number[][] = f.map(() => [0, 0, 0]);
    const LEAN = 0.12; // rad
    const up = (a: number) => new Vector3(0, Math.cos(a), Math.sin(a));
    names.forEach((n, i) => {
      if (i === 0) return;
      const par = out[land.parents[i]], side = n.startsWith('Left') ? 1 : -1;
      let d: Vector3 | null = null;
      if (/^(Spine1|Spine2|Chest|Neck1|Neck2)$/.test(n)) d = up(LEAN);
      else if (n === 'Head') d = up(0.04);
      else if (/Shoulder$/.test(n)) d = new Vector3(side * 0.95, 0.3, 0.05);
      else if (/Arm$/.test(n) && !/Fore/.test(n)) d = new Vector3(side * 0.9, 0.1, 0);
      else if (/ForeArm$/.test(n)) d = new Vector3(side * 0.08, -1, 0.12);
      else if (/Hand$/.test(n)) d = new Vector3(side * 0.04, -1, 0.5);
      else if (/ThumbEnd$/.test(n)) d = new Vector3(side * 0.3, -0.7, 0.5);
      else if (/MiddleEnd$/.test(n)) d = new Vector3(side * 0.02, -1, 0.5);
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
  const lerpPose = (a: Pose, b: Pose, w: number): Pose => ({
    joints: a.joints.map((p, i) => p.clone().lerp(b.joints[i], w)),
    hipsAbove: a.hipsAbove + (b.hipsAbove - a.hipsAbove) * w,
  });

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
      case 'wall-run': {
        const a = sample(run, runSeconds(run, distance, scale), true);
        return place(a.rel, a.hipsAbove).joints;
      }
      case 'wall-reach': {
        const a = sample(reach, reachSeconds(reach, s.wallProgress ?? 1), false);
        return place(a.rel, a.hipsAbove).joints;
      }
      case 'swing':
        return hanging(sample(swing, s.tick / 120, true).rel);
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
    last = joints.map((p) => p.clone());

    // tilt: the wall leans the body with the slope under it; the rope turns it about the grip
    if (prev && !jumped && s.mode === 'wall') {
      const dx = s.facing * (s.x - prev.x);
      const dy = s.y - prev.y;
      if (Math.hypot(dx, dy) > 1e-6) slope = Math.atan2(dy, Math.max(dx, 0));
    } else if (s.mode !== 'wall') slope = 0;
    lean += (WALL_LEAN * Math.sin(2 * slope) - lean) * (1 - Math.pow(0.9, dticks));
    if (Math.abs(lean) > 1e-4) rotateZ(joints, new Vector3(0, 0, 0), -lean);
    if (s.mode === 'swing') rotateZ(joints, new Vector3(0, HAND_HEIGHT, 0), localAngle(s.swingTheta ?? 0, s.facing));

    // pose the bones in the unturned frame at the surface, then move the group to the feet
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.updateMatrixWorld(true);
    // carry the foot clearance so the soles, not the ankles, touch the surface
    const lifted = joints.map((p) => p.clone().add(new Vector3(0, footClear, 0)));
    rookie.apply(lifted);
    if (s.mode !== 'swing' && k !== 'leap') {
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
    joints: () => rookie.world(),
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
