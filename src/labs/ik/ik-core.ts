import { Vector3 } from 'three';
import type { Clip } from '../../motion/clip';
import { ik2 } from '../../motion/compose';
import { settleNeck, NECK_LIMIT, SHOULDER_LIMIT } from '../../motion/neck';
import { legLength } from '../../motion/timeline';

// Lab 3: posing a character (inverse kinematics). The pure part: the Rookie's stand pose, the game's real two-bone reach (`ik2`) and neck rule
// (`settleNeck`), an iterative solver for comparison, and the facts the page shows. No page, no model, so the tests can check the numbers directly.
// The side plane is the page: x forward, y up (metres, feet on y = 0). The game only runs the two-bone solver; the iterative one is here to compare.

export type Solver = 'two-bone' | 'dls';
export interface Choices { solver: Solver; limits: boolean; neck: boolean; fold: number; damping: number }
export const DEFAULT_CHOICES: Choices = { solver: 'two-bone', limits: false, neck: true, fold: 0.6, damping: 0.1 };

// What the page's "limits on" means: a person's arm in the side plane. The game has no such limits (only the full-stretch stop).
export const ELBOW_MAX = (150 * Math.PI) / 180; // rad of bend; 0 is a straight arm, and an elbow does not bend backwards
export const SHOULDER_MIN = (-60 * Math.PI) / 180; // rad, arm swung back from hanging straight down
export const SHOULDER_MAX = Math.PI; // rad, arm swung forward and up to straight overhead
export const GAME_POLE = new Vector3(-0.6, -1, 0); // which way the game bends the elbow: down and back (src/render/actor.ts, reachLedge)
export const MATCH = 0.005; // m; a hand within 5 mm of the target counts as on it

export interface Body {
  names: string[];
  parents: number[];
  ix: (n: string) => number;
  stand: Vector3[];
  bent: Vector3[];
  scale: number;
}

const dirs = (side: number, n: string): Vector3 | null => {
  // game axes: x forward, y up, z across (left is -z); the same recipe as the game's ready stance
  if (/^(Spine1|Spine2|Chest|Neck1|Neck2|Head)$/.test(n)) return new Vector3(0, 1, 0);
  if (/ForeArm$/.test(n)) return new Vector3(0, -1, -side * 0.03);
  if (/Hand$/.test(n)) return new Vector3(0, -1, 0);
  if (/ThumbEnd$/.test(n)) return new Vector3(0.15, -1, -side * 0.2);
  if (/MiddleEnd$/.test(n)) return new Vector3(0, -1, 0);
  if (/Leg$/.test(n)) return new Vector3(0, -0.5, -side * 0.9);
  if (/Shin$/.test(n)) return new Vector3(0.1, -1, 0);
  if (/Foot$/.test(n)) return new Vector3(-0.06, -1, 0);
  if (/ToeBase$/.test(n)) return new Vector3(1, -0.3, 0);
  return null;
};
const BENT_DEG: Record<string, number> = { Spine1: 51, Spine2: 70, Chest: 80, Neck1: 95, Neck2: 108, Head: 127 }; // forward lean from upright: a crouch with the chin down
const lean = (v: Vector3, a: number): Vector3 => new Vector3(v.x * Math.cos(a) + v.y * Math.sin(a), -v.x * Math.sin(a) + v.y * Math.cos(a), v.z);

/** The Rookie's stand and a crouched pose, built bone by bone from the clips' bone lengths and the model's rest shoulders. */
export function makeBody(run: Clip, land: Clip, rest: Vector3[], rookieLeg: number): Body {
  const names = run.names, parents = run.parents;
  const ix = (n: string) => names.indexOf(n);
  const scale = rookieLeg / legLength(names, (i) => new Vector3(...run.frames[0][i]));
  const f = land.frames[13];
  const len = (i: number) => scale * Math.hypot(...f[i].map((v, k) => v - f[parents[i]][k]));
  const build = (bent: boolean): Vector3[] => {
    const out: Vector3[] = names.map(() => new Vector3());
    const turn: number[] = names.map(() => 0); // the forward lean of the chain each joint hangs on
    names.forEach((n, i) => {
      if (i === 0) return;
      const p = parents[i], side = n.startsWith('Left') ? 1 : -1;
      turn[i] = turn[p];
      let d: Vector3 | null = dirs(side, n);
      if (bent && n in BENT_DEG) { const a = (BENT_DEG[n] * Math.PI) / 180; d = new Vector3(Math.sin(a), Math.cos(a), 0); turn[i] = a; }
      if (/Shoulder$|Arm$/.test(n) && !/Fore/.test(n)) { d = rest[i].clone().sub(rest[p]); d.y = Math.min(d.y, 0); if (bent) d = lean(d, turn[i]); }
      if (d) out[i] = out[p].clone().add(d.normalize().multiplyScalar(len(i)));
      else out[i] = out[p].clone().add(new Vector3(f[i][2] - f[p][2], f[i][1] - f[p][1], -(f[i][0] - f[p][0])).multiplyScalar(scale)); // jaw, eyes
    });
    const low = Math.min(...out.map((q) => q.y));
    return out.map((q) => q.clone().add(new Vector3(0, -low, 0)));
  };
  const stand = build(false);
  const bent = build(true);
  return { names, parents, ix, stand, bent, scale };
}

/** The pose before any hand is sent to a target: stand blended toward crouch by `fold`, then (rule on) the game's neck rule. */
export function basePose(b: Body, fold: number, neckRule: boolean): Vector3[] {
  const t = Math.min(1, Math.max(0, fold));
  const joints = b.stand.map((p, i) => p.clone().lerp(b.bent[i], t)); // the game blends poses by lerping joint positions
  if (neckRule) settleNeck(joints, b.stand, b.ix);
  return joints;
}

export interface NeckFacts { headDeg: number; shoulderCm: number; limitDeg: number; shoulderLimitCm: number }
/** How far the neck chain bends from the trunk's line (largest, degrees) and how far the shoulder sits off the chest (largest, cm). */
export function neckFacts(b: Body, joints: Vector3[]): NeckFacts {
  const ix = b.ix, ang = (v: Vector3) => Math.atan2(v.y, v.x);
  const trunk = (j: Vector3[]) => ang(j[ix('Chest')].clone().sub(j[0]));
  const turned = trunk(joints) - trunk(b.stand);
  let worst = 0, cum = 0, parent = 'Chest';
  for (const n of ['Neck1', 'Neck2', 'Head']) {
    const want = ang(b.stand[ix(n)].clone().sub(b.stand[ix(parent)])) + turned;
    const a = ang(joints[ix(n)].clone().sub(joints[ix(parent)]));
    const off = Math.atan2(Math.sin(a - want), Math.cos(a - want));
    worst = Math.max(worst, Math.abs(off)); cum += off; parent = n;
  }
  worst = Math.max(worst, Math.abs(cum));
  let sh = 0;
  for (const side of ['Left', 'Right']) {
    const chest = joints[ix('Chest')];
    const rel = b.stand[ix(side + 'Arm')].clone().sub(b.stand[ix('Chest')]);
    const place = new Vector3(rel.x * Math.cos(turned) - rel.y * Math.sin(turned), rel.x * Math.sin(turned) + rel.y * Math.cos(turned), 0).add(chest);
    sh = Math.max(sh, Math.hypot(joints[ix(side + 'Arm')].x - place.x, joints[ix(side + 'Arm')].y - place.y));
  }
  return { headDeg: (worst * 180) / Math.PI, shoulderCm: sh * 100, limitDeg: (NECK_LIMIT * 180) / Math.PI, shoulderLimitCm: SHOULDER_LIMIT * 100 };
}

// ---- the arm: two links in the side plane ----
export interface ArmSolve { elbow: { x: number; y: number }; hand: { x: number; y: number }; residual: number; bend: number; shoulder: number; flipped: boolean; iterations: number; atLimit: boolean }
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Hand, elbow and the two joint angles from a shoulder angle `phi` (0 = hanging straight down, forward positive) and an elbow `bend` (0 = straight, forward positive). */
export function forward(sh: { x: number; y: number }, l1: number, l2: number, phi: number, bend: number): { elbow: { x: number; y: number }; hand: { x: number; y: number } } {
  const a1 = phi - Math.PI / 2, a2 = a1 + bend;
  const elbow = { x: sh.x + l1 * Math.cos(a1), y: sh.y + l1 * Math.sin(a1) };
  return { elbow, hand: { x: elbow.x + l2 * Math.cos(a2), y: elbow.y + l2 * Math.sin(a2) } };
}

function finish(sh: { x: number; y: number }, l1: number, l2: number, tx: number, ty: number, phi: number, bend: number, iterations: number, limits: boolean): ArmSolve {
  const fk = forward(sh, l1, l2, phi, bend);
  const atLimit = limits && (bend <= 1e-9 || bend >= ELBOW_MAX - 1e-9 || phi <= SHOULDER_MIN + 1e-9 || phi >= SHOULDER_MAX - 1e-9);
  return { ...fk, residual: Math.hypot(fk.hand.x - tx, fk.hand.y - ty), bend, shoulder: phi, flipped: bend < -1e-6, iterations, atLimit };
}

/** The game's solver: `ik2` as it is, then (limits on) the elbow and shoulder are held inside a person's ranges and the arm re-aimed. */
export function solveTwoBone(sh: { x: number; y: number }, l1: number, l2: number, tx: number, ty: number, limits: boolean): ArmSolve {
  const r = ik2(new Vector3(sh.x, sh.y, 0), new Vector3(tx, ty, 0), l1, l2, GAME_POLE);
  const a1 = Math.atan2(r.elbow.y - sh.y, r.elbow.x - sh.x), a2 = Math.atan2(r.hand.y - r.elbow.y, r.hand.x - r.elbow.x);
  let bend = wrap(a2 - a1), phi = wrap(a1 + Math.PI / 2);
  if (!limits) return finish(sh, l1, l2, tx, ty, phi, bend, 0, false);
  if (bend < 0 || bend > ELBOW_MAX) {
    bend = clamp(bend, 0, ELBOW_MAX); // re-aim: the shoulder points the hand's line at the target
    const dir = Math.atan2(ty - sh.y, tx - sh.x);
    phi = wrap(dir - Math.atan2(l2 * Math.sin(bend), l1 + l2 * Math.cos(bend)) + Math.PI / 2);
  }
  return finish(sh, l1, l2, tx, ty, clamp(phi, SHOULDER_MIN, SHOULDER_MAX), bend, 0, true);
}

/** Damped least squares: small steps along the Jacobian's answer, `lambda` stops it lunging near a straight arm. Starts from (phi0, bend0), like a pose the last frame left. */
export function solveDls(sh: { x: number; y: number }, l1: number, l2: number, tx: number, ty: number, limits: boolean, lambda: number, start = { phi: 0, bend: 0.3 }, maxIter = 80): ArmSolve {
  let phi = start.phi, bend = start.bend, it = 0;
  const lam2 = lambda * lambda;
  for (; it < maxIter; it++) {
    const { elbow, hand } = forward(sh, l1, l2, phi, bend);
    const ex = tx - hand.x, ey = ty - hand.y;
    if (Math.hypot(ex, ey) < 0.0005) break;
    // columns: how the hand moves per radian of shoulder, per radian of elbow (turn the arm from the joint to the hand by 90 degrees)
    const j11 = -(hand.y - sh.y), j21 = hand.x - sh.x, j12 = -(hand.y - elbow.y), j22 = hand.x - elbow.x;
    const a = j11 * j11 + j12 * j12 + lam2, b = j11 * j21 + j12 * j22, d = j21 * j21 + j22 * j22 + lam2;
    const det = a * d - b * b;
    const wx = (d * ex - b * ey) / det, wy = (-b * ex + a * ey) / det; // (J Jt + lambda^2 I)^-1 e
    let dphi = j11 * wx + j21 * wy, dbend = j12 * wx + j22 * wy; // Jt w
    const big = Math.max(Math.abs(dphi), Math.abs(dbend));
    if (big > 0.3) { dphi *= 0.3 / big; dbend *= 0.3 / big; }
    const np = phi + dphi, nb = bend + dbend;
    if (limits) { phi = clamp(np, SHOULDER_MIN, SHOULDER_MAX); bend = clamp(nb, 0, ELBOW_MAX); } else { phi = np; bend = nb; }
    if (Math.abs(dphi) + Math.abs(dbend) < 1e-7) break;
  }
  return finish(sh, l1, l2, tx, ty, phi, bend, it, limits);
}

export function solveArm(c: Choices, sh: { x: number; y: number }, l1: number, l2: number, tx: number, ty: number, start?: { phi: number; bend: number }): ArmSolve {
  return c.solver === 'two-bone' ? solveTwoBone(sh, l1, l2, tx, ty, c.limits) : solveDls(sh, l1, l2, tx, ty, c.limits, c.damping, start);
}

export interface Pose { joints: Vector3[]; arm: ArmSolve; shoulder: { x: number; y: number }; l1: number; l2: number; neck: NeckFacts }
/** The whole pose for a hand target (side plane, metres): the base pose, then the near arm solved to the target. The far arm follows the same target. */
export function poseFor(b: Body, c: Choices, tx: number, ty: number, start?: { phi: number; bend: number }): Pose {
  const joints = basePose(b, c.fold, c.neck);
  const ix = b.ix;
  const arm0 = joints[ix('LeftArm')], el0 = joints[ix('LeftForeArm')], hand0 = joints[ix('LeftHand')];
  const l1 = arm0.distanceTo(el0), l2 = el0.distanceTo(hand0);
  const sh = { x: arm0.x, y: arm0.y };
  const arm = solveArm(c, sh, l1, l2, tx, ty, start);
  for (const side of ['Left', 'Right']) {
    const s = joints[ix(side + 'Arm')], e = joints[ix(side + 'ForeArm')], h = joints[ix(side + 'Hand')];
    const fk = forward({ x: s.x, y: s.y }, e.distanceTo(s), h.distanceTo(e), arm.shoulder, arm.bend);
    const dh = new Vector3(fk.hand.x - h.x, fk.hand.y - h.y, 0);
    joints[ix(side + 'ForeArm')] = new Vector3(fk.elbow.x, fk.elbow.y, e.z);
    for (const n of ['Hand', 'HandThumbEnd', 'HandMiddleEnd']) joints[ix(side + n)] = joints[ix(side + n)].clone().add(dh);
  }
  return { joints, arm, shoulder: sh, l1, l2, neck: neckFacts(b, basePose(b, c.fold, c.neck)) };
}

// ---- facts about the reach ----
export const maxReach = (l1: number, l2: number): number => l1 + l2;
export const minReach = (l1: number, l2: number): number => Math.abs(l1 - l2);

/** Walk the target out from the shoulder along the line it is on, from a cold start each time: the first distance past the near edge where the hand is no longer on it (more than MATCH off). `from` is where it first gets on. */
export function breakingPoint(c: Choices, sh: { x: number; y: number }, l1: number, l2: number, tx: number, ty: number): { distance: number; from: number; x: number; y: number } | null {
  const len = Math.hypot(tx - sh.x, ty - sh.y) || 1e-9, ux = (tx - sh.x) / len, uy = (ty - sh.y) / len;
  const offAt = (r: number) => solveArm({ ...c }, sh, l1, l2, sh.x + ux * r, sh.y + uy * r).residual > MATCH;
  const top = (l1 + l2) * 1.5;
  let from = -1, prev = 0;
  for (let r = 0; r <= top; r += 0.01) {
    const off = offAt(r);
    if (from < 0 && !off) from = r;
    if (from >= 0 && off) {
      let lo = prev, hi = r; // bisection to a tenth of a millimetre
      for (let k = 0; k < 20 && hi - lo > 1e-4; k++) { const mid = (lo + hi) / 2; if (offAt(mid)) hi = mid; else lo = mid; }
      return { distance: lo, from, x: sh.x + ux * lo, y: sh.y + uy * lo };
    }
    prev = r;
  }
  return null;
}

/** Residual (m) over a grid of targets around the shoulder, cold start each: the picture of where the arm can and cannot go. */
export function residualMap(c: Choices, sh: { x: number; y: number }, l1: number, l2: number, half: number, step: number): { x: number; y: number; r: number; flipped: boolean }[] {
  const out: { x: number; y: number; r: number; flipped: boolean }[] = [];
  for (let gy = -half; gy <= half + 1e-9; gy += step) for (let gx = -half; gx <= half + 1e-9; gx += step) {
    const a = solveArm(c, sh, l1, l2, sh.x + gx, sh.y + gy);
    out.push({ x: sh.x + gx, y: sh.y + gy, r: a.residual, flipped: a.flipped });
  }
  return out;
}

export const deg = (r: number): number => (r * 180) / Math.PI;
