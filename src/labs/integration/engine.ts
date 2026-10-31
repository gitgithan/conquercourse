import { DEFAULT_CART, makeRails, type CartParams, type Rails } from "../../sim/cart";
import { GRAVITY } from "../../sim/units";

// Lab 6: Numerical integration. The cart's equations are the game's own (src/sim/cart.ts: same acceleration, same rails);
// only the stepping rule and the step size are the player's choice. At the game's setting (RK4, 1/120 s) this code gives the game's numbers bit for bit (tested).

export type Method = "euler" | "semi" | "rk4";
export const METHOD_INFO: Record<Method, { label: string; about: string; evals: number; order: number }> = {
  euler: { label: "Euler", about: "Use the speed and the push you have now to guess the next moment. One look at the push per step.", evals: 1, order: 1 },
  semi: { label: "Semi-implicit Euler", about: "Update the speed first, then move with the new speed. Same cost as Euler, and it usually keeps energy in check far better on swinging things.", evals: 1, order: 1 },
  rk4: { label: "RK4", about: "Look at the push four times inside the step and blend them. Four times the cost of Euler. This is the game's rule.", evals: 4, order: 4 },
};
export const STEP_CHOICES = [10, 15, 30, 60, 120, 240, 480, 960]; // steps per second; all divide one second, so every run has a state at each whole second
export const LENGTH_CHOICES = [10, 60, 300, 1200]; // seconds of game time
export const GAME_METHOD: Method = "rk4";
export const GAME_STEPS_PER_SECOND = 120;

export interface LabConfig { method: Method; stepsPerSecond: number; seconds: number }
export const DEFAULT_CONFIG: LabConfig = { method: "euler", stepsPerSecond: 60, seconds: 300 };
export function clampCfg(c: LabConfig): LabConfig {
  const m: Method = c.method in METHOD_INFO ? c.method : "euler";
  const near = (list: number[], v: number) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), list[0]);
  return { method: m, stepsPerSecond: near(STEP_CHOICES, c.stepsPerSecond), seconds: near(LENGTH_CHOICES, c.seconds) };
}

// A bowl of rail: a smooth valley, no friction and no drag, so the energy of the cart should never change.
export const BOWL_PTS: [number, number][] = [[0, 6], [10, 1.2], [20, 0.2], [30, 1.2], [40, 6]];
export const BOWL_START = { x: 1, v: 0 };
export const LOSSLESS: CartParams = { ...DEFAULT_CART, rolling: 0, drag: 0, brake: 0 };
export const bowlRails = (): Rails => makeRails(BOWL_PTS);

export type Stepper = (x: number, v: number) => { x: number; v: number };
// The game's own acceleration and speed along the x axis, with the step size and the rule free.
export function makeStepper(rails: Rails, method: Method, dt: number, p: CartParams = LOSSLESS, brake = false): Stepper {
  const acc = (xx: number, vv: number): number => {
    const s = rails.slope(xx), c = 1 / Math.sqrt(1 + s * s), sinPhi = s * c;
    const smooth = Math.tanh(vv / 0.05);
    return -p.gravity * sinPhi - p.rolling * p.gravity * c * smooth - p.drag * vv * Math.abs(vv) - (brake ? p.brake * smooth : 0);
  };
  const vel = (xx: number, vv: number): number => vv / Math.sqrt(1 + rails.slope(xx) ** 2);
  if (method === "euler") return (x, v) => ({ x: x + dt * vel(x, v), v: v + dt * acc(x, v) });
  if (method === "semi") return (x, v) => { const nv = v + dt * acc(x, v); return { x: x + dt * vel(x, nv), v: nv }; };
  return (x, v) => {
    const k1x = vel(x, v), k1v = acc(x, v);
    const k2x = vel(x + 0.5 * dt * k1x, v + 0.5 * dt * k1v), k2v = acc(x + 0.5 * dt * k1x, v + 0.5 * dt * k1v);
    const k3x = vel(x + 0.5 * dt * k2x, v + 0.5 * dt * k2v), k3v = acc(x + 0.5 * dt * k2x, v + 0.5 * dt * k2v);
    const k4x = vel(x + dt * k3x, v + dt * k3v), k4v = acc(x + dt * k3x, v + dt * k3v);
    return { x: x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x), v: v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v) };
  };
}

// Energy per kilogram above the bottom of the bowl: height plus half the speed squared (speed along the rails). It is constant on the true motion.
export const energyOf = (rails: Rails, x: number, v: number, floorY: number, g = GRAVITY): number => g * (rails.y(x) - floorY) + 0.5 * v * v;

export interface Trace {
  method: Method; stepsPerSecond: number; seconds: number;
  steps: number; // steps actually taken
  leftTrackAt: number | null; // game seconds when it left the rails or blew up; the run stops there
  xs: number[]; vs: number[]; // state at each whole second (index = second), up to the end of the run
  drift: { t: number; e: number }[]; // relative energy error (E - E0) / E0 at about 240 moments
  maxDrift: number; // largest |(E - E0) / E0| seen on every step
  finalDrift: number;
  hash: string;
}

// FNV-1a over the bytes of every whole-second state: two runs have the same hash only if every one of those numbers is identical to the last bit.
export function hashStates(xs: number[], vs: number[]): string {
  const buf = new DataView(new ArrayBuffer(8));
  let h = 0x811c9dc5;
  const feed = (n: number) => { buf.setFloat64(0, n); for (let i = 0; i < 8; i++) { h ^= buf.getUint8(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  xs.forEach((x, i) => { feed(x); feed(vs[i]); });
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function runBowl(method: Method, stepsPerSecond: number, seconds: number, rails: Rails = bowlRails()): Trace {
  const dt = 1 / stepsPerSecond;
  const step = makeStepper(rails, method, dt);
  const floorY = rails.y(20), e0 = energyOf(rails, BOWL_START.x, BOWL_START.v, floorY);
  let x = BOWL_START.x, v = BOWL_START.v;
  const xs = [x], vs = [v];
  const drift: { t: number; e: number }[] = [{ t: 0, e: 0 }];
  const total = Math.round(seconds * stepsPerSecond);
  const every = Math.max(1, Math.floor(total / 240));
  let maxDrift = 0, steps = 0, leftTrackAt: number | null = null;
  for (let n = 1; n <= total; n++) {
    const s = step(x, v); x = s.x; v = s.v; steps = n;
    if (!Number.isFinite(x) || !Number.isFinite(v) || x < rails.x0 || x > rails.x1) { leftTrackAt = n / stepsPerSecond; break; }
    const rel = (energyOf(rails, x, v, floorY) - e0) / e0;
    if (Math.abs(rel) > maxDrift) maxDrift = Math.abs(rel);
    if (n % every === 0) drift.push({ t: n / stepsPerSecond, e: rel });
    if (n % stepsPerSecond === 0) { xs.push(x); vs.push(v); }
  }
  const ok = Number.isFinite(x) && Number.isFinite(v);
  const finalDrift = ok ? (energyOf(rails, Math.min(Math.max(x, rails.x0), rails.x1), v, floorY) - e0) / e0 : NaN;
  return { method, stepsPerSecond, seconds, steps, leftTrackAt, xs, vs, drift, maxDrift: ok ? maxDrift : Infinity, finalDrift, hash: hashStates(xs, vs) };
}

// How far apart two runs are, in metres, at each whole second they both reached.
export function divergence(a: Trace, b: Trace): { t: number; d: number }[] {
  const n = Math.min(a.xs.length, b.xs.length);
  return Array.from({ length: n }, (_, t) => ({ t, d: Math.abs(a.xs[t] - b.xs[t]) }));
}
// The first whole second the runs are further apart than a millimetre, or null if they never are.
export const firstApart = (d: { t: number; d: number }[]): number | null => d.find((p) => !(p.d <= 0.001))?.t ?? null;

// Measured order of accuracy: halve the step, see how much the error at T seconds shrinks. Reference: RK4 at 3840 steps a second.
export function measuredOrder(method: Method, stepsPerSecond: number, rails: Rails = bowlRails(), T = 3): { errorAt: number; errorHalf: number; order: number | null } {
  const at = (m: Method, sps: number): number => { const f = makeStepper(rails, m, 1 / sps); let x = BOWL_START.x, v = BOWL_START.v; for (let i = 0; i < Math.round(T * sps); i++) { const s = f(x, v); x = s.x; v = s.v; } return x; };
  const ref = at("rk4", 3840);
  const e1 = Math.abs(at(method, stepsPerSecond) - ref), e2 = Math.abs(at(method, stepsPerSecond * 2) - ref);
  const order = e2 > 2e-10 && e1 > 0 && Number.isFinite(e1) ? Math.log2(e1 / e2) : null;
  return { errorAt: e1, errorHalf: e2, order };
}

export interface Replay { label: string; trace: Trace; equal: boolean; apartAt: number | null; endGap: number | null; div: { t: number; d: number }[] }
export interface LabResult {
  cfg: LabConfig;
  mine: Trace;
  game: Trace; // the recording: RK4 at 120 steps a second, the same length
  replays: Replay[];
  order: ReturnType<typeof measuredOrder>;
  costPerSecond: number; // looks at the push per game second
  wallMs: number;
}

// Original = the game's recording (RK4, 120 a second). Replays: the recording played again, your choice, your choice a second time.
export function runLab(cfg0: LabConfig, now: () => number = () => Date.now()): LabResult {
  const t0 = now();
  const cfg = clampCfg(cfg0);
  const rails = bowlRails();
  const mine = runBowl(cfg.method, cfg.stepsPerSecond, cfg.seconds, rails);
  const game = runBowl(GAME_METHOD, GAME_STEPS_PER_SECOND, cfg.seconds, rails);
  const mk = (label: string, trace: Trace): Replay => {
    const div = divergence(game, trace);
    const n = div.length;
    return { label, trace, equal: trace.hash === game.hash && game.leftTrackAt === trace.leftTrackAt, apartAt: firstApart(div), endGap: n ? div[n - 1].d : null, div };
  };
  const replays = [
    mk("The game's recording, played again", runBowl(GAME_METHOD, GAME_STEPS_PER_SECOND, cfg.seconds, rails)),
    mk("Your choice", mine),
    mk("Your choice, run a second time", runBowl(cfg.method, cfg.stepsPerSecond, cfg.seconds, rails)),
  ];
  return { cfg, mine, game, replays, order: measuredOrder(cfg.method, cfg.stepsPerSecond, rails), costPerSecond: METHOD_INFO[cfg.method].evals * cfg.stepsPerSecond, wallMs: now() - t0 };
}
