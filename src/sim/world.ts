import type { CourseData } from '../course/course';
import { DT } from './units';
import { DEFAULT_PARAMS, NO_INPUT, startState, step, type RunnerInput, type RunnerParams, type RunnerState } from './runner';
import { groundAt, standingOn } from './terrain';
import { DEFAULT_WALL, runWall, type WallParams, type WallResult } from './wall';
import { DEFAULT_ROPE, ropePoint, release, swingStep, tryCatch, type RopeParams, type Swing } from './rope';
import { DEFAULT_TRAMPOLINE, bounce, type Bounce } from './trampoline';

// One world for the Course: the runner plus whichever obstacle has hold of the runner right now.
// The simulator is the truth: everything the screen shows comes from this state, one tick at a time.
export type Mode = 'run' | 'wall' | 'swing' | 'bounce';
export type Outcome = 'running' | 'cleared' | 'splash';

export interface GameEvent {
  tick: number;
  type: 'jump' | 'land' | 'stumble' | 'splash' | 'wall-grab' | 'wall-slide' | 'rope-catch' | 'rope-release' | 'bounce' | 'cleared';
  detail?: Record<string, number | boolean>;
}

export interface WorldState {
  runner: RunnerState;
  mode: Mode;
  outcome: Outcome;
  wall: { result: WallResult; path: { x: number; y: number }[]; index: number; x0: number } | null;
  swing: Swing | null;
  bed: { base: Bounce; vIn: number; start: number; press: number | null; vx: number; top: number } | null;
  noCatchUntil: number;
  events: GameEvent[];
}

export function newWorld(course: CourseData): WorldState {
  const r = startState(course.startX);
  r.y = groundAt(course.terrain, course.startX);
  return { runner: r, mode: 'run', outcome: 'running', wall: null, swing: null, bed: null, noCatchUntil: 0, events: [] };
}

const wallParams = (c: CourseData): WallParams => ({ ...DEFAULT_WALL, ...(c.wall ?? {}) });
const ropeParams = (c: CourseData): RopeParams => ({ ...DEFAULT_ROPE, ...(c.rope ?? {}) });

export function stepWorld(w: WorldState, input: RunnerInput, course: CourseData, p: RunnerParams = DEFAULT_PARAMS): WorldState {
  if (w.outcome !== 'running') return { ...w, runner: { ...w.runner, tick: w.runner.tick + 1 } };
  const input2: RunnerInput = input.jump && w.runner.grounded && w.mode === 'run' ? { ...input, jumpSpeed: course.jumpSpeed } : input;
  const events: GameEvent[] = [];
  const tick = w.runner.tick + 1;
  const ev = (type: GameEvent['type'], detail?: GameEvent['detail']) => events.push({ tick, type, detail });
  let n: WorldState = { ...w };

  if (w.mode === 'wall') return stepWall(w, course);
  if (w.mode === 'swing') return stepSwing(w, input, course);
  if (w.mode === 'bounce') return stepBounce(w, input);

  const before = w.runner;
  const r = step(before, input2, p, course.terrain);
  n.runner = r;
  if (before.grounded && !r.grounded && input2.jump) ev('jump', { vy: r.vy });
  if (!before.grounded && r.grounded && r.landing) {
    ev('land', { impact: r.landing.impactSpeed, peakDecel: r.landing.peakDecel, squat: r.landing.squatted });
    if (r.landing.stumbled) ev('stumble', { peakDecel: r.landing.peakDecel });
    const plat = standingOn(course.terrain, r.x);
    if (plat?.bouncy) {
      const base = bounce(r.landing.impactSpeed, DEFAULT_TRAMPOLINE);
      n.mode = 'bounce';
      n.bed = { base, vIn: r.landing.impactSpeed, start: r.tick, press: null, vx: r.vx, top: r.y };
      ev('bounce', { vIn: r.landing.impactSpeed });
    }
  }
  if (r.splashed) { n.outcome = 'splash'; ev('splash', { x: r.x }); }

  // the wall: running onto the curve with the feet on the ground
  if (course.wall && n.mode === 'run' && r.grounded && r.vx > 0.5 && r.x >= course.wall.x0 && r.y === groundAt(course.terrain, course.wall.x0)) {
    const wp = wallParams(course);
    const result = runWall(r.vx, wp);
    n.mode = 'wall';
    n.wall = { result, path: wallPath(result, course.wall.x0, wp.height), index: 0, x0: course.wall.x0 };
  }

  // the rope: airborne hands meet it
  if (course.rope && n.mode === 'run' && !r.grounded && r.tick >= w.noCatchUntil) {
    const sw = tryCatch(ropeParams(course), r.x, r.y, r.vx, r.vy, 0);
    if (sw) {
      n.mode = 'swing';
      n.swing = sw;
      ev('rope-catch', { grip: sw.grip, omega: sw.omega });
    }
  }

  // finish: standing on the finish platform past the line
  if (n.outcome === 'running' && r.grounded && r.x >= course.finishX && n.mode === 'run') { n.outcome = 'cleared'; ev('cleared'); }
  n.events = events;
  return n;
}

// After the hands reach the top the runner pulls up and over: a smooth hand-over from the grab point to the deck,
// so nothing ever jumps (no teleport). Positions are feet positions.
export const MANTLE_RUN = 0.4;
const MANTLE_TICKS = 72;
export function wallPath(result: WallResult, x0: number, height: number): { x: number; y: number }[] {
  if (!result.grabbed) return result.path;
  const up = result.path.slice(0, result.grabTick! + 1);
  const from = up[up.length - 1];
  const to = { x: height + MANTLE_RUN, y: height };
  const out = [...up];
  for (let i = 1; i <= MANTLE_TICKS; i++) {
    const t = i / MANTLE_TICKS;
    const e = t * t * (3 - 2 * t); // smoothstep: slow start and end
    out.push({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
  }
  void x0;
  return out;
}

function stepWall(w: WorldState, course: CourseData): WorldState {
  const wl = w.wall!;
  const path = wl.path;
  const i = wl.index;
  const tick = w.runner.tick + 1;
  const events: GameEvent[] = [];
  if (i >= path.length - 1) {
    const wp = wallParams(course);
    if (wl.result.grabbed) {
      events.push({ tick, type: 'wall-grab', detail: { margin: wl.result.margin } });
      const x = wl.x0 + wp.height + MANTLE_RUN;
      return { ...w, mode: 'run', wall: null, events, runner: { ...w.runner, tick, x, y: wp.height, vx: 0, vy: 0, grounded: true } };
    }
    events.push({ tick, type: 'wall-slide', detail: { margin: wl.result.margin, exit: wl.result.exitSpeed } });
    return { ...w, mode: 'run', wall: null, events, runner: { ...w.runner, tick, x: wl.x0 - 0.5, y: groundAt(course.terrain, wl.x0 - 1), vx: 0, vy: 0, grounded: true } };
  }
  const q = path[i];
  return { ...w, wall: { ...wl, index: i + 1 }, events, runner: { ...w.runner, tick, x: wl.x0 + q.x, y: q.y, vx: 0, vy: 0, grounded: true } };
}

function stepSwing(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  const rp = ropeParams(course);
  const tick = w.runner.tick + 1;
  const events: GameEvent[] = [];
  if (input.jump) {
    const rel = release(rp, w.swing!);
    events.push({ tick, type: 'rope-release', detail: { vx: rel.vx, vy: rel.vy } });
    return { ...w, mode: 'run', swing: null, noCatchUntil: tick + 60, events, runner: { ...w.runner, tick, x: rel.x, y: rel.y, vx: rel.vx, vy: rel.vy, grounded: false } };
  }
  const sw = swingStep(w.swing!);
  const hand = ropePoint(rp, sw.grip, sw.theta);
  const speed = sw.omega * sw.grip;
  return { ...w, swing: sw, events, runner: { ...w.runner, tick, x: hand.x, y: hand.y - rp.handHeight, vx: speed * Math.cos(sw.theta), vy: speed * Math.sin(sw.theta), grounded: false } };
}

function stepBounce(w: WorldState, input: RunnerInput): WorldState {
  const bed = w.bed!;
  const tick = w.runner.tick + 1;
  const k = tick - bed.start;
  const press = input.jump && bed.press === null ? k : bed.press;
  const x = w.runner.x + bed.vx * DT;
  if (k >= bed.base.ticksOnBed) {
    const out = bounce(bed.vIn, DEFAULT_TRAMPOLINE, press);
    const events: GameEvent[] = [{ tick, type: 'bounce', detail: { vyOut: out.vyOut, pumped: out.pumped } }];
    return { ...w, mode: 'run', bed: null, events, runner: { ...w.runner, tick, x, y: bed.top, vx: bed.vx, vy: out.vyOut, grounded: false } };
  }
  return { ...w, bed: { ...bed, press }, events: [], runner: { ...w.runner, tick, x, y: bed.top + bed.base.path[k], vy: 0 } };
}

export { NO_INPUT, DT };
