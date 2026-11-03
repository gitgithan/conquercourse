// Outcome-level check: for every shipped course, the ideal plan and N seeded key-mash runs; prints one line per run: ticks, outcome, final x (6 decimals).
// Usage: npx tsx data/eval/trace-machines/outcomes.ts <seeds> > out.txt
import { readFileSync } from "node:fs";
import { playPlan } from "../../../src/sim/ideal";
import { newWorld, stepWorld } from "../../../src/sim/world";
import type { RunnerInput } from "../../../src/sim/runner";
import type { CourseData } from "../../../src/course/course";
import { DEMO_COURSE_FILES } from "../../../src/course/demo-list";
import { verifyLog } from "../../../src/sim/replay";

function mash(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seeds = Number(process.argv[2] ?? 50);
const bits = (w: { runner: { x: number; y: number } }) => `${w.runner.x.toFixed(6)},${w.runner.y.toFixed(6)}`;
for (const f of DEMO_COURSE_FILES.filter((f) => !f.endsWith("generated-1.course.json"))) {
  const course = JSON.parse(readFileSync(f, "utf8")) as CourseData; const name = f.split("/").pop()!;
  if (course.plan) { let n = 0; const r = playPlan(course, course.plan, undefined, () => { n++; }); console.log(`plan ${name} ${n} ${r.world.outcome} ${bits(r.world)}`); }
  for (let seed = 1; seed <= seeds; seed++) {
    const rnd = mash(seed); let w = newWorld(course); let hold: Partial<RunnerInput> = {}; let n = 0;
    for (let i = 0; i < 2400 && w.outcome === "running"; i++) {
      if (i % 24 === 0) hold = { run: rnd() < 0.85, left: rnd() < 0.05, squat: rnd() < 0.2, roll: rnd() < 0.1, slide: rnd() < 0.1, handL: rnd() < 0.5, handR: rnd() < 0.5, vault: rnd() < 0.15, up: rnd() < 0.3, fire: rnd() < 0.2, aimUp: rnd() < 0.2, aimDown: rnd() < 0.2 };
      const input = { run: false, jump: i % 36 === 0 && rnd() < 0.6, jumpSpeed: 5 + rnd() * 3, squat: false, ...hold } as RunnerInput;
      w = stepWorld(w, input, course); n++;
    }
    console.log(`mash${seed} ${name} ${n} ${w.outcome} ${bits(w)}`);
  }
}
