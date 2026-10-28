// Usage: npx tsx scripts/bench-pool.ts [out.json] [workers]   (CC-69)
// The whole-course ideal run on every demo course, played by a pool of worker threads; the answers must match scripts/bench-search.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { CourseData } from "../src/course/course";
import { DEMO_COURSE_FILES } from "../src/course/demo-list";
import { nodePool } from "../src/sim/ideal-pool-node";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
const out = process.argv[2] ?? "bench-pool.json";
const size = Number(process.argv[3] ?? 8);
const pool = nodePool(size);
const res: Record<string, { seconds: number; answer: string }> = {};
for (const f of DEMO_COURSE_FILES) {
  const course = JSON.parse(readFileSync(f, "utf8")) as CourseData; delete course.plan;
  const t0 = performance.now();
  const r = await pool.search(course);
  const seconds = (performance.now() - t0) / 1000;
  const name = `whole ${f.split("/").pop()}`;
  res[name] = { seconds: Math.round(seconds * 100) / 100, answer: hash({ plan: r.plan, windows: r.windows, cleared: r.cleared }) };
  console.log(name.padEnd(46), seconds.toFixed(2).padStart(7), "s", res[name].answer);
}
pool.close();
writeFileSync(out, JSON.stringify(res, null, 2) + "\n");
