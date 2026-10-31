// Fit any rigged character to the game's one skeleton (CC-108, UGC fit). Pure: works on arrays, so the loader and the tests share it.
// The game never designs around a character. The bones (and so the physics, the grab points and the hit box) are the Rookie's.
// What differs is the skin, so the skin is stretched to the bones: each arm to the arm bones, the legs and torso to the hip and shoulder heights.
// Weights come from the character's own skinning, so only the vertices a limb owns are moved.
// First of all the skin is turned to face the way the bones face: a made mesh comes out with a front the maker never checked (see docs/ugc-fit.md, Facing).

export type Vec3 = [number, number, number];
export interface FitInput {
  positions: Float32Array; // x y z per vertex, in the bind pose (T-pose); changed in place
  joints: { length: number; [i: number]: number }; // 4 bone indices per vertex; changed in place when the skin is turned around (left and right bones swap)
  weights: ArrayLike<number>; // 4 weights per vertex
  names: string[]; // bone names, in skin order
  rest: Vec3[]; // where each bone sits in the bind pose, in the same space as the positions
  index?: ArrayLike<number>; // triangles, only used to measure how much the skin stretched
}

export interface LimbFit { meshLen: number; boneLen: number; wanted: number; used: number; clamped: boolean }
/** Which way the skin's shoes point, against the way the bones' feet point. */
export interface FacingReport {
  /** -1 .. 1: how much more of the shoe sticks out in front of the shin than behind it (positive: the toes point the way the bones face) */
  score: number;
  verdict: 'forward' | 'back' | 'unclear';
  /** the skin was turned 180 degrees about the vertical axis (and its left and right bone weights swapped) */
  turned: boolean;
  /** the way the bones face on the ground (x, z), from the foot bones */
  axis: [number, number];
}
export interface FitReport {
  facing: FacingReport;
  arms: { Left: LimbFit | null; Right: LimbFit | null };
  legs: LimbFit | null; // crotch height (skin) -> hip bone height
  torso: LimbFit | null; // crotch -> arm line (skin) -> shoulder line (bones)
  shoulder: { meshY: number; boneY: number; wanted: number; used: number; clamped: boolean } | null; // the arm line (m), and how far the arm skin moved up
  /** how far the mesh's fingertip is from the fingertip bone, as a share of the arm bones' length, before and after */
  handGap: { before: number; after: number };
  edge: { p99: number; max: number } | null; // edge length after / before
  quality: 'good' | 'stretched' | 'extreme';
  notes: string[];
}

// Clamps: a limb is lengthened or shortened by at most this much, whatever the skin asks for.
export const MIN_K = 0.7, MAX_K = 1.7;
export const LEG_MIN_K = 0.8, LEG_MAX_K = 1.4; // legs move the whole body, so they are held tighter
export const TORSO_MIN_K = 0.85, TORSO_MAX_K = 1.3;
export const SHOULDER_MAX = 0.25; // m: the most the arm skin moves up against the torso skin
export const GOOD_K: [number, number] = [0.8, 1.3]; // inside this a limb is only nudged: the picture looks as drawn

const SIDES = ['Left', 'Right'] as const;
const ARM = ['Arm', 'ForeArm', 'Hand', 'HandThumbEnd', 'HandMiddleEnd', 'Grip'];
const LEG = ['Leg', 'Shin', 'Foot', 'ToeBase', 'Sole'];

/** Below this the shoes do not say which way the character faces (a round blob, a jellyfish), so the skin is left as it is. */
export const FACING_MIN = 0.1;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function percentile(sorted: number[], q: number): number { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0; }

/**
 * Which way does the skin face? The bones always face the Rookie's way (the foot bones point from the ankle to the toe).
 * The skin's shoes tell the rest: the toe sticks out in front of the shin, the heel only a little behind it.
 * So take the skin just above the ground (the lowest 13.6 percent of the height) and the shin skin above it (15 to 30 percent),
 * and compare how far the shoe reaches in front of the shin with how far it reaches behind (2nd and 98th percentile along the bones' forward).
 * Gives (front - back) / (front + back): about +0.2 to +0.4 for a shoe that points forward, about -0.1 to -0.4 for one that points back.
 */
export function measureFacing(P: Float32Array, names: string[], rest: Vec3[]): Omit<FacingReport, 'turned'> {
  const ix = (name: string) => names.indexOf(name);
  let ax = 0, az = 0;
  for (const side of SIDES) { const a = ix(side + 'Foot'), b = ix(side + 'ToeBase'); if (a >= 0 && b >= 0) { ax += rest[b][0] - rest[a][0]; az += rest[b][2] - rest[a][2]; } }
  const l = Math.hypot(ax, az);
  const axis: [number, number] = l > 1e-6 ? [ax / l, az / l] : [0, 1];
  const [hx] = hipCentre(names, rest);
  const n = P.length / 3;
  let yMin = Infinity, yMax = -Infinity;
  for (let v = 0; v < n; v++) { yMin = Math.min(yMin, P[v * 3 + 1]); yMax = Math.max(yMax, P[v * 3 + 1]); }
  const H = yMax - yMin, shoe: number[] = [];
  let col = 0, colN = 0;
  for (let v = 0; v < n; v++) {
    if (Math.abs(P[v * 3] - hx) < 0.03) continue; // the gap between the legs says nothing
    const y = (P[v * 3 + 1] - yMin) / H, t = P[v * 3] * axis[0] + P[v * 3 + 2] * axis[1];
    if (y < 0.136) shoe.push(t); else if (y > 0.15 && y < 0.3) { col += t; colN++; }
  }
  if (shoe.length < 8 || colN < 8) return { score: 0, verdict: 'unclear', axis };
  shoe.sort((a, b) => a - b);
  const c = col / colN, front = shoe[Math.floor(0.98 * (shoe.length - 1))] - c, back = c - shoe[Math.floor(0.02 * (shoe.length - 1))];
  const score = front + back > 1e-6 ? (front - back) / (front + back) : 0;
  return { score, verdict: score >= FACING_MIN ? 'forward' : score <= -FACING_MIN ? 'back' : 'unclear', axis };
}

function hipCentre(names: string[], rest: Vec3[]): [number, number] {
  const hs = SIDES.map((s) => names.indexOf(s + 'Leg')).filter((i) => i >= 0);
  return hs.length ? [hs.reduce((a, i) => a + rest[i][0], 0) / hs.length, hs.reduce((a, i) => a + rest[i][2], 0) / hs.length] : [0, 0];
}

/**
 * Turn a skin that faces back around: 180 degrees about the vertical axis through the hips, and the left and right bone weights swap
 * (what was on the character's side that now lies on the other side must follow the other side's bones).
 * Changes the positions and the bone indices in place. Returns the measurement and whether it turned.
 */
export function faceForward(inp: Pick<FitInput, 'positions' | 'joints' | 'names' | 'rest'>): FacingReport {
  const m = measureFacing(inp.positions, inp.names, inp.rest);
  if (m.verdict !== 'back') return { ...m, turned: false };
  const { positions: P, joints: J, names } = inp;
  const [cx, cz] = hipCentre(names, inp.rest);
  const other = names.map((nm) => { const o = nm.startsWith('Left') ? 'Right' + nm.slice(4) : nm.startsWith('Right') ? 'Left' + nm.slice(5) : nm; const i = names.indexOf(o); return i >= 0 ? i : names.indexOf(nm); });
  for (let v = 0; v < P.length / 3; v++) { P[v * 3] = 2 * cx - P[v * 3]; P[v * 3 + 2] = 2 * cz - P[v * 3 + 2]; }
  for (let k = 0; k < J.length; k++) J[k] = other[J[k]];
  return { ...m, turned: true };
}

export function fitToSkeleton(inp: FitInput): FitReport {
  const { positions: P, joints: J, weights: W, names, rest } = inp;
  const n = P.length / 3;
  const ix = (name: string) => names.indexOf(name);
  const notes: string[] = [];
  const facing = faceForward(inp);
  if (facing.turned) notes.push('turned around: the made skin faced back');
  else if (facing.verdict === 'unclear') notes.push('could not tell which way the skin faces; left as it is');
  const before = inp.index ? Float32Array.from(P) : null;

  // share of each vertex's weight that sits on one group of bones
  const share = (group: Set<number>): Float32Array => {
    const out = new Float32Array(n);
    for (let v = 0; v < n; v++) for (let k = 0; k < 4; k++) if (group.has(J[v * 4 + k])) out[v] += W[v * 4 + k];
    return out;
  };
  const armSet = (s: string) => new Set(ARM.map((b) => ix(s + b)).filter((i) => i >= 0));
  const legSet = new Set(SIDES.flatMap((s) => LEG.map((b) => ix(s + b))).filter((i) => i >= 0));
  const armW = { Left: share(armSet('Left')), Right: share(armSet('Right')) };
  const legW = share(legSet);

  // ---- heights: a piecewise-linear map of y, so the crotch meets the hip bones and the arm line gets close to the shoulders;
  // the head takes the rest, so the total height stays what it was
  let yMin = Infinity, yMax = -Infinity;
  for (let v = 0; v < n; v++) { yMin = Math.min(yMin, P[v * 3 + 1]); yMax = Math.max(yMax, P[v * 3 + 1]); }
  const legYs: number[] = [], armYs: number[] = [];
  for (let v = 0; v < n; v++) {
    if (legW[v] > 0.5) legYs.push(P[v * 3 + 1]);
    if (armW.Left[v] > 0.5 || armW.Right[v] > 0.5) armYs.push(P[v * 3 + 1]);
  }
  legYs.sort((a, b) => a - b); armYs.sort((a, b) => a - b);
  const mk = (meshLen: number, boneLen: number, lo = MIN_K, hi = MAX_K): LimbFit => { const wanted = boneLen / meshLen, used = clamp(wanted, lo, hi); return { meshLen, boneLen, wanted, used, clamped: used !== wanted }; };
  const hipB = (rest[ix('LeftLeg')][1] + rest[ix('RightLeg')][1]) / 2;
  const lineB = SIDES.reduce((s, side) => s + (rest[ix(side + 'Arm')][1] + rest[ix(side + 'Hand')][1]) / 2, 0) / 2;
  let legs: LimbFit | null = null, torso: LimbFit | null = null;
  let lineAfter = armYs.length >= 8 ? percentile(armYs, 0.5) : NaN;
  if (legYs.length >= 8 && armYs.length >= 8) {
    const crotchM = percentile(legYs, 0.98), lineM = percentile(armYs, 0.5);
    if (crotchM > yMin + 0.2 && lineM > crotchM + 0.1 && yMax > lineM + 0.05) {
      legs = mk(crotchM - yMin, hipB - yMin, LEG_MIN_K, LEG_MAX_K);
      const crotchT = yMin + (crotchM - yMin) * legs.used;
      torso = mk(lineM - crotchM, lineB - (yMin + (hipB - yMin)), TORSO_MIN_K, TORSO_MAX_K);
      const lineT = crotchT + (lineM - crotchM) * torso.used;
      lineAfter = lineT;
      for (let v = 0; v < n; v++) {
        const y = P[v * 3 + 1];
        P[v * 3 + 1] = y <= crotchM ? yMin + (y - yMin) * legs.used : y <= lineM ? crotchT + (y - crotchM) * torso.used : lineT + (y - lineM) * ((yMax - lineT) / (yMax - lineM));
      }
    } else notes.push('could not find where the legs end and the arms start');
  } else notes.push('too few leg or arm vertices to fit the heights');

  // ---- shoulders: what the torso could not close is closed by moving the arm skin up (the torso skin stays)
  let shoulder: FitReport['shoulder'] = null;
  if (Number.isFinite(lineAfter)) {
    const wanted = lineB - lineAfter, used = clamp(wanted, -SHOULDER_MAX, SHOULDER_MAX);
    shoulder = { meshY: lineAfter, boneY: lineB, wanted, used, clamped: used !== wanted };
    for (let v = 0; v < n; v++) P[v * 3 + 1] += used * Math.min(1, Math.max(armW.Left[v], armW.Right[v]));
  }

  // ---- arms: stretch each arm along its own bones so the fingertip reaches the fingertip bone
  const arms: FitReport['arms'] = { Left: null, Right: null };
  let gapBefore = 0, gapAfter = 0, gapN = 0;
  for (const side of SIDES) {
    const sh = rest[ix(side + 'Arm')];
    const tips = ['HandThumbEnd', 'HandMiddleEnd'].map((b) => ix(side + b)).filter((i) => i >= 0);
    if (ix(side + 'Arm') < 0 || !tips.length) continue;
    const tip = tips.map((i) => rest[i]).reduce((a, b) => (len(sub(a, sh)) >= len(sub(b, sh)) ? a : b));
    const boneLen = len(sub(tip, sh));
    const u = sub(tip, sh).map((c) => c / boneLen) as Vec3;
    const w = armW[side];
    const ts: number[] = [];
    for (let v = 0; v < n; v++) if (w[v] > 0.5) ts.push((P[v * 3] - sh[0]) * u[0] + (P[v * 3 + 1] - sh[1]) * u[1] + (P[v * 3 + 2] - sh[2]) * u[2]);
    ts.sort((a, b) => a - b);
    if (ts.length < 8) { notes.push(`no ${side.toLowerCase()} arm found in the skin`); continue; }
    const meshLen = percentile(ts, 0.995);
    const wanted = boneLen / Math.max(meshLen, 1e-3), used = clamp(wanted, MIN_K, MAX_K);
    arms[side] = { meshLen, boneLen, wanted, used, clamped: used !== wanted };
    gapBefore += Math.abs(boneLen - meshLen) / boneLen; gapN++;
    gapAfter += Math.abs(boneLen - meshLen * used) / boneLen;
    for (let v = 0; v < n; v++) {
      if (w[v] <= 0) continue;
      const t = (P[v * 3] - sh[0]) * u[0] + (P[v * 3 + 1] - sh[1]) * u[1] + (P[v * 3 + 2] - sh[2]) * u[2];
      if (t <= 0) continue;
      const d = (used - 1) * t * Math.min(1, w[v]);
      P[v * 3] += d * u[0]; P[v * 3 + 1] += d * u[1]; P[v * 3 + 2] += d * u[2];
    }
  }

  // ---- how much the skin stretched
  let edge: FitReport['edge'] = null;
  if (before && inp.index) {
    const r: number[] = [];
    for (let f = 0; f < inp.index.length; f += 3) for (let e = 0; e < 3; e++) {
      const a = inp.index[f + e], b = inp.index[f + (e + 1) % 3];
      const l0 = Math.hypot(before[a * 3] - before[b * 3], before[a * 3 + 1] - before[b * 3 + 1], before[a * 3 + 2] - before[b * 3 + 2]);
      if (l0 < 1e-4) continue;
      const l1 = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
      r.push(l1 / l0);
    }
    r.sort((a, b) => a - b);
    edge = { p99: percentile(r, 0.99), max: r[r.length - 1] ?? 1 };
  }

  const limbs = [arms.Left, arms.Right, legs].filter((l): l is LimbFit => !!l);
  const missing = !arms.Left || !arms.Right || !legs || !shoulder;
  const extreme = missing || limbs.some((l) => l.clamped) || !!shoulder?.clamped;
  const stretched = limbs.some((l) => l.wanted < GOOD_K[0] || l.wanted > GOOD_K[1]);
  const gapMean = (g: number) => (gapN ? g / gapN : 1);
  return {
    facing, arms, legs, torso, shoulder,
    handGap: { before: gapMean(gapBefore), after: gapMean(gapAfter) },
    edge, quality: extreme ? 'extreme' : stretched ? 'stretched' : 'good', notes,
  };
}

/** A plain line for a person who made a character that cannot be fitted (used at make time; the game still runs it, clamped). */
export function fitWords(r: FitReport): string {
  if (r.quality === 'good') return 'Fits the runner.';
  if (r.quality === 'stretched') return 'Fits the runner, with its arms or legs stretched to match.';
  return 'Its arms or legs are very different from the runner\'s. They are stretched as far as looks right, so it may look a little off.';
}
