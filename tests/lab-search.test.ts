import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { playPlan } from "../src/sim/ideal";
import { DEFAULT_CONFIG, clampCfg, planFor, runLabSearch } from "../src/lab/search-lab";

// Lab 1 (CC-118): the player chooses the search; the simulator is the real one. The trap course is made so that the farthest first jump strands the second.
const course = JSON.parse(readFileSync("public/assets/lab/search-trap.course.json", "utf8")) as CourseData;
const run = (c: Partial<typeof DEFAULT_CONFIG>) => runLabSearch(course, { ...DEFAULT_CONFIG, ...c });

describe("Lab 1: search", () => {
  it("has a stored line that clears the trap course", () => {
    expect(course.plan).toBeDefined();
    expect(playPlan(course, course.plan!).world.outcome).toBe("cleared");
  });
  it("greedy by distance is stranded; exhaustive clears in the time of the stored line", () => {
    const g = run({ method: "greedy" });
    expect(g.cleared).toBe(false);
    expect(g.stuck).toBe(true);
    const e = run({ method: "exhaustive" });
    expect(e.cleared).toBe(true);
    expect(playPlan(course, planFor(e.line)).world.outcome).toBe("cleared");
    expect(Math.abs(e.gap!)).toBeLessThan(0.1); // the grid of presses is coarser than the stored line, so not identical, but as fast
  });
  it("gives the same numbers twice for the same choices", () => {
    for (const method of ["greedy", "beam", "astar", "exhaustive"] as const) {
      const cfg = { method, beam: 6, wDist: 0.7, wSpeed: 0.3, wHeight: 0.2 };
      expect(JSON.stringify(run(cfg))).toBe(JSON.stringify(run(cfg)));
    }
  });
  it("a wider beam clears what a narrow one cannot", () => {
    expect(run({ method: "beam", beam: 2 }).cleared).toBe(false);
    expect(run({ method: "beam", beam: 8 }).cleared).toBe(true);
  });
  it("A* clears and never spends more runs than exhaustive", () => {
    const a = run({ method: "astar" });
    expect(a.cleared).toBe(true);
    expect(a.steps).toBeLessThanOrEqual(run({ method: "exhaustive" }).steps);
  });
  it("stops at the step budget and says so", () => {
    const r = run({ method: "exhaustive", budget: 20 });
    expect(r.steps).toBeLessThanOrEqual(20);
    expect(r.budgetHit).toBe(true);
    expect(r.cleared).toBe(false);
  });
  it("keeps the choices in range", () => {
    const c = clampCfg({ ...DEFAULT_CONFIG, beam: 99, wDist: 5, wSpeed: -1, budget: 0 });
    expect([c.beam, c.wDist, c.wSpeed, c.budget]).toEqual([20, 1, 0, 1]);
  });
});
