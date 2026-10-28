import type { Advice } from './advice';
import type { P } from './holds-world';
import { wrapFor, type Machine } from './launch-lane';
import { roleCourse } from './roles';
import { searchIdealRun } from '../sim/ideal';
import { releaseWindow } from '../sim/launch-window';
import { DEFAULT_TREBUCHET, deg, swingPath } from '../sim/trebuchet';
import type { CourseData } from '../course/course';

// Fix it and advice for a lane that starts in a trebuchet: change the machine before the pieces. The machine has three knobs, the counterweight (kg),
// the arm (its ratio, long end to short end) and a pin (the arm angle at which it lets the rider go by itself). Every suggestion is proved by the
// ideal-run search with the machine on, the smallest change first, like the rest of Fix it.
type Lane = { angle: number; offset: number; level: number };
export interface MachineFix { ok: boolean; machine: Machine; steps: string[] }
export const MIN_KG = 300, MAX_KG = 4000, NARROW_MS = 250; // a release window under a quarter of a second is hard for a first-time player

const roundTo = (v: number, step: number) => Math.round(v / step) * step;
export const armRatio = (m: Machine): number => DEFAULT_TREBUCHET.long / (m.short ?? DEFAULT_TREBUCHET.short);

export interface Candidate { cost: number; text: string; machine: Machine }

// Smaller changes first (a tenth more or less before double); duplicates dropped.
export function machineCandidates(m: Machine): Candidate[] {
  const out: Candidate[] = [];
  // a tenth more or less first, then bigger steps, then a ladder of round weights so a far-off weight (300 kg when 1200 is needed) still finds its way
  const weights = [...[0.9, 1.1, 0.8, 1.25, 0.7, 1.5, 0.6, 1.8, 0.5, 2.2, 2.7, 3.3].map((k) => m.counterweight * k), 400, 600, 800, 1000, 1200, 1600, 2000, 2400, 3000, 3600, 4000];
  for (const w of weights) {
    const kg = Math.min(MAX_KG, Math.max(MIN_KG, roundTo(w, 50)));
    if (kg === m.counterweight) continue;
    out.push({ cost: Math.abs(Math.log(kg / m.counterweight)), text: `Use a ${kg} kg counterweight (now ${m.counterweight} kg).`, machine: { ...m, counterweight: kg } });
  }
  const r0 = armRatio(m);
  for (const k of [0.85, 1.15, 0.7, 1.3, 0.55, 1.5]) {
    const short = Math.min(2.6, Math.max(0.8, roundTo(DEFAULT_TREBUCHET.long / (r0 * k), 0.05)));
    if (Math.abs(short - (m.short ?? DEFAULT_TREBUCHET.short)) < 1e-9) continue;
    out.push({ cost: Math.abs(Math.log(k)) + 0.05, text: `Change the arm to ${(DEFAULT_TREBUCHET.long / short).toFixed(1)} to 1: the counterweight end ${short.toFixed(2)} m from the pivot (now ${r0.toFixed(1)} to 1).`, machine: { ...m, short } });
  }
  const seen = new Set<string>();
  return out.sort((a, b) => a.cost - b.cost).filter((c) => { const key = `${c.machine.counterweight}/${c.machine.short ?? ''}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

export function laneCourseWith(pieces: P[], lane: Lane, m: Machine, pivotX = 0): CourseData | null {
  const { course, length } = roleCourse(pieces, lane, 'machine'); // the lane with the roles of the pieces (wall, rope, trampoline) and the bars
  return length >= 8 ? wrapFor(m, pivotX)!(course) : null; // under 8 m of ground is not a lane
}

// Something that builds the course for a machine setting (the editor's lane with the machine on), or null when there is no lane.
export type CourseFor = (m: Machine) => CourseData | null;
export const courseForPieces = (pieces: P[], lane: Lane, pivotX = 0): CourseFor => (m) => laneCourseWith(pieces, lane, m, pivotX);
const clearsFor = (courseFor: CourseFor, m: Machine): boolean => { const c = courseFor(m); return !!c && searchIdealRun(c).cleared; };

// Fix it for the machine: the first counterweight or arm that makes the lane clearable.
export function fixMachineFor(courseFor: CourseFor, m: Machine, budgetMs = 40000): MachineFix {
  const t0 = performance.now();
  if (clearsFor(courseFor, m)) return { ok: true, machine: m, steps: [] };
  for (const c of machineCandidates(m)) {
    if (performance.now() - t0 > budgetMs) break;
    if (clearsFor(courseFor, c.machine)) return { ok: true, machine: c.machine, steps: [c.text] };
  }
  return { ok: false, machine: m, steps: ['No counterweight or arm gets the rider onto this lane: move the pieces after the machine.'] };
}
export const fixMachine = (pieces: P[], lane: Lane, m: Machine, budgetMs = 40000, pivotX = 0): MachineFix => fixMachineFor(courseForPieces(pieces, lane, pivotX), m, budgetMs);

// The arm angle (degrees) the machine has the given number of ticks after the pin is pulled.
export function armAngleAt(m: Machine, deck: number, ticks: number): number {
  const path = swingPath({ ...DEFAULT_TREBUCHET, ...m, x: 0 }, deck);
  return deg(path[Math.min(ticks, path.length - 1)].s.alpha);
}

// Advice for the machine: up to `max` proved changes (counterweight, arm); and, when the lane clears but the release window is narrow, a pin
// that lets the rider go by itself at the best arm angle.
export function adviseMachineFor(courseFor: CourseFor, m: Machine, opts: { budgetMs?: number; max?: number } = {}): Advice[] {
  const t0 = performance.now(), budget = opts.budgetMs ?? 30000, max = opts.max ?? 2;
  const out: Advice[] = [];
  const here = courseFor(m);
  if (!here) return out;
  const found = searchIdealRun(here);
  if (!found.cleared) {
    for (const c of machineCandidates(m)) {
      if (performance.now() - t0 > budget || out.length >= max) break;
      if (clearsFor(courseFor, c.machine)) out.push({ text: c.text, change: {}, verified: true, machine: c.machine });
    }
    return out;
  }
  if (m.pin === undefined && found.plan.launchRelease !== undefined) {
    const w = releaseWindow(here, found);
    if (w && w.widthMs < NARROW_MS) {
      const deck = here.terrain.platforms[0]?.top ?? 0;
      const pin = Math.round(armAngleAt(m, deck, found.plan.launchRelease));
      const withPin = { ...m, pin };
      if (clearsFor(courseFor, withPin)) out.push({ text: `The release window is only ${(w.widthMs / 1000).toFixed(2)} s. Add a pin at ${pin}° so the machine lets the rider go by itself.`, change: {}, verified: true, machine: withPin });
    }
  }
  return out;
}
export const adviseMachine = (pieces: P[], lane: Lane, m: Machine, opts: { budgetMs?: number; max?: number } = {}, pivotX = 0): Advice[] => adviseMachineFor(courseForPieces(pieces, lane, pivotX), m, opts);
