import type { CourseData } from '../course/course';
import { DT } from './units';
import { DEFAULT_PARAMS, step, type RunnerInput, type RunnerParams } from './runner';
import { groundAt } from './terrain';
import type { GameEvent, WorldState } from './world';

// The elastic band: a post stands in front of the runner and a stretchy band runs from it to the runner's belt.
// Running AWAY from the post stretches the band; the band stores the work the legs do against it, and when the runner turns round and runs
// toward the post, the band gives that energy back as extra push (an assisted sprint, as in speed training). It can only pull, and only while it is stretched:
// at its rest length it goes slack and unclips, so nothing drags the runner back. Everything is a metre, a second or a kilogram.
export interface BandParams {
  x: number; // m, the post
  rest: number; // m, the band's length when it hangs loose (it is clipped on at this distance from the post)
  k: number; // N/m, stiffness: how hard it pulls per metre stretched
  snap: number; // m, the longest stretch it takes before it snaps
  mass: number; // kg, the runner's mass
}

const COAST_LOSS = 0.2; // m/s of speed lost per tick-second while coasting above top speed (a tiny drag)

export const DEFAULT_BAND: BandParams = { x: 0, rest: 1, k: 45, snap: 20, mass: 70 };

export interface Band {
  maxStretch: number; // m, the longest stretch so far
  work: number; // J, the work the band has done pushing the runner forward (not counting the pull-back, which the legs paid for)
}

export const bandParams = (c: CourseData): BandParams => ({ ...DEFAULT_BAND, ...(c.band ?? {}) });

// Where the band goes slack: the runner is clipped on here, with the band hanging loose.
export const slackX = (p: BandParams): number => p.x - p.rest;
export const stretchAt = (p: BandParams, x: number): number => Math.max(0, slackX(p) - x);
// The pull on the runner's mass, in m/s²: the force divided by the mass.
export const bandAccel = (p: BandParams, x: number): number => (p.k * stretchAt(p, x)) / p.mass;
// The energy stored in a band stretched by s metres.
export const storedEnergy = (p: BandParams, s: number): number => 0.5 * p.k * s * s;
// How far a full-strength push away from the post can stretch it: where the band's pull equals what the legs can push with at a standstill.
export function reachableStretch(p: BandParams, rp: RunnerParams = DEFAULT_PARAMS): number {
  return Math.min(p.snap, (rp.acceleration * p.mass) / p.k);
}
// The speed a band-only release would give from a stretch s (no legs, no friction): all the stored energy becomes motion.
export const bandOnlySpeed = (p: BandParams, s: number): number => Math.sqrt((2 * storedEnergy(p, s)) / p.mass);

export const newBand = (): Band => ({ maxStretch: 0, work: 0 });

// A course with a band starts clipped on at the slack point (or, from a checkpoint behind it, wherever the checkpoint is).
export function enterBand(w: WorldState, course: CourseData): WorldState {
  const p = bandParams(course);
  const x = Math.min(w.runner.x, slackX(p));
  return { ...w, mode: 'band', band: newBand(), runner: { ...w.runner, x, y: groundAt(course.terrain, x) } };
}

// One tick clipped on: the legs drive the runner as always; on top of that the band pulls toward the post while it is stretched.
export function stepBandWorld(w: WorldState, input: RunnerInput, course: CourseData, rp: RunnerParams = DEFAULT_PARAMS): WorldState {
  const p = bandParams(course);
  const b = w.band!;
  const tick = w.runner.tick + 1;
  const before = w.runner;
  const a = bandAccel(p, before.x);
  // the legs push toward top speed but do not brake the band's extra speed (they only stop pushing): above top speed the runner coasts, losing a little to air and grip
  const overspeed = input.run && !input.left && before.vx > rp.topSpeed;
  const r0 = step(before, input, overspeed ? { ...rp, topSpeed: before.vx - COAST_LOSS } : rp, course.terrain);
  // the pull acts over this tick: exact for a constant push (semi-implicit; the stretch changes slowly against the step)
  const vx = r0.vx + a * DT;
  const x = r0.x + 0.5 * a * DT * DT;
  const r = { ...r0, x, vx, tick };
  const s = stretchAt(p, x);
  const next: Band = { maxStretch: Math.max(b.maxStretch, s), work: b.work + (vx > 0 ? p.mass * a * vx * DT : 0) };
  const events: GameEvent[] = [];
  if (s > p.snap) { // stretched past what it takes: it snaps and lets go (nobody is hurt)
    events.push({ tick, type: 'band-snap', detail: { stretch: s } });
    return { ...w, mode: 'run', band: null, events, runner: r };
  }
  if (s <= 0 && vx > 0.1) { // back at the slack point and moving toward the post: the clip lets go
    events.push({ tick, type: 'band-release', detail: { vx, stretch: next.maxStretch, work: next.work } });
    return { ...w, mode: 'run', band: null, events, runner: r };
  }
  return { ...w, band: next, events, runner: r };
}
