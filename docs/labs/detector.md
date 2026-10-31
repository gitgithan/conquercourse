# Lab 10: Evaluating a detector

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

## Not tested
- Only 22 scored cases from one run on six objects: the curve shows a shape, not a stable score.
- A made-up claim at the wrong place on a real part counts as missed only (the CC-49 rule), not also as made up.
- Another detector, another prompt wording or a point prompt was not run.
- Phones and touch: out of scope.
