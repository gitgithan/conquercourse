// The monkey-bars pose, built from the geometry of the move instead of played from a clip (CC-133, procedural fallback).
// The body hangs from the hands like a pendulum: the hands are pinned on the rungs, the shoulders sit one arm's length under them,
// and the trunk and legs hang from the shoulders. A reaching hand leaves its rung, travels to the next one in a short arc while the
// other hand keeps its grip, and the shoulders twist a little toward the reaching side. A kip drives the legs (kick, tuck).
// Axes are the clips': joints in metres, y up, travel along +z, left on +x (so the output can go through the same plausibility gate as a clip).
// Plain numbers, no three.js: the unit tests and the film script use it directly.
export type V3 = [number, number, number];

export interface BarsRig {
  names: string[];
  parents: number[];
  len: number[]; // bone length from each joint to its parent, metres (the rig's own, any scale)
}

export interface Reach {
  side: 'left' | 'right'; // the hand that is travelling to the next rung
  from: V3; // the rung it left
  to: V3; // the rung it is going to
  progress: number; // 0 to 1
}

export interface BarsPoseIn {
  grips: { left: V3; right: V3 }; // where each hand holds (world metres); the reaching hand's entry is ignored while it travels
  reach?: Reach;
  swing?: number; // rad the body swings from straight under the hands; positive toward +z
  kick?: number; // rad the legs swing ahead of the body (kip); positive toward +z
  tuck?: number; // 0 to 1: knees drawn up (kip)
  bodyZ?: number; // where the shoulders are along the travel; by default the middle of the two hands (the body then moves in steps with the reaches)
}

export interface BarsPoseOut {
  joints: V3[]; // in rig.names order
  hands: { left: V3; right: V3 };
  reachShort: number; // metres a hand wanted to be farther than the arm goes (0 when every target was within reach)
}

export const ARM_BENT = 0.97; // the hanging arm is this share of its full length: nearly straight, never locked
export const REACH_LIFT = 0.06; // m: a reaching hand rises this much over the straight line to the next rung
export const SHOULDER_TWIST = 0.3; // rad: shoulders turn toward the reaching side at the middle of a reach
export const HANG_KNEE = 0.15; // rad: knees hang a little bent

const smooth = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => mul(a, 1 / Math.max(norm(a), 1e-9));
const lerp = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));

/** Bone lengths of a rig from one frame of a clip (the same helper the tests use). */
export function rigFromFrame(names: string[], parents: number[], frame: number[][]): BarsRig {
  return { names, parents, len: names.map((_, i) => (parents[i] < 0 ? 0 : norm(sub(frame[i] as V3, frame[parents[i]] as V3)))) };
}

/** The hand's path while it reaches: the straight line to the next rung, eased, with a small lift in the middle. */
export function reachPoint(r: Reach): V3 {
  const e = smooth(r.progress);
  const p = lerp(r.from, r.to, e);
  return [p[0], p[1] + REACH_LIFT * Math.sin(Math.PI * Math.min(Math.max(r.progress, 0), 1)), p[2]];
}

/** Two-bone arm: the elbow for a shoulder, a target, the two bone lengths and a pole (the way the elbow points). */
function arm(shoulder: V3, target: V3, upper: number, fore: number, pole: V3): { elbow: V3; hand: V3; short: number } {
  const to = sub(target, shoulder);
  const want = norm(to), max = (upper + fore) * 0.9999;
  const dist = Math.min(Math.max(want, Math.abs(upper - fore) + 1e-4), max);
  const dir = unit(to);
  const a = (upper * upper - fore * fore + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(upper * upper - a * a, 0));
  const perp = unit(sub(pole, mul(dir, dot(pole, dir))));
  return { elbow: add(add(shoulder, mul(dir, a)), mul(perp, h)), hand: add(shoulder, mul(dir, dist)), short: Math.max(want - max, 0) };
}

export function barsPose(rig: BarsRig, inp: BarsPoseIn): BarsPoseOut {
  const { names, parents, len } = rig;
  const ix = (n: string) => names.indexOf(n);
  const L = (n: string) => len[ix(n)];
  const reachOf = (side: string) => L(`${side}ForeArm`) + L(`${side}Hand`); // the two sides of a real body differ a little
  const armLen = Math.min(reachOf('Left'), reachOf('Right')) * ARM_BENT;
  const swing = inp.swing ?? 0, kick = inp.kick ?? 0, tuck = Math.min(Math.max(inp.tuck ?? 0, 0), 1);

  // the hands: pinned on their rungs, except the one that is reaching
  const reaching = inp.reach;
  const hold: Record<'left' | 'right', V3> = { left: inp.grips.left, right: inp.grips.right };
  if (reaching) hold[reaching.side] = reachPoint(reaching);
  const anchor = mul(add(hold.left, hold.right), 0.5); // the body hangs from the middle of the two hands (the reaching one where it is now)
  if (inp.bodyZ !== undefined) anchor[2] = inp.bodyZ;

  // the body in its own frame, upright, shoulders' middle at the origin; the twist turns the shoulders (and what is above) about the vertical
  const twist = reaching ? (reaching.side === 'left' ? -1 : 1) * SHOULDER_TWIST * Math.sin(Math.PI * Math.min(Math.max(reaching.progress, 0), 1)) : 0;
  const turn = (p: V3): V3 => [p[0] * Math.cos(twist) + p[2] * Math.sin(twist), p[1], -p[0] * Math.sin(twist) + p[2] * Math.cos(twist)];
  const body: V3[] = names.map(() => [0, 0, 0] as V3);
  const trunk = L('Spine1') + L('Spine2') + L('Chest');
  const chestTop: V3 = [0, 0, 0];
  const lift = (from: V3, n: string): V3 => add(from, [0, len[ix(n)], 0]);
  body[ix('Chest')] = chestTop;
  body[ix('Spine2')] = [0, -L('Chest'), 0];
  body[ix('Spine1')] = [0, -L('Chest') - L('Spine2'), 0];
  body[0] = [0, -trunk, 0];
  body[ix('Neck1')] = lift(chestTop, 'Neck1');
  body[ix('Neck2')] = lift(body[ix('Neck1')], 'Neck2');
  body[ix('Head')] = lift(body[ix('Neck2')], 'Head');
  body[ix('Jaw')] = add(body[ix('Head')], [0, -0.07, 0.06]);
  body[ix('LeftEye')] = add(body[ix('Head')], [0.03, 0.04, 0.09]);
  body[ix('RightEye')] = add(body[ix('Head')], [-0.03, 0.04, 0.09]);
  for (const [side, s] of [['Left', 1], ['Right', -1]] as const) {
    body[ix(`${side}Shoulder`)] = [s * L(`${side}Shoulder`), 0, 0];
    body[ix(`${side}Arm`)] = [s * (L(`${side}Shoulder`) + L(`${side}Arm`)), 0, 0];
  }
  const turned = ['Chest', 'Neck1', 'Neck2', 'Head', 'Jaw', 'LeftEye', 'RightEye', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'];
  for (const n of turned) body[ix(n)] = turn(body[ix(n)]);
  // the legs hang from the hips: thigh and shin follow the leg angles (kick swings them ahead, tuck bends the knees)
  const thigh = HANG_KNEE * 0.5 + kick * 0.6, knee = HANG_KNEE + tuck * 1.3;
  const dirOf = (a: number): V3 => [0, -Math.cos(a), Math.sin(a)];
  for (const [side, s] of [['Left', 1], ['Right', -1]] as const) {
    const hip = add(body[0], [s * L(`${side}Leg`), 0, 0]);
    const k = add(hip, mul(dirOf(thigh + kick * 0.4), L(`${side}Shin`)));
    const f = add(k, mul(dirOf(thigh + kick * 0.4 - knee), L(`${side}Foot`)));
    const t = add(f, mul(dirOf(thigh + kick * 0.4 - knee + Math.PI / 2 - 0.35), L(`${side}ToeBase`)));
    body[ix(`${side}Leg`)] = hip; body[ix(`${side}Shin`)] = k; body[ix(`${side}Foot`)] = f; body[ix(`${side}ToeBase`)] = t;
  }

  // hang it from the hands: the shoulders' middle one arm under the anchor, swung about the anchor like a pendulum
  const c = Math.cos(swing), s = Math.sin(swing);
  // how far under the anchor the shoulders hang: an arm's length, less when a hand is ahead or behind (the arm is then slanted)
  const halfShoulders = L('LeftShoulder') + L('LeftArm');
  let drop = armLen;
  for (const [h, sgn] of [[hold.left, 1], [hold.right, -1]] as const) {
    const horizontal = Math.hypot(h[0] - (anchor[0] + sgn * halfShoulders), h[2] - anchor[2]);
    drop = Math.min(drop, Math.sqrt(Math.max(armLen * armLen - horizontal * horizontal, 0)));
  }
  drop = Math.max(drop, 0.15);
  const place = (p: V3): V3 => {
    const q: V3 = [p[0], p[1] - drop, p[2]]; // relative to the anchor
    return add(anchor, [q[0], q[1] * c + q[2] * s, -q[1] * s + q[2] * c]);
  };
  const joints: V3[] = body.map(place);

  // the arms: two bones from each shoulder to its hand
  const hands = { left: joints[0], right: joints[0] } as { left: V3; right: V3 };
  let short = 0;
  for (const [side, sgn] of [['Left', 1], ['Right', -1]] as const) {
    const sh = joints[ix(`${side}Arm`)];
    const pole: V3 = [sgn * 0.8, -0.5, -0.3]; // elbows point out to the side and down, a little back
    const r = arm(sh, hold[sgn === 1 ? 'left' : 'right'], L(`${side}ForeArm`), L(`${side}Hand`), pole);
    short = Math.max(short, r.short);
    joints[ix(`${side}ForeArm`)] = r.elbow;
    joints[ix(`${side}Hand`)] = r.hand;
    const along = unit(sub(r.hand, r.elbow));
    joints[ix(`${side}HandThumbEnd`)] = add(r.hand, mul(along, L(`${side}HandThumbEnd`)));
    joints[ix(`${side}HandMiddleEnd`)] = add(r.hand, mul(along, L(`${side}HandMiddleEnd`)));
    hands[sgn === 1 ? 'left' : 'right'] = r.hand;
  }
  void parents;
  return { joints, hands, reachShort: short };
}

/** One frame of travel along evenly spaced rungs: which hand holds which rung and which one is reaching, at time t (seconds).
 *  The hands alternate: each moves two rungs forward once per cycle while the other holds; the body hangs under the hands. */
export interface TravelOpts { rungGap: number; rungY: number; handX: number; cycle: number; move: number; z0?: number }
export function travelAt(t: number, o: TravelOpts): { grips: { left: V3; right: V3 }; reach?: Reach; swing: number; bodyZ: number } {
  const z0 = o.z0 ?? 0.3;
  const hand = (phase: number, x: number) => {
    // this hand's k-th hold starts at phase + k*cycle and lasts cycle - move; its rung is z0 + (2 k + phase/cycle*2) * gap
    const k = Math.floor((t - phase) / o.cycle);
    const into = t - phase - k * o.cycle;
    const rung = (kk: number): V3 => [x, o.rungY, z0 + (2 * kk + (phase / o.cycle) * 2) * o.rungGap];
    if (into < o.cycle - o.move) return { grip: rung(k) };
    return { grip: rung(k), reach: { from: rung(k), to: rung(k + 1), progress: (into - (o.cycle - o.move)) / o.move } };
  };
  const L = hand(0, o.handX), R = hand(o.cycle / 2, -o.handX);
  const reach = L.reach ? { side: 'left' as const, ...L.reach } : R.reach ? { side: 'right' as const, ...R.reach } : undefined;
  // a small forward lean of the swing while the body is carried forward: the faster the carry, the more it trails
  return { grips: { left: L.grip, right: R.grip }, reach, swing: 0.06 * Math.sin(Math.PI * 2 * t / o.cycle), bodyZ: (2 * o.rungGap / o.cycle) * t };
}
