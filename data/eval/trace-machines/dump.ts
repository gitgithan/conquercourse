// Dumps the world after every tick of the seeded key-mash runs (same keys as tests/sim-trace.test.ts) as JSON lines.
// Usage: npx tsx data/eval/trace-machines/dump.ts <out-dir> [course-file-substring ...]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { newWorld, stepWorld } from "../../../src/sim/world";
import type { RunnerInput } from "../../../src/sim/runner";
import type { CourseData } from "../../../src/course/course";
import { DEMO_COURSE_FILES } from "../../../src/course/demo-list";

function mash(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const [out, ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const f of DEMO_COURSE_FILES.filter((f) => !f.endsWith("generated-1.course.json") && (only.length === 0 || only.some((o) => f.includes(o))))) {
  const course = JSON.parse(readFileSync(f, "utf8")) as CourseData; const name = f.split("/").pop()!;
  for (const seed of [1, 2, 3]) {
    const rnd = mash(seed); let w = newWorld(course); let hold: Partial<RunnerInput> = {}; const lines: string[] = [];
    for (let i = 0; i < 2400 && w.outcome === "running"; i++) {
      if (i % 24 === 0) hold = { run: rnd() < 0.85, left: rnd() < 0.05, squat: rnd() < 0.2, roll: rnd() < 0.1, slide: rnd() < 0.1, handL: rnd() < 0.5, handR: rnd() < 0.5, vault: rnd() < 0.15, up: rnd() < 0.3, fire: rnd() < 0.2, aimUp: rnd() < 0.2, aimDown: rnd() < 0.2 };
      const input = { run: false, jump: i % 36 === 0 && rnd() < 0.6, jumpSpeed: 5 + rnd() * 3, squat: false, ...hold } as RunnerInput;
      w = stepWorld(w, input, course); lines.push(JSON.stringify(w));
    }
    writeFileSync(`${out}/mash${seed}-${name}.jsonl`, lines.join("\n") + "\n");
  }
}
