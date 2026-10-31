// Precomputes the default ("our setting") result of the three slow Labs, with the same code the Lab runs, so a Lab opens already filled.
// Usage: npx tsx scripts/labs-default-precompute.ts [timing|gentest|rl|all]   (add --check to compare with the shipped files and exit 1 on drift)
// The files are written pretty-printed under public/assets/lab/. Each carries the config and seed it came from; wallMs is the time on the machine that made it.
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_TIMING, prepare, runTiming, sweepSigma } from "../src/labs/timing/core";
import { DEFAULT_CONFIG, DEFAULT_RULES, buildProposals, tally, testProposal, type Config } from "../src/labs/gentest/core";
import { DEFAULT_RL, pathOfPlan, policyStrip, trainNoExplore, trainRl } from "../src/lab/rl-lab";

export const TIMING_COURSE = "/assets/lab/search-trap.course.json";
export const TIMING_SWEEP = [0, 15, 30, 50, 75, 100, 150, 220];
export const GENTEST_OURS: Config = { ...DEFAULT_CONFIG, rules: { ...DEFAULT_RULES }, repairs: 2 };

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const out = (name: string) => `public/assets/lab/${name}-default.json`;

export function computeTiming() {
  const c = read("public" + TIMING_COURSE);
  const t = Date.now();
  const prep = prepare(c);
  const result = runTiming(c, DEFAULT_TIMING, undefined, prep);
  const curve = result ? sweepSigma(c, DEFAULT_TIMING, TIMING_SWEEP, Math.max(100, Math.round(DEFAULT_TIMING.runs / 4)), prep) : [];
  return { lab: "lab-timing", course: TIMING_COURSE, label: "Trap chain (3 jumps)", cfg: DEFAULT_TIMING, sweep: TIMING_SWEEP, result, curve, wallMs: Date.now() - t };
}
export function computeGentest(limit = GENTEST_OURS.limit) {
  const pool = read("public/assets/lab/gentest-proposals.json").proposals;
  const cfg = { ...GENTEST_OURS, limit };
  const t = Date.now();
  const verdicts = buildProposals(pool, cfg).map((p) => testProposal(p, cfg.rules, cfg.repairs, cfg.budget));
  return { lab: "lab-gentest", cfg: GENTEST_OURS, verdicts, tally: tally(verdicts), wallMs: Date.now() - t };
}
export function computeRl() {
  const c = read("public/assets/lab/search-trap.course.json");
  const t = Date.now();
  const r = trainRl(c, DEFAULT_RL);
  r.greedy = trainNoExplore(c, DEFAULT_RL);
  const { q, policyRun, ...result } = r;
  return { lab: "lab-rl", course: "/assets/lab/search-trap.course.json", cfg: DEFAULT_RL, result, found: policyRun.path, ours: pathOfPlan(c), strip: policyStrip(q), wallMs: Date.now() - t };
}

if (process.argv[1]?.endsWith("labs-default-precompute.ts")) {
  const which = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "all";
  const jobs: [string, () => unknown][] = [["timing", computeTiming], ["gentest", () => computeGentest()], ["rl", computeRl]];
  for (const [name, fn] of jobs) {
    if (which !== "all" && which !== name) continue;
    const d = JSON.parse(JSON.stringify(fn()));
    writeFileSync(out(name), JSON.stringify(d, null, 2) + "\n");
    console.log(name, "written", out(name), JSON.stringify(d).length, "bytes", d.wallMs, "ms");
  }
}
