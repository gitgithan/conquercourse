// The vault pose, built from the geometry of the move instead of played from a clip (CC-68).
// A speed vault is hands on the obstacle: at the plant the body leans in and the arms reach for the top surface; while the body passes over,
// both hands stay pinned on the top at the vault's contact point (the arms are solved to that point, the shoulders over the hands, the hips lifted
// by the arms so the body arcs over, the legs gathered); then the hands let go as the feet come down and the body stands up into the run.
// Axes are the actor's: x along the run, y up, z to the runner's right; the origin is the feet's place (the simulator's x, y).
import { Vector3 } from 'three';

export interface VaultRig {
  names: string[];
  parents: number[];
  len: number[]; // bone length from each joint to its parent, metres on the Rookie
}

export interface VaultPoseIn {
  progress: number; // 0 to 1 through the vault (the simulator's tick / length)
  contact: { x: number; y: number }; // where the hands go, relative to the feet's place (x along the run, y up)
  base: Vector3[]; // the running pose the vault starts from and ends in (same joints, same frame)
}

export interface VaultPoseOut {
  joints: Vector3[];
  handsDown: number; // 0 to 1: how firmly the hands are pinned on the contact point (1 = exactly on it)
  hands: { left: Vector3; right: Vector3 };
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const rotZ = (v: Vector3, angle: number) => { // turn in the x-y plane, counter-clockwise by `angle`
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Vector3(v.x * c - v.y * s, v.x * s + v.y * c, v.z);
};
const up = (phi: number) => new Vector3(Math.sin(phi), Math.cos(phi), 0); // a direction leaning forward by phi from straight up

// Where the hands are pinned: the arm reach used for the check (a little less than the real reach, so the arms are never asked for more than they have).
export const REACH_SHARE = 0.93;
export const PIN_FROM = 0.97; // the hands are pinned while the contact is within this share of the reach ahead of the shoulders ...
export const PIN_UNTIL = -0.8; // ... and until it is this share of the reach behind them

export function vaultPose(rig: VaultRig, inp: VaultPoseIn): VaultPoseOut {
  const { names, parents, len } = rig;
  const ix = (n: string) => names.indexOf(n);
  const p = Math.min(Math.max(inp.progress, 0), 1);
  const off = (n: string) => inp.base[ix(n)].clone().sub(inp.base[parents[ix(n)]]); // the base pose's offset from the parent (small parts)
  const upper = len[ix('LeftForeArm')], fore = len[ix('LeftHand')], reach = (upper + fore) * REACH_SHARE;
  const trunk = len[ix('Spine1')] + len[ix('Spine2')] + len[ix('Chest')];
  const hipsRun = inp.base[0].y;
  const shoulderRun = inp.base[ix('LeftArm')].y;

  // How far ahead of the shoulders the contact is (d), how much the body has given itself to the obstacle (lean: from the plant to the push-off, wide) and whether the
  // hands are on it (pinned: only while the contact is within the arms' reach, ahead or behind).
  const leanAt = (d: number) => smooth(3 * reach, reach, d) * (1 - smooth(-0.8 * reach, -1.6 * reach, d));
  const phiFor = (d: number) => {
    const free = 0.22; // rad: a runner leaning into the plant
    const pin = 0.62 + 0.55 * Math.max(0, 1 - (d / reach) ** 2); // flatter over the hands, up to about 67 degrees
    return free + (pin - free) * leanAt(d);
  };
  const pinnedAt = (d: number) => smooth(PIN_FROM + 0.1, PIN_FROM, d / reach) * (1 - smooth(PIN_UNTIL - 0.05, PIN_UNTIL - 0.4, d / reach));
  // the shoulders' x is about `trunk * sin(phi)` ahead of the hips (x = 0): settle the lean and the distance together
  let d = inp.contact.x - trunk * Math.sin(0.22), phi = phiFor(d);
  for (let k = 0; k < 4; k++) { d = inp.contact.x - trunk * Math.sin(phi); phi = phiFor(d); }
  const pinned = pinnedAt(d), lean = leanAt(d);

  // the height of the shoulders over the contact: the arms carry them while the hands hold (above the hands, within the arms' reach), and the body dives toward the
  // obstacle as it comes near, so the hands can arrive; the run's own shoulder height is the ceiling, so before the plant and after the push-off nothing changes
  const hmin = 0.3;
  const cap = (x: number) => {
    if (x >= reach) return hmin + 0.4 * smooth(0, 1, (x - reach) / (2 * reach));
    if (x >= -0.8 * reach) return Math.max(hmin, Math.sqrt(Math.max(reach * reach - x * x, 0)));
    return Math.sqrt(Math.max(reach * reach - 0.64 * reach * reach, 0)) + 1.2 * smooth(0, 1, (-0.8 * reach - x) / (0.8 * reach));
  };
  const shoulderTarget = Math.min(shoulderRun, inp.contact.y + cap(d));
  const hips = new Vector3(0, hipsRun, 0); // moved up or down below, once the shoulders are built, so that the shoulders are where the arms need them

  const out: Vector3[] = inp.base.map((q) => q.clone());
  out[0] = hips.clone();

  // the trunk: a straight lean, the head turned back up so it looks ahead
  const phis: Record<string, number> = { Spine1: phi, Spine2: phi, Chest: phi, Neck1: phi * 0.5, Neck2: phi * 0.25, Head: phi * 0.05 };
  for (const n of ['Spine1', 'Spine2', 'Chest', 'Neck1', 'Neck2', 'Head']) {
    const i = ix(n);
    out[i] = out[parents[i]].clone().add(up(phis[n]).multiplyScalar(len[i]));
  }
  // small parts (jaw, eyes) keep their offsets from the head, turned with it
  for (const n of ['Jaw', 'LeftEye', 'RightEye']) { const i = ix(n); out[i] = out[parents[i]].clone().add(rotZ(off(n), -phis.Head)); }
  // the shoulders and the top of the arms keep the base pose's offsets from the chest, turned with the trunk
  for (const side of ['Left', 'Right']) {
    const sh = ix(side + 'Shoulder'), arm = ix(side + 'Arm');
    out[sh] = out[parents[sh]].clone().add(rotZ(off(side + 'Shoulder'), -phi));
    out[arm] = out[parents[arm]].clone().add(rotZ(off(side + 'Arm'), -phi));
  }

  // the body's height: while the hands hold the obstacle the arms carry the shoulders (above the hands, within the arms' reach), so the whole upper body moves to put them there
  const shoulderNow = (out[ix('LeftArm')].y + out[ix('RightArm')].y) / 2;
  const dy = shoulderTarget - shoulderNow;
  const upperBody = ['Hips', 'Spine1', 'Spine2', 'Chest', 'Neck1', 'Neck2', 'Head', 'Jaw', 'LeftEye', 'RightEye', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'];
  for (const n of upperBody) out[ix(n)].y += dy;
  hips.y += dy;

  // the arms: two bones solved to a target: the contact while pinned, a reach toward it before, and let go after
  const hands: Record<string, Vector3> = {};
  for (const side of ['Left', 'Right']) {
    const s = out[ix(side + 'Arm')], z = side === 'Left' ? -1 : 1;
    const contact = new Vector3(inp.contact.x, inp.contact.y, s.z);
    const toward = contact.clone().sub(s);
    const free = toward.length() > reach ? s.clone().add(toward.setLength(reach)) : contact.clone(); // reaching: as far as the arm goes toward the contact
    const after = s.clone().add(new Vector3(0.1, -(upper + fore) * 0.9, z * 0.02)); // after the vault: hanging down, a little forward
    const letGo = smooth(PIN_UNTIL - 0.05, PIN_UNTIL - 0.4, d / reach); // 0 while holding, 1 once the body is well past
    const target = free.clone().lerp(contact, pinned).lerp(after, letGo);
    const dist = Math.min(Math.max(target.distanceTo(s), 0.05), upper + fore - 1e-4);
    const dir = target.clone().sub(s).normalize();
    const a = (upper * upper - fore * fore + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(upper * upper - a * a, 0));
    const pole = new Vector3(-0.35, -0.5, z * 0.8).normalize(); // elbows go out to the side and back
    const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const elbow = s.clone().add(dir.clone().multiplyScalar(a)).add(perp.multiplyScalar(h));
    const hand = s.clone().add(dir.clone().multiplyScalar(dist));
    const fa = ix(side + 'ForeArm'), ha = ix(side + 'Hand');
    out[fa] = elbow; out[ha] = hand;
    for (const t of ['HandThumbEnd', 'HandMiddleEnd']) { const i = ix(side + t); out[i] = hand.clone().add(rotZ(off(side + t), 0)); }
    hands[side.toLowerCase()] = hand;
  }

  // the legs: gathered together under the hips and swung up behind and to one side, knees bent (a speed vault); blended in after the hands are down and out before the landing
  const legW = lean * lean * (3 - 2 * lean); // the legs gather as the body gives itself to the obstacle and open out after
  if (legW > 0) {
    const a = up(phi).multiplyScalar(-1); // down the body, away from the shoulders
    for (const side of ['Left', 'Right']) {
      const z = side === 'Left' ? -1 : 1;
      const hip = ix(side + 'Leg'), knee = ix(side + 'Shin'), foot = ix(side + 'Foot'), toe = ix(side + 'ToeBase');
      const hipJ = hips.clone().add(off(side + 'Leg'));
      // legs together: the hip joints pulled in, the thighs swung forward of the body line, the shins folded back
      const thigh = rotZ(a, -0.55).normalize(), shin = rotZ(thigh, 1.25).normalize(); // thighs trailing behind and a little up, knees bent about 70 degrees, shins down and back
      const kneeP = hipJ.clone().add(thigh.multiplyScalar(len[knee])), footP = kneeP.clone().add(shin.multiplyScalar(len[foot])), toeP = footP.clone().add(rotZ(shin, Math.PI / 2).multiplyScalar(len[toe]));
      kneeP.z += z * 0.05; footP.z += z * 0.03; toeP.z += z * 0.03;
      out[hip] = out[hip].clone().lerp(hipJ, legW);
      out[knee] = inp.base[knee].clone().lerp(kneeP, legW);
      out[foot] = inp.base[foot].clone().lerp(footP, legW);
      out[toe] = inp.base[toe].clone().lerp(toeP, legW);
    }
  } else for (const side of ['Left', 'Right']) { // the base legs, hung from the moved hips
    for (const n of ['Leg', 'Shin', 'Foot', 'ToeBase']) { const i = ix(side + n); out[i] = inp.base[i].clone().add(hips.clone().sub(inp.base[0])); }
  }
  // the legs before and after the gathered part follow the hips, so they stay attached
  if (legW > 0 && legW < 1) for (const side of ['Left', 'Right']) {
    const hip = ix(side + 'Leg');
    out[hip] = out[hip].clone();
  }

  // the first and last part of the vault is the running pose: blend in and out so nothing jumps
  const w = smooth(0, 0.12, p) * (1 - smooth(0.9, 1, p));
  const joints = out.map((q, i) => inp.base[i].clone().lerp(q, w));
  const lh = joints[ix('LeftHand')], rh = joints[ix('RightHand')];
  return { joints, handsDown: pinned * (1 - smooth(PIN_UNTIL - 0.05, PIN_UNTIL - 0.4, d / reach)) * w, hands: { left: lh, right: rh } };
}
