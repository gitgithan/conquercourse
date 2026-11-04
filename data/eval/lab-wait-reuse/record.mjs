// Run with: node --import tsx data/eval/lab-wait-reuse/record.mjs
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { OUR_REUSE, activeUnits, freshReuse, leakedUnits, switchReuse } from '../../../src/labs/wait/reuse.ts';
const summarize = (t) => ({ workUnits: t.work, reused: t.kept.map((r) => r.kind), replaced: t.made.map((r) => r.kind), activeUnits: activeUnits(t.after), leftoverUnits: leakedUnits(t.after), switches: t.after.switches });
let clean = freshReuse(), leaky = freshReuse();
for (let i = 0; i < 20; i++) clean = switchReuse(clean, OUR_REUSE).after;
for (let i = 0; i < 3; i++) leaky = switchReuse(leaky, { ...OUR_REUSE, cleanup: false }).after;
const run = {
  date: '2026-11-05', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  question: 'Which work survives a course switch, and what happens when old course resources are not closed?',
  method: { kind: 'Deterministic teaching model', inputs: 'An already-loaded course, three boolean choices, illustrative per-resource units', units: 'Not milliseconds or measured MB', animation: '90 ms per illustrative work unit, or immediate with reduced motion; not measured load time', recordedRealTimings: 'Separate observations from data/eval/course-loading/run.json, not predicted by this model', modelCalls: 0, newVMs: 0 },
  outputs: {
    ourNextSwitch: summarize(switchReuse(freshReuse(), OUR_REUSE)),
    rebuildEverything: summarize(switchReuse(freshReuse(), { renderer: false, assets: false, cleanup: true })),
    after20CleanSwitches: { activeUnits: activeUnits(clean), leftoverUnits: leakedUnits(clean) },
    after3UncleanSwitches: { activeUnits: activeUnits(leaky), leftoverUnits: leakedUnits(leaky) },
    cleanupAfterEarlierLeaks: summarize(switchReuse(leaky, OUR_REUSE)),
    reset: { activeUnits: activeUnits(freshReuse()), leftoverUnits: leakedUnits(freshReuse()) },
  },
  validation: { modelTests: '5 invariant tests across all policies and repeated switches', browser: 'Desktop checks of immediate changes, IDs, leaks, cleanup, reset, replay, scrubber, resource inspection, original experiment and feature opt-out', fullSuite: 'Not rerun by this recording command; see README for verification results', evidence: ['docs/evidence/lab-wait-reuse.png', 'docs/evidence/lab-wait-reuse-leftovers.png'] },
};
writeFileSync(new URL('./run.json', import.meta.url), JSON.stringify(run, null, 2) + '\n');
console.log(JSON.stringify(run.outputs, null, 2));
