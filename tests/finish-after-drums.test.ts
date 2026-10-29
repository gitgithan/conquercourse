import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { DEMO_COURSE_FILES } from "../src/course/demo-list";
import { drumsFor } from "../src/sim/drums";
import { inputFor, searchIdealRun } from "../src/sim/ideal";
import { newWorld, stepWorld } from "../src/sim/world";

// The run is cleared only on the ground, and never before the last planned press (CC-84): a finish line inside the final landing let a
// player who landed a little early be cleared while the X drum was still ahead.
function clearTick(c: CourseData, plan: NonNullable<CourseData["plan"]>) {
  let w = newWorld(c);
  const st: any = { next: 0, caught: null, bedAt: null, hangAt: null, hangs: 0, vnext: 0, cnext: 0, inClimb: false, fnext: 0, airSince: null };
  for (let i = 0; i < 120 * 90 && w.outcome === "running"; i++) w = stepWorld(w, inputFor(plan, w, st, c), c);
  return w;
}
function check(c: CourseData, plan: NonNullable<CourseData["plan"]>) {
  const w = clearTick(c, plan);
  expect(w.outcome).toBe("cleared");
  expect(w.runner.grounded).toBe(true); // never in the air
  const last = drumsFor(c, plan).filter((d) => d.what !== "board").pop();
  if (last && c.finishX > 0) expect(last.x).toBeLessThanOrEqual(c.finishX - 0.5); // every press is before the finish line
  if (last) expect(w.runner.x).toBeGreaterThanOrEqual(last.x);
}
describe("the finish comes after the last drum, on the ground", () => {
  for (const f of DEMO_COURSE_FILES) {
    const c = JSON.parse(readFileSync(f, "utf8")) as CourseData;
    if (!c.plan || c.track) continue;
    it(f.split("/").pop()!, () => check(c, c.plan!), 60000);
  }
  it("the stock course", () => {
    const c = JSON.parse(readFileSync("src/course/default-course.json", "utf8")) as CourseData;
    const r = searchIdealRun(c);
    expect(r.cleared).toBe(true);
    check(c, r.plan);
  }, 180000);
});
