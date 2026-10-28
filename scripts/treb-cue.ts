// For every tick of the swing: what the cue (predictLaunch) says, against what really happens if the rider is let go at that tick.
import { readFileSync } from "node:fs";
import type { CourseData } from "../src/course/course";
import { playPlan, type Plan } from "../src/sim/ideal";
import { predictLaunch } from "../src/sim/predict";
import { newWorld, stepWorld } from "../src/sim/world";
import { NO_INPUT } from "../src/sim/runner";
const f = process.argv[2];
const c = JSON.parse(readFileSync(f, "utf8")) as CourseData;
const plan = c.plan as Plan;
let w = newWorld(c, c.startX);
w = stepWorld(w, { ...NO_INPUT, run: true }, c);
const rows: string[] = [];
let mism = 0;
for (let t = 1; t < 400 && w.mode === "launch"; t++) {
  const pl = predictLaunch(w, c);
  const cue = pl.result === "lands" && /^You (reach|land)/.test(pl.why);
  const real = playPlan(c, { ...plan, launchRelease: t }).world.outcome === "cleared";
  if (cue !== real) { mism++; rows.push(`t=${t} cue=${cue} (${pl.result}: ${pl.why.slice(0, 60)}) real=${real}`); }
  w = stepWorld(w, { ...NO_INPUT, run: true }, c);
}
console.log(f, "mismatches", mism);
console.log(rows.slice(0, 40).join("\n"));
