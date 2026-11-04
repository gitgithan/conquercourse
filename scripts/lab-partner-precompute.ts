// Design partner loop opens already run: the simulator's report for every recorded answer, made with the game's own tool (testLayout). A test re-runs two and compares.
// Run: npx tsx scripts/lab-partner-precompute.ts   (about two minutes)
import { readFileSync, writeFileSync } from "node:fs";
import { testLayout } from "../src/slice/course-agent-tools";
import { readAnswer, ruleProblems, EASED_WALL, type Answer } from "../src/labs/partner/partner-core";
import type { Layout } from "../src/slice/layout-draft";

export function computePartner(only?: string[]) {
  const answers = (JSON.parse(readFileSync("public/assets/lab/partner-recorded.json", "utf8")) as { answers: Answer[] }).answers;
  const reports: Record<string, unknown> = {};
  for (const a of answers) {
    if (only && !only.includes(a.id)) continue;
    const r = readAnswer(a);
    if (r.layout && !ruleProblems(r.layout).length) reports[a.id] = testLayout(r.layout, { probeSeconds: 8 });
  }
  return reports;
}
if (process.argv[1]?.endsWith("lab-partner-precompute.ts")) {
  const reports = computePartner() as Record<string, unknown>;
  const extra: Record<string, unknown> = {};
  const rep = (k: string, l: Layout) => { extra[k] = testLayout(l, { probeSeconds: 8 }); };
  rep("eased-wall", EASED_WALL);
  writeFileSync("public/assets/lab/partner-default.json", JSON.stringify({ about: "Simulator reports (testLayout) for the recorded answers of Design partner loop, made offline with scripts/lab-partner-precompute.ts.", reports, extra }, null, 2) + "\n");
  console.log("wrote", Object.keys(reports).length, "reports");
}
