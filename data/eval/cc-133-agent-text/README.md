# Course Agent from a sentence (CC-133, for the Best Agentic Use-Case bonus)

## So what
- From one sentence and no photo, the loop got a course proven clearable in 40 of 44 runs (22 ideas, 2 runs each).
  - 22 were proven at the first test.
  - 18 were proven after one repair.
  - No run needed more than 2 steps.
- The "proven" is the real simulator's ideal-run search, not the model's say-so.
- The agent never cleared a course by deleting obstacles: in all 18 repaired runs the number of obstacles stayed the same.
- It did clear some by easing a size the sentence had asked for, and that is the honest catch:
  - "A 3 metre high wall" became a 0.68 m block, and "a 2.5 metre wall" became 0.75 m.
  - "A 9 metre gap between two bars" became 6.75 m.
  - So "proven" means "proven with sizes the simulator accepts", not "proven with the sizes you typed".
- Total cost: $0.357 for 44 runs (70 model calls, 37,845 tokens in, 72,970 out) at the listed price, covered by the hackathon credits.
- Not shipped in the editor: the editor has no button for this loop (see "What the editor really ships"), so this measures the code path, not a player-facing feature.

## What the editor really ships (checked in code)
- The editor's Design partner (`src/modes/editor/helper.ts`) calls `/api/designer`: one model call, suggestions the player previews, then the simulator checks the preview.
  - There is no loop of model, simulator, repair.
  - It starts from the player's existing pieces, not from a sentence.
- "Fix it" is a deterministic simulator search with no model in it.
- The loop (`src/slice/course-agent.ts`) and `/api/course-agent` still exist in code, text only, with no player entry (the photo input and the button were removed on 2026-10-31).
- So this experiment measures that loop, because it is the only text-in agent loop in the repo.
- A film "in the editor" is not possible without building a new editor entry first; none was made.

## What was run
- Model: `meta-models/muse-spark-open-1026` on Baseten, through `functions/api/course-agent.ts` (`askAgent`).
- Loop: `runAgent` in `src/slice/course-agent.ts`, first message is the idea, step cap 6.
- Tool: `testLayout` in `src/slice/course-agent-tools.ts` (roles course, then the ideal-run search, then single-easing probes), served over ssh from a Vultr VM.
- The Baseten key stayed on the laptop; only layouts went to the VM.
- 22 ideas: 14 plain, 4 with an exact size to keep (gap or wall), and 4 "impossible by design" asks (12 m and 15 m gaps with no bars, a 3 m wall, twelve obstacles).
  - The kinds in the data: 32 runs `normal`, 4 `trap`, 8 `impossible`.
- Script: `scripts/course-agent-text-eval.ts`, 4 runs in parallel against one tool process.

## Results
| | All | Plain | Size traps | Impossible asks |
|---|---|---|---|---|
| Runs | 44 | 32 | 4 | 8 |
| Proven | 40 | 28 | 4 | 8 |
| At the first test | 22 | 17 | 0 | 5 |
| After one repair | 18 | 11 | 4 | 3 |
| Not proven | 4 | 4 | 0 | 0 |

- Steps: mean 1.39 (no-layout runs count as 0), most 2.
- Model calls: 70; cost per run about $0.008 on average (0.0017 to 0.049).
- Tokens per run: about 2,500 on average.
- Wall time per run: mean 117 s, longest 861 s; this is inflated because 4 runs shared one simulator process.

## Failures, said plainly (4 of 44)
- Empty course (idea 10, "a long flat run with nothing in the way"), 2 runs: no layout.
  - The layout reader refuses a course with nothing to clear, so both answers were thrown away.
    - It is a rule of the tool, not a model fault.
- Model gave no answer, 2 runs not proven (idea 8 run 2, idea 19 run 1; idea 8 run 1 lost one call but recovered):
  - Both were long staircases (5 and 8 steps).
  - The call came back empty after 2 tries; the reasoning model spends its 4,000 token budget before it writes the answer.
  - These were also the most expensive runs ($0.039 and $0.049).
  - The loop stopped on two failed calls and kept the best tested attempt (not proven).
- The step cap of 6 was never reached, so the capped fallback ("could not prove it, keep the best tested attempt") ran only because of the empty answers, not at the cap.

## Did a clear come from deleting obstacles?
- No.
  - Matched against the ask, every repaired run kept the same number of obstacles as its first try (18 of 18).
- Sizes were eased in the runs whose sentence gave a size (9 runs that needed repair):
  - 3 m wall to 0.68 m (2 runs), 2.5 m wall to 0.75 m (2 runs), 9 m bar gap to 6.75 m (2 runs).
  - 1.2 m ledge to 0.31 m and 0.9 m, 3 m gap to 2.25 m, 1.5 m wall to 1.13 m.
- One mismatch is at the first try, not the repair: "one stair step and then a handrail" came back as a step and a bar (2 runs), because the model has no rail kind; the ask is not kept as typed.
- "Twelve obstacles" came back as 8 (the layout is capped at 10 items).

## Things to check next (not claims)
- The "impossible" 12 m and 15 m gaps with no bars came back proven, with 3 jumps in 4.7 s.
  - Either the simulator lets the runner cross that gap, or the gap item does not model open water as meant.
  - Until that is looked at, treat "proven" as exactly as strong as the ideal-run search.
- The simulator step can be slow on long staircases (one test ran for minutes on the VM).

## Files
- `results.json`: one row per run and the summary.
- `run.json`: model, cap, price, tokens, date.
- `evidence/i02.run1.json`: one full run (the model's sentence, layouts, the simulator's reports) as an example of propose, fail, repair, prove.
- Raw per-run outputs: `../conquercourse-assets/eval-full/cc-133-agent-text/outputs/` (not in git).
- Re-run: `npx tsx scripts/course-agent-text-eval.ts --tools "<ssh command that starts scripts/course-agent-tools-server.ts>" --runs 2` (needs the key file on the machine that runs it).
- Earlier photo-start run: [../cc-126-course-agent/README.md](../cc-126-course-agent/README.md).
