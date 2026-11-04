import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BINS, CARDS, FINDER_ITEMS, GAME_LIMIT, GATE_ROWS, STAGES, allBest, cheapestSafe, confusion, finderCut, flagged, isSafe, judge, ourSorting, ratioOf, scoreSort, sweep, totalCalls } from "../src/labs/limits/limits-core";
import { LAB_GROUPS, LAB_LIST, flowOf, groupOf } from "../src/ui/labs-series";

// Lab "What the model cannot do": the sorting, the gate's precision and recall, the finder cut, the safe-design check. Every number comes from tracked data/eval files.
describe("lab-limits: the real data", () => {
  it("14 hard photos, ratio = extent aspect over mask aspect as the game computes it", () => {
    expect(GATE_ROWS).toHaveLength(14);
    for (const r of GATE_ROWS) expect(r.ratio).toBeCloseTo(ratioOf(r), 2);
  });
  it("every card has a picture on disk, a tracked source and a known bin", () => {
    const ids = new Set(CARDS.map((c) => c.id));
    expect(ids.size).toBe(CARDS.length);
    for (const c of CARDS) {
      expect(existsSync("public" + c.picture)).toBe(true);
      expect(existsSync(c.source)).toBe(true);
      expect(BINS.some((b) => b.id === c.bin)).toBe(true);
    }
    for (const b of BINS) expect(CARDS.some((c) => c.bin === b.id)).toBe(true);
  });
  it("the data file is pretty-printed JSON", () => {
    const t = readFileSync("src/labs/limits/limits-data.json", "utf8");
    expect(t).toBe(JSON.stringify(JSON.parse(t), null, 2) + "\n");
  });
});

describe("lab-limits: the gate (precision and recall)", () => {
  it("flagged is symmetric: too wide and too narrow by the same factor", () => {
    expect(flagged(2.01, 2)).toBe(true); expect(flagged(1 / 2.01, 2)).toBe(true);
    expect(flagged(1.99, 2)).toBe(false); expect(flagged(1, 2)).toBe(false);
  });
  it("the table adds up to 14 at every limit", () => {
    for (const s of sweep(GATE_ROWS, false)) expect(s.c.tp + s.c.fp + s.c.fn + s.c.tn).toBe(14);
  });
  it("a looser limit flags fewer lifts: precision can rise, recall never rises", () => {
    const s = sweep(GATE_ROWS, false);
    for (let i = 1; i < s.length; i++) { expect(s[i].c.tp + s[i].c.fp).toBeLessThanOrEqual(s[i - 1].c.tp + s[i - 1].c.fp); expect(s[i].c.recall ?? 0).toBeLessThanOrEqual(s[i - 1].c.recall ?? 0); }
  });
  it("at the game's limit the gate is precise and misses half the bad lifts", () => {
    const c = confusion(GATE_ROWS, GAME_LIMIT);
    expect(c.precision).toBe(1); expect(c.recall).toBeCloseTo(0.5, 5); expect(c.fp).toBe(0);
  });
  it("a limit of 1.1 flags nearly everything: recall is high and precision falls", () => {
    const hi = confusion(GATE_ROWS, 1.1), g = confusion(GATE_ROWS, GAME_LIMIT);
    expect(hi.recall!).toBeGreaterThanOrEqual(g.recall!); expect(hi.precision!).toBeLessThan(g.precision!);
  });
  it("nothing flagged gives precision n/a (null), never NaN or 0", () => {
    const c = confusion(GATE_ROWS, 100);
    expect(c.tp + c.fp).toBe(0); expect(c.precision).toBeNull(); expect(c.f1).toBeNull();
  });
  it("counting partly lifts as bad changes the positives, not the flags", () => {
    const a = confusion(GATE_ROWS, 2, false), b = confusion(GATE_ROWS, 2, true);
    expect(a.tp + a.fp).toBe(b.tp + b.fp); expect(b.tp + b.fn).toBeGreaterThanOrEqual(a.tp + a.fn);
  });
});

describe("lab-limits: the finder cut", () => {
  it("a higher score cut keeps no more outlines, and never finds a bar pattern the finder missed", () => {
    expect(FINDER_ITEMS).toHaveLength(12);
    let last = Infinity;
    for (let c = 0.3; c <= 0.75; c += 0.05) { const f = finderCut(c); expect(f.kept).toBeLessThanOrEqual(last); last = f.kept; expect(f.patternsFound).toBe(0); expect(f.bestIou).toBeLessThan(0.1); }
  });
});

describe("lab-limits: sorting and the safe design", () => {
  it("our sorting scores all right; an empty one scores zero placed", () => {
    expect(scoreSort(ourSorting())).toEqual({ placed: CARDS.length, right: CARDS.length, total: CARDS.length });
    expect(scoreSort({}).placed).toBe(0);
  });
  it("each stage has exactly one cheapest safe option that does the job; naive options are not safe", () => {
    for (const s of STAGES) { const b = cheapestSafe(s); expect(isSafe(b) && b.does).toBe(true); expect(judge(s.id, b.id).status).toBe("best"); expect(judge(s.id, s.options[0].id).status).toBe("unsafe"); }
  });
  it("a model grading a model is unsafe; the free option does no job", () => {
    expect(judge("move", "judge").status).toBe("unsafe");
    expect(judge("move", "stored").status).toBe("no-job");
    expect(judge("lift", "three").status).toBe("unsafe");
  });
  it("allBest only for the three cheapest safe choices, costing 3 calls", () => {
    const best = Object.fromEntries(STAGES.map((s) => [s.id, cheapestSafe(s).id]));
    expect(allBest(best)).toBe(true); expect(totalCalls(best)).toBe(3);
    expect(allBest({ ...best, find: "vote" })).toBe(false); expect(allBest({})).toBe(false);
  });
});

describe("lab-limits: the series", () => {
  it("is in the list, in the Pipelines tier, before no later Lab, with a from-less flow", () => {
    expect(LAB_LIST.some((l) => l.mode === "lab-limits")).toBe(true);
    expect(groupOf("lab-limits")?.tier).toBe("pipelines");
    expect(LAB_GROUPS.filter((g) => g.modes.includes("lab-limits"))).toHaveLength(1);
    expect(flowOf("lab-limits")?.from).toBeNull();
    expect(LAB_LIST.findIndex((l) => l.mode === "lab-limits")).toBeGreaterThan(14); // list order only; nothing shows a number
  });
});
