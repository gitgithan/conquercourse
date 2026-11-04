import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TICKS_PER_WORK_SECOND, searchIdealRun } from "../src/sim/ideal";
import { recordSearch } from "../src/labs/wait/record";
import { ASSUME, DEFAULT_SEARCH, DEFAULT_WAIT, REAL, SCENE, bestSafeSearch, challenges, simulateSearch, simulateWait, strides, unpack, type RecCourse, type Search, type SearchCfg, type WaitCfg } from "../src/labs/wait/core";
import { loadCourseFile } from "./helpers/course";

// Hide the wait: the scheduler is pinned by laws (work is conserved, no frame goes over its slice, speed-ups are bounded) and the recorded jobs are the real search's.
const file = JSON.parse(readFileSync("public/assets/lab/wait-recorded.json", "utf8")) as { courses: RecCourse[] };
const by = (id: string): Search => unpack(file.courses.find((c) => c.id === id)!);
const trap = by("trap"), rail = by("rail"), bars = by("bars");
const total = (s: Search, early = true) => s.batches.reduce((a, b) => a + (early && b.stopAt >= 0 ? b.ticks.slice(0, b.stopAt + 1) : b.ticks).reduce((x, y) => x + y, 0), 0) / REAL.ticksPerMs;
const cfg = (c: Partial<SearchCfg> = {}): SearchCfg => ({ ...DEFAULT_SEARCH, ...c });
const wcfg = (c: Partial<WaitCfg> = {}): WaitCfg => ({ ...DEFAULT_WAIT, ...c });

describe("the recorded search is the real one", () => {
  it("ticks per millisecond is the game's work-second", () => expect(REAL.ticksPerMs * 1000).toBe(TICKS_PER_WORK_SECOND));
  it("the trap chain and the rail run record again exactly as stored, and give the game's own plan", () => {
    for (const [id, url, s] of [["trap", "public/assets/lab/search-trap.course.json", trap], ["rail", "public/assets/demo/park-rail-run.course.json", rail]] as const) {
      const course = loadCourseFile(url);
      const rec = recordSearch(course, true);
      expect(rec.batches.map((b) => b.ticks), id).toEqual(s.batches.map((b) => b.ticks));
      expect(rec.planKey, id).toBe(JSON.stringify(searchIdealRun(course).plan));
      expect(rec.cleared).toBe(true);
    }
  });
  it("early exit never changes the answer and only removes work (the bars course)", () => {
    const stopped = bars.batches.filter((b) => b.stopAt >= 0);
    expect(stopped.length).toBeGreaterThan(0);
    expect(total(bars, true)).toBeLessThan(total(bars, false) / 3);
    for (const b of stopped) expect(b.stopAt).toBeLessThan(b.ticks.length);
    const o1 = simulateSearch(bars, cfg({ workers: 1, earlyExit: true })), o2 = simulateSearch(bars, cfg({ workers: 1, earlyExit: false }));
    expect(o1.jobs).toBeLessThan(o2.jobs);
    expect(o1.doneMs).toBeLessThan(o2.doneMs);
  });
  it("inside one search almost nothing repeats, so the cache pays on the next visit", () => {
    for (const c of file.courses) expect(c.dupJobs / c.jobsRun).toBeLessThan(0.05);
  });
});

describe("the frame-budget scheduler", () => {
  it("conserves work: every job is run once, whatever the knobs", () => {
    for (const s of [trap, rail]) for (const c of [cfg({ workers: 0 }), cfg({ workers: 0, slice: false }), cfg({ workers: 1 }), cfg({ workers: 4 }), cfg({ workers: 8, slow: 2 })]) {
      expect(simulateSearch(s, c).workMs).toBeCloseTo(total(s) * c.slow, 6);
    }
  });
  it("a slice never starts more work than its budget plus one job", () => {
    const maxJob = Math.max(...rail.batches.flatMap((b) => b.ticks)) / REAL.ticksPerMs;
    for (const sliceMs of [1, 4, 8, 12, 20]) {
      const o = simulateSearch(rail, cfg({ sliceMs }));
      for (const f of o.frames) expect(f.work).toBeLessThan(sliceMs + maxJob + 1e-9);
      expect(o.frames.reduce((a, f) => a + f.work, 0)).toBeCloseTo(o.workMs, 6);
      expect(o.worstFrameMs).toBeLessThanOrEqual(ASSUME.renderMs + sliceMs + maxJob + 1e-9);
    }
  });
  it("a small slice keeps every frame inside 16.7 ms; a big one drops frames", () => {
    const small = simulateSearch(rail, cfg({ sliceMs: 6 }));
    expect(small.worstFrameMs).toBeLessThanOrEqual(ASSUME.frameMs);
    expect(small.dropped).toBe(0);
    expect(simulateSearch(rail, cfg({ sliceMs: 30 })).dropped).toBeGreaterThan(0);
  });
  it("all at once freezes the page for as long as the work takes", () => {
    const o = simulateSearch(bars, cfg({ slice: false }));
    expect(o.frames.length).toBe(1);
    expect(o.dropped).toBeGreaterThan(300);
    expect(o.frozen.length).toBe(1);
    expect(o.doneMs).toBeGreaterThanOrEqual(total(bars));
  });
  it("a smaller slice costs wall time, never gives a faster answer", () => {
    const a = simulateSearch(rail, cfg({ sliceMs: 2 })).doneMs, b = simulateSearch(rail, cfg({ sliceMs: 12 })).doneMs;
    expect(a).toBeGreaterThanOrEqual(b);
  });
  it("workers: the speed-up is at least 1 and never more than the number of workers", () => {
    for (const s of [trap, rail, bars]) {
      const one = simulateSearch(s, cfg({ workers: 1 })).doneMs;
      for (let n = 1; n <= ASSUME.maxWorkers; n++) {
        const gain = one / simulateSearch(s, cfg({ workers: n })).doneMs;
        expect(gain).toBeLessThanOrEqual(n + 1e-9);
        expect(gain).toBeGreaterThan(0.95);
      }
      expect(simulateSearch(s, cfg({ workers: 8 })).doneMs).toBeLessThan(one);
    }
  });
  it("workers keep the page's own thread free", () => {
    const o = simulateSearch(rail, cfg({ workers: 4 }));
    expect(o.worstFrameMs).toBeLessThan(ASSUME.frameMs);
    expect(o.dropped).toBe(0);
  });
  it("the pool gain on the real record sits inside what CC-70 measured (5 to 14 times with 8 or more workers is the ceiling, so 8 here is below it)", () => {
    const gain = simulateSearch(rail, cfg({ workers: 1 })).doneMs / simulateSearch(rail, cfg({ workers: 8 })).doneMs;
    expect(gain).toBeGreaterThan(REAL.oneThreadGain[0]);
    expect(gain).toBeLessThan(REAL.poolGain[1]);
  });
  it("a cache hit rate p removes that share of the work and nothing else", () => {
    const full = simulateSearch(rail, cfg({ workers: 1 })).workMs;
    let last = full;
    for (const p of [0.25, 0.5, 0.9]) {
      const w = simulateSearch(rail, cfg({ workers: 1, cacheHit: p })).workMs;
      expect(w).toBeLessThan(last);
      expect(w).toBeGreaterThan((1 - p) * full * 0.9);
      expect(w).toBeLessThan((1 - p) * full * 1.1 + 756 * ASSUME.lookupMs);
      last = w;
    }
    expect(simulateSearch(rail, cfg({ cacheHit: 1 })).workMs).toBeCloseTo(756 * ASSUME.lookupMs, 6);
  });
  it("coarse-to-fine: the first answer comes early, the whole costs at most a third more", () => {
    expect(strides(3)).toEqual([16, 4, 1]);
    const one = simulateSearch(rail, cfg({ workers: 1 }));
    expect(one.firstUsefulMs).toBe(one.doneMs);
    let prev = one;
    for (const L of [2, 3, 4]) {
      const o = simulateSearch(rail, cfg({ workers: 1, levels: L }));
      expect(o.firstUsefulMs).toBeLessThan(prev.firstUsefulMs);
      expect(o.passEnds.length).toBe(L);
      expect(o.workMs).toBeGreaterThan(one.workMs);
      expect(o.workMs).toBeLessThan(one.workMs * (4 / 3) + 40);
      prev = o;
    }
  });
  it("a slower machine scales every time by the same factor", () => {
    const a = simulateSearch(rail, cfg({ workers: 2 })).doneMs, b = simulateSearch(rail, cfg({ workers: 2, slow: 3 })).workMs;
    expect(b).toBeCloseTo(3 * total(rail), 6);
    expect(a).toBeGreaterThan(0);
  });
  it("is deterministic", () => expect(simulateSearch(bars, cfg({ workers: 3, cacheHit: 0.3, levels: 2 }))).toEqual(simulateSearch(bars, cfg({ workers: 3, cacheHit: 0.3, levels: 2 }))));
});

describe("the whole wait", () => {
  it("with no warm-up the person sits through two cold starts; the page's warm-up hides the 3D maker's and part of the finder's", () => {
    const none = simulateWait(trap, cfg(), wcfg({ warm: "none", coldS: 50 }));
    const page = simulateWait(trap, cfg(), wcfg({ warm: "page", coldS: 50, tabToPressS: 8 }));
    const early = simulateWait(trap, cfg(), wcfg({ warm: "early", coldS: 50, tabToPressS: 8 }));
    expect(none.coldWaitMs).toBeCloseTo(100_000, 0);
    expect(page.coldWaitMs).toBeCloseTo(42_000, 0);
    expect(early.coldWaitMs).toBeCloseTo(42_000, 0);
    expect(page.totalMs).toBeLessThan(none.totalMs);
  });
  it("no cold start, no cold wait", () => expect(simulateWait(trap, cfg(), wcfg({ coldS: 0 })).coldWaitMs).toBe(0));
  it("a warm-up fired earlier never makes the total longer", () => {
    for (const lead of [0, 4, 8, 20, 40]) {
      const a = simulateWait(trap, cfg(), wcfg({ warm: "none", tabToPressS: lead })).totalMs, b = simulateWait(trap, cfg(), wcfg({ warm: "page", tabToPressS: lead })).totalMs, c = simulateWait(trap, cfg(), wcfg({ warm: "early", tabToPressS: lead })).totalMs;
      expect(b).toBeLessThanOrEqual(a); expect(c).toBeLessThanOrEqual(b);
    }
  });
  it("a warm run with no cold start is the recorded 18 s + 4 s pick + 32 s", () => {
    const o = simulateWait(trap, cfg({ workers: 4 }), wcfg({ coldS: 0, searchEarly: true }));
    expect(o.totalMs).toBeCloseTo((REAL.segmentWarmS + ASSUME.pickS + REAL.pieceWarmS) * 1000, 0);
  });
  it("the full cold run lands near the recorded first-piece times (90 to 100 s for one machine)", () => {
    const o = simulateWait(trap, cfg({ workers: 4 }), wcfg({ coldS: 50, warm: "none", tabToPressS: 0 }));
    const lifterOnly = (o.totalMs - 50_000) / 1000;
    expect(lifterOnly).toBeGreaterThan(REAL.firstPieceColdS[0] - 10);
    expect(lifterOnly).toBeLessThan(REAL.firstPieceColdS[1] + 40);
  });
  it("the UX lane covers the wait exactly once: dead + told + useful = total", () => {
    for (const w of [wcfg(), wcfg({ keepWorking: false }), wcfg({ keepWorking: false, preview: false, progress: false, ack: false }), wcfg({ warm: "none", searchEarly: false })]) {
      for (const sc of [cfg(), cfg({ slice: false }), cfg({ workers: 4, levels: 2 })]) {
        const o = simulateWait(bars, sc, w);
        expect(o.deadMs + o.toldMs + o.usefulMs).toBeCloseTo(o.totalMs, 3);
        expect(o.perceivedMs).toBeCloseTo(o.deadMs + o.toldMs, 6);
        expect(o.ux[0].a).toBeCloseTo(o.press, 3); expect(o.ux[o.ux.length - 1].b).toBeCloseTo(o.end, 3);
        for (let i = 1; i < o.ux.length; i++) expect(o.ux[i].a).toBeCloseTo(o.ux[i - 1].b, 3);
      }
    }
  });
  it("showing things never makes the wait longer, only less empty", () => {
    const bare = simulateWait(trap, cfg(), wcfg({ ack: false, progress: false, preview: false, keepWorking: false }));
    const full = simulateWait(trap, cfg(), wcfg());
    expect(full.totalMs).toBeCloseTo(bare.totalMs, 3);
    expect(full.deadMs).toBeLessThan(bare.deadMs);
    expect(full.usefulMs).toBeGreaterThan(bare.usefulMs);
    expect(bare.deadMs).toBeCloseTo(bare.totalMs - (ASSUME.pickS * 1000), 0);
  });
  it("first feedback: an answer at once is 50 ms; with nothing, it is the first result", () => {
    expect(simulateWait(trap, cfg(), wcfg({ ack: true })).firstFeedbackMs).toBe(ASSUME.ackMs);
    expect(simulateWait(trap, cfg(), wcfg({ ack: false, progress: true })).firstFeedbackMs).toBe(ASSUME.progressMs);
    const none = simulateWait(trap, cfg(), wcfg({ ack: false, progress: false, warm: "none" }));
    expect(none.firstFeedbackMs).toBeGreaterThan(50_000);
  });
  it("a frozen page cannot answer: the feedback waits for the freeze to end, and the freeze is dead time", () => {
    const o = simulateWait(bars, cfg({ slice: false }), wcfg({ searchEarly: true }));
    expect(o.firstFeedbackMs).toBeGreaterThan(1000);
    expect(o.ux.some((u) => u.label === "Page frozen" && u.state === "dead")).toBe(true);
    expect(simulateWait(bars, cfg({ workers: 4 }), wcfg({ searchEarly: true })).firstFeedbackMs).toBe(ASSUME.ackMs);
  });
  it("starting the search early overlaps it with the Modal wait", () => {
    const late = simulateWait(bars, cfg({ workers: 4 }), wcfg({ searchEarly: false })), early = simulateWait(bars, cfg({ workers: 4 }), wcfg({ searchEarly: true }));
    expect(early.totalMs).toBeLessThanOrEqual(late.totalMs);
    expect(late.totalMs).toBeGreaterThan(early.totalMs - 1);
  });
  it("the rough ghost makes the wait after the lift useful before the search is done", () => {
    const a = simulateWait(bars, cfg({ workers: 1, levels: 1 }), wcfg({ keepWorking: false, searchEarly: false })), b = simulateWait(bars, cfg({ workers: 1, levels: 3 }), wcfg({ keepWorking: false, searchEarly: false }));
    expect(b.usefulMs).toBeGreaterThan(a.usefulMs);
  });
});

describe("the challenges", () => {
  const byId = (s: Search, c: SearchCfg, w: WaitCfg) => Object.fromEntries(challenges(s, c, w).map((x) => [x.id, x]));
  it("the Lab's own setting passes the first and the last; the plain one-thread setting is smooth but not the fastest", () => {
    const ch = byId(rail, cfg(), wcfg());
    expect(ch.feedback.pass).toBe(true); expect(ch.cold.pass).toBe(true); expect(ch.smooth.pass).toBe(true);
    expect(ch.fastest.pass).toBe(false);
  });
  it("workers and early exit pass the fastest-safe-search check on every course", () => {
    for (const s of [trap, rail, bars]) expect(byId(s, cfg({ workers: 8 }), wcfg()).fastest.pass, s.id).toBe(true);
  });
  it("a frozen page fails the smooth check; no feedback and no warm-up fail their checks", () => {
    expect(byId(rail, cfg({ slice: false }), wcfg()).smooth.pass).toBe(false);
    expect(byId(rail, cfg(), wcfg({ ack: false, progress: false })).feedback.pass).toBe(false);
    expect(byId(rail, cfg(), wcfg({ warm: "none", keepWorking: false, preview: false })).cold.pass).toBe(false);
  });
  it("a knob outside the scene cannot cheat a check (cache, machine speed and cold length are fixed)", () => {
    const a = challenges(rail, cfg({ cacheHit: 1, slow: 0.25 }), wcfg({ coldS: 0, tabToPressS: 60 })), b = challenges(rail, cfg(), wcfg());
    expect(a.map((x) => x.got)).toEqual(b.map((x) => x.got));
    expect(SCENE.cacheHit).toBe(0);
  });
  it("the best safe search is a real optimum: nothing in the grid beats it", () => {
    const best = bestSafeSearch(rail);
    for (let n = 0; n <= 8; n++) {
      const o = simulateSearch(rail, cfg({ workers: n, sliceMs: 6 }));
      if (o.dropped === 0 && o.worstFrameMs <= ASSUME.frameMs) expect(o.doneMs).toBeGreaterThanOrEqual(best.doneMs - 1e-9);
    }
  });
});
