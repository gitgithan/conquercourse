# Make it easier: show the work and keep its proof

- Updated 2026-11-04.
- The editor can stay responsive while the simulator tries small changes.
- A verified proposal keeps its successful run through Preview, Apply and Play.
- No model decides clearance or invents a run.
- The measured method comparison and prefix experiment are in the [experiment report](../data/eval/easier-search/README.md).

## What changed, and why

| Change | What it removes or improves | Limit |
| --- | --- | --- |
| Reuse the exact current-course proof | Removes the baseline search when a complete matching proof exists | Legacy stored bar/device proofs without full timing metadata need one enrichment search |
| Retain the winning plan, windows and course | Removes the extra winner search at Preview and after Apply | Changing a checkbox or any physics input needs its own matching proof |
| Run whole candidates in two workers | Keeps simulation off the UI thread; lets two candidate searches overlap | Does not make every course twice as fast; more workers also use more memory |
| Cancel, edit or leave the editor | Terminates both workers and rejects queued work immediately | Already completed cache entries remain valid for their exact course |
| Small candidate profiles | Shows the changed layouts, their status and measured press windows | Profiles are layouts, not a picture of every timing trial or a physical CPU core |
| Target the weakest measured window | Spends the first edits near the limiting obstacle instead of near an unrelated selection/start | Unknown obstacle labels fall back to the selected area |
| Deduplicate identical course inputs | Reuses rounded/clamped candidates and the baseline | Keys include current device settings; different inputs cannot share a proof |

- Candidate cards appear by default while Make it easier searches, in development and built versions.
- They show the simulator trying layout changes; Ask AI for ideas instead uses the single-preview simulator progress card.
- `easierview=0` hides the cards while keeping worker searches and cancellation.
- `easierview=1` explicitly enables the cards; no query parameter is needed by default.
- Grey profiles show the current course; teal shows a candidate.
- “Verified” means that candidate's simulator found a successful run.
- The number in milliseconds measures the narrowest supported press window, not search duration.
- Nothing moves in the editor until the normal Apply action.

## Before: simulation blocks the page, then the proof is lost

```mermaid
sequenceDiagram
    actor Player
    participant UI as Editor UI thread
    participant Sim as Synchronous simulator
    participant Preview
    participant Worker as Preview simulator worker
    Player->>UI: Make it easier
    UI->>Sim: Search original course again
    Note over UI,Sim: Page input and drawing wait during each search
    loop Up to roughly 30 edits
        UI->>Sim: Search one changed course
        Sim-->>UI: Verdict, plan, windows
        Note over UI: Keep widths, discard successful plan
    end
    UI->>Preview: Winning edit without full proof
    Preview->>Worker: Search winner again
    Note over Preview: Existing Preview→Apply cache helps only after this extra search
```

## After: workers calculate; the page shows progress

```mermaid
sequenceDiagram
    actor Player
    participant UI as Editor UI thread
    participant Cache as Exact-course proof cache
    participant A as Candidate worker A
    participant B as Candidate worker B
    participant Preview
    UI->>Cache: Read complete original proof
    Cache-->>UI: Successful plan and all timing windows
    UI->>UI: Locate weakest window, order small edits by cost
    par Cost-ordered wave
        UI->>A: Candidate 1, complete course
        UI->>B: Candidate 2, complete course
    end
    Note over UI: Input, drawing and Cancel remain available
    A-->>UI: Full proof, or no clear run
    B-->>UI: Full proof, or no clear run
    UI->>UI: Choose in cost order, regardless of finish order
    UI->>Cache: Retain winner and all timing windows
    UI->>Preview: Proposed edit
    Preview->>Cache: Exact matching proof
    Cache-->>Preview: Already verified, Apply ready
    Player->>UI: Apply then Play
    UI->>Cache: Reuse the same successful run
```

- A wave waits for both answers before choosing in edit-cost order.
- A faster, more expensive result cannot displace a cheaper qualifying edit still running.
- This preserves the “smallest edit first” rule, at the cost of waiting for a slow wave member.
- The first change that widens the window by at least 25% wins.
- If none reaches 25%, the best improvement of at least 15% is offered.
- The existing 40-second ordinary / 150-second hold search budgets are checked between waves.
- A wave can overrun that soft budget; the Cancel button stops it immediately.

## What blocks what

```mermaid
flowchart TD
    Full[Complete proof: plan + all timing windows] --> Locate[Locate actual limiting obstacle]
    Full --> Reuse[Skip repeated original search]
    Pool[Worker lifecycle + cancellation] --> Cards[Safe live candidate cards]
    Pool --> Compare[Compare candidate workers with timing-trial pool]
    Ordered[Stable cost order and exact course keys] --> Winner[Trustworthy winning edit]
    Locate --> Winner
    Compare --> Winner
    Winner --> Carry[Carry complete proof into shared cache]
    Carry --> Apply[Preview / Apply / Play without repeated search]
    Snapshot[Full world + controller + tick + events snapshot] --> Prefix[Exact identical-course prefix experiment]
    Invalidate[Prove changed geometry cannot affect saved prefix] --> Cross[Future cross-course prefix reuse]
    Prefix --> Cross
```

- Merely adding cards before moving calculation off the page cannot keep cards updating during a synchronous search.
- Merely caching a boolean cannot give Play the actual successful run.
- Rendering windows contain only position-based markers; bar hang/reach windows are different data.
- The cache now keeps `timingWindows` as well as the existing filtered `windows` used by the lane drawing.
- The shipped positive preset proofs were enriched with full timing metadata without changing their successful plans.
- New stored preset proofs also save full timing metadata.
- An older stored positive proof still proves clearance; its incomplete timing metadata is enriched once when required for Make it easier.
- A changed course is always rebuilt with only the devices currently in the editor.
- Results are bounded to 24 cached courses; the winning proof is reinserted immediately before Preview.

## Reusing a run prefix: measured investigation, not enabled in production

```mermaid
flowchart LR
    Before[41 trials] --> Full[41 complete replays from tick zero]
    After[Same course; only final jump threshold differs] --> Once[Replay common prefix once]
    Once --> Snap[Clone full world, controller and loop state]
    Snap --> Branch[Resume 41 suffixes before first different input]
    Branch --> Check[Compare complete world and events against full replay]
```

- The prototype uses the real `inputFor` and `stepWorld` functions.
- It saves every controller field, event history, maximum distance, stuck counter and elapsed tick count.
- It stops the common prefix before the earliest final-jump threshold can change an input.
- It rejects batches that differ in any earlier control setting.
- It compares full final worlds and events, beyond comparing only clearance scores.
- Cross-course reuse remains blocked on geometry and device dependency checks.
- Moving a platform can alter collision, terrain lookup, start placement, finish placement or contacts earlier than its visual location suggests.
- General prefix reuse belongs inside the trial evaluator, after exact equivalence tests for each supported obstacle family.
- The current experiment does not change production physics, the optimizer, or trial execution.

## Source map and checks

- [Search and bottleneck selection](../src/slice/easier.ts).
- [Worker lifecycle](../src/modes/editor/easier-workers.ts).
- [Candidate profiles](../src/modes/editor/easier-progress.ts).
- [Editor integration](../src/modes/editor/helper.ts).
- [Shared proof cache](../src/modes/editor/search.ts).
- [Reproducible benchmark](../scripts/bench-easier.ts) and [prefix prototype](../scripts/easier-prefix.ts).
- Unit checks cover worker limits, queued cancellation, malformed proofs, out-of-order completion, timing metadata and exact prefix replay.
- Browser checks use real simulator searches and verify Cancel, candidate cards, cached Preview and cached Apply.
- Marketing clips and accompanying post text are local throwaway outputs and are deliberately outside the repository.

## Explain exactly which press became easier

- Evidence: [named timing and exact move](evidence/easier-named-timing.jpg), [Apply transition frame](evidence/easier-apply-transition.jpg).

- Before, the result named only the smallest window: for example, 314 ms to 400 ms.
- The result now names the measured movement and position before and after the edit, next to the exact proposed object change.
- A jump result can say: “Before: Jump take-off at 17 m — 314 ms.”
- The next line names the timing after the edit and its measured width; a third line states the extra room for the hardest press.
- The checked move below tells the user which object moves and by how much.
- These are player timing windows measured by the simulator, not calculation times or model-written claims.
- Before and after minima are named independently: another movement can become the hardest one after a successful edit.
- Do not call two different bottlenecks the same relaxed timing.
- The start-deck marker remains excluded, even when it ties another window's width.
- The comparison is hidden if any proposed edit is switched off and retained in the applied summary for the full result.
- Apply interpolates the 3D drawing for 800 ms between the original grey outline and proposed teal outline.
- The course, proof and one undo step commit immediately; the visual transition does not alter simulation inputs or trigger another search.
- A new edit finishes the visual transition at the current course state, and reduced-motion preferences skip it.

```mermaid
flowchart LR
  A["Original proof<br/>Measured timing windows"] --> C["Name hardest timing before"]
  B["Winning proof<br/>Measured timing windows"] --> D["Name hardest timing after"]
  C --> E["Before / after / extra room<br/>Exact object edit"]
  D --> E
  E --> F["Apply commits course and proof<br/>One undo step"]
  F --> G["Drawing animates grey to teal<br/>Physics stays at final course"]
```
