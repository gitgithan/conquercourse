import { DT, GRAVITY } from './units';
import { DEFAULT_LANDING, landing, type LandingParams, type LandingReport } from './landing';
import { FLAT, groundAt, platformAt, type Terrain } from './terrain';

// Starting values from the spec (section 4); playtests re-tune them.
export interface RunnerParams {
  topSpeed: number; // m/s, the speed a held sprint approaches
  acceleration: number; // m/s², the push at standstill; time constant tau = topSpeed / acceleration
  grip: number; // friction coefficient between feet and ground (braking = grip * g)
  gravity: number; // m/s²
  landing: LandingParams;
  stepUp: number; // m, the tallest curb the runner steps onto without jumping
}

export const DEFAULT_PARAMS: RunnerParams = { topSpeed: 9, acceleration: 10, grip: 0.8, gravity: GRAVITY, landing: DEFAULT_LANDING, stepUp: 0.3 };

export interface RunnerInput {
  run: boolean; // sprint toward top speed
  jump: boolean; // leave the ground this tick if standing on it
  jumpSpeed: number; // upward speed at take-off, m/s
  squat: boolean; // bend the knees (read at touchdown)
}

export const NO_INPUT: RunnerInput = { run: false, jump: false, jumpSpeed: 0, squat: false };

// The runner as a point mass: x along the track, y up from the ground (y = 0).
export interface RunnerState {
  tick: number; // the only clock
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  landedAtTick: number | null; // fractional tick of the last touchdown
  landedAtX: number | null;
  landing: LandingReport | null; // report of the last touchdown
  splashed: boolean; // fell in the water: the run is over
}

export function startState(x = 0): RunnerState {
  return { tick: 0, x, y: 0, vx: 0, vy: 0, grounded: true, landedAtTick: null, landedAtX: null, landing: null, splashed: false };
}

// One fixed step of 1/120 s. Every update below is the exact solution of its law over one step,
// so the closed forms in the tests hold at any step size, not just in the limit.
export function step(s: RunnerState, input: RunnerInput, p: RunnerParams, terrain: Terrain = FLAT): RunnerState {
  if (s.splashed) return { ...s, tick: s.tick + 1, vx: 0, vy: 0 };
  const next: RunnerState = { ...s, tick: s.tick + 1 };
  if (s.grounded) {
    if (input.jump) return takeOff(next, input.jumpSpeed);
    // Without a push the feet skid: braking is the same grip-limited law.
    return onGround(input.run ? sprint(next, p) : skid(next, p), s, p, terrain);
  }
  return fly(next, input, p, terrain);
}

function takeOff(s: RunnerState, jumpSpeed: number): RunnerState {
  // Flight is decided here: after this tick only gravity acts.
  return { ...s, grounded: false, vy: jumpSpeed };
}

// dv/dt = (top - v) / tau, so v(t) = top - (top - v0) e^(-t/tau).
function sprint(s: RunnerState, p: RunnerParams): RunnerState {
  const tau = p.topSpeed / p.acceleration;
  const decay = Math.exp(-DT / tau);
  const vx = p.topSpeed - (p.topSpeed - s.vx) * decay;
  const x = s.x + p.topSpeed * DT - (p.topSpeed - s.vx) * tau * (1 - decay);
  return { ...s, vx, x };
}

// Coulomb friction: constant deceleration grip * g until the feet stop.
function skid(s: RunnerState, p: RunnerParams): RunnerState {
  const decel = p.grip * p.gravity;
  const stopTime = s.vx / decel;
  if (stopTime >= DT) return { ...s, vx: s.vx - decel * DT, x: s.x + s.vx * DT - 0.5 * decel * DT * DT };
  return { ...s, vx: 0, x: s.x + 0.5 * s.vx * stopTime };
}

// After moving on the ground: step up a small curb, stop at a tall block, or walk off an edge.
function onGround(moved: RunnerState, before: RunnerState, p: RunnerParams, t: Terrain): RunnerState {
  const here = groundAt(t, moved.x);
  if (here > before.y + p.stepUp) {
    const block = platformAt(t, moved.x);
    return { ...moved, x: block ? block.x0 - 1e-6 : before.x, vx: 0 };
  }
  if (here < before.y - 1e-9) return { ...moved, grounded: false, vy: 0 }; // off the edge: fall
  return { ...moved, y: here };
}

// Gravity only. Constant acceleration, so x += v dt and y += v dt - g dt²/2 are exact.
function fly(s: RunnerState, input: RunnerInput, p: RunnerParams, t: Terrain): RunnerState {
  const vy = s.vy - p.gravity * DT;
  const y = s.y + s.vy * DT - 0.5 * p.gravity * DT * DT;
  let x = s.x + s.vx * DT;
  let vx = s.vx;
  const ground = groundAt(t, x);
  // Flew into the side of a block that stands higher than the feet: stop against it and drop.
  if (ground > s.y + 1e-9 && groundAt(t, s.x) < ground) {
    const block = platformAt(t, x);
    if (block) { x = block.x0 - 1e-6; vx = 0; }
  }
  const floor = groundAt(t, x);
  if (y > floor) {
    if (y < t.waterY) return { ...s, x, vx, y, vy, splashed: true };
    return { ...s, x, vx, y, vy };
  }
  // Touchdown inside this step: find the exact moment so range doesn't depend on the step size.
  const disc = Math.sqrt(s.vy * s.vy + 2 * p.gravity * (s.y - floor));
  const tHit = (s.vy + disc) / p.gravity;
  const landedAtX = s.x + s.vx * tHit;
  const report = landing(-(s.vy - p.gravity * tHit), input.squat, p.landing);
  return {
    ...s,
    x: landedAtX,
    y: floor,
    vx: report.stumbled ? vx * p.landing.stumbleKeep : vx,
    vy: 0,
    grounded: true,
    landedAtTick: s.tick - 1 + tHit / DT, // s.tick already counts this step
    landedAtX,
    landing: report,
  };
}

export function run(
  start: RunnerState,
  inputAt: (tick: number) => RunnerInput,
  ticks: number,
  p: RunnerParams = DEFAULT_PARAMS,
  terrain: Terrain = FLAT,
): RunnerState {
  let s = start;
  for (let i = 0; i < ticks; i++) s = step(s, inputAt(s.tick), p, terrain);
  return s;
}
