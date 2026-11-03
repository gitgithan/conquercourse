// Forks (CC-224): a stretch of the course with two or three ways through it, from a fork to a join.
// The simulator is not changed: the ways are made of the same platforms, bars and walls. Two ways can share the same x range because one flies above the other
// (bars over a low floor), so a way is told apart by how low the runner went between the fork and the join, not by a rule in the physics.
// A course with no `branches` field is a course with one way, as before.
import type { CourseData } from '../course/course';
import type { Plan } from './ideal';

export interface BranchRoute {
  id: string;
  name: string; // "High way: the bars"
  band: [lo: number, hi: number]; // the lowest height (m) the runner reaches between the fork and the join says which way it is on: lo <= lowest < hi
  own?: { platforms?: number[]; holds?: number[]; poles?: number[] }; // indexes into terrain.platforms and holds that exist only for this way (the search closes the other ways by removing them); poles: indexes into climbPoles (CC-133, the fork's bulb lane)
  icons: string[]; // the strip shows these (ZONE_ICONS keys), in order along the way
  plan?: Plan; // the proved line for the whole course taking this way, from the start
  ticks?: number; // the time of that line (120 ticks a second)
  lines?: { name: string; ticks: number }[]; // the lines found on this way when it has more than one (bar to bar, or skip the second bar), for the report
  effort?: number; // the energy that line spends, in jumps' worth (src/sim/energy.ts)
  narrowestMs?: number; // the narrowest window of good presses on this way: a fact about how little room it leaves
}
export interface Branch {
  id: string;
  name: string;
  forkX: number; // where the ways part (the strip and the drum lane mark it)
  joinX: number; // where they meet again
  routes: BranchRoute[];
}

export const branchesOf = (c: CourseData): Branch[] => c.branches ?? [];

/** The way a lowest height belongs to, or null when no band holds it. */
export function routeAt(b: Branch, lowest: number): BranchRoute | null {
  return b.routes.find((r) => lowest >= r.band[0] && lowest < r.band[1]) ?? null;
}

/** The way taken through a branch, read from the places the runner was (a path, or a track from a replay): the lowest height reached between the fork and the join.
 *  Bars fly over a low floor, so the low way is the one that touched down low. Null when the run never got to the join (a fall is not a way). */
export function routeOfPath(b: Branch, pts: { x: number; y: number }[]): BranchRoute | null {
  let lowest = Infinity, entered = false, joined = false;
  for (const p of pts) {
    if (p.x >= b.forkX && p.x <= b.joinX) { entered = true; lowest = Math.min(lowest, p.y); }
    if (p.x > b.joinX) joined = true;
  }
  return entered && joined ? routeAt(b, lowest) : null;
}
export const routeOfTrack = (b: Branch, xs: ArrayLike<number>, ys: ArrayLike<number>): BranchRoute | null =>
  routeOfPath(b, Array.from({ length: xs.length }, (_, i) => ({ x: xs[i], y: ys[i] })));

/** The course with every other way closed: what the ideal-run search needs to prove one way on its own. */
export function routeCourse(course: CourseData, branchId: string, routeId: string): CourseData {
  const b = branchesOf(course).find((q) => q.id === branchId);
  if (!b) throw new Error(`no branch ${branchId}`);
  const dropP = new Set<number>(), dropH = new Set<number>(), dropC = new Set<number>();
  for (const r of b.routes) if (r.id !== routeId) { r.own?.platforms?.forEach((i) => dropP.add(i)); r.own?.holds?.forEach((i) => dropH.add(i)); r.own?.poles?.forEach((i) => dropC.add(i)); }
  const c: CourseData = JSON.parse(JSON.stringify(course));
  c.terrain.platforms = c.terrain.platforms.filter((_, i) => !dropP.has(i));
  const oldHolds = c.holds;
  if (c.holds) c.holds = c.holds.filter((_, i) => !dropH.has(i));
  if (c.climbPoles) { // a pole points at its first bar by index: keep the pointer right after bars are removed, and a pole whose bar is gone goes too
    const newIndex = new Map<number, number>();
    let k = 0;
    (oldHolds ?? []).forEach((_, i) => { if (!dropH.has(i)) newIndex.set(i, k++); });
    c.climbPoles = c.climbPoles.flatMap((p, i) => {
      if (dropC.has(i)) return [];
      if (p.toHold === undefined) return [p];
      const j = newIndex.get(p.toHold);
      return j === undefined ? [] : [{ ...p, toHold: j }];
    });
    if (!c.climbPoles.length) delete c.climbPoles;
  }
  delete c.plan; delete c.routes; delete c.windows; delete c.shortcuts; delete c.branches;
  return c;
}

/** The faster way's line, to store as the course's own plan so every old consumer (Shift+I, the drums, the report) keeps working. */
export function fastestRoute(b: Branch): BranchRoute | null {
  const timed = b.routes.filter((r) => r.plan && r.ticks !== undefined);
  return timed.length ? timed.reduce((a, c) => (c.ticks! < a.ticks! ? c : a)) : null;
}
