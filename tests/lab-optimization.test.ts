import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { DRONE, FAIL_BASE, PROBLEMS, ROPE, DEFAULTS, encode, findPeaks, peakOf, runMethod, sampleAt, scoreFromCell, tableScore, type Method, type Table } from "../src/labs/optimization/core";
import { playPlan } from "../src/sim/ideal";

// CC-118: the map is the real simulator's finishing time; the three searches only ask for cells.
const load = (p: (typeof PROBLEMS)[number]) => ({
  course: JSON.parse(readFileSync("public" + p.courseUrl, "utf8")) as CourseData,
  table: JSON.parse(readFileSync(`public/assets/lab/opt-${p.id}.table.json`, "utf8")) as Table,
});
const R = load(ROPE), D = load(DRONE);
const fR = tableScore(R.table, R.course.finishX), fD = tableScore(D.table, D.course.finishX);
const run = (m: Method, f: typeof fR, p: typeof ROPE, t: Table, c: Partial<typeof DEFAULTS> = {}) => runMethod(m, f, t.nx, t.ny, { ...DEFAULTS, start: p.start, ...c });

describe("Optimization: the reference tables are the live simulator", () => {
  it("have the size of their axes", () => {
    for (const [p, x] of [[ROPE, R], [DRONE, D]] as const) expect(x.table.cells.length).toBe(p.axes[0].count * p.axes[1].count);
  });
  it("match live runs on a spread of cells", () => {
    for (const [p, x] of [[ROPE, R], [DRONE, D]] as const) {
      for (let n = 0; n < 24; n++) {
        const i = (n * 7) % p.axes[0].count, j = (n * 11) % p.axes[1].count;
        expect(encode(sampleAt(p, x.course, i, j)), `${p.id} ${i},${j}`).toBe(x.table.cells[j * x.table.nx + i]);
      }
    }
  });
  it("the game's own stored plan clears both courses", () => {
    for (const x of [R, D]) expect(playPlan(x.course, x.course.plan!).world.outcome).toBe("cleared");
  });
});

describe("Optimization: the maps have the peaks the lab teaches with", () => {
  it("the drone map has exactly two local peaks, the second 0.6 s slower", () => {
    const k = findPeaks(fD, D.table.nx, D.table.ny);
    expect(k.length).toBe(2);
    expect(k[1].score - k[0].score).toBeGreaterThan(0.5);
  });
  it("the rope map has several peaks and the fastest is not the one next to a cliff of the game's pick", () => {
    const k = findPeaks(fR, R.table.nx, R.table.ny);
    expect(k.length).toBeGreaterThanOrEqual(4);
  });
  it("a failing cell is worse than every clear, and has a slope toward the finish", () => {
    expect(scoreFromCell(-100, 28.7)).toBeGreaterThan(FAIL_BASE);
    expect(scoreFromCell(-200, 28.7)).toBeLessThan(scoreFromCell(-100, 28.7));
    expect(scoreFromCell(2000, 28.7)).toBeLessThan(FAIL_BASE);
  });
});

describe("Optimization: the search methods", () => {
  it("a hill-climb stops at a peak where no neighbour is faster, and sticks in the slower basin", () => {
    const peaks = findPeaks(fD, D.table.nx, D.table.ny);
    const h = run("hill", fD, DRONE, D.table);
    const stop = h.stops[0];
    expect(peakOf(peaks, stop.i, stop.j)).toBe(peaks[1]);
    expect(stop.score).toBeGreaterThan(peaks[0].score);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const a = stop.i + di, b = stop.j + dj;
      if (a >= 0 && b >= 0 && a < D.table.nx && b < D.table.ny) expect(fD(a, b)).toBeGreaterThanOrEqual(stop.score - 1e-9);
    }
  });
  it("a climb from the other basin reaches the fastest peak", () => {
    const peaks = findPeaks(fD, D.table.nx, D.table.ny);
    const h = run("hill", fD, DRONE, D.table, { start: [peaks[0].i, peaks[0].j - 1] });
    expect(h.best.score).toBeCloseTo(peaks[0].score, 6);
  });
  it("random restarts find the fastest peak on the drone map, spending more runs than one climb", () => {
    const peaks = findPeaks(fD, D.table.nx, D.table.ny);
    const r = run("random", fD, DRONE, D.table, { restarts: 8, budget: 3000 });
    const h = run("hill", fD, DRONE, D.table);
    expect(r.best.score).toBeCloseTo(peaks[0].score, 6);
    expect(r.evals).toBeGreaterThan(h.evals);
  });
  it("a grid costs the cells of its lattice, and a coarser grid costs less", () => {
    const g6 = run("grid", fD, DRONE, D.table, { grid: 6, budget: 3000 }), g3 = run("grid", fD, DRONE, D.table, { grid: 3, budget: 3000 });
    expect(g6.evals).toBe(Math.ceil(D.table.nx / 6) * Math.ceil(D.table.ny / 6));
    expect(g3.evals).toBeGreaterThan(g6.evals);
    expect(g3.best.score).toBeLessThanOrEqual(g6.best.score + 1e-9);
  });
  it("never spends more runs than the budget, and says so", () => {
    for (const m of ["grid", "hill", "random"] as Method[]) {
      const t = run(m, fR, ROPE, R.table, { budget: 20, grid: 2 });
      expect(t.evals).toBeLessThanOrEqual(20);
      expect(t.budgetHit).toBe(true);
    }
  });
  it("gives the same numbers twice, and a different seed gives different restarts", () => {
    const a = JSON.stringify(run("random", fR, ROPE, R.table)), b = JSON.stringify(run("random", fR, ROPE, R.table));
    expect(a).toBe(b);
    expect(JSON.stringify(run("random", fR, ROPE, R.table, { seed: 99 }))).not.toBe(a);
  });
  it("counts each different cell once", () => {
    let calls = 0;
    const t = runMethod("hill", (i, j) => { calls++; return fD(i, j); }, D.table.nx, D.table.ny, { ...DEFAULTS, start: DRONE.start });
    expect(calls).toBe(t.evals);
  });
  it("on the rope map restarts do better than one climb from the default start", () => {
    const h = run("hill", fR, ROPE, R.table), r = run("random", fR, ROPE, R.table, { restarts: 12, budget: 3000 });
    expect(r.best.score).toBeLessThanOrEqual(h.best.score + 1e-9);
  });
  it("the real simulator gives the same score as the table when a method asks it (hill-climb on the drone)", () => {
    const t = runMethod("hill", (i, j) => sampleAt(DRONE, D.course, i, j).score, D.table.nx, D.table.ny, { ...DEFAULTS, start: DRONE.start, budget: 200 });
    const same = run("hill", fD, DRONE, D.table, { budget: 200 });
    expect(JSON.stringify(t)).toBe(JSON.stringify(same));
  });
});
