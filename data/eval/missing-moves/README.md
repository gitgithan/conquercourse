# Missing-move search: keep editing while physics runs

- The editor stays usable while **Find ways to add the missing moves** tests object roles with real game physics.
- Progress names the proposed change, counts candidates and verified suggestions, and shows elapsed time.
- Progress and Cancel appear immediately below the Moves title; starting a search scrolls them into view.
- No course changes until the player reviews a suggestion with Show it, then uses Preview and Apply.

## Dependencies and method

- Existing role candidates, course builder and `searchIdealRun` supply the same physics and candidate order.
- The initial CC-133 fix moved the calculation into `src/sim/roles-worker.ts`.
- This follow-up reuses that worker and its `roles-job.ts` protocol; it removes the blocking fallback and completes cancellation, failure handling and the time limit.
- A real two-box wall fixture is stored by [the browser check](../../../scripts/missing-moves-check.mjs).
- Chromium runs at 1280 × 900 with WebGL2 through SwiftShader on the existing 8-vCPU, 32-GB test worker.
- No model calls, new VM or mocked simulator are involved in the browser check.

## Before: the page waits for physics

```mermaid
flowchart LR
  CLICK["Find missing moves"] --> TIMER["Short timer lets initial text paint"]
  TIMER --> LOOP["Candidate loop on the page"]
  LOOP --> PROOF["Synchronous simulator proof"]
  PROOF --> LOOP
  PROOF -.-> BLOCK["Drawing, clicks and Cancel wait"]
  LOOP --> RESULTS["Results after calculation"]
```

- A timer delays the start; it does not move the simulation off the page thread.
- Checking the budget only between candidates cannot stop a single expensive proof.
- The initial worker fix removed the normal blocking path, but retained synchronous fallback when worker creation failed.
- Old searches also needed cancellation on lane edits, closing the panel and leaving the editor.

## After: the page controls a disposable worker

```mermaid
flowchart TD
  CLICK["Find missing moves"] --> SNAPSHOT["Send current pieces and lane to worker"]
  SNAPSHOT --> WORKER["Worker tests candidates with the simulator"]
  WORKER -->|"Candidate and completed proofs"| UI["Page draws progress and handles input"]
  UI -->|"Cancel, edit, close or leave"| STOP["Terminate worker; ignore late messages"]
  CLOCK["40-second page-side deadline"] --> PARTIAL["Terminate; show only completed verified results"]
  WORKER -->|"Finished"| RESULTS["Verified suggestions; Show it"]
  RESULTS --> PREVIEW["Preview and Apply"]
  FAIL["Worker unavailable or fails"] --> ERROR["Explain failure; keep editor usable"]
```

- One worker owns one search; completion, cancellation, failure and deadline all terminate it.
- The page remains free even if an individual proof runs for a long time.
- Editing geometry or lane settings invalidates the old search before it can publish stale suggestions.
- Native worker structured cloning preserves geometry arrays without a JSON conversion.
- A time limit means incomplete search, not an impossible course; only simulator-verified partial results are retained.
- Candidate progress is a count of work attempted, not a prediction of seconds remaining.

## Results and limits

- [Recorded browser results](run.json) include a page heartbeat during real physics, cancellation latency, worker termination, closing Moves, lane edits and stale-result rejection.
- [Visible search progress](../../../docs/evidence/missing-moves-search.png).
- The focused suite checks worker errors, startup/clone failure, hard deadline and late messages, plus equality between the worker job and the existing search.
- Physics cost is unchanged: this fix improves responsiveness and control, not the search algorithm.
- A deadline can stop a nearly finished proof; its unfinished candidate is not presented as verified.
- Lesson: test cancellation while the expensive operation is still running, and inspect the screenshot; a progress element can exist yet be outside the visible scroll area.

## Validation record

- Focused role/client suite: 26 tests passed, including equivalence with the existing simulator search.
- Real browser: 12 heartbeat ticks during 600 ms of physics; Cancel responded in 212 ms; all 11 lifecycle/visibility checks passed with no page errors.
- Typecheck and production build passed.
- Full suite ran all 328 files: 323 passed; five failures were investigated rather than hidden.
- Three promo JSON formatting failures were corrected; stale pole-toolbar and default-fork expectations were updated; existing `botlag` and `ninja` film switches were registered.
- Targeted reruns pass those corrected checks, plus documentation and privacy guards.
- Remaining unrelated baseline limitation: the fork preset reports `cleared: true` but takes 149.6 seconds in the isolated rerun, exceeding its existing 120-second test limit.
- No timeout was raised and no physics assertion was removed; the full suite therefore remains non-green because of that preset timing limit.
- A tracked-file hash comparison confirmed the VM's runtime source matched the branch before diagnosing baseline failures.
- Raw captures and logs are retained outside git under the sibling assets folder's `eval-full/missing-moves/`, with checksums.
