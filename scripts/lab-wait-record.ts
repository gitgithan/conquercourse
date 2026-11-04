// Records the real ideal-run search of three courses for the "Hide the wait" Lab: the cost in simulator ticks of every job, batch by batch.
// Usage: npx tsx scripts/lab-wait-record.ts [--check]   (--check compares with the shipped file and exits 1 on drift)
// The ticks do not depend on the machine; wallMs is the time on the machine that made the file. The swing-to-bars course takes a few minutes (it plays the jobs early exit skipped, only to price them).
import { readFileSync, writeFileSync } from "node:fs";
import { recordSearch } from "../src/labs/wait/record";

export const WAIT_COURSES = [
  { id: "trap", label: "Trap chain (3 jumps)", url: "/assets/lab/search-trap.course.json" },
  { id: "rail", label: "Park rail run (5 jumps)", url: "/assets/demo/park-rail-run.course.json" },
  { id: "bars", label: "Swing to bars", url: "/assets/demo/swing-to-bars.course.json" },
] as const;
const FILE = "public/assets/lab/wait-recorded.json";
const pack = (t: number[]): string => t.join(",");

const courses = WAIT_COURSES.map((c) => {
  const t0 = Date.now();
  const rec = recordSearch(JSON.parse(readFileSync("public" + c.url, "utf8")), true);
  console.error(c.id, rec.batches.length, "batches", rec.jobsRun, "jobs run", rec.ticksRun, "ticks run", Date.now() - t0, "ms");
  return { ...c, cleared: rec.cleared, jobsRun: rec.jobsRun, ticksRun: rec.ticksRun, dupJobs: rec.dupJobs, wallMs: Date.now() - t0, batches: rec.batches.map((b) => ({ label: b.label, early: b.early, stopAt: b.stopAt, ticks: pack(b.ticks) })) };
});
const out = { lab: "lab-wait", note: "Cost in simulator ticks of every job of the real ideal-run search (src/sim/ideal.ts), per batch. ticks is a comma list. stopAt is the first clear of an early-exit batch (-1: none). wallMs is the time on the machine that made the file.", courses };
const text = JSON.stringify(out, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const old = JSON.parse(readFileSync(FILE, "utf8"));
  const strip = (o: typeof out) => o.courses.map((c) => ({ ...c, wallMs: 0 }));
  if (JSON.stringify(strip(old)) !== JSON.stringify(strip(out))) { console.error("DRIFT: the recorded search changed"); process.exit(1); }
  console.error("recorded file matches");
} else writeFileSync(FILE, text);
