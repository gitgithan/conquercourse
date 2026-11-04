// "Hide the wait": two clocks and one player. Slow work (the simulator search, a Modal cold start) runs on a compute lane; what the player sees runs on a UX lane.
// Everything here is pure and deterministic: same recorded search + same knobs = same timeline. The recorded jobs come from the REAL search (see record.ts).

/** What we measured or recorded, with where it is written down. */
export const REAL = {
  /** src/sim/ideal.ts: TICKS_PER_WORK_SECOND = 330000, the search budget unit (tests pin it). */
  ticksPerMs: 330,
  /** docs/community-flow-guide.md: the 3D maker's model load on a cold start, 45 to 54 s (data/eval/cc-38-photo-to-3d). */
  coldLoadS: [45, 54] as const,
  /** docs/community-flow-guide.md: a first piece after a quiet spell took 90 to 100 s. */
  firstPieceColdS: [90, 100] as const,
  /** docs/community-flow-guide.md: live run of 2026-10-31, warm: Segment Objects about 18 s, a piece about 32 s. */
  segmentWarmS: 18,
  pieceWarmS: 32,
  /** docs/world-slice.md (Search speed, CC-69/CC-70): one thread 1.5 to 3 times faster, a pool of workers 5 to 14 times. */
  oneThreadGain: [1.5, 3] as const,
  poolGain: [5, 14] as const,
  /** docs/community-flow-guide.md: how long each Modal program keeps its machine after the last call. */
  scaledownFinderS: 60,
  scaledownLifterS: 240,
};

/** Assumptions about the page and the person; each one is a stand-in, not a measurement (docs/labs/wait.md says so). */
export const ASSUME = {
  frameMs: 1000 / 60,
  /** What drawing one frame of the page costs on the main thread. */
  renderMs: 4,
  /** A cached job: a look-up, not a run. */
  lookupMs: 0.01,
  /** Starting a web worker. */
  spawnMs: 40,
  /** One message to a worker and back. */
  messageMs: 0.3,
  /** From pressing Segment Objects to the first word on the screen when we answer at once. */
  ackMs: 50,
  /** From the press to the progress panel opening. */
  progressMs: 100,
  /** The person picks which cut-out to lift. */
  pickS: 4,
  chunksPerWorker: 4,
  maxWorkers: 8,
};

export interface RecBatchPacked { label: string; early: boolean; stopAt: number; ticks: string }
export interface RecCourse { id: string; label: string; url: string; cleared: boolean; jobsRun: number; ticksRun: number; dupJobs: number; wallMs: number; batches: RecBatchPacked[] }
export interface Batch { label: string; early: boolean; ticks: number[]; stopAt: number }
export interface Search { id: string; label: string; batches: Batch[]; cleared: boolean; dupJobs: number }

export const unpack = (c: RecCourse): Search => ({
  id: c.id, label: c.label, cleared: c.cleared, dupJobs: c.dupJobs,
  batches: c.batches.map((b) => ({ label: b.label, early: b.early, stopAt: b.stopAt, ticks: b.ticks === "" ? [] : b.ticks.split(",").map(Number) })),
});

// ---- The search ----
export interface SearchCfg {
  workers: number; // 0 = on the page's own thread
  slice: boolean; // on the page's thread: work in slices between frames (true) or all at once (false)
  sliceMs: number; // the most work started in one frame
  cacheHit: number; // 0 to 1: share of jobs already remembered from an earlier visit
  earlyExit: boolean; // a batch that may stop at its first clear does
  levels: number; // 1 = full search only; 2 or more = rough passes first
  slow: number; // 1 = the machine the ticks per millisecond describe; 2 = twice as slow
}
export const DEFAULT_SEARCH: SearchCfg = { workers: 0, slice: true, sliceMs: 8, cacheHit: 0, earlyExit: true, levels: 1, slow: 1 };

export const clampSearch = (c: SearchCfg): SearchCfg => ({
  workers: Math.max(0, Math.min(ASSUME.maxWorkers, Math.round(c.workers))),
  slice: !!c.slice,
  sliceMs: Math.max(0.5, Math.min(40, c.sliceMs)),
  cacheHit: Math.max(0, Math.min(1, c.cacheHit)),
  earlyExit: !!c.earlyExit,
  levels: Math.max(1, Math.min(4, Math.round(c.levels))),
  slow: Math.max(0.25, Math.min(8, c.slow)),
});

/** Jobs of one pass as milliseconds, batch by batch: early exit cuts a batch at its first clear; a coarse pass keeps every stride-th job; the cache makes some jobs a look-up. */
export function passJobs(s: Search, cfg: SearchCfg, stride: number, counter: { i: number }): number[][] {
  return s.batches.map((b) => {
    const kept = cfg.earlyExit && b.stopAt >= 0 ? b.ticks.slice(0, b.stopAt + 1) : b.ticks;
    const thin = stride > 1 ? kept.filter((_, i) => i % stride === 0) : kept;
    return thin.map((t) => {
      const k = counter.i++;
      const hit = Math.floor((k + 1) * cfg.cacheHit + 1e-9) > Math.floor(k * cfg.cacheHit + 1e-9);
      return hit ? ASSUME.lookupMs : (t / REAL.ticksPerMs) * cfg.slow;
    });
  });
}

/** The strides of the passes, coarsest first: the last pass is the full search. */
export const strides = (levels: number): number[] => Array.from({ length: levels }, (_, j) => 4 ** (levels - 1 - j));

export interface Frame { start: number; ms: number; work: number } // a frame of the page's own thread: when it started, what it cost, how much search work it held
export interface SearchOut {
  doneMs: number; // when the full answer is in
  firstUsefulMs: number; // when the first (rough or full) answer is in
  passEnds: number[];
  frames: Frame[]; // frames of the page's own thread while the search ran (only when it ran there)
  dropped: number; // frames the screen missed because a frame cost more than its 16.7 ms
  worstFrameMs: number;
  workMs: number; // job time actually run (look-ups included)
  jobs: number;
  frozen: [number, number][]; // stretches where the page could not answer a click
}

/** Plays the search on the clock. Pure: batches are sequential (a batch needs the last one's answers); inside a batch the jobs are independent. */
export function simulateSearch(s: Search, input: SearchCfg): SearchOut {
  const cfg = clampSearch(input);
  const counter = { i: 0 };
  const passes = strides(cfg.levels).map((st) => passJobs(s, cfg, st, counter));
  const frames: Frame[] = [];
  const passEnds: number[] = [];
  const frozen: [number, number][] = [];
  let t = 0, workMs = 0, jobs = 0, dropped = 0, worst = 0;
  const vsync = ASSUME.frameMs;
  if (cfg.workers === 0) {
    const flat = passes.map((p) => p.flat());
    let frameStart = 0;
    for (const list of flat) {
      let i = 0;
      while (i < list.length) {
        let used = 0, n = 0;
        do { used += list[i]; i++; n++; } while (i < list.length && (!cfg.slice || used < cfg.sliceMs));
        const cost = ASSUME.renderMs + used;
        const len = Math.max(1, Math.ceil(cost / vsync - 1e-9)) * vsync;
        frames.push({ start: t, ms: cost, work: used });
        workMs += used; jobs += n;
        dropped += Math.round(len / vsync) - 1;
        worst = Math.max(worst, cost);
        if (!cfg.slice && len > 2 * vsync) frozen.push([t, t + len]);
        t += len; frameStart = t;
      }
      passEnds.push(t);
    }
    void frameStart;
  } else {
    const n = cfg.workers;
    t = ASSUME.spawnMs;
    for (const pass of passes) {
      for (const batch of pass) {
        if (batch.length === 0) continue;
        const chunk = Math.max(1, Math.ceil(batch.length / (n * ASSUME.chunksPerWorker)));
        const free = new Array<number>(n).fill(t);
        for (let i = 0; i < batch.length; i += chunk) {
          const part = batch.slice(i, i + chunk);
          const cost = part.reduce((a, b) => a + b, 0);
          const w = free.indexOf(Math.min(...free));
          free[w] += cost + ASSUME.messageMs;
          workMs += cost; jobs += part.length;
        }
        t = Math.max(...free);
      }
      passEnds.push(t);
    }
    worst = ASSUME.renderMs + ASSUME.messageMs;
  }
  return { doneMs: t, firstUsefulMs: passEnds[0] ?? 0, passEnds, frames, dropped, worstFrameMs: worst, workMs, jobs, frozen };
}

/** Total job time with nothing else in the way: what the search costs on one core. */
export const totalWorkMs = (s: Search, cfg: SearchCfg): number => simulateSearch(s, { ...cfg, workers: 1, levels: 1 }).workMs;

// ---- The whole wait: Modal cold start, mask, lift, search; and what the player sees ----
export type Warm = "none" | "page" | "early";
export const WARMS: { id: Warm; name: string; says: string }[] = [
  { id: "none", name: "No warm-up", says: "Each machine wakes when its own job is asked for." },
  { id: "page", name: "As the page does", says: "The finder wakes when the Make tab opens; the 3D maker when Segment is pressed." },
  { id: "early", name: "Both at the first hover", says: "Both machines wake as soon as the Make tab opens." },
];
export interface WaitCfg {
  coldS: number; // a Modal machine's cold start
  tabToPressS: number; // from opening the Make tab to pressing Segment Objects
  warm: Warm;
  searchEarly: boolean; // start the base lane search when Segment is pressed, not after the lift
  ack: boolean; // say "working" at once
  progress: boolean; // a panel with the step and the time left
  preview: boolean; // show a stand-in box while the lift runs, and the rough ghost while the search refines
  keepWorking: boolean; // the person can keep editing the course while we wait
}
export const DEFAULT_WAIT: WaitCfg = { coldS: 50, tabToPressS: 8, warm: "page", searchEarly: true, ack: true, progress: true, preview: true, keepWorking: true };
export const clampWait = (c: WaitCfg): WaitCfg => ({ ...c, coldS: Math.max(0, Math.min(120, c.coldS)), tabToPressS: Math.max(0, Math.min(60, c.tabToPressS)) });

export type UxState = "dead" | "told" | "useful";
export interface Seg { a: number; b: number; kind: string; label: string }
export interface UxSeg extends Seg { state: UxState }
export interface WaitOut {
  press: number; // ms on the clock where Segment Objects is pressed
  end: number; // ms where everything is ready
  compute: Seg[];
  ux: UxSeg[];
  search: SearchOut;
  searchStart: number;
  firstFeedbackMs: number; // after the press
  firstUsefulMs: number; // after the press
  totalMs: number; // after the press
  deadMs: number; // nothing new on the screen, nothing to do
  toldMs: number; // only a progress panel
  usefulMs: number; // something useful to see or do
  perceivedMs: number; // dead + told: time with nothing useful
  coldWaitMs: number; // cold start the person actually sat through (finder + 3D maker)
  dropped: number;
  worstFrameMs: number;
}

const S = 1000;
/** The first moment at or after `t` when the page is not frozen. */
function unfrozen(t: number, frozen: [number, number][]): number {
  let at = t;
  for (const [a, b] of [...frozen].sort((x, y) => x[0] - y[0])) if (at >= a && at < b) at = b;
  return at;
}

export function simulateWait(s: Search, searchIn: SearchCfg, waitIn: WaitCfg): WaitOut {
  const w = clampWait(waitIn), cold = w.coldS * S;
  const press = w.tabToPressS * S;
  const search = simulateSearch(s, searchIn);
  // wake times
  const fireFinder = w.warm === "none" ? press : 0;
  const finderReady = fireFinder + cold;
  const maskStart = Math.max(press, finderReady);
  const maskEnd = maskStart + REAL.segmentWarmS * S;
  const pickEnd = maskEnd + ASSUME.pickS * S;
  const fireLifter = w.warm === "none" ? pickEnd : w.warm === "page" ? press : 0;
  const lifterReady = fireLifter + cold;
  const liftStart = Math.max(pickEnd, lifterReady);
  const liftEnd = liftStart + REAL.pieceWarmS * S;
  const searchStart = w.searchEarly ? press : liftEnd;
  const searchEnd = searchStart + search.doneMs;
  const end = Math.max(liftEnd, searchEnd);

  const compute: Seg[] = [];
  if (cold > 0) {
    compute.push({ a: fireFinder, b: finderReady, kind: "wake", label: "Finder wakes" });
    compute.push({ a: fireLifter, b: lifterReady, kind: "wake", label: "3D maker wakes" });
  }
  compute.push({ a: maskStart, b: maskEnd, kind: "mask", label: "Cut-out (Segment Objects)" });
  compute.push({ a: liftStart, b: liftEnd, kind: "lift", label: "Lift to 3D" });
  compute.push({ a: searchStart, b: searchEnd, kind: "search", label: "Simulator search" });

  // frozen stretches are in search time: move them to the clock
  const frozen = search.frozen.map(([a, b]) => [a + searchStart, b + searchStart] as [number, number]);
  const roughAt = search.passEnds.length > 1 ? searchStart + search.firstUsefulMs : Infinity;

  // The UX lane: what the foreground wait is, stretch by stretch.
  const stages: { a: number; b: number; kind: "mask" | "pick" | "lift" | "tail"; label: string }[] = [
    { a: press, b: maskEnd, kind: "mask", label: "Waiting for the cut-out" },
    { a: maskEnd, b: pickEnd, kind: "pick", label: "You pick a cut-out" },
    { a: pickEnd, b: liftEnd, kind: "lift", label: "Waiting for the lift" },
  ];
  if (end > liftEnd) stages.push({ a: liftEnd, b: end, kind: "tail", label: "Waiting for the search" });
  const ux: UxSeg[] = [];
  const push = (a: number, b: number, state: UxState, label: string) => {
    if (b - a < 1) return;
    const last = ux[ux.length - 1];
    if (last && last.state === state && last.label === label && Math.abs(last.b - a) < 1) last.b = b; else ux.push({ a, b, state, kind: state, label });
  };
  for (const st of stages) {
    // cut each stage at the moments the screen changes: freeze stretches and the rough ghost
    const cuts = [st.a, st.b, ...frozen.flat(), roughAt].filter((x) => x >= st.a && x <= st.b).sort((x, y) => x - y);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1], mid = (a + b) / 2;
      const isFrozen = frozen.some(([fa, fb]) => mid >= fa && mid < fb);
      let state: UxState;
      if (isFrozen) state = "dead";
      else if (st.kind === "pick") state = "useful";
      else if (w.keepWorking) state = "useful";
      else if (st.kind === "lift" && w.preview) state = "useful";
      else if (st.kind === "tail" && w.preview && mid >= roughAt) state = "useful";
      else if (w.progress || w.ack) state = "told";
      else state = "dead";
      push(a, b, state, isFrozen ? "Page frozen" : st.label);
    }
  }
  // measures, all counted from the press
  const feedbackAt = unfrozen(press + (w.ack ? ASSUME.ackMs : w.progress ? ASSUME.progressMs : maskEnd - press), frozen);
  const firstResult = maskEnd;
  const firstUsefulAt = Math.min(firstResult, ux.find((u) => u.state === "useful" && u.label !== "You pick a cut-out")?.a ?? Infinity, feedbackAt + (w.keepWorking ? 1 : Infinity));
  const sum = (st: UxState) => ux.filter((u) => u.state === st).reduce((a, u) => a + (u.b - u.a), 0);
  const dead = sum("dead"), told = sum("told"), useful = sum("useful");
  const coldWaitMs = (maskStart - press) + (liftStart - pickEnd);
  return {
    press, end, compute, ux, search, searchStart,
    firstFeedbackMs: feedbackAt - press, firstUsefulMs: Math.max(0, Math.min(firstUsefulAt, firstResult) - press),
    totalMs: end - press, deadMs: dead, toldMs: told, usefulMs: useful, perceivedMs: dead + told, coldWaitMs,
    dropped: search.dropped, worstFrameMs: search.worstFrameMs,
  };
}

// ---- The challenges: hard checks, each run in its own fixed scene so a knob cannot cheat it ----
export const SCENE = { coldS: 50, tabToPressS: 8, cacheHit: 0, slow: 1 };
export interface Challenge { id: string; title: string; rule: string; pass: boolean; got: string; want: string }

/** The least wall time the search can have with no frame over 16.7 ms and no early/cache help changed: tries every worker count and slice size. */
export function bestSafeSearch(s: Search, slow = 1): { doneMs: number; workers: number; sliceMs: number } {
  let best = { doneMs: Infinity, workers: 0, sliceMs: 0 };
  for (let n = 0; n <= ASSUME.maxWorkers; n++) {
    for (const sliceMs of n === 0 ? [1, 2, 4, 6, 8, 10, 12] : [0]) {
      const o = simulateSearch(s, { ...DEFAULT_SEARCH, workers: n, slice: true, sliceMs: sliceMs || 8, cacheHit: 0, earlyExit: true, levels: 1, slow });
      if (o.dropped === 0 && o.worstFrameMs <= ASSUME.frameMs && o.doneMs < best.doneMs) best = { doneMs: o.doneMs, workers: n, sliceMs };
    }
  }
  return best;
}

export function challenges(s: Search, search: SearchCfg, wait: WaitCfg): Challenge[] {
  const fixedSearch: SearchCfg = { ...search, cacheHit: SCENE.cacheHit, slow: SCENE.slow };
  const fixedWait: WaitCfg = { ...wait, coldS: SCENE.coldS, tabToPressS: SCENE.tabToPressS };
  const o = simulateWait(s, fixedSearch, fixedWait);
  const so = simulateSearch(s, fixedSearch);
  const best = bestSafeSearch(s, SCENE.slow);
  const r1 = (x: number) => (Math.round(x * 10) / 10).toString();
  return [
    { id: "feedback", title: "Answer the press", rule: "The first word on the screen comes in under 300 ms.", pass: o.firstFeedbackMs < 300, got: `${Math.round(o.firstFeedbackMs)} ms`, want: "under 300 ms" },
    { id: "smooth", title: "Keep the page smooth", rule: "While the search runs, no frame costs more than 16.7 ms.", pass: so.worstFrameMs <= ASSUME.frameMs && so.dropped === 0, got: `worst frame ${r1(so.worstFrameMs)} ms, ${so.dropped} dropped`, want: "16.7 ms, 0 dropped" },
    { id: "fastest", title: "Fastest safe search", rule: "Smooth, and within 15% of the least wall time any safe setting gives on this course.", pass: so.worstFrameMs <= ASSUME.frameMs && so.dropped === 0 && so.doneMs <= best.doneMs * 1.15 + 1e-9, got: `${Math.round(so.doneMs)} ms`, want: `${Math.round(best.doneMs * 1.15)} ms or less (best ${Math.round(best.doneMs)} ms)` },
    { id: "cold", title: "Hide the cold start", rule: `With a ${SCENE.coldS} s cold start: all done within 110 s of the press, and something useful to see or do for 80% of it.`, pass: o.totalMs <= 110 * S && o.usefulMs >= 0.8 * o.totalMs, got: `${r1(o.totalMs / S)} s, useful ${Math.round((100 * o.usefulMs) / o.totalMs)}%`, want: "110 s, 80%" },
  ];
}
