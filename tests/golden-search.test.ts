import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { DEMO_COURSE_FILES } from "../src/course/demo-list";
import { searchIdealRun } from "../src/sim/ideal";
import { adviseLane } from "../src/slice/advice";
import { fixLayout } from "../src/slice/fixit";
import { generateCourse } from "../src/slice/generator";
import type { Mesh } from "../src/slice/slice";
import { newPiece, scaleBy, type Piece } from "../src/slice/world";

// The answers of the search and of Fix it and the advice, as they were before they were made faster (CC-69): a faster search must give the same plans,
// windows, fixes and advice. The slowest courses (the generated sample, the wide lache and the Training course) are checked by `scripts/bench-pool.ts` instead (a whole-course search of a minute).
const golden = JSON.parse(readFileSync("tests/golden/search.json", "utf8")) as Record<string, string>;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
const SLOW = ["generated-1.course.json", "lache-wide.course.json", "training.course.json"];

const box = (w: number, h: number, d: number): Mesh => {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  return { positions: [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], indices: [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2] };
};
const lane = { angle: 0, offset: 0, level: 0 };
const wall = (): Piece[] => [newPiece("Low box", box(4, 0.5, 1.5), { x: 3, z: 0 }), newPiece("Tall wall", box(4, 1.6, 1.5), { x: 8, z: 0 })];

describe("the search gives the same answers as before it was made faster", () => {
  for (const f of DEMO_COURSE_FILES.filter((q) => !SLOW.some((s) => q.endsWith(s)))) {
    it(`whole-course ideal run: ${f.split("/").pop()}`, () => {
      const course = JSON.parse(readFileSync(f, "utf8")) as CourseData; delete course.plan;
      const r = searchIdealRun(course);
      expect(hash({ plan: r.plan, windows: r.windows, cleared: r.cleared })).toBe(golden[`whole ${f.split("/").pop()}`]);
    }, 120000);
  }
  it("Fix it: a block ten times too big", () => {
    const r = fixLayout([newPiece("Low box", box(4, 0.5, 1.5), { x: 3, z: 0 }), scaleBy(newPiece("Block", box(1, 0.5, 1), { x: 8, z: 0 }), 10)], lane);
    expect(hash({ ok: r.ok, steps: r.steps })).toBe(golden["fix it: block ten times too big"]);
  }, 120000);
  it("Fix it: a tall wall", () => {
    const r = fixLayout(wall(), lane);
    expect(hash({ ok: r.ok, steps: r.steps })).toBe(golden["fix it: tall wall"]);
  }, 120000);
  it("advice: a tall wall", () => {
    expect(hash(adviseLane(wall(), lane).map((a) => a.text))).toBe(golden["advice: tall wall"]);
  }, 120000);
  it("generateCourse(2) composes the same plan", () => {
    expect(hash(generateCourse(2).plan)).toBe(golden["generateCourse(2)"]);
  }, 120000);
});
