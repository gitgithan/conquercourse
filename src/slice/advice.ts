import { LANE_DROP } from '../sim/drop';
import { clearedCached, meter, workSeconds } from '../sim/ideal';
import type { CourseData } from '../course/course';
import type { Machine } from './launch-lane';
import { CLIMBABLE, describe, laneToCourse } from './slice';
import { realSize, laneProfile, type Piece } from './world';

// When the simulator cannot clear a lane, say what to shift. Pure: it tries small changes (slide a piece along the lane, make it
// smaller, turn the lane, step it sideways, change the water level), keeps the ones the simulator really clears (checked with the
// same ideal-run search the Play button uses), and returns the smallest changes first, as plain words plus the numbers to apply.
export interface LaneSetting { angle: number; offset: number; level: number }
export interface Change { dx?: number; dz?: number; dy?: number; scale?: number; yaw?: number; angle?: number; offset?: number; level?: number }
export interface Advice { text: string; piece?: number; change: Change; verified: boolean; machine?: Machine } // machine: the trebuchet's settings after this advice, when it changes them
export interface AdviceOptions { budget?: number; max?: number; wrap?: (c: CourseData) => CourseData } // budget in simulated ticks (workSeconds(n)), not milliseconds

interface Verdict { ok: boolean; why: string }

// The cheap check first (a profile and its tallest step, no search), then the full ideal-run proof (the truth).
function check(pieces: Piece[], lane: LaneSetting, proof: boolean, wrap?: (c: CourseData) => CourseData): Verdict {
  if (!pieces.length) return { ok: false, why: 'There is nothing in the lane.' };
  const profile = laneProfile(pieces, lane);
  if (profile.length < 8) return { ok: false, why: 'The lane is almost empty: nothing for the runner to stand on.' };
  const report = describe(profile);
  if (report.maxDrop > LANE_DROP) return { ok: false, why: `a drop of ${report.maxDrop.toFixed(1)} m; even a roll survives about ${LANE_DROP} m` };
  if (!wrap && report.maxRise > CLIMBABLE) return { ok: false, why: `a step is ${report.maxRise.toFixed(1)} m high; a climb reaches about ${CLIMBABLE.toFixed(1)} m (a jump 0.9 m, a vault 1.3 m)` };
  const base = laneToCourse({ cells: [...profile.cells], length: profile.length }), course = wrap ? wrap(base) : base;
  if (!proof) return { ok: true, why: '' };
  return clearedCached(course) ? { ok: true, why: '' } : { ok: false, why: 'the runner cannot find a way through' };
}

interface Candidate { cost: number; text: string; piece?: number; change: Change; apply: (ps: Piece[], l: LaneSetting) => { ps: Piece[]; lane: LaneSetting } }

const metres = (v: number) => `${Math.abs(v).toFixed(v % 1 === 0 ? 0 : 1)} m`;

export function adviseLane(pieces: Piece[], lane: LaneSetting, opts: AdviceOptions = {}): Advice[] {
  const budget = opts.budget ?? workSeconds(1.5), max = opts.max ?? 3;
  const first = check(pieces, lane, true, opts.wrap);
  if (first.ok) return []; // nothing to fix
  const t0 = meter.ticks; // the budget is for the tries; the first proof (a slow one on a big lane) does not eat it
  const ca = Math.cos(lane.angle), sa = Math.sin(lane.angle);
  const cands: Candidate[] = [];
  const bits = (p: Piece, patch: Partial<Piece>) => (ps: Piece[], l: LaneSetting) => ({ ps: ps.map((q) => (q.id === p.id ? { ...q, ...patch } : q)), lane: l });
  // only pieces that touch the lane matter
  const near = pieces.filter((p) => { const r = realSize(p); const side = Math.abs(-sa * p.x + ca * p.z - lane.offset); return side <= 1 + Math.hypot(r.w, r.d) / 2; });
  for (const p of near.length ? near : pieces) {
    for (const d of [0.25, 0.5, 1, 1.5, 2, 3]) for (const sign of [-1, 1]) {
      const dx = sign * d * ca, dz = sign * d * sa;
      cands.push({ cost: d, piece: p.id, change: { dx: round(dx), dz: round(dz) }, text: `Slide “${p.name}” ${metres(d)} ${sign < 0 ? 'back toward where the runner starts' : 'further along, away from the start'}.`, apply: bits(p, { x: p.x + dx, z: p.z + dz }) });
    }
    for (const k of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) cands.push({ cost: (1 - k) * 4, piece: p.id, change: { scale: round(p.scale * k) }, text: `Make “${p.name}” smaller: ${Math.round((1 - k) * 100)}% less (about ${metres(realSize(p).h * k)} high).`, apply: bits(p, { scale: p.scale * k }) });
    for (const k of [1.2, 1.5]) cands.push({ cost: (k - 1) * 4, piece: p.id, change: { scale: round(p.scale * k) }, text: `Make “${p.name}” bigger: ${Math.round((k - 1) * 100)}% more (about ${metres(realSize(p).h * k)} high).`, apply: bits(p, { scale: p.scale * k }) });
    if (p.y > 0.01) cands.push({ cost: p.y, piece: p.id, change: { dy: round(-p.y) }, text: `Put “${p.name}” down on the ground (it floats ${metres(p.y)} up).`, apply: bits(p, { y: 0 }) });
  }
  for (const d of [10, 20, 30, 45, 60, 90]) for (const sign of [-1, 1]) {
    const a = lane.angle + (sign * d * Math.PI) / 180;
    cands.push({ cost: d / 20, change: { angle: round(a) }, text: `Turn the lane ${d}° ${sign < 0 ? 'one way' : 'the other way'} about the rod.`, apply: (ps, l) => ({ ps, lane: { ...l, angle: a } }) });
  }
  for (const d of [0.5, 1, 2, 3]) for (const sign of [-1, 1]) {
    const o = lane.offset + sign * d;
    cands.push({ cost: d / 2, change: { offset: round(o) }, text: `Move the lane ${metres(d)} sideways.`, apply: (ps, l) => ({ ps, lane: { ...l, offset: o } }) });
  }
  for (const d of [0.25, 0.5, 1]) cands.push({ cost: d * 2, change: { level: round(lane.level + d) }, text: `Raise the water ${metres(d)} (the lane starts higher up).`, apply: (ps, l) => ({ ps, lane: { ...l, level: l.level + d } }) });
  if (lane.level > 0.01) cands.push({ cost: lane.level * 2, change: { level: 0 }, text: 'Lower the water back to the ground.', apply: (ps, l) => ({ ps, lane: { ...l, level: 0 } }) });

  cands.sort((a, b) => a.cost - b.cost);
  const out: Advice[] = [];
  for (const c of cands) {
    if (meter.ticks - t0 > budget || out.length >= max) break;
    const next = c.apply(pieces, lane);
    if (!check(next.ps, next.lane, false).ok) continue; // cheap checks first
    if (!check(next.ps, next.lane, true, opts.wrap).ok) continue;
    // not three versions of the same kind of change in a row: skip a candidate that changes the same thing as one already kept, by the same piece
    if (out.some((o) => o.piece === c.piece && Object.keys(o.change).join() === Object.keys(c.change).join())) continue;
    out.push({ text: c.text, piece: c.piece, change: c.change, verified: true });
  }
  return out;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
