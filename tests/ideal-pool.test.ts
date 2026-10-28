import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { DEMO_COURSE_FILES } from "../src/course/demo-list";
import { nodePool } from "../src/sim/ideal-pool-node";

// A pool of worker threads gives exactly the plan and windows of the one-thread search (golden hashes from before the speed work, tests/golden/search.json).
const golden = JSON.parse(readFileSync("tests/golden/search.json", "utf8")) as Record<string, string>;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

describe("ideal-run worker pool", () => {
  it("finds the same answers as the search on one thread", async () => {
    const pool = nodePool(3);
    try {
      for (const f of ["launch.course.json", "lane-2.course.json", "eixample-barcelona.course.json"]) {
        const course = JSON.parse(readFileSync(DEMO_COURSE_FILES.find((q) => q.endsWith(f))!, "utf8")) as CourseData; delete course.plan;
        const r = await pool.search(course);
        expect(hash({ plan: r.plan, windows: r.windows, cleared: r.cleared }), f).toBe(golden[`whole ${f}`]);
      }
    } finally { pool.close(); }
  }, 120000);
});
