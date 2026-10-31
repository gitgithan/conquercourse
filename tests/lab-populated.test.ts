import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { computeGentest, computeRl, computeTiming } from "../scripts/labs-default-precompute";

// Every Lab opens already run (owner, 2026-11-01). The three slow Labs ship a precomputed result; these tests re-run the same code and
// check the file has not drifted. The other nine run live on open; their source must announce it (the browser smoke checks the pixels).
const file = (n: string) => `public/assets/lab/${n}-default.json`;
const load = (n: string) => JSON.parse(readFileSync(file(n), "utf8"));
const strip = (o: unknown) => JSON.parse(JSON.stringify(o, (k, v) => (k === "wallMs" ? undefined : v)));

describe("Labs open already run", () => {
  for (const n of ["timing", "gentest", "rl"]) {
    it(`${n}: the precomputed file is small and pretty-printed`, () => {
      expect(existsSync(file(n))).toBe(true);
      expect(statSync(file(n)).size).toBeLessThanOrEqual(300 * 1024);
      const text = readFileSync(file(n), "utf8");
      expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2) + "\n");
    });
  }
  it("timing: the file equals a fresh run of the same code", () => { expect(strip(computeTiming())).toEqual(strip(load("timing"))); }, 120000);
  it("rl: the file equals a fresh run of the same code", () => { expect(strip(computeRl())).toEqual(strip(load("rl"))); }, 120000);
  it("gentest: the first verdicts equal a fresh run of the same code", () => {
    const fresh = computeGentest(2).verdicts, shipped = load("gentest").verdicts.slice(0, 2);
    const key = (v: { id: string; firstClear: boolean; cleared: boolean; repairsUsed: number }) => [v.id, v.firstClear, v.cleared, v.repairsUsed];
    expect(fresh.map(key)).toEqual(shipped.map(key));
  }, 120000);
  it("gentest: our setting is the recorded ideas with repairs on, and nothing is empty", () => {
    const d = load("gentest");
    expect(d.cfg.source).toBe("recorded"); expect(d.cfg.repairs).toBeGreaterThan(0);
    expect(d.verdicts.length).toBe(d.cfg.limit); expect(d.tally.tested).toBe(d.cfg.limit);
  });
  it("timing and rl: results hold numbers, not placeholders", () => {
    const t = load("timing"); expect(t.result.runs).toBe(t.cfg.runs); expect(t.curve.length).toBe(t.sweep.length);
    const r = load("rl"); expect(r.result.blocks.length).toBeGreaterThan(0); expect(r.found.length).toBeGreaterThan(0); expect(r.strip.length).toBeGreaterThan(0);
  });
  it("every Lab source announces its default and its populated moment", () => {
    for (const lab of ["search", "optimization", "ik", "vision", "camera", "integration", "timing", "signal", "gentest", "detector", "hashing", "rl"]) {
      const src = readFileSync(`src/modes/lab-${lab}.ts`, "utf8");
      expect(src, lab).toContain("labDefaultNote(");
      expect(src, lab).toContain(`labPopulated("lab-${lab}")`);
    }
  });
});
