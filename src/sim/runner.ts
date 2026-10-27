import { DT, GRAVITY } from './units';

// Starting values from the spec (section 4); playtests re-tune them.
export interface RunnerParams {
  topSpeed: number; // m/s, the speed a held sprint approaches
  acceleration: number; // m/s², the push at standstill; time constant tau = topSpeed / acceleration
  grip: number; // friction coefficient between feet and ground (braking = grip * g)
  gravity: number; // m/s²
}

export const DEFAULT_PARAMS: RunnerParams = { topSpeed: 8, acceleration: 6, grip: 0.8, gravity: GRAVITY };

export interface RunnerInput {
  run: boolean; // sprint toward top speed
  jump: boolean; // leave the ground this tick if standing on it
  jumpSpeed: number; // upward speed at take-off, m/s
}

export const NO_INPUT: RunnerInput = { run: false, jump: false, jumpSpeed: 0 };

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
}

export function startState(x = 0): RunnerState {
  return { tick: 0, x, y: 0, vx: 0, vy: 0, grounded: true, landedAtTick: null, landedAtX: null };
}

// One fixed step of 1/120 s. Every update below is the exact solution of its law over one step,
// so the closed forms in the tests hold at any step size, not just in the limit.
export function step(s: RunnerState, input: RunnerInput, p: RunnerParams): RunnerState {
  const next: RunnerState = { ...s, tick: s.tick + 1 };
  if (s.grounded) {
    if (input.jump) return takeOff(next, input.jumpSpeed);
    // Without a push the feet skid: braking is the same grip-limited law.
    return input.run ? sprint(next, p) : skid(next, p);
  }
  return fly(next, p);
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

// Gravity only. Constant acceleration, so x += v dt and y += v dt - g dt²/2 are exact.
function fly(s: RunnerState, p: RunnerParams): RunnerState {
  const vy = s.vy - p.gravity * DT;
  const y = s.y + s.vy * DT - 0.5 * p.gravity * DT * DT;
  const x = s.x + s.vx * DT;
  if (y > 0) return { ...s, x, y, vy };
  // Touchdown inside this step: find the exact moment so range doesn't depend on the step size.
  const disc = Math.sqrt(s.vy * s.vy + 2 * p.gravity * s.y);
  const tHit = (s.vy + disc) / p.gravity;
  const landedAtX = s.x + s.vx * tHit;
  return {
    ...s,
    x: landedAtX,
    y: 0,
    vy: 0,
    grounded: true,
    landedAtTick: s.tick - 1 + tHit / DT, // s.tick already counts this step
    landedAtX,
  };
}

export function run(
  start: RunnerState,
  inputAt: (tick: number) => RunnerInput,
  ticks: number,
  p: RunnerParams = DEFAULT_PARAMS,
): RunnerState {
  let s = start;
  for (let i = 0; i < ticks; i++) s = step(s, inputAt(s.tick), p);
  return s;
}
