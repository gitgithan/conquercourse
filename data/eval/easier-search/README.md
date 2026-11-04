# Make it easier: local method comparison

- Recommendation: ship two whole-candidate workers with proof reuse and cancellation.
- Keep the existing timing-trial pool for its current callers.
- Do not nest the two pools: two candidate workers each spawning a large trial pool can overwhelm the machine.
- Prefix reuse saved ticks with exact results, but did not consistently save time; keep it experimental.
- [Before/after and blocker diagrams](../../../docs/easier-search.md).

## Method

- Run `npx tsx scripts/bench-easier.ts /tmp/easier-scores.json` from the repository root.
- Inputs, base revision and environment are in [run.json](run.json); individual times, ordered answer hashes and prefix results are in [scores.json](scores.json).
- Eight fixed, small edits move the leading edge of the last platform closer, from 0.05 m to 0.40 m.
- All methods evaluate exactly these same eight courses in the same logical order, regardless of when workers finish.
- This is a candidate-throughput comparison, not a time-to-first-improvement benchmark of the whole editor feature.
- The benchmark keeps candidate workers busy from a shared queue; the editor waits for each two-candidate wave before choosing in cost order.
- The reported batch times therefore do not include the editor’s wave idle time or early-stopping behavior.
- Three repeats rotate method order to reduce warm-up/order bias.
- Worker creation and first search are included; compilation is performed once per process.
- A single bundled worker controls for differences between the TypeScript development runtime and bundled code.
- Workers execute the actual simulator, with no model calls or mocked simulation results.
- This was an exploratory local development run: browser QA and typechecking overlapped some samples.
- Treat close differences as inconclusive and rerun under controlled load before making a general performance claim.

## Results: median wall time for all eight candidates

| Course | Serial development runtime | One bundled worker | Two candidate workers | Two timing-trial workers |
| --- | ---: | ---: | ---: | ---: |
| lane-2 | 1,995 ms | 857 ms | 614 ms | 612 ms |
| lache | 9,606 ms | 2,841 ms | 1,950 ms | 2,029 ms |
| bars | 38,793 ms | 12,647 ms | 8,252 ms | 10,275 ms |

- Every candidate's ordered plan, windows and clearance hash matched across all methods and repeats.
- Candidate parallelism was about 1.40–1.53 times faster than the matching single bundled worker in this run.
- It tied the trial pool on the short course, was close on lache and took about 20% less time on bars.
- The much larger difference from the serial development runtime is not attributable solely to adding a second worker.
- Two candidate workers fit the new UI: one complete layout per worker, independent progress, immediate termination and no nested worker hierarchy.
- Candidate waves may do an extra search after the first acceptable candidate; cost-order selection and cancellation matter more than maximum throughput alone.
- Original-proof reuse and winning-proof reuse remove entire searches; worker parallelism makes the remaining work overlap.
- No percentage reduction in complete user-visible editor latency is claimed from this batch benchmark.

## Identical-course prefix experiment

| Course | Full replay median | Prefix median | Full ticks | Reused-prefix ticks | Tick reduction | Complete run match |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| lane-2 | 41 ms | 16 ms | 19,598 | 5,598 | 71.4% | Yes |
| lache | 98 ms | 75 ms | 54,489 | 31,009 | 43.1% | Yes |
| bars | 144 ms | 153 ms | 50,639 | 44,319 | 12.5% | Yes |

- Each case contains 41 plans differing only in the final jump threshold, on the identical course.
- The common prefix stops before the earliest threshold can change any input.
- The prototype clones the complete world, controller state, event history and loop bookkeeping.
- Full final worlds, events, maximum distance and jump counts matched ordinary replay exactly on all cases and repeats.
- On bars the shared prefix is short and the prefix method was slower in the median sample.
- State-copy overhead is a likely explanation, but copying was not profiled separately and background load can also affect these small timings.
- Saving simulated work is useful evidence, but is not sufficient evidence of lower wall time.
- This prototype is not wired into the production evaluator.
- Reusing prefixes across edited geometry still needs dependency/invalidation rules and tests for every affected obstacle/device family.

## Browser evidence

- Reproduce the browser checks with `node data/eval/easier-search/check-browser.mjs` while the local dev server is on port 5188.
- Real two-deck editor example: the narrowest press widened from 314 ms to 400 ms after one 1 m movement.
- Cancel stopped an active search without moving anything.
- A lane-slider input also cancelled the active search immediately.
- Candidate profiles showed actual courses submitted to workers.
- Preview and Apply reported cached proofs; no extra winner search was needed.
- [Searching](searching.jpg) and [verified winner](winner.jpg).
- Evidence images are from the local 1280 px desktop preview.
- Social clips and post drafts are throwaway outputs outside the repository and are not tracked.
