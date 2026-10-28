import type { CourseData } from '../course/course';
import { DT } from './units';
import { DEFAULT_PARAMS, NO_INPUT, startState, step, type RunnerInput, type RunnerParams, type RunnerState } from './runner';
import { groundAt, standingOn } from './terrain';
import { DEFAULT_WALL, runWall, type WallParams, type WallResult } from './wall';
import { DEFAULT_ROPE, ropePoint, release, swingStep, tryCatch, type RopeParams, type Swing } from './rope';
import { DEFAULT_TRAMPOLINE, bounce, type Bounce } from './trampoline';
import { JUMP_COST, VAULT_COST } from './energy';
import { VAULT_BUFFER, VAULT_KEEP, findVault, vaultAt, type Vault } from './vault';
import { comDistance, DEFAULT_HANG, feetOf, gripSlips, hangStep, releaseHang, tryGrab, type Hang } from './holds';

// One world for the Course: the runner plus whichever obstacle has hold of the runner right now.
// The simulator is the truth: everything the screen shows comes from this state, one tick at a time.
export const ROLL_BUFFER = 30; // ticks (a quarter of a second): a C press this long before touchdown still rolls
export type Mode = 'run' | 'wall' | 'swing' | 'bounce' | 'hang' | 'vault';
export type Outcome = 'running' | 'cleared' | 'splash' | 'hurt'; // hurt: a landing harder than the body can take

export interface GameEvent {
  tick: number;
  type: 'jump' | 'land' | 'stumble' | 'hard-landing' | 'splash' | 'wall-grab' | 'wall-slide' | 'rope-catch' | 'rope-release' | 'hang-catch' | 'hang-release' | 'vault' | 'bounce' | 'cleared';
  detail?: Record<string, number | boolean>;
}

export interface WorldState {
  runner: RunnerState;
  mode: Mode;
  outcome: Outcome;
  wall: { result: WallResult; path: { x: number; y: number }[]; index: number; x0: number } | null;
  swing: Swing | null;
  hang: Hang | null; // hanging from a bar in the air
  vault: Vault | null; // going over an obstacle with a hand on top
  energy: number; // 1 = fresh; each move spends some (src/sim/energy.ts)
  bed: { base: Bounce; vIn: number; start: number; press: number | null; vx: number; top: number } | null;
  noCatchUntil: number;
  lastPress: number; // tick of the last Space press, so a press just before landing counts
  lastVault: number; // tick of the last V press, so a press a moment before the obstacle still vaults it
  lastRoll: number; // tick of the last C press, so a press a quarter of a second before touchdown still rolls
  events: GameEvent[];
}

// A start standing still on the ground at x: the whole course, or the start of one obstacle (a checkpoint).
export function newWorld(course: CourseData, x: number = course.startX): WorldState {
  const r = startState(x);
  r.y = groundAt(course.terrain, x);
  return { runner: r, mode: 'run', outcome: 'running', wall: null, swing: null, hang: null, vault: null, energy: 1, bed: null, noCatchUntil: 0, lastPress: -1000, lastVault: -1000, lastRoll: -1000, events: [] };
}

const wallParams = (c: CourseData): WallParams => ({ ...DEFAULT_WALL, ...(c.wall ?? {}) });
const ropeParams = (c: CourseData): RopeParams => ({ ...DEFAULT_ROPE, ...(c.rope ?? {}) });

export function stepWorld(w: WorldState, input: RunnerInput, course: CourseData, p: RunnerParams = DEFAULT_PARAMS): WorldState {
  if (w.outcome !== 'running') return { ...w, runner: { ...w.runner, tick: w.runner.tick + 1 } };
  const rolling = input.roll || w.runner.tick + 1 - w.lastRoll <= ROLL_BUFFER;
  const input2: RunnerInput = { ...(input.jump && w.runner.grounded && w.mode === 'run' ? { ...input, jumpSpeed: course.jumpSpeed } : input), roll: rolling };
  const events: GameEvent[] = [];
  const tick = w.runner.tick + 1;
  const ev = (type: GameEvent['type'], detail?: GameEvent['detail']) => events.push({ tick, type, detail });
  let n: WorldState = { ...w, lastPress: input.jump ? w.runner.tick + 1 : w.lastPress, lastVault: input.vault ? w.runner.tick + 1 : w.lastVault, lastRoll: input.roll ? w.runner.tick + 1 : w.lastRoll };

  if (w.mode === 'wall') return stepWall(w, course);
  if (w.mode === 'swing') return stepSwing(w, input, course);
  if (w.mode === 'bounce') return stepBounce(w, input);
  if (w.mode === 'hang') return stepHang(w, input, course);
  if (w.mode === 'vault') return stepVault(w);

  // the vault: a hand on top of the obstacle just ahead, the body goes over it and keeps most of the speed
  if (n.lastVault >= 0 && w.runner.tick + 1 - n.lastVault <= VAULT_BUFFER && w.runner.grounded) { // a V pressed up to a fifth of a second early still counts
    const v = findVault(course.terrain, w.runner.x, w.runner.y, w.runner.vx);
    if (v) {
      ev('vault', { rise: v.y1 - v.y0, vx: w.runner.vx });
      return { ...w, mode: 'vault', vault: v, energy: Math.max(0, w.energy - VAULT_COST), lastPress: n.lastPress, lastVault: -1000, events, runner: { ...w.runner, tick, grounded: false } };
    }
  }

  const before = w.runner;
  const r = step(before, input2, p, course.terrain);
  n.runner = r;
  if (before.grounded && !r.grounded && input2.jump) { ev('jump', { vy: r.vy, vx: r.vx, x: r.x }); n.energy = Math.max(0, w.energy - JUMP_COST); if (course.jumpKeep !== undefined && course.jumpKeep !== 1) n.runner = { ...r, vx: r.vx * course.jumpKeep }; }
  if (!before.grounded && r.grounded && r.landing) {
    const plat = standingOn(course.terrain, r.x);
    ev('land', { impact: r.landing.impactSpeed, peakDecel: r.landing.peakDecel, squat: r.landing.squatted, rolled: r.landing.rolled, bouncy: !!plat?.bouncy });
    if (r.landing.stumbled && !plat?.bouncy) ev('stumble', { peakDecel: r.landing.peakDecel });
    if (r.landing.hurt && !plat?.bouncy) { n.outcome = 'hurt'; ev('hard-landing', { impact: r.landing.impactSpeed, peakDecel: r.landing.peakDecel, rolled: r.landing.rolled, squat: r.landing.squatted }); }
    if (plat?.bouncy) {
      const base = bounce(r.landing.impactSpeed, DEFAULT_TRAMPOLINE);
      n.mode = 'bounce';
      const early = r.tick - w.lastPress <= 8; // a press just before landing counts as a press at the start of the bounce
      n.bed = { base, vIn: r.landing.impactSpeed, start: r.tick, press: early ? 0 : null, vx: r.vx, top: r.y };
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

  // a bar: airborne with a hand on the key and the hands within reach of it
  if (course.holds?.length && n.mode === 'run' && !r.grounded && r.tick >= w.noCatchUntil && (input.handL || input.handR)) {
    const g = tryGrab(course.holds, r.x, r.y, r.vx, r.vy);
    if (g) {
      n.mode = 'hang';
      n.hang = g;
      ev('hang-catch', { hold: g.hold, omega: g.omega });
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

function stepVault(w: WorldState): WorldState {
  const v = w.vault!;
  const tick = w.runner.tick + 1;
  const i = v.i + 1;
  if (i >= v.n) {
    const end = vaultAt(v, v.n);
    return { ...w, mode: 'run', vault: null, events: [], runner: { ...w.runner, tick, x: end.x, y: end.y, vx: v.vx * VAULT_KEEP, vy: 0, grounded: true } };
  }
  const q = vaultAt(v, i);
  return { ...w, vault: { ...v, i }, events: [], runner: { ...w.runner, tick, x: q.x, y: q.y, vx: v.vx * VAULT_KEEP, vy: 0, grounded: false } };
}

function stepHang(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  const holds = course.holds ?? [];
  const h = holds[w.hang!.hold];
  const tick = w.runner.tick + 1;
  // both hands off the bar: let go and fly on
  if (!input.handL && !input.handR) {
    const rel = releaseHang(h, w.hang!);
    return { ...w, mode: 'run', hang: null, noCatchUntil: tick + 24, events: [{ tick, type: 'hang-release', detail: { vx: rel.vx, vy: rel.vy } }], runner: { ...w.runner, tick, x: rel.x, y: rel.y, vx: rel.vx, vy: rel.vy, grounded: false } };
  }
  const pump = ((input.run ? 1 : 0) - (input.left ? 1 : 0)) as -1 | 0 | 1;
  const s = hangStep(w.hang!, pump);
  // the bar pulls harder than the hands can hold: they open and the body flies on with the speed it has
  if (gripSlips(s)) {
    const rel = releaseHang(h, s);
    return { ...w, mode: 'run', hang: null, noCatchUntil: tick + 24, events: [{ tick, type: 'hang-release', detail: { vx: rel.vx, vy: rel.vy, slipped: true } }], runner: { ...w.runner, tick, x: rel.x, y: rel.y, vx: rel.vx, vy: rel.vy, grounded: false } };
  }
  const f = feetOf(h, s), d = comDistance(DEFAULT_HANG);
  return { ...w, hang: s, events: [], runner: { ...w.runner, tick, x: f.x, y: f.y, vx: s.omega * d * Math.cos(s.theta), vy: s.omega * d * Math.sin(s.theta), grounded: false } };
}

function stepBounce(w: WorldState, input: RunnerInput): WorldState {
  const bed = w.bed!;
  const tick = w.runner.tick + 1;
  const k = tick - bed.start;
  const press = input.jump && bed.press === null ? k : bed.press;
  const x = w.runner.x + bed.vx * DT;
  if (k >= bed.base.ticksOnBed) {
    const out = bounce(bed.vIn, DEFAULT_TRAMPOLINE, press);
    const events: GameEvent[] = [{ tick, type: 'bounce', detail: { vyOut: out.vyOut, pumped: out.pumped, gain: out.gain } }];
    return { ...w, mode: 'run', bed: null, events, runner: { ...w.runner, tick, x, y: bed.top, vx: bed.vx, vy: out.vyOut, grounded: false } };
  }
  return { ...w, bed: { ...bed, press }, events: [], runner: { ...w.runner, tick, x, y: bed.top + bed.base.path[k], vy: 0 } };
}

export { NO_INPUT, DT };
