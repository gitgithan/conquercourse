import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { DEMO_COURSE_FILES } from "../src/course/demo-list";
import { playPlan } from "../src/sim/ideal";
import { newWorld, stepWorld } from "../src/sim/world";
import type { RunnerInput } from "../src/sim/runner";
import { loadCourseFile } from "./helpers/course";

// CC-133: a fingerprint of the whole world after EVERY tick, for every shipped course.
// A refactor of the physics step (or anything it calls) must leave these unchanged, bit for bit.
// Two kinds of run: the stored best line of each course, and a fixed pseudo-random key mash (seeded) that reaches falls, bad landings and the other branches the best line avoids.
// Regenerate on purpose only: delete tests/golden/sim-trace.json and run `UPDATE_GOLDEN=1 npx vitest run tests/sim-trace.test.ts`, then say in the pull request why the physics changed.
const GOLDEN = "tests/golden/sim-trace.json";
const SKIP_LONG = ["generated-1.course.json"]; // the longest sample is covered by the search golden
const sha = (h: ReturnType<typeof createHash>) => h.digest("hex").slice(0, 16);

function mash(seed: number) { // a small seeded generator (mulberry32), so the same keys every run
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function traceOfPlan(course: CourseData): string | null {
  if (!course.plan) return null;
  const h = createHash("sha256"); let n = 0;
  playPlan(course, course.plan, undefined, (w) => { h.update(JSON.stringify(w)); n++; });
  return `${n}:${sha(h)}`;
}

function traceOfMash(course: CourseData, seed: number): string {
  const rnd = mash(seed); const h = createHash("sha256");
  let w = newWorld(course); let hold: Partial<RunnerInput> = {}; let n = 0;
  for (let i = 0; i < 2400 && w.outcome === "running"; i++) {
    if (i % 24 === 0) hold = { run: rnd() < 0.85, left: rnd() < 0.05, squat: rnd() < 0.2, roll: rnd() < 0.1, slide: rnd() < 0.1, handL: rnd() < 0.5, handR: rnd() < 0.5, vault: rnd() < 0.15, up: rnd() < 0.3, fire: rnd() < 0.2, aimUp: rnd() < 0.2, aimDown: rnd() < 0.2 };
    const input = { run: false, jump: i % 36 === 0 && rnd() < 0.6, jumpSpeed: 5 + rnd() * 3, squat: false, ...hold } as RunnerInput;
    w = stepWorld(w, input, course); h.update(JSON.stringify(w)); n++;
  }
  return `${n}:${w.outcome}:${sha(h)}`;
}

const files = DEMO_COURSE_FILES.filter((f) => !SKIP_LONG.some((s) => f.endsWith(s)));
const now = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const f of files) {
    const c = loadCourseFile(f); const name = f.split("/").pop()!;
    const p = traceOfPlan(c); if (p) out[`plan ${name}`] = p;
    for (const seed of [1, 2, 3]) out[`mash${seed} ${name}`] = traceOfMash(c, seed);
  }
  return out;
};

// Bit for bit on Node 22 and Node 24 (CC-133, 2026-11-03): the sim no longer uses `**` or Math.pow, only + - * / and Math.sqrt, which IEEE fixes exactly.
// Not yet bit-exact in workerd where a course uses sin, cos, tan or exp (the drone, lache and training plans): see data/eval/trace-machines/README.md.
// Before the fix, `x ** 3` and `Math.pow(x, 1.5)` rounded one step differently in V8 12.4 (Node 22) and V8 13.6 (Node 24).
// tests/sim-no-pow.test.ts keeps those out; data/eval/trace-machines/README.md has the evidence.

describe("the world after every tick is unchanged (bit for bit)", () => {
  it("matches the stored traces for every shipped course (same ticks, outcome and hash on Node 22 and 24)", () => {
    if (!existsSync(GOLDEN) && process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, JSON.stringify(now(), null, 2) + "\n");
    expect(now()).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
  }, 300000);
});
