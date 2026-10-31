import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { playPlan } from "../src/sim/ideal";
import { DEFAULT_TIMING, binIndex, cdf, clampTiming, measureWindows, pressSpeeds, playMoved, predictedRate, prepare, rateForWidth, rng, runTiming, sampleJitter, widthFor, wilson, type TimingConfig } from "../src/labs/timing/core";

// Lab 7 (statistics of timing): the simulator is the real one; the random source is seeded.
const load = (p: string) => JSON.parse(readFileSync(p, "utf8")) as CourseData;
const trap = load("public/assets/lab/search-trap.course.json");
const lane = load("public/assets/demo/lane-1.course.json");
const run = (c: Partial<TimingConfig>, course = trap) => runTiming(course, { ...DEFAULT_TIMING, ...c })!;

describe("Lab 7: statistics of timing", () => {
  it("presses on time clear exactly as the plan does", () => {
    for (const c of [trap, lane]) {
      const sp = pressSpeeds(c, c.plan!);
      expect(sp.length).toBe(c.plan!.jumpXs.length);
      for (const v of sp) expect(v).toBeGreaterThan(3);
      expect(playMoved(c, c.plan!, sp, sp.map(() => 0)).cleared).toBe(playPlan(c, c.plan!).world.outcome === "cleared");
    }
  });
  it("a press far too early or too late loses the run", () => {
    const sp = pressSpeeds(trap, trap.plan!);
    for (const off of [-500, 500]) expect(playMoved(trap, trap.plan!, sp, sp.map((_, i) => (i === 0 ? off : 0))).cleared).toBe(false);
  });
  it("measured windows contain the ideal press and are a few tens of milliseconds wide", () => {
    const p = prepare(trap)!;
    for (const w of p.windows) { expect(w.loMs).toBeLessThan(0); expect(w.hiMs).toBeGreaterThan(0); expect(w.widthMs).toBeGreaterThan(20); expect(w.widthMs).toBeLessThan(1500); }
  });
  it("zero jitter clears every run", () => {
    const r = run({ sigmaMs: 0, runs: 30 });
    expect(r.clears).toBe(30);
  });
  it("more jitter never clears more often (one seed, many runs)", () => {
    const rates = [0, 30, 80, 200].map((s) => run({ sigmaMs: s, runs: 300 }).rate);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeLessThanOrEqual(rates[i - 1] + 0.02);
    expect(rates[0]).toBe(1);
    expect(rates[3]).toBeLessThan(0.5);
  });
  it("is deterministic: the same seed gives the same numbers, another seed differs", () => {
    const a = JSON.stringify(run({ sigmaMs: 60, runs: 120, seed: 3 }));
    expect(JSON.stringify(run({ sigmaMs: 60, runs: 120, seed: 3 }))).toBe(a);
    expect(JSON.stringify(run({ sigmaMs: 60, runs: 120, seed: 4 }))).not.toBe(a);
  });
  it("the simulated rate agrees with the maths (product of window chances) inside the interval", () => {
    for (const dist of ["uniform", "normal", "heavy"] as const) {
      const r = run({ sigmaMs: 50, dist, runs: 600 }, lane);
      expect(r.predicted).toBeGreaterThanOrEqual(r.ci.lo - 0.06);
      expect(r.predicted).toBeLessThanOrEqual(r.ci.hi + 0.06);
    }
  });
  it("failures are blamed on a press that was off, almost never on one made on time", () => {
    const r = run({ sigmaMs: 90, runs: 300 });
    expect(r.clears).toBeLessThan(r.runs);
    expect(r.failHist.reduce((a, b) => a + b, 0) + r.failsNoPress).toBe(r.runs - r.clears);
    expect(r.failHist[binIndex(0)] + r.failHist[binIndex(-1)]).toBeLessThanOrEqual(Math.ceil(0.05 * (r.runs - r.clears))); // almost no failure comes from a press made on time
  });
  it("jitter has the stated standard deviation and the heavy tail has more far values", () => {
    const sd = (dist: "uniform" | "normal" | "heavy", far: number): [number, number] => {
      const u = rng(11); const xs = Array.from({ length: 40000 }, () => sampleJitter(dist, 50, u));
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      return [Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length), xs.filter((x) => Math.abs(x) > far).length / xs.length];
    };
    expect(sd("uniform", 200)[0]).toBeGreaterThan(47); expect(sd("uniform", 200)[0]).toBeLessThan(53);
    expect(sd("normal", 200)[0]).toBeGreaterThan(47); expect(sd("normal", 200)[0]).toBeLessThan(53);
    expect(sd("heavy", 200)[1]).toBeGreaterThan(sd("normal", 200)[1] * 5);
  });
  it("the cdf matches sampling", () => {
    for (const dist of ["uniform", "normal", "heavy"] as const) {
      const u = rng(5); const xs = Array.from({ length: 40000 }, () => sampleJitter(dist, 50, u));
      for (const x of [-60, 0, 40, 90]) expect(Math.abs(xs.filter((v) => v <= x).length / xs.length - cdf(dist, 50, x))).toBeLessThan(0.012);
    }
  });
  it("the width for a target rate inverts the rate for a width", () => {
    for (const dist of ["uniform", "normal", "heavy"] as const) for (const n of [1, 3, 7]) for (const t of [0.5, 0.9]) {
      const w = widthFor(dist, 40, n, t);
      expect(rateForWidth(dist, 40, n, w)).toBeCloseTo(t, 3);
    }
    expect(widthFor("normal", 40, 3, 0.9)).toBeGreaterThan(widthFor("normal", 40, 3, 0.5));
    expect(widthFor("normal", 40, 7, 0.9)).toBeGreaterThan(widthFor("normal", 40, 1, 0.9));
  });
  it("Wilson interval holds the rate, narrows with N, and stays inside 0..1", () => {
    const a = wilson(30, 100), b = wilson(300, 1000);
    expect(a.lo).toBeLessThan(0.3); expect(a.hi).toBeGreaterThan(0.3);
    expect(b.hi - b.lo).toBeLessThan(a.hi - a.lo);
    expect(wilson(0, 10).lo).toBe(0); expect(wilson(10, 10).hi).toBe(1);
    expect(predictedRate("normal", 0, [{ loMs: -10, hiMs: 10 }])).toBe(1);
  });
  it("keeps the choices in range", () => {
    const c = clampTiming({ sigmaMs: 9999, dist: "normal", runs: 1, seed: -1 });
    expect([c.sigmaMs, c.runs]).toEqual([400, 10]);
  });
  it("measureWindows is the same as a direct check", () => {
    const sp = pressSpeeds(trap, trap.plan!);
    const w = measureWindows(trap, trap.plan!, sp)[0];
    const at = (t: number) => playMoved(trap, trap.plan!, sp, sp.map((_, i) => (i === 0 ? t : 0))).cleared;
    expect(at(w.hiMs - 2)).toBe(true); expect(at(w.hiMs + 2)).toBe(false);
    expect(at(w.loMs + 2)).toBe(true); expect(at(w.loMs - 2)).toBe(false);
  });
});
