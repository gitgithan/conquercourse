// Usage: npx tsx scripts/bench-search.ts [out.json] [--only=whole|fix|advice|generate]   (CC-69)
// Times the searches that make players wait (whole-course ideal run on every demo course, Fix it on the ten-times-too-big block, advice on a wall,
// generateCourse(2)) and writes the answers too, so a faster search can be checked against the answers of the slower one.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { CourseData } from "../src/course/course";
import { DEMO_COURSE_FILES } from "../src/course/demo-list";
import { searchIdealRun } from "../src/sim/ideal";
import { adviseLane } from "../src/slice/advice";
import { fixLayout } from "../src/slice/fixit";
import { generateCourse } from "../src/slice/generator";
import { newPiece, scaleBy, type Piece } from "../src/slice/world";
import type { Mesh } from "../src/slice/slice";

const box = (w: number, h: number, d: number): Mesh => {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  return { positions: [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], indices: [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2] };
};
const lane = { angle: 0, offset: 0, level: 0 };
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
const out = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) ?? "bench.json";
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const res: Record<string, { seconds: number; cpu: number; answer: string }> = {};
const time = <T,>(name: string, f: () => T, digest: (t: T) => unknown) => { const c0 = process.cpuUsage(), t0 = performance.now(); const r = f(); const seconds = (performance.now() - t0) / 1000; const c = process.cpuUsage(c0); const cpu = (c.user + c.system) / 1e6; res[name] = { seconds: Math.round(seconds * 100) / 100, cpu: Math.round(cpu * 100) / 100, answer: hash(digest(r)) }; console.log(name.padEnd(46), seconds.toFixed(2).padStart(7), "s wall", cpu.toFixed(2).padStart(7), "s cpu", res[name].answer); };

const QUICK = ["lache.course.json", "launch-bar.course.json", "lane-1.course.json", "eixample-barcelona.course.json"];
if (!only || only === "whole" || only === "quick") for (const f of DEMO_COURSE_FILES) {
  if (only === "quick" && !QUICK.some((q) => f.endsWith(q))) continue;
  const course = JSON.parse(readFileSync(f, "utf8")) as CourseData; delete course.plan;
  time(`whole ${f.split("/").pop()}`, () => searchIdealRun(course), (r) => ({ plan: r.plan, windows: r.windows, cleared: r.cleared }));
}
const wall = (): Piece[] => [newPiece("Low box", box(4, 0.5, 1.5), { x: 3, z: 0 }), newPiece("Tall wall", box(4, 1.6, 1.5), { x: 8, z: 0 })];
if (!only || only === "fix" || only === "quick") time("fix it: block ten times too big", () => fixLayout([newPiece("Low box", box(4, 0.5, 1.5), { x: 3, z: 0 }), scaleBy(newPiece("Block", box(1, 0.5, 1), { x: 8, z: 0 }), 10)], lane), (r) => ({ ok: r.ok, steps: r.steps }));
if (!only || only === "fix") time("fix it: tall wall", () => fixLayout(wall(), lane), (r) => ({ ok: r.ok, steps: r.steps }));
if (!only || only === "advice" || only === "quick") time("advice: tall wall", () => adviseLane(wall(), lane), (r) => r.map((a) => a.text));
if (!only || only === "generate") time("generateCourse(2)", () => generateCourse(2), (c) => c.plan);
writeFileSync(out, JSON.stringify(res, null, 2) + "\n");
