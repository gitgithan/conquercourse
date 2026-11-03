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
  run: boolean; // sprint to the right toward top speed
  left?: boolean; // sprint to the left (if both are held the runner just brakes)
  jump: boolean; // leave the ground this tick if standing on it
  jumpSpeed: number; // upward speed at take-off, m/s
  squat: boolean; // bend the knees (read at touchdown)
  roll?: boolean; // X: roll out of the fall (read at touchdown; the world keeps a press for a quarter of a second)
  slide?: boolean; // Down or S, a fresh press: slide along the ground low (ground and a jog's speed needed; src/sim/slide.ts)
  handL?: boolean; // E: the hands hold on (a bar); both fields come from the one hold key
  handR?: boolean; // E: the right hand holds on (a bar)
  reachL?: boolean; // Q: on monkey bars the left hand reaches for the next rung (a fresh press; src/sim/bars.ts)
  reachR?: boolean; // T: the right hand reaches
  vault?: boolean; // V: go over the obstacle just ahead with a hand on top (keeps the speed)
  aim?: number; // a big cannon: set the barrel angle (rad), for the bot and tests; the player tilts it with aimUp and aimDown
  aimUp?: boolean; // Up arrow or W: tilt the barrel so the push goes higher
  aimDown?: boolean; // Down arrow: tilt it flatter
  up?: boolean; // ArrowUp: climb (in a drone); ArrowDown (squat) descends
  fire?: boolean; // K: fire the launcher clipped on at a recoil pad (the ball goes back, the runner goes forward)
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
    const dir = input.left && !input.run ? -1 : input.run && !input.left ? 1 : 0;
    return onGround(dir !== 0 ? sprint(next, p, dir) : skid(next, p), s, p, terrain);
  }
  return fly(next, input, p, terrain);
}

function takeOff(s: RunnerState, jumpSpeed: number): RunnerState {
  // Flight is decided here: after this tick only gravity acts.
  return { ...s, grounded: false, vy: jumpSpeed };
}

// dv/dt = (top - v) / tau, so v(t) = top - (top - v0) e^(-t/tau).
function sprint(s: RunnerState, p: RunnerParams, dir: 1 | -1 = 1): RunnerState {
  const tau = p.topSpeed / p.acceleration;
  const decay = Math.exp(-DT / tau);
  const target = dir * p.topSpeed;
  const vx = target - (target - s.vx) * decay;
  const x = s.x + target * DT - (target - s.vx) * tau * (1 - decay);
  return { ...s, vx, x };
}

// Coulomb friction: constant deceleration grip * g until the feet stop.
function skid(s: RunnerState, p: RunnerParams): RunnerState {
  const decel = p.grip * p.gravity;
  if (decel <= 0) return { ...s, x: s.x + s.vx * DT }; // no friction: the feet keep sliding at the same speed (and 0 / 0 never happens)
  const sign = s.vx < 0 ? -1 : 1;
  const speed = Math.abs(s.vx);
  const stopTime = speed / decel;
  if (stopTime >= DT) return { ...s, vx: sign * (speed - decel * DT), x: s.x + sign * (speed * DT - 0.5 * decel * DT * DT) };
  return { ...s, vx: 0, x: s.x + sign * 0.5 * speed * stopTime };
}

// After moving on the ground: step up a small curb, stop at a tall block, or walk off an edge.
const MAX_SLOPE = 1; // rise over run: a curved top steeper than 45 degrees cannot be run up

function onGround(moved: RunnerState, before: RunnerState, p: RunnerParams, t: Terrain): RunnerState {
  const here = groundAt(t, moved.x);
  const nowOn = platformAt(t, moved.x), wasOn = platformAt(t, before.x);
  if (nowOn?.profile || wasOn?.profile) {
    // on a curved top: too steep to run up means stopping where it becomes that steep (found by halving the step)
    const climbs = (x: number) => groundAt(t, x) - before.y > MAX_SLOPE * Math.abs(x - before.x) + 1e-9;
    if (climbs(moved.x)) {
      let lo = before.x, hi = moved.x;
      for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (climbs(mid)) hi = mid; else lo = mid; }
      return { ...moved, x: lo, y: before.y, vx: 0 };
    }
  }
  if (here > before.y + p.stepUp) {
    const block = nowOn;
    if (!block) return { ...moved, x: before.x, vx: 0 };
    return { ...moved, x: moved.x < before.x ? block.x1 + 1e-6 : block.x0 - 1e-6, vx: 0 };
  }
  if (here < before.y - 1e-9) {
    // down a curved top the feet stay on the ground as long as the slope is gentler than 45 degrees: running over a dome is not
    // leaving the ground (so Space still works on the way down); a real drop (an edge) still lets go
    const onCurve = nowOn?.profile !== undefined && wasOn?.profile !== undefined;
    if (onCurve && before.y - here <= MAX_SLOPE * Math.abs(moved.x - before.x) + 1e-9) return { ...moved, y: here };
    return { ...moved, grounded: false, vy: 0 }; // off the edge: fall
  }
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
    if (block && !block.profile) { x = s.vx < 0 ? block.x1 + 1e-6 : block.x0 - 1e-6; vx = 0; } // a curved top has no side to hit: rising ground is met by landing on it
  }
  const floor = groundAt(t, x);
  if (y > floor) {
    if (y < t.waterY) return { ...s, x, vx, y, vy, splashed: true };
    return { ...s, x, vx, y, vy };
  }
  // Touchdown inside this step: find the exact moment so range doesn't depend on the step size.
  const curved = platformAt(t, x)?.profile !== undefined || platformAt(t, s.x)?.profile !== undefined;
  if (curved) {
    // over a curved top the floor changes during the step: find the moment the path meets it by halving the time
    let lo = 0, hi = DT;
    for (let i = 0; i < 30; i++) {
      const tm = (lo + hi) / 2;
      const ym = s.y + s.vy * tm - 0.5 * p.gravity * tm * tm;
      if (ym > groundAt(t, s.x + s.vx * tm)) lo = tm; else hi = tm;
    }
    const tHit = hi, landedAtX = s.x + s.vx * tHit, landY = groundAt(t, landedAtX);
    const vyHit = s.vy - p.gravity * tHit;
    const report = landing(Math.max(0, -vyHit), input.squat, p.landing, !!input.roll);
    return {
      ...s, x: landedAtX, y: landY,
      vx: afterLanding(report, vx, p, !!platformAt(t, landedAtX)?.bouncy),
      vy: 0, grounded: true, landedAtTick: s.tick - 1 + tHit / DT, landedAtX, landing: report,
    };
  }
  const disc = Math.sqrt(s.vy * s.vy + 2 * p.gravity * (s.y - floor));
  const tHit = (s.vy + disc) / p.gravity;
  const landedAtX = s.x + s.vx * tHit;
  const report = landing(-(s.vy - p.gravity * tHit), input.squat, p.landing, !!input.roll);
  return {
    ...s,
    x: landedAtX,
    y: floor,
    vx: afterLanding(report, vx, p, !!platformAt(t, landedAtX)?.bouncy), // a trampoline catches the fall
    vy: 0,
    grounded: true,
    landedAtTick: s.tick - 1 + tHit / DT, // s.tick already counts this step
    landedAtX,
    landing: report,
  };
}

// Forward speed after touchdown: a stumble loses most of it, a roll keeps most, a hurt landing stops the runner dead.
function afterLanding(report: LandingReport, vx: number, p: RunnerParams, bouncy: boolean): number {
  if (bouncy) return vx;
  if (report.hurt) return 0;
  if (report.rolled) return vx * p.landing.rollKeep;
  return report.stumbled ? vx * p.landing.stumbleKeep : vx;
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
