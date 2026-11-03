import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILTERS, noiseGain, addNoise, applyForTest, cutoffHz, expAlpha, filterSeries, gameSmoothing, kernel, lagFrames, mulberry32, runGate, runSignalLab, DEFAULT_CHOICE, type FilterKind, type Frames, type SignalClip } from "../src/lab/signal-lab";
import { loadClipJson } from "./helpers/clips";

// Lab 8 (Signal processing): the filter laws, then the TypeScript gate against the numbers the Python gate printed.
const load = (n: string) => loadClipJson<SignalClip>(n);
const clips: Record<string, SignalClip> = { run: load("run"), leap: load("leap"), vault: load("vault") };
const KINDS: FilterKind[] = ["average", "triangle", "savgol", "exponential"];
const ref = JSON.parse(readFileSync("tests/fixtures/lab-signal-reference.json", "utf8")) as { cases: any[] };

describe("filter laws", () => {
  it("window kernels sum to 1 (a flat line stays flat)", () => {
    for (const k of ["average", "triangle", "savgol"] as const) for (let h = 1; h <= 8; h++) expect(kernel(k, h).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it("the game's smoothing is the 1-2-3-2-1 triangle", () => {
    expect(kernel("triangle", 2).map((v) => Math.round(v * 9))).toEqual([1, 2, 3, 2, 1]);
  });
  it("every filter keeps a constant exactly and strength 0 changes nothing", () => {
    for (const k of KINDS) {
      expect(filterSeries(new Array(20).fill(3.5), k, 4).every((v) => Math.abs(v - 3.5) < 1e-12)).toBe(true);
      const x = [0, 1, 4, 9, 16, 25];
      expect(filterSeries(x, k, 0)).toEqual(x);
    }
  });
  it("symmetric windows keep a straight line (away from the ends); the curve fit also keeps a parabola", () => {
    const line = Array.from({ length: 30 }, (_, i) => 2 + 0.5 * i), par = Array.from({ length: 30 }, (_, i) => 1 + 0.3 * i - 0.04 * i * i);
    for (const k of ["average", "triangle", "savgol"] as const) {
      const y = filterSeries(line, k, 3);
      for (let i = 3; i < 27; i++) expect(y[i]).toBeCloseTo(line[i], 9);
    }
    const p = filterSeries(par, "savgol", 3);
    for (let i = 3; i < 27; i++) expect(p[i]).toBeCloseTo(par[i], 9);
    const a = filterSeries(par, "average", 3);
    expect(Math.abs(a[10] - par[10])).toBeGreaterThan(0.01); // an average flattens the curve
  });
  it("the live one-pole filter lags a ramp by (1 - a) / a frames; window filters do not lag", () => {
    const ramp = Array.from({ length: 80 }, (_, i) => i);
    for (const s of [2, 4, 6]) {
      const a = expAlpha(s), y = filterSeries(ramp, "exponential", s);
      expect(ramp[70] - y[70]).toBeCloseTo((1 - a) / a, 2);
    }
    expect(filterSeries(ramp, "triangle", 4)[40]).toBeCloseTo(40, 9);
  });
  it("a stronger filter lets through less noise and has a lower cut-off", () => {
    const clip = clips.leap;
    for (const k of KINDS) {
      const noisy = addNoise(clip.frames, 2);
      let prevNoise = Infinity, prevCut = Infinity;
      for (const s of [2, 4, 6]) {
        const r = runSignalLab(clip, { ...DEFAULT_CHOICE, kind: k, strength: s, noiseCm: 2 });
        expect(r.noiseLeftCm).toBeLessThan(prevNoise);
        prevNoise = r.noiseLeftCm;
        const c = cutoffHz(k, s, 30)!;
        expect(c).toBeLessThan(prevCut);
        prevCut = c;
      }
      expect(noisy.length).toBe(clip.frames.length);
    }
  });
  it("only the live filter lags; the window filters shift nothing", () => {
    const clip = clips.run;
    const lag = (k: FilterKind) => runSignalLab(clip, { ...DEFAULT_CHOICE, kind: k, strength: 4, noiseCm: 0 }).lagMs;
    expect(Math.abs(lag("average"))).toBeLessThan(5);
    expect(Math.abs(lag("savgol"))).toBeLessThan(5);
    expect(lag("exponential")).toBeGreaterThan(80); // (1-a)/a = 4 frames at 30 fps, minus the clip's own curvature
    expect(lagFrames(clip.frames, clip.frames)).toBe(0);
  });
  it("white noise comes out smaller by the square root of the summed squared weights", () => {
    const rnd = mulberry32(7);
    const x = Array.from({ length: 20000 }, () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd()));
    const sd = (v: number[]) => Math.sqrt(v.reduce((a, b) => a + b * b, 0) / v.length);
    for (const k of KINDS) for (const s of [2, 5]) expect(sd(filterSeries(x, k, s)) / sd(x)).toBeCloseTo(noiseGain(k, s), 1);
  });
  it("the same choices give the same numbers twice (the noise is seeded)", () => {
    const a = JSON.stringify(runSignalLab(clips.vault, DEFAULT_CHOICE).gateFiltered), b = JSON.stringify(runSignalLab(clips.vault, DEFAULT_CHOICE).gateFiltered);
    expect(a).toBe(b);
    expect(mulberry32(1)()).toBe(mulberry32(1)());
  });
  it("filters name four kinds, each with a sentence", () => {
    expect(FILTERS.map((f) => f.kind).sort()).toEqual([...KINDS].sort());
    for (const f of FILTERS) expect(f.about.length).toBeGreaterThan(40);
  });
});

describe("the gate and the filters agree with the Python reference", () => {
  it("has the cases", () => expect(ref.cases.length).toBeGreaterThan(25));
  it("matches every case: noise, filter, bones, then every gate number", () => {
    for (const c of ref.cases) {
      const clip = clips[c.clip];
      const f: Frames = applyForTest(clip, c.kind, c.strength, c.noiseCm, c.fixBones);
      const sum = f.reduce((a, fr) => a + fr.reduce((b, p) => b + p[0] + p[1] + p[2], 0), 0);
      expect(sum, `${c.clip} ${c.kind} ${c.strength} sum`).toBeCloseTo(c.sum, 4);
      c.hipsY.forEach((v: number, i: number) => expect(f[[0, 10, 20, 30][i]][0][1]).toBeCloseTo(v, 5));
      const r = runGate({ frames: f, fps: clip.fps, supportedBy: clip.supportedBy });
      const all = { ...r.hard, ...r.soft };
      expect(r.pass, `${c.clip} ${c.kind} ${c.strength} pass`).toBe(c.pass);
      for (const [k, v] of Object.entries(c.values) as [string, number | null][]) {
        const got = all[k]?.value ?? null;
        expect(got === null, `${c.clip} ${c.kind} ${c.strength} ${k} null`).toBe(v === null);
        if (v !== null) expect(got!, `${c.clip} ${c.kind} ${c.strength} ${k}`).toBeCloseTo(v, 3);
        expect(all[k].ok, `${c.clip} ${c.kind} ${c.strength} ${k} ok`).toBe(c.oks[k]);
      }
    }
  });
  it("the game's smoothing keeps every bone one length", () => {
    const g = gameSmoothing(clips.leap);
    const r = runGate({ frames: g, fps: clips.leap.fps });
    expect(r.soft.bones_keep_length.value!).toBeLessThan(1e-6);
  });
  it("no motion is shown unless it passes: heavy noise fails the gate, and the lab says which rule", () => {
    const r = runSignalLab(clips.run, { ...DEFAULT_CHOICE, kind: "triangle", strength: 2, noiseCm: 4, fixBones: true });
    expect(r.gateFiltered.pass).toBe(false);
  });
  it("the shipped clips pass the gate unfiltered", () => {
    for (const n of Object.keys(clips)) expect(runGate({ frames: clips[n].frames, fps: clips[n].fps, supportedBy: clips[n].supportedBy }).pass).toBe(true);
  });
});
