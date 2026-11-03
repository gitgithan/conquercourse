// Replays the recorded runs (public/assets/demo/*.run.json) on their courses and prints: file, cleared, ticks (recorded and replayed), end place.
// Usage: npx tsx data/eval/trace-machines/runs.ts
import { readFileSync, readdirSync } from "node:fs";
import type { CourseData } from "../../../src/course/course";
import { verifyLog, type InputLog } from "../../../src/sim/replay";

const dir = "public/assets/demo/";
for (const f of readdirSync(dir).filter((f) => f.endsWith(".run.json"))) {
  const course = JSON.parse(readFileSync(dir + f.replace(".run.json", ".course.json"), "utf8")) as CourseData;
  const run = JSON.parse(readFileSync(dir + f, "utf8")) as { log: InputLog; ticks: number };
  const v = verifyLog(course, run.log);
  console.log(`${f} cleared=${v.cleared} recordedTicks=${run.ticks} ticks=${v.ticks} end=${v.world.runner.x.toFixed(6)},${v.world.runner.y.toFixed(6)}`);
}
