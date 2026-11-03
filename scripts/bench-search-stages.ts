// Usage: npx tsx scripts/bench-search-stages.ts [out.json] [--runs=3] [--pool=6] [--only=name,name] [--raw=dir]   (CC-133)
// Times the whole-course ideal-run search per STAGE on the demo courses: wall time and simulated ticks, one thread, and the whole search again in a worker pool.
// A stage is a family of batches: take-off edges, steps, monkey bars, the trebuchet, the final whole-course run; "between batches" is everything the generator
// does on the calling thread (the machine searches for the recoil pad, band, cannon, drone and cart, the start delay, the second-best branch set-up, the routes).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import type { CourseData } from "../src/course/course";
import { CLEARED, evalJob, meter, searchGen, type Batch } from "../src/sim/ideal";
import { nodePool } from "../src/sim/ideal-pool-node";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const out = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) ?? "bench-stages.json";
const runs = Number(arg("runs") ?? 3), poolSize = Number(arg("pool") ?? 6), rawDir = arg("raw");
const NAMES = (arg("only") ?? "bars,swing-to-bars,training,lache,fork-bench-bulb,launch-bar,cannon,cannonballs").split(",");
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const stageOf = (b: Batch): string => (b.label.includes("monkey bars") ? "monkey bars" : b.label === "the whole course" ? "final run" : b.label.includes("trebuchet") ? "trebuchet" : "edges and steps");

interface Stage { ms: number; ticks: number; jobs: number; batches: number }
function profile(course: CourseData): { total: number; stages: Record<string, Stage>; answer: string } {
  const stages: Record<string, Stage> = {};
  const add = (name: string, ms: number, ticks: number, jobs = 0, batches = 0) => { const s = (stages[name] ??= { ms: 0, ticks: 0, jobs: 0, batches: 0 }); s.ms += ms; s.ticks += ticks; s.jobs += jobs; s.batches += batches; };
  const t00 = performance.now();
  const g = searchGen(course, {});
  let t0 = performance.now(), m0 = meter.ticks;
  let r = g.next();
  add("between batches", performance.now() - t0, meter.ticks - m0);
  while (!r.done) {
    const b = r.value;
    t0 = performance.now(); m0 = meter.ticks;
    const scores: number[] = [];
    for (const j of b.jobs) { const s = evalJob(course, j); scores.push(s); if (b.stopOnClear && s >= CLEARED) break; }
    add(stageOf(b), performance.now() - t0, meter.ticks - m0, scores.length, 1);
    t0 = performance.now(); m0 = meter.ticks;
    r = g.next(scores);
    add("between batches", performance.now() - t0, meter.ticks - m0);
  }
  return { total: performance.now() - t00, stages, answer: hash({ plan: r.value.plan, windows: r.value.windows, cleared: r.value.cleared }) };
}

const result: Record<string, unknown> = {
  machine: { cpus: os.cpus().length, model: os.cpus()[0]?.model, node: process.version, load1: os.loadavg()[0], poolWorkers: poolSize }, runs, courses: {},
};
const pool = poolSize > 0 ? nodePool(poolSize) : null;
for (const name of NAMES) {
  const course = JSON.parse(readFileSync(`public/assets/demo/${name}.course.json`, "utf8")) as CourseData; delete course.plan;
  const all = Array.from({ length: runs }, () => profile(course));
  const med = all.map((a) => a.total).sort((x, y) => x - y)[Math.floor(runs / 2)];
  const pick = all.find((a) => a.total === med)!; // the median run's stages
  const answers = new Set(all.map((a) => a.answer));
  let poolMs: number[] = [], poolAnswer = "";
  if (pool) for (let i = 0; i < runs; i++) { const t0 = performance.now(); const r = await pool.search(course); poolMs.push(performance.now() - t0); poolAnswer = hash({ plan: r.plan, windows: r.windows, cleared: r.cleared }); }
  const stages = Object.fromEntries(Object.entries(pick.stages).map(([k, v]) => [k, { ...v, ms: Math.round(v.ms), medianMs: Math.round(median(all.map((a) => a.stages[k]?.ms ?? 0))) }]));
  const totalTicks = Object.values(pick.stages).reduce((s, v) => s + v.ticks, 0);
  (result.courses as Record<string, unknown>)[name] = {
    oneThreadMedianMs: Math.round(med), oneThreadRunsMs: all.map((a) => Math.round(a.total)), totalTicks, ticksPerSecond: Math.round(totalTicks / (med / 1000)),
    poolMedianMs: pool ? Math.round(median(poolMs)) : null, poolRunsMs: poolMs.map(Math.round), sameAnswerEveryRun: answers.size === 1 && (!pool || poolAnswer === [...answers][0]), answer: [...answers][0], stages,
  };
  console.log(name.padEnd(18), `${(med / 1000).toFixed(2)} s one thread`, pool ? `${(median(poolMs) / 1000).toFixed(2)} s pool` : "", `${totalTicks} ticks`, answers.size === 1 ? "stable" : "UNSTABLE");
  if (rawDir) { mkdirSync(rawDir, { recursive: true }); writeFileSync(`${rawDir}/${name}.json`, JSON.stringify(all, null, 2) + "\n"); }
}
pool?.close();
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
