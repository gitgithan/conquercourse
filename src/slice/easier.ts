import type { CourseData } from '../course/course';
import { searchIdealRun, type Window, type Plan, type Route } from '../sim/ideal';
import { isHold, type P } from './holds-world';
import { searchInput } from './preset-plans';
import { diffProposal, type Proposal } from './preview';

// "Make it easier": the simulator already knows the course can be cleared, but a player keeps missing it. The narrowest window of presses
// (how many milliseconds a press may be off and still work) says how hard the hardest press is. This tries the smallest changes to the
// pieces nearest the fall and keeps the first one that widens that window by a quarter or more. Pure: the editor shows the result as a Proposal.
export type Lane = { angle: number; offset: number; level: number };
export interface EasierDeps {
  courseOf(pieces: P[], lane: Lane): CourseData; // the same lane the editor plays (bars, trebuchet, floor)
  search?: (course: CourseData) => Promise<EasierProof> | EasierProof;
  xOf(p: P): number; // where along the run a piece is
}
export interface EasierProof { cleared: boolean; plan?: Plan; windows?: Window[]; timingWindows?: Window[]; routes?: Route[] }
export interface EasierProgress { index: number; total: number; state: 'testing' | 'done'; words: string; course: CourseData; before: number; after?: number; cleared?: boolean }
export interface EasierOptions { concurrency?: number; targetLimiting?: boolean; signal?: { cancelled: boolean }; onCandidate?: (p: EasierProgress) => void }
export interface Easier { proof?: EasierProof; course?: CourseData; target?: string; proposal: Proposal | null; before: number; after: number; tried: number; note: string }

const WIDEN = 1.25; // the window must grow by a quarter to be worth a change
const SOME = 1.15; // when nothing does that, the best change must still grow it by 15% to be offered

// The narrowest window of working presses, in milliseconds. Windows of zero width are markers, not presses; and the jump off the start deck
// (the lane always puts the first ground a fixed 3 m past it) is not the player's layout, so it is left out when its place is given.
export function narrowest(windows: Window[], skipEdgeX?: number): number {
  const w = windows.filter((x) => {
    if (!Number.isFinite(x.widthMs) || x.widthMs <= 1) return false;
    const m = skipEdgeX !== undefined ? /\bat ([\d.]+) m\b/.exec(x.obstacle) : null;
    return !(m && Math.abs(Number(m[1]) - skipEdgeX!) < 0.3);
  }).map((x) => x.widthMs);
  return w.length ? Math.min(...w) : 0;
}

interface Cand { cost: number; apply: (ps: P[]) => P[]; ids: number[] }

export function candidatesFor(pieces: P[], lane: Lane, focusX: number, xOf: (p: P) => number): Cand[] {
  const near = pieces.filter((p) => !p.src?.startsWith('device:') && !p.src?.startsWith('obj:../characters/')).sort((a, b) => Math.abs(xOf(a) - focusX) - Math.abs(xOf(b) - focusX)).slice(0, 3);
  const along = Math.cos(lane.angle), across = Math.sin(lane.angle);
  const out: Cand[] = [];
  const edit = (id: number, f: (p: P) => P) => (ps: P[]) => ps.map((p) => (p.id === id ? f(p) : p));
  for (const p of near) {
    if (isHold(p)) {
      for (const dy of [-0.2, -0.4, -0.8, 0.2, 0.4]) out.push({ cost: Math.abs(dy), ids: [p.id], apply: edit(p.id, (q) => ({ ...q, y: Math.min(4.3, Math.max(0.35, q.y + dy)) })) });
      for (const du of [-0.25, -0.5, -1, 0.5]) out.push({ cost: Math.abs(du) * 0.6, ids: [p.id], apply: edit(p.id, (q) => ({ ...q, x: q.x + du * along, z: q.z + du * across })) });
    } else {
      for (const k of [0.95, 0.9, 0.8, 0.7]) out.push({ cost: (1 - k) * 2, ids: [p.id], apply: edit(p.id, (q) => ({ ...q, scale: q.scale * k })) });
      for (const du of [-0.25, 0.25, -0.5, 0.5, -1, 1]) out.push({ cost: Math.abs(du) * 0.5, ids: [p.id], apply: edit(p.id, (q) => ({ ...q, x: q.x + du * along, z: q.z + du * across })) });
    }
  }
  return out.sort((a, b) => a.cost - b.cost);
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0)); // let the page paint between two searches

// Resolve the weakest measured window to course coordinates, rather than defaulting to the start.
export function limitingTarget(course: CourseData, windows: Window[], skipEdgeX: number | undefined, fallback: number): { x: number; label: string } {
  const eligible = windows.filter((w) => narrowest([w], skipEdgeX) > 0);
  const width = narrowest(eligible), w = eligible.find((w) => w.widthMs === width);
  if (!w) return { x: fallback, label: 'selected area' };
  const at = /\bat (?:edge at |step at )?(-?[\d.]+) m/.exec(w.obstacle);
  const bar = /hang on bar (\d+)/.exec(w.obstacle);
  const x = at ? Number(at[1]) : bar ? course.holds?.[Number(bar[1]) - 1]?.x : w.obstacle.startsWith('bars:') ? course.bars?.[0]?.x : w.obstacle.includes('trebuchet') ? course.trebuchet?.x : w.obstacle.includes('band') ? course.band?.x : undefined;
  return { x: x ?? fallback, label: w.obstacle };
}

export async function makeItEasier(pieces: P[], lane: Lane, focusX: number, deps: EasierDeps, budgetMs = pieces.some(isHold) ? 150000 : 40000, onTry?: (tried: number, total: number) => void, options: EasierOptions = {}): Promise<Easier> {
  const t0 = performance.now();
  const search: NonNullable<EasierDeps['search']> = deps.search ?? searchIdealRun;
  const check = () => { if (options.signal?.cancelled) throw new Error('cancelled'); };
  const baseCourse = deps.courseOf(pieces, lane);
  const base = await search(baseCourse); check();
  if (!base.cleared) return { proposal: null, before: 0, after: 0, tried: 0, note: 'The simulator cannot clear this lane as it is, so use Fix it first.' };
  const startEdge = [...baseCourse.terrain.platforms].sort((a, b) => a.x0 - b.x0)[0]?.x1;
  const before = narrowest(base.timingWindows ?? base.windows ?? [], startEdge);
  if (before <= 0) return { proposal: null, before, after: 0, tried: 0, note: 'There is no press to widen here: the way through needs no precise timing.' };
  const target = limitingTarget(baseCourse, base.timingWindows ?? base.windows ?? [], startEdge, focusX);
  let tried = 0, best: { ps: P[]; after: number; proof: EasierProof; course: CourseData } | null = null;
  const cands = candidatesFor(pieces, lane, options.targetLimiting ? target.x : focusX, deps.xOf);
  const seen = new Map<string, Promise<EasierProof>>([[JSON.stringify(searchInput(baseCourse)), Promise.resolve(base)]]);
  const width = Math.max(1, Math.min(4, options.concurrency ?? 1));
  // Waves retain cost order even when a more expensive candidate finishes first.
  for (let from = 0; from < cands.length; from += width) {
    check(); if (performance.now() - t0 > budgetMs) break;
    await tick();
    const wave = await Promise.all(cands.slice(from, from + width).map(async (c, k) => {
      check();
      const next = c.apply(pieces), course = deps.courseOf(next, lane), index = from + k + 1;
      const words = diffProposal('easier', '', pieces, lane, next, lane).items.map((i) => i.words).join(' ') || 'Same course after rounding.';
      tried++; onTry?.(tried, cands.length);
      options.onCandidate?.({ index, total: cands.length, state: 'testing', words, course, before });
      const key = JSON.stringify(searchInput(course));
      let pending = seen.get(key);
      if (!pending) { pending = Promise.resolve(search(course)); seen.set(key, pending); }
      const proof = await pending; check();
      const after = proof.cleared ? narrowest(proof.timingWindows ?? proof.windows ?? [], startEdge) : 0;
      options.onCandidate?.({ index, total: cands.length, state: 'done', words, course, before, after, cleared: proof.cleared });
      return { ps: next, after, proof, course };
    }));
    for (const result of wave) {
      if (!result.proof.cleared) continue;
      if (result.after >= before * WIDEN) { best = result; break; }
      if (result.after >= before * SOME && (!best || result.after > best.after)) best = result;
    }
    if (best && best.after >= before * WIDEN) break;
  }
  check();
  if (!best) return { proposal: null, before, after: before, tried, target: target.label, note: `No small change widens the narrowest press (${Math.round(before)} ms). Move things by hand in the editor.` };
  const steps = [`The narrowest press window grows from ${Math.round(before)} ms to ${Math.round(best.after)} ms.`];
  return { proposal: diffProposal('easier', 'Make it easier', pieces, lane, best.ps, lane, steps, true), proof: best.proof, course: best.course, target: target.label, before, after: best.after, tried, note: '' };
}
