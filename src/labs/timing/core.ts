import type { CourseData } from "../../course/course";
import { edges, meter, playPlan, type Plan } from "../../sim/ideal";

// Statistics of timing (CC-118 family). A simulated presser is a little late or early on every jump press.
// The REAL simulator plays the run with each press moved by that jitter, over and over, with a seeded random source, and we count the clears.
// This is a fact about a course and a simulated presser. It is never a mark for a person.
export type Dist = "uniform" | "normal" | "heavy";
export interface TimingConfig {
  sigmaMs: number; // how shaky the presses are: the standard deviation of the jitter, in milliseconds (same for all three shapes)
  dist: Dist;
  runs: number; // Monte Carlo runs, N
  seed: number;
}
export const DEFAULT_TIMING: TimingConfig = { sigmaMs: 40, dist: "normal", runs: 400, seed: 7 };
export const clampTiming = (c: TimingConfig): TimingConfig => ({
  ...c,
  sigmaMs: Math.max(0, Math.min(400, c.sigmaMs)),
  runs: Math.max(10, Math.min(5000, Math.round(c.runs))),
  seed: Math.round(c.seed) >>> 0,
});

export const TICK_HZ = 120;
export const MS_PER_TICK = 1000 / TICK_HZ;
export const toTicks = (ms: number): number => Math.round((ms * TICK_HZ) / 1000);
const CLIP_MS = 1000; // no press is more than a second off

/** A seeded random source (mulberry32): the same seed gives the same list. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (u: () => number): number => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());

/** One jitter in ms; every shape has standard deviation sigma. Uniform: flat up to sigma*sqrt(3). Heavy: Student-t with 3 degrees of freedom, scaled by sigma/sqrt(3). */
export function sampleJitter(dist: Dist, sigmaMs: number, u: () => number): number {
  let v: number;
  if (dist === "uniform") v = (2 * u() - 1) * sigmaMs * Math.sqrt(3);
  else if (dist === "normal") v = gauss(u) * sigmaMs;
  else { const z = gauss(u); const chi = gauss(u) ** 2 + gauss(u) ** 2 + gauss(u) ** 2; v = (z / Math.sqrt(chi / 3)) * (sigmaMs / Math.sqrt(3)); }
  return Math.max(-CLIP_MS, Math.min(CLIP_MS, v));
}

// ---- the maths: the chance one press lands inside a window, and the window that gives a target ----
const erf = (x: number): number => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
/** P(jitter <= x ms) for the shape with standard deviation sigma. */
export function cdf(dist: Dist, sigmaMs: number, x: number): number {
  if (sigmaMs <= 0) return x >= 0 ? 1 : 0;
  if (dist === "uniform") { const a = sigmaMs * Math.sqrt(3); return x <= -a ? 0 : x >= a ? 1 : (x + a) / (2 * a); }
  if (dist === "normal") return 0.5 * (1 + erf(x / (sigmaMs * Math.SQRT2)));
  const t = x / (sigmaMs / Math.sqrt(3)); // Student-t, 3 degrees of freedom
  return 0.5 + (1 / Math.PI) * ((t / Math.sqrt(3)) / (1 + (t * t) / 3) + Math.atan(t / Math.sqrt(3)));
}
/** P(lo <= jitter <= hi) for one press. */
export const pInside = (dist: Dist, sigmaMs: number, loMs: number, hiMs: number): number => Math.max(0, cdf(dist, sigmaMs, hiMs) - cdf(dist, sigmaMs, loMs));
/** The predicted clear rate when the presses are independent: the product of the chances. */
export const predictedRate = (dist: Dist, sigmaMs: number, wins: { loMs: number; hiMs: number }[]): number => wins.reduce((a, w) => a * pInside(dist, sigmaMs, w.loMs, w.hiMs), 1);
/** The width W (ms) of a window centred on the ideal press that lets a presser clear n presses with chance `target` (every press needs chance target^(1/n)). */
export function widthFor(dist: Dist, sigmaMs: number, n: number, target: number): number {
  if (n <= 0) return 0;
  const p = Math.pow(target, 1 / n);
  let lo = 0, hi = 4 * CLIP_MS;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (pInside(dist, sigmaMs, -mid / 2, mid / 2) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** Clear rate when every press has a window of this width, centred: p^n with p the chance one press lands inside. */
export const rateForWidth = (dist: Dist, sigmaMs: number, n: number, widthMs: number): number => Math.pow(pInside(dist, sigmaMs, -widthMs / 2, widthMs / 2), n);
/** Wilson score interval for k clears in n runs (95 % by default, z = 1.96). */
export function wilson(k: number, n: number, z = 1.96): { lo: number; hi: number } {
  if (n <= 0) return { lo: 0, hi: 1 };
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}

// ---- the real simulator, with each press moved ----
// The game plays a press at the first moment the feet are on the ground at or past an x. A press that is `ms` late is the same press made `ms` of running later,
// which on the flat is speed * ms metres further on (the game's own windows are written the same way: metres divided by speed). So we move each press along x and let the
// game's own plan player (playPlan) do the rest. The press is relative to where the runner is, so an early or late landing does not drag every later press out of place.
export interface Played { cleared: boolean; maxX: number }
export function playMoved(course: CourseData, plan: Plan, speeds: number[], offsetsMs: number[]): Played {
  const moved: Plan = { ...plan, jumpXs: plan.jumpXs.map((x, k) => x + (speeds[k] * (offsetsMs[k] ?? 0)) / 1000) };
  const r = playPlan(course, moved);
  return { cleared: r.world.outcome === "cleared", maxX: r.maxX };
}

/** The speed (m/s) the runner has at each press when the plan is played as it stands. */
export function pressSpeeds(course: CourseData, plan: Plan): number[] {
  const out: number[] = [];
  let k = 0;
  playPlan(course, plan, 120 * 80, (w) => {
    if (k < plan.jumpXs.length && w.mode === "run" && w.runner.grounded && w.runner.x >= plan.jumpXs[k]) { out.push(Math.abs(w.runner.vx)); k++; }
  });
  return out;
}

export interface PressWindow { index: number; edgeX: number; loMs: number; hiMs: number; widthMs: number; centredMs: number; capped: boolean; aimShiftMs?: number }
export const SWEEP_MS = 4; // the windows are measured in steps of 4 ms
/** For each press, how early and how late it may be (all other presses on time) and still clear: measured on the simulator. */
export function measureWindows(course: CourseData, plan: Plan, speeds: number[], reachMs = 600): PressWindow[] {
  const es = edges(course);
  return speeds.map((_, k) => {
    const ok = (t: number): boolean => { const off = speeds.map(() => 0); off[k] = t; return playMoved(course, plan, speeds, off).cleared; };
    let lo = 0, hi = 0;
    while (lo > -reachMs && ok(lo - SWEEP_MS)) lo -= SWEEP_MS;
    while (hi < reachMs && ok(hi + SWEEP_MS)) hi += SWEEP_MS;
    const loMs = lo - SWEEP_MS / 2, hiMs = hi + SWEEP_MS / 2;
    return { index: k, edgeX: es[k]?.x ?? 0, loMs, hiMs, widthMs: hiMs - loMs, centredMs: 2 * Math.min(-loMs, hiMs), capped: lo <= -reachMs || hi >= reachMs };
  });
}

// ---- the Monte Carlo ----
export const BIN_MS = 20, BIN_MIN = -400, BIN_MAX = 400; // failure histogram: bins of 20 ms from -400 to 400, the ends hold everything beyond
export interface TimingResult {
  runs: number; clears: number; rate: number; ci: { lo: number; hi: number };
  presses: number;
  windows: PressWindow[];
  failHist: number[]; // counts per bin of the offset of the press that lost the run (late is positive)
  failBins: number[]; // left edge of each bin, ms
  failsNoPress: number; // failures not traced to a press
  predicted: number; // the product of the chances that each press lands in its measured window
  w50: number; w90: number; // window width (ms) per press that gives 50 % and 90 % clear at this jitter
  minWindowMs: number; meanWindowMs: number; minCentredMs: number; // the centred window is the same either side of the ideal press: the part of the window a symmetric presser can use
  simSeconds: number;
  cfg: TimingConfig;
}
export function binIndex(ms: number): number {
  const n = (BIN_MAX - BIN_MIN) / BIN_MS;
  return Math.max(0, Math.min(n + 1, Math.floor((ms - BIN_MIN) / BIN_MS) + 1)); // 0 = below the range, n+1 = above it
}
export const binEdges = (): number[] => { const n = (BIN_MAX - BIN_MIN) / BIN_MS; return [-Infinity, ...Array.from({ length: n }, (_, i) => BIN_MIN + i * BIN_MS), BIN_MAX]; };

/** The presser aims at the middle of each press's window (the game's own "ideal press" is the middle of the good presses), looking at most AIM_REACH_MS either side so a window that runs on and on is not centred on its far end. */
export const AIM_REACH_MS = 300;
export function prepare(course: CourseData): { plan: Plan; speeds: number[]; windows: PressWindow[] } | null {
  const plan = course.plan;
  if (!plan || !plan.jumpXs.length) return null;
  const speeds = pressSpeeds(course, plan);
  if (speeds.length !== plan.jumpXs.length || playPlan(course, plan).world.outcome !== "cleared") return null;
  const first = measureWindows(course, plan, speeds);
  const shifts = first.map((w) => { const lo = Math.max(w.loMs, -AIM_REACH_MS), hi = Math.min(w.hiMs, AIM_REACH_MS); return Math.round((lo + hi) / 2 / SWEEP_MS) * SWEEP_MS; });
  // move the presses one at a time, keeping a move only if the whole plan still clears (the others shift with it); a move that fails is tried at half size
  const moved = plan.jumpXs.slice();
  const kept = shifts.map(() => 0);
  const withMoved = (xs: number[]): Plan => ({ ...plan, jumpXs: xs });
  shifts.forEach((sh, k) => {
    for (const f of [1, 0.5]) {
      const ms = Math.round((sh * f) / SWEEP_MS) * SWEEP_MS;
      if (ms === 0) break;
      const xs = moved.slice(); xs[k] = plan.jumpXs[k] + (speeds[k] * ms) / 1000;
      if (playPlan(course, withMoved(xs)).world.outcome === "cleared") { moved[k] = xs[k]; kept[k] = ms; break; }
    }
  });
  const aimed = withMoved(moved);
  const aimedSpeeds = pressSpeeds(course, aimed);
  const windows = measureWindows(course, aimed, aimedSpeeds).map((w, k) => ({ ...w, aimShiftMs: kept[k] }));
  return { plan: aimed, speeds: aimedSpeeds, windows };
}

export function runTiming(course: CourseData, input: TimingConfig, onProgress?: (done: number) => void, prep = prepare(course)): TimingResult | null {
  const cfg = clampTiming(input);
  if (!prep) return null;
  const { plan, speeds, windows } = prep;
  const es = edges(course);
  const n = speeds.length;
  const t0 = meter.ticks;
  const failHist = new Array((BIN_MAX - BIN_MIN) / BIN_MS + 2).fill(0);
  let clears = 0, failsNoPress = 0;
  for (let r = 0; r < cfg.runs; r++) {
    const u = rng((cfg.seed * 1000003 + r * 7919) >>> 0); // one stream per run, so the answer does not depend on how runs are split between workers
    const ms = speeds.map(() => sampleJitter(cfg.dist, cfg.sigmaMs, u));
    const res = playMoved(course, plan, speeds, ms);
    if (res.cleared) clears++;
    else {
      // which press lost the run: the first press that left its own window (a late press can get through its own gap and strand the next, so the fall place alone would blame the wrong press);
      // when every press was inside its window, the last take-off edge the runner reached
      let k = ms.findIndex((m, i) => m < windows[i].loMs || m > windows[i].hiMs);
      if (k < 0) es.forEach((e, i) => { if (e.x <= res.maxX + 0.05) k = i; });
      if (k >= 0 && k < n) failHist[binIndex(ms[k])]++; else failsNoPress++;
    }
    if (onProgress && (r + 1) % 25 === 0) onProgress(r + 1);
  }
  const wins = windows.map((w) => ({ loMs: w.loMs, hiMs: w.hiMs }));
  const widths = windows.map((w) => w.widthMs);
  return {
    runs: cfg.runs, clears, rate: clears / cfg.runs, ci: wilson(clears, cfg.runs), presses: n, windows,
    failHist, failBins: binEdges(), failsNoPress,
    predicted: predictedRate(cfg.dist, cfg.sigmaMs, wins),
    w50: widthFor(cfg.dist, cfg.sigmaMs, n, 0.5), w90: widthFor(cfg.dist, cfg.sigmaMs, n, 0.9),
    minWindowMs: Math.min(...widths), minCentredMs: Math.min(...windows.map((w) => w.centredMs)), meanWindowMs: widths.reduce((a, b) => a + b, 0) / n,
    simSeconds: Math.round(((meter.ticks - t0) / TICK_HZ) * 10) / 10,
    cfg,
  };
}

/** The clear rate at several jitters (same shape, same seed), for the "how it falls" curve. */
export function sweepSigma(course: CourseData, base: TimingConfig, sigmas: number[], runsEach: number, prep = prepare(course)): { sigmaMs: number; rate: number; ci: { lo: number; hi: number }; predicted: number }[] {
  if (!prep) return [];
  const wins = prep.windows.map((w) => ({ loMs: w.loMs, hiMs: w.hiMs }));
  return sigmas.map((s) => {
    const r = runTiming(course, { ...base, sigmaMs: s, runs: runsEach }, undefined, prep)!;
    return { sigmaMs: s, rate: r.rate, ci: r.ci, predicted: predictedRate(base.dist, s, wins) };
  });
}
