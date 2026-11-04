# Evaluating a detector

## When you open it
- Live: it opens on the recorded detector data with the scores and the "what the game does" card already shown.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## See also
- A chip at the top jumps to the computer vision Lab: "See where the threshold comes from".
- Both Labs keep their own widgets; the link carries no state.
- The list lives in `SEE_ALSO` in `src/ui/labs-series.ts`, by mode name.

## The question
- A helper program looked at six park objects and was asked to point at the part a hand could hold.
- Is it good enough to place holds for us?
- Open it at `?mode=lab-detector&labs=1`.

## The data
- The helper is PartLLM (Apache-2.0), run once on 2026-10-28 for CC-49; the full trail is in `data/eval/partllm/`.
- The answer key was labelled by hand from side and top views of each object.
- The Lab ships only a table of the recorded numbers: `public/assets/lab/detector-partllm.json` (about 5 KB, 24 rows).
- No model runs on the page and no paid call is made.

## The controls
- Words asked for: bar, rail, ledge, step.
- The claim line: the share of the object the helper must paint before it counts as saying "there is a part".
- The on-hold share: how much of a claim must sit on the real hold to count as found.
- "Keep this setting" adds the choice to a list so settings can be compared.

## What each output means
- **Found:** a real part exists and the helper painted it in the right place.
- **Missed:** a real part exists and the helper said nothing, or painted the wrong place.
- **Made up:** no such part exists and the helper painted one anyway.
- **Confusion table:** the same four counts in a 2 by 2 grid.
- **Precision:** found divided by (found + made up).
- **Recall:** found divided by (found + missed).
- **F1:** 2PR/(P+R), low when either is low.
- **Sliding curve:** the same three numbers at claim lines from 0% to 80%; the dot is the best F1.
- **Which words work:** the table per word.
- **Which labelled parts are hard:** the share of claim lines at which the helper is right on that part.
- **The maths:** shown on request, equations allowed in Labs.

## What we chose and why
- The game does not use this detector to place holds.
- It found 2 of 9 real parts (both the top tube of a handrail) and made up a part in 11 of 13 absent cases.
- It must answer for every word, and it was trained on furniture-like parts, not skate-park edges.
- Moving the claim line cannot fix it, because the made-up and the real parts are painted in similar amounts.
- Holds stay with a person or the bar tools the simulator checks; a newer release is the next test.

## How it was designed
- **The one question:** is this detector good enough to place holds for us, and can a threshold fix it if not?
- **The choices and why those:**
  - Words asked for, the claim line and the on-hold share are the three things a person tuning a detector really changes.
  - Found, missed and made up are the three outcomes that matter for placing a hold, and they feed a 2 by 2 table so precision, recall and F1 are earned from counts.
  - The sliding curve shows the whole trade-off, not one setting.
- **Which real game code runs:** none; the game does not use this detector.
  - The Lab's scoring is `src/lab/detector-lab.ts`, and it runs in the page.
- **Which data is precomputed:** everything.
  - `public/assets/lab/detector-partllm.json` (24 rows) is copied from `data/eval/partllm/scores.json` and the answer key of the CC-49 run of 2026-10-28.
  - The answer key was labelled by hand from side and top views of six objects.
  - The model is PartLLM (Apache-2.0); it ran once, not on the page.
- **Order of the screen and why compare comes last:** controls, the counts and table, the sliding curve, then which words and parts are hard; what we chose comes last so the player sees that no threshold rescues the helper before reading that we did not use it.

## How we prove the lesson is right
- `tests/lab-detector.test.ts` (8 tests):
  - At the shipped settings the Lab reproduces the recorded numbers from `data/eval/partllm/scores.json`: found equals present hits (2 of 9) and made up equals absent false claims (11 of 13).
  - Every one of the recorded verdicts is reproduced case by case.
  - Precision, recall and F1 follow their definitions on a small hand-made list.
  - Raising the claim line never adds made-up claims or finds, and a claim line of 100% finds and claims nothing.
  - The best F1 on the curve is under 0.5 and not below the default setting's F1.
  - Asking for "rail" finds the 2 real rails and "ledge" finds none.
  - The hard-parts list has the 22 scored cases, lowest first, and the stairs ledge scores 0.
  - The result is deterministic.
- There is no browser smoke script for this Lab; evidence pictures are `docs/evidence/lab-detector-start.png` and `docs/evidence/lab-detector-after.png`.
- What would make the Lab's claim false:
  - Any claim line giving an F1 of 0.5 or more (the best-F1 test fails).
  - A re-run of the helper that finds many more of the real parts (the tests would need the new recording).

## Limits
- **Small data:** 22 scored cases from one run on six objects; the curve shows a shape, not a stable score.
- **Hand labels:** the answer key is ours and was made by eye.
- **One scoring rule:** a made-up claim at the wrong place on a real part counts as missed only (the CC-49 rule), not also as made up.
- **One detector, one prompt style:** another detector, a point prompt or another wording was not run.
- **Unbacked sentences on the "what we chose" card:** that the model "was trained on furniture-like parts" and "must answer for every word" are explanations, not tested here.
- **Sliding the claim line re-scores stored numbers;** it does not re-run any model.
- No phone or touch layout (out of scope).

## How to make the lesson better
1. Run a newer detector release on the same six objects and add it as a second recording, so the Lab can compare two helpers.
2. Add objects and labelled parts so the curve is stable (at least 50 scored cases).
3. Add a second labeller on a subset and show how much the answer key itself disagrees.
4. Show confidence intervals on precision and recall, so small data is visible.
5. Add a browser smoke script like the other Labs.
