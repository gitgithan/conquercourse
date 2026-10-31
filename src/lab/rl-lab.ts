import type { CourseData } from "../course/course";
import { edges, playPlan, meter } from "../sim/ideal";
import { NO_INPUT, type RunnerInput } from "../sim/runner";
import { newWorld, stepWorld, type WorldState } from "../sim/world";
import { DT } from "../sim/units";

// Lab 12, Reinforcement learning (a game character learning a course by trial and error).
// The character stands on the REAL deterministic simulator. Every twentieth of a second on the ground it picks one of three real inputs:
// run, jump, or wait (let go of run). It is not told where the gaps are: it gets points (the reward the player writes) and learns a table
// of "how good is each input at each place" (tabular Q-learning). Same course, same choices and same seed give the same numbers: the only
// randomness is a seeded generator, and there is no clock.
export type Action = 0 | 1 | 2; // 0 run, 1 jump, 2 wait
export const ACTION_NAMES = ["run", "jump", "wait"] as const;

export interface RewardCfg {
  progress: number; // points per metre moved to the right
  finish: number; // points for clearing the course
  fall: number; // points taken off for falling or hurting (a splash, a hard landing)
  alive: number; // points for every moment (a twentieth of a second) spent playing; negative is a time cost
  edge: number; // points for every grounded moment spent in the last 1.5 m before a take-off edge (a "shaping" hint)
}
export interface RlConfig {
  reward: RewardCfg;
  alpha: number; // learning rate, 0.02 to 1
  epsilon: number; // exploration: the share of moves chosen at random, 0 to 0.6
  decay: boolean; // shrink exploration to a tenth by the last episode
  episodes: number; // 50 to 5000
  seed: number;
}
export const GAMMA = 0.99; // how much a point a moment later is worth: fixed, shown in the equations
export const REWARD_PRESETS: Record<string, { label: string; about: string; reward: RewardCfg }> = {
  honest: { label: "Honest", about: "Points for distance, a bonus for the finish, a penalty for a fall.", reward: { progress: 1, finish: 10, fall: 10, alive: 0, edge: 0 } },
  alive: { label: "Pays for staying alive", about: "A big bonus for every moment it is still playing. Watch where that leads.", reward: { progress: 1, finish: 10, fall: 10, alive: 0.5, edge: 0 } },
  edge: { label: "Pays for nearing a gap", about: "A hint meant to pull it toward the take-off edge. Watch what it does with the hint.", reward: { progress: 1, finish: 10, fall: 10, alive: 0, edge: 3 } },
  lazy: { label: "Pays only for the finish", about: "No points on the way, only at the end. It must find the whole run by luck first.", reward: { progress: 0, finish: 10, fall: 0, alive: 0, edge: 0 } },
};
export const DEFAULT_RL: RlConfig = { reward: REWARD_PRESETS.honest.reward, alpha: 0.2, epsilon: 0.2, decay: true, episodes: 2000, seed: 7 };

export const clampRl = (c: RlConfig): RlConfig => {
  const k = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);
  return {
    reward: { progress: k(c.reward.progress, 0, 3), finish: k(c.reward.finish, 0, 100), fall: k(c.reward.fall, 0, 100), alive: k(c.reward.alive, -1, 2), edge: k(c.reward.edge, 0, 3) },
    alpha: k(c.alpha, 0.02, 1), epsilon: k(c.epsilon, 0, 0.6), decay: !!c.decay, episodes: Math.round(k(c.episodes, 50, 5000)), seed: Math.round(k(c.seed, 0, 1e9)),
  };
};

// ---- seeded randomness (mulberry32) ----
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

const D = 6; // ticks per moment: 1/20 s
const BIN = 0.25; // metres per place in the table
const MAX_TICKS = 2400; // an episode ends after 20 s of game time
const ZONE = 1.5; // metres before a take-off edge that count as "near the gap"

export interface Step { reward: number; discount: number; done: boolean; cleared: boolean; truncated: boolean }

// One episode of the course, one move at a time.
export class Env {
  w: WorldState;
  edgeXs: number[];
  readonly bins: number;
  ticks = 0;
  ret = 0; // points collected so far (not discounted)
  maxX = 0;
  constructor(readonly course: CourseData, readonly rw: RewardCfg) {
    this.w = newWorld(course);
    this.edgeXs = edges(course).map((e) => e.x);
    this.bins = Math.ceil((course.finishX - course.startX) / BIN) + 4;
    this.maxX = this.w.runner.x;
  }
  state(): number { return Math.max(0, Math.min(this.bins - 1, Math.floor((this.w.runner.x - this.course.startX) / BIN))); }
  get done(): boolean { return this.w.outcome !== "running"; }
  inZone(x: number): boolean { const e = this.edgeXs.find((ex) => ex > x - 0.05); return e !== undefined && x >= e - ZONE && x <= e; }
  private chunk(input: RunnerInput): number {
    const x0 = this.w.runner.x;
    for (let i = 0; i < D && this.w.outcome === "running" && this.ticks < MAX_TICKS; i++) {
      this.w = stepWorld(this.w, i === 0 ? input : { ...input, jump: false }, this.course);
      this.ticks++;
    }
    meter.ticks += D;
    return chunkReward(this.rw, x0, this.w.runner.x, this.w.runner.grounded && this.inZone(this.w.runner.x), this.w.outcome);
  }
  // The move: run, jump or wait for one moment; after a jump the character keeps running until its feet are back on the ground.
  step(a: Action): Step {
    let reward = 0, k = 0, discount = 1;
    do {
      const first = k === 0;
      const input: RunnerInput = { ...NO_INPUT, run: a !== 2 || !first, squat: true, jump: first && a === 1 };
      const r = this.chunk(input);
      this.ret += r;
      reward += discount * r;
      discount *= GAMMA; k++;
      this.maxX = Math.max(this.maxX, this.w.runner.x);
    } while (this.w.outcome === "running" && !this.w.runner.grounded && this.ticks < MAX_TICKS);
    const truncated = this.w.outcome === "running" && this.ticks >= MAX_TICKS;
    return { reward, discount, done: this.w.outcome !== "running", cleared: this.w.outcome === "cleared", truncated };
  }
}

// The points for one moment of play, given where the runner was and is.
export function chunkReward(rw: RewardCfg, x0: number, x1: number, nearGap: boolean, outcome: string): number {
  let r = rw.progress * (x1 - x0) + rw.alive + (nearGap ? rw.edge : 0);
  if (outcome === "cleared") r += rw.finish;
  else if (outcome === "splash" || outcome === "hurt") r -= rw.fall;
  return r;
}

export interface Block { episode: number; meanReturn: number; clearRate: number; greedyCleared: boolean; greedyReturn: number }
export interface Baseline { clearRate: number; meanProgress: number; episodes: number }
export interface RlResult {
  blocks: Block[];
  firstClearEpisode: number | null; // first episode (while exploring) that reached the finish
  firstPolicyClearEpisode: number | null; // first time the best-guess policy (no random moves) cleared; checked every 10 episodes
  finalCleared: boolean;
  finalSeconds: number | null;
  finalReturn: number;
  finalProgress: number; // fraction of the course covered, 0 to 1
  finalEnd: string; // how the final run ended: cleared, splash, hurt, or out of time
  line: { jumps: number[]; waits: number[] }; // places where the learned policy jumps or waits (x, m)
  ideal: { seconds: number | null; ret: number; jumps: number[] };
  random: Baseline;
  greedy: Baseline; // never explores (epsilon 0 with the same learning rate) for contrast; filled by compareNoExplore
  hacked: boolean; // the character scored more than the game's own clear line without clearing
  simSeconds: number;
  episodes: number;
}

const argmax = (q: Float64Array, s: number): Action => {
  const o = s * 3;
  let best: Action = 0;
  if (q[o + 1] > q[o + best]) best = 1;
  if (q[o + 2] > q[o + best]) best = 2;
  return best;
};

export interface Played { ret: number; cleared: boolean; seconds: number | null; maxX: number; end: string; path: { x: number; y: number }[] }

// Play one episode. `pick` chooses the move from the place; `learn` (optional) is told every step.
function episode(course: CourseData, rw: RewardCfg, pick: (s: number) => Action, learn?: (s: number, a: Action, st: Step, s2: number) => void, wantPath = false): Played {
  const env = new Env(course, rw);
  const path: { x: number; y: number }[] = [];
  if (wantPath) path.push({ x: env.w.runner.x, y: env.w.runner.y });
  while (!env.done && env.ticks < MAX_TICKS) {
    const s = env.state();
    const a = pick(s);
    const before = env.ticks;
    const st = env.step(a);
    learn?.(s, a, st, env.state());
    if (wantPath) path.push({ x: env.w.runner.x, y: env.w.runner.y });
    if (env.ticks === before) break;
  }
  return { ret: env.ret, cleared: env.w.outcome === "cleared", seconds: env.w.outcome === "cleared" ? env.w.runner.tick * DT : null, maxX: env.maxX, end: env.w.outcome === "running" ? "out of time" : env.w.outcome, path };
}

const progressOf = (course: CourseData, maxX: number): number => Math.max(0, Math.min(1, (maxX - course.startX) / (course.finishX - course.startX)));

// Where the learned table says to jump or wait: replay the greedy policy and note the places it picks those moves.
function policyLine(course: CourseData, q: Float64Array, rw: RewardCfg): { jumps: number[]; waits: number[] } {
  const jumps: number[] = [], waits: number[] = [];
  const env = new Env(course, rw);
  while (!env.done && env.ticks < MAX_TICKS) {
    const s = env.state(), a = argmax(q, s);
    const x = Math.round(env.w.runner.x * 100) / 100;
    if (a === 1) jumps.push(x); else if (a === 2 && !waits.includes(x)) waits.push(x);
    env.step(a);
    if (waits.length > 40) break;
  }
  return { jumps, waits: waits.slice(0, 40) };
}

// The return of the game's own stored line, under the same points, counted on the same moments.
export function idealReturn(course: CourseData, rw: RewardCfg): { seconds: number | null; ret: number; jumps: number[] } {
  if (!course.plan) return { seconds: null, ret: 0, jumps: [] };
  const es = edges(course).map((e) => e.x);
  const near = (x: number): boolean => { const e = es.find((ex) => ex > x - 0.05); return e !== undefined && x >= e - ZONE && x <= e; };
  let ret = 0, i = 0, prev = course.startX;
  const r = playPlan(course, course.plan, 120 * 60, (w) => {
    if (i++ % D === 0 && i > 1) { ret += chunkReward(rw, prev, w.runner.x, w.runner.grounded && near(w.runner.x), w.outcome); prev = w.runner.x; }
    else if (w.outcome !== "running" && w.runner.x !== prev) { ret += chunkReward(rw, prev, w.runner.x, false, w.outcome); prev = w.runner.x; }
  });
  return { seconds: r.world.outcome === "cleared" ? r.world.runner.tick * DT : null, ret, jumps: course.plan.jumpXs };
}

export function randomBaseline(course: CourseData, rw: RewardCfg, seed: number, episodes = 200): Baseline {
  const rand = rng(seed ^ 0x9e3779b9);
  let cleared = 0, prog = 0;
  for (let i = 0; i < episodes; i++) {
    const p = episode(course, rw, () => Math.floor(rand() * 3) as Action);
    if (p.cleared) cleared++;
    prog += progressOf(course, p.maxX);
  }
  return { clearRate: cleared / episodes, meanProgress: prog / episodes, episodes };
}

// Train. Returns the learning curve, the first clear, the final policy played back, and the comparisons.
export function trainRl(course: CourseData, input: RlConfig, onBlock?: (b: Block, done: number) => void, opts: { baselines?: boolean } = {}): RlResult & { q: Float64Array; policyRun: Played } {
  const cfg = clampRl(input);
  const t0 = meter.ticks;
  const rand = rng(cfg.seed);
  const probe = new Env(course, cfg.reward);
  const q = new Float64Array(probe.bins * 3);
  const blocks: Block[] = [];
  let firstClear: number | null = null, firstPolicyClear: number | null = null;
  let sumRet = 0, cleared = 0, n = 0;
  const BLOCK = Math.max(10, Math.min(50, Math.round(cfg.episodes / 30) * 10 || 10));
  for (let ep = 1; ep <= cfg.episodes; ep++) {
    const eps = cfg.decay ? cfg.epsilon * (1 - 0.9 * (ep - 1) / Math.max(1, cfg.episodes - 1)) : cfg.epsilon;
    const p = episode(
      course, cfg.reward,
      (s) => (rand() < eps ? (Math.floor(rand() * 3) as Action) : argmax(q, s)),
      (s, a, st, s2) => {
        const target = st.reward + (st.done ? 0 : st.discount * q[s2 * 3 + argmax(q, s2)]);
        q[s * 3 + a] += cfg.alpha * (target - q[s * 3 + a]);
      },
    );
    sumRet += p.ret; n++;
    if (p.cleared) { cleared++; if (firstClear === null) firstClear = ep; }
    if (ep % 10 === 0) {
      const g = episode(course, cfg.reward, (s) => argmax(q, s));
      if (g.cleared && firstPolicyClear === null) firstPolicyClear = ep;
      if (ep % BLOCK === 0) {
        const b: Block = { episode: ep, meanReturn: sumRet / n, clearRate: cleared / n, greedyCleared: g.cleared, greedyReturn: g.ret };
        blocks.push(b); onBlock?.(b, ep);
        sumRet = 0; cleared = 0; n = 0;
      }
    }
  }
  const policyRun = episode(course, cfg.reward, (s) => argmax(q, s), undefined, true);
  const ideal = idealReturn(course, cfg.reward);
  const base = opts.baselines === false ? { clearRate: 0, meanProgress: 0, episodes: 0 } : randomBaseline(course, cfg.reward, cfg.seed);
  return {
    blocks, firstClearEpisode: firstClear, firstPolicyClearEpisode: firstPolicyClear,
    finalCleared: policyRun.cleared, finalSeconds: policyRun.seconds, finalReturn: policyRun.ret, finalProgress: progressOf(course, policyRun.maxX), finalEnd: policyRun.end,
    line: policyLine(course, q, cfg.reward), ideal, random: base, greedy: { clearRate: 0, meanProgress: 0, episodes: 0 },
    hacked: !policyRun.cleared && policyRun.ret > ideal.ret, simSeconds: Math.round((meter.ticks - t0) * DT * 100) / 100, episodes: cfg.episodes,
    q, policyRun,
  };
}

// The same choices with exploration switched off: the character that only repeats its best guess (greedy).
export function trainNoExplore(course: CourseData, cfg: RlConfig): Baseline {
  const r = trainRl(course, { ...cfg, epsilon: 0 }, undefined, { baselines: false });
  return { clearRate: r.finalCleared ? 1 : 0, meanProgress: r.finalProgress, episodes: cfg.episodes };
}

// For the pictures: the path of a stored plan, and what the table says at every place (-1: never visited).
export function pathOfPlan(course: CourseData): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  if (!course.plan) return pts;
  let i = 0;
  playPlan(course, course.plan, 120 * 60, (w) => { if (i++ % 3 === 0) pts.push({ x: w.runner.x, y: w.runner.y }); });
  return pts;
}
export function policyStrip(q: Float64Array): number[] {
  const out: number[] = [];
  for (let s = 0; s * 3 < q.length; s++) out.push(q[s * 3] === 0 && q[s * 3 + 1] === 0 && q[s * 3 + 2] === 0 ? -1 : argmax(q, s));
  return out;
}
export const BIN_METRES = BIN;
