// Which way does a made skin face, against the way the bones face? (CC-108 facing; the story is docs/character-facing-bug.md)
// The bones always face the Rookie's way. The maker's mesh has a front the maker never checked, so the skin can be turned 180 degrees.
// Several independent cues each vote; the votes are combined with a confidence, and the skin is only turned when the vote is confident.
// Pure: works on arrays, so the loader, the tests and the checking scripts share it.

import type { Vec3 } from './fit';

/** One cue's vote. `score` is the cue's own number (positive: the skin faces the way the bones face); `lean` is -1 .. 1 after its dead zone (0: it abstains). */
export interface FacingVote {
  name: string;
  /** false: the character has no such part (no feet, no hands), so the cue could not look */
  available: boolean;
  score: number;
  lean: number;
  /** how much this cue counts (shoes count most; the weak cues count a little) */
  weight: number;
}
export interface FacingReport {
  /** -1 .. 1: how strongly the voting cues lean (positive: the skin faces the way the bones face) */
  score: number;
  /** 0 .. 1: the weighted lean over everything that could look, so cues that abstain or disagree lower it */
  confidence: number;
  verdict: 'forward' | 'back' | 'unclear';
  votes: FacingVote[];
  /** the skin was turned 180 degrees about the vertical axis (and its left and right bone weights swapped) */
  turned: boolean;
  /** a per-character override decided the verdict (FACING_OVERRIDE) */
  overridden?: boolean;
  /** the way the bones face on the ground (x, z), from the foot bones */
  axis: [number, number];
}

/** A skin turns only when the combined lean is at least this strong ... */
export const FACING_MIN = 0.1;
/** ... and at least this much of everything that could look agrees. */
export const CONFIDENCE_MIN = 0.2;

/**
 * Per-character answer for a character the cues cannot judge (or judge wrongly): id -> which way the skin faces as made.
 * 'back' turns it, 'forward' leaves it. Keyed by the character's 16-hex id, as in the cast and the Characters picker.
 */
export const FACING_OVERRIDE: Record<string, 'forward' | 'back'> = {};

const SIDES = ['Left', 'Right'] as const;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pct = (sorted: number[], q: number): number => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);

export function hipCentre(names: string[], rest: Vec3[]): [number, number] {
  const hs = SIDES.map((s) => names.indexOf(s + 'Leg')).filter((i) => i >= 0);
  return hs.length ? [hs.reduce((a, i) => a + rest[i][0], 0) / hs.length, hs.reduce((a, i) => a + rest[i][2], 0) / hs.length] : [0, 0];
}

/** Each cue: a score from the skin along the bones' forward `t`, a dead zone (below it the cue abstains), a full-strength score, and a weight. */
const CUES = [
  { name: 'shoe reach', dead: 0.05, full: 0.25, weight: 1 }, // the toe sticks out in front of the shin further than the heel behind it
  { name: 'shoe middle', dead: 0.005, full: 0.03, weight: 0.7 }, // the middle of the shoe sits in front of the shin (the mean, so one long lace does not decide)
  { name: 'shoe top', dead: 0.07, full: 0.2, weight: 0.6 }, // the toe cap is lower than the heel collar
  { name: 'torso', dead: 0.07, full: 0.2, weight: 0.3 }, // belly and chest stick out more than the back
  { name: 'hands', dead: 0.1, full: 0.4, weight: 0.3 }, // the thumb side of the hands sticks out in front
] as const;

/**
 * `axisOverride` names the way to face (x, z) instead of the foot bones' forward: the Course probe passes the way the runner really moves on screen.
 * The cues, as scores. All of them are measured along the bones' forward, in the bind pose, from positions and bone names only.
 * Tried and left out (they did not separate the eight starter characters; see data/eval/cc-chars-facing/README.md): eye, jaw and thumb bones against the skin,
 * the skin weights of the toe bone, the head's front reach, the shin front. The maker's recorded yaw has no direction in it (a box has no front).
 */
export function measureFacing(P: Float32Array, names: string[], rest: Vec3[], axisOverride?: [number, number]): FacingReport {
  const ix = (name: string) => names.indexOf(name);
  let ax = 0, az = 0;
  for (const side of SIDES) { const a = ix(side + 'Foot'), b = ix(side + 'ToeBase'); if (a >= 0 && b >= 0) { ax += rest[b][0] - rest[a][0]; az += rest[b][2] - rest[a][2]; } }
  const l = Math.hypot(ax, az);
  const axis: [number, number] = axisOverride ?? (l > 1e-6 ? [ax / l, az / l] : [0, 1]);
  const [hx] = hipCentre(names, rest);
  const n = P.length / 3;
  const scores: (number | null)[] = CUES.map(() => null);
  let yMin = Infinity, yMax = -Infinity;
  for (let v = 0; v < n; v++) { yMin = Math.min(yMin, P[v * 3 + 1]); yMax = Math.max(yMax, P[v * 3 + 1]); }
  const H = yMax - yMin;
  if (n >= 8 && H > 1e-6) {
    const shoe: number[] = [], toes: [number, number][] = [], torso: number[] = [], hands: number[] = [];
    let col = 0, colN = 0;
    const armX = SIDES.map((s) => ix(s + 'Arm')).filter((i) => i >= 0).map((i) => Math.abs(rest[i][0] - hx));
    const wristX = SIDES.map((s) => ix(s + 'Hand')).filter((i) => i >= 0).map((i) => Math.abs(rest[i][0] - hx));
    const torsoHalf = armX.length ? 0.9 * Math.max(...armX) : 0.15;
    const handFrom = wristX.length ? 0.9 * Math.min(...wristX) : Infinity;
    const lineY = SIDES.map((s) => ix(s + 'Hand')).filter((i) => i >= 0).map((i) => rest[i][1]);
    const handY = lineY.length ? lineY.reduce((a, b) => a + b) / lineY.length : NaN;
    for (let v = 0; v < n; v++) {
      const x = P[v * 3], y = (P[v * 3 + 1] - yMin) / H, t = x * axis[0] + P[v * 3 + 2] * axis[1], dx = Math.abs(x - hx);
      if (dx > handFrom && Number.isFinite(handY) && Math.abs(P[v * 3 + 1] - handY) < 0.1 * H) hands.push(t);
      if (dx < 0.03) continue; // the gap between the legs says nothing
      if (y < 0.136) { shoe.push(t); toes.push([t, P[v * 3 + 1] - yMin]); } else if (y > 0.15 && y < 0.3) { col += t; colN++; }
      else if (y > 0.5 && y < 0.78 && dx < torsoHalf) torso.push(t);
    }
    if (shoe.length >= 8 && colN >= 8) {
      const c = col / colN, sorted = [...shoe].sort((a, b) => a - b);
      const front = pct(sorted, 0.98) - c, back = c - pct(sorted, 0.02);
      scores[0] = front + back > 1e-6 ? (front - back) / (front + back) : 0;
      scores[1] = (shoe.reduce((a, b) => a + b, 0) / shoe.length - c) / H;
      const top = (lo: number, hi: number): number | null => { const ys = toes.filter(([t]) => t >= lo && t < hi).map(([, h]) => h).sort((a, b) => a - b); return ys.length >= 5 ? pct(ys, 0.9) : null; };
      const f = top(c + 0.04, Infinity), b = top(-Infinity, c - 0.04);
      if (f !== null && b !== null && f + b > 1e-6) scores[2] = (b - f) / (b + f);
    }
    const asym = (ts: number[]): number | null => {
      if (ts.length < 12) return null;
      const s = [...ts].sort((a, b) => a - b), m = s.reduce((a, b) => a + b, 0) / s.length, f = pct(s, 0.98) - m, b = m - pct(s, 0.02);
      return f + b > 1e-6 ? (f - b) / (f + b) : null;
    };
    scores[3] = asym(torso);
    scores[4] = asym(hands);
  }
  const votes: FacingVote[] = CUES.map((c, i) => {
    const s = scores[i];
    if (s === null) return { name: c.name, available: false, score: 0, lean: 0, weight: c.weight };
    return { name: c.name, available: true, score: s, lean: Math.abs(s) < c.dead ? 0 : clamp(s / c.full, -1, 1), weight: c.weight };
  });
  const voting = votes.filter((v) => v.lean !== 0), avail = votes.filter((v) => v.available);
  const sum = voting.reduce((a, v) => a + v.weight * v.lean, 0);
  const score = voting.length ? sum / voting.reduce((a, v) => a + v.weight, 0) : 0;
  const confidence = avail.length ? Math.abs(sum) / avail.reduce((a, v) => a + v.weight, 0) : 0;
  const sure = confidence >= CONFIDENCE_MIN && Math.abs(score) >= FACING_MIN;
  return { score, confidence, verdict: sure ? (score > 0 ? 'forward' : 'back') : 'unclear', votes, turned: false, axis };
}
