# Course Agent evaluation (CC-127, for CC-126 Best Agentic Use-Case)

## So what
- The loop works: given a photo-drawn course, the agent got it proven clearable in 40 of 40 runs, in at most 3 steps.
- One-shot Muse Spark Open cleared 13 of 20 as drawn (CC-52); the agent cleared 20 of 20 starting from those same drafts.
- Fresh end to end from the photo, it cleared 20 of 20 (15 at the first try, 5 after a repair).
- For the demo: it is the strongest honest agent story we have, because the tool is the real simulator and every claim is proved.
- The fallback is built in: at the cap of 6 steps it reports it could not prove the course and keeps the best tested attempt. No run reached the cap, so that path is tested by unit tests only, not by a real photo.

## What was run
- Model: `meta-models/muse-spark-open-1026` on Baseten, through `functions/api/course-agent.ts` (the same function the site uses).
- Tool: `src/slice/course-agent-tools.ts` (the editor's own proof: roles course, then the ideal-run search), served over ssh from a Vultr VM.
- The Baseten key stayed on the laptop; it is not on the VMs, so the model calls ran there and only layouts went to the VM.
- Part 1, paired: the 20 saved one-shot drafts of CC-52 (10 photos, 2 runs each) are the starting point, so any gain is the repair loop alone.
- Part 2, fresh: 10 photos, 2 runs each, the agent proposes from the photo and then repairs.
- Step cap: 6 (one proposal and up to five repairs). Repair turns are text only: the first sentence, the numbered layout, the simulator's report.

## Results
| | Paired (from CC-52 drafts) | Fresh (from the photo) |
|---|---|---|
| Runs | 20 | 20 |
| Proven clearable | 20 | 20 |
| At the first test | 13 | 15 |
| After one or more repairs | 7 | 5 |
| Steps, mean (most) | 1.4 (3) | 1.3 (3) |
| Model calls | 10 | 26 |
| Tokens in / out | 7,133 / 19,641 | 25,437 / 31,597 |
| Cost | $0.093 | $0.166 |
| Kept every obstacle of the answer key | 20 of 20 | 20 of 20 |

- Baselines (CC-52, one-shot): 13 of 20 clear as drawn; 13 after Fix it; 15 after Fix it and dropping bars.
- Total cost: $0.26 (listed Baseten price of $1.25 in and $4.25 out per million tokens; the hackathon credits cover it).
- Three steps was the most any run needed: park05 run 2 (paired) and new02 run 2 (fresh).

## Did a "clear" come from deleting the obstacles?
- No run cleared with fewer obstacles than the answer key; every key obstacle was matched (matched share 1.0 in both parts).
- The model does ease sizes: in the 6 repaired paired runs with a size error, the mean error against the key went from 0.51 to 0.48 (so no worse).
- The model sometimes lowered a wall to the exact height the simulator named (for example 0.9 m down to 0.49 m on park05 run 2), which clears it but is a lower wall than the photo shows.
- So "cleared" means "cleared with sizes the simulator accepts", not "cleared with the photo's true sizes".

## Caveats, said plainly
- The fresh first-try rate (15 of 20) is higher than CC-52's 13 of 20, but the prompt also changed (it now mentions the simulator's report) and the samples are 20 runs of a sampled model, so do not read it as a gain from the agent.
- The paired part is the clean comparison: same drafts in, 13 stay cleared and 7 of the 7 failures are repaired (park01 run 1 had no layout and was proposed from the photo).
- Photos are 10 park photos; the answer key is one person's eyeball, not truth.
- The tool tries single easings of one obstacle only; a course that needs two changes at once is reached by the model's own repair, not by a proved single change.

## Files
- `outputs/<part>.<photo>.run<n>.json`: every step (the model's sentence, the layout, the simulator's report, the trace line), tokens and cost.
- `results.paired.json`, `results.fresh.json`: one row per run and the summary.
- `run.paired.json`, `run.fresh.json`: model, cap, tokens, price, date.
- Re-run: `npx tsx scripts/course-agent-eval.ts --part paired|fresh --tools "<ssh command that starts scripts/course-agent-tools-server.ts>"` (needs the key file on the machine that runs it).
