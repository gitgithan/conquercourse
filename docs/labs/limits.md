# What the model cannot do

*Know the limits, stage 2 of 3: Check (see [the series map](pipelines.md)).*
*Before it: the Labs that teach the checks: [Evaluating a detector](detector.md) (precision and recall) and [Computer vision](vision.md) (the mask threshold).*
*After it: [System design](system-design.md) (System design, the finale) builds the whole product out of these checks.*
*The full table of model weaknesses, with numbers, is in [model limits](../model-limits.md); the lessons behind it are in [lessons](../lessons.md).*

## When you open it
- Live: it opens with all 11 failure cards already sorted into our bins, one card selected, and its "what we did instead" showing.
- The gate widget opens at the game's own limit (2 times), so the table reads precision 100% and recall 50% on the 14 real lifts.
- The design challenge opens with the naive design (nothing checks the answer), so every verdict starts red and the player fixes it.
- A small label says "Showing our setting, already run"; sort, slide or pick to try your own.

## The question
- Every model in the game gets some inputs wrong.
- Which failures do we give up on, which do we cover with a check or a person, and which did we never need a model for?
- Open it at `?mode=lab-limits&labs=1`.

## What runs
- Nothing calls a model.
- Everything on the page is a recorded result from `data/eval`, built into small files by `scripts/lab-limits-build.py`.
- Sort the failures:
  - 11 cards, each a real picture and what the model gave back, dragged (or pressed) into three bins: can't do it, can with help, no model needed.
  - Each card then shows the kind of thing we did instead: a fallback, the simulator as judge, the plausibility gate, or a person dragging a box.
  - The player's sorting is compared with ours; a different bin is allowed and explained, not marked as a fault.
- Move the limit of a real gate:
  - The gate is the game's lift check: a lift is flagged when its shape is more than a limit too wide or too narrow compared with the cut-out (`pipelines/ccpipe/padretry.py`).
  - 14 hard photos, each with the ratio the game computed and a rating by eye (usable, partly, bad).
  - The slider moves the limit; the table, precision, recall and F1 and the two curves follow.
  - A tick box counts "partly" as bad too.
- The finder's score cut: 12 outlines the finder gave on the monkey-bars photo; a cut can only throw outlines away.
- Pick the cheapest safe design for three stages (find, lift, move): safe means something that is not the same model checks the answer, and there is a way out.
- A button shows the maths (equations are allowed in Labs).
- Lab code only: `src/labs/limits/limits-core.ts`.

## How it was designed
- **The one question:** what can a model not do, and what does the product do about it?
- **The choices and why those:**
  - Real pictures, not drawings, because the failure is the lesson (a flat plank where the loops were).
  - The sorting has no single right answer for every card, so a different bin is shown beside ours and the reason.
  - The gate is the one place where we have both the game's number and a person's rating on the same photos, so precision and recall can be shown honestly.
  - Cost is counted in paid model calls per object, not dollars, because prices change and calls do not.
  - "Three calls for three stages" is the point: one model proposes, something plain checks.
- **Which data is precomputed:** all of it (cards and numbers), from tracked `data/eval` files.
- **Order of the screen and why:** sort first (see the failures), the gate next (a check you can tune), the design last (put the checks together).
- Nobody's technique is graded: the cards are about models, not about people.

## How we prove the lesson is right
- `tests/lab-limits.test.ts` pins:
  - 14 photos, and each ratio equals extent aspect over mask aspect.
  - Every card has a picture on disk and a tracked source file.
  - A looser limit flags no more lifts and recall never rises; the table always adds to 14.
  - At the game's limit precision is 100% and recall is 50%.
  - With nothing flagged, precision is "n/a", never 0 or NaN.
  - A score cut never finds a bar pattern the finder missed (best overlap stays under 10%).
  - Each stage has one cheapest safe option; the naive option and a model grading a model are unsafe; the free option does no job.
- What would make the Lab's claim false: a limit where recall rises as the limit loosens, or a cheapest safe design that costs more than 3 calls.
- Browser check: `scripts/lab-limits-check.mjs` opens the page at 1280 px, drags a card, moves both sliders, picks the best design, and fails on a page error.
- Picture: [the Lab at 1280 px](../evidence/cc-133-pipeline-labs/lab-limits.png).

## What we saw
- At the game's limit the gate never cries wolf (precision 100%) but lets half of the lifts a person rated bad through.
- A tighter limit catches more bad lifts and starts flagging good ones: recall and precision trade places.
- The finder's best outlines overlap the two bar patterns by 2% and 5%; no score cut fixes a miss, so a person drags a box.
- Checking a model with the same model is not a check; a plain gate or the simulator is.

## Limits
- 14 photos is small: the curves are steps, not smooth lines.
- The ratings were made by eye by one person (the product owner's team), so "bad" is a judgement.
- Only one gate is tuned; the plausibility gate for motion has its own limits in [Video to motion](motion.md).
- The design options are written by us; they show the idea, they are not every choice.
- The sorting bins are our opinion, not a measurement.
- The photo cards use CC0, CC BY and CC BY-SA photos; the two bar cards use a CC BY-SA photo (demo only; swap before a sale, see `docs/ASSETS.md`).
- Photo credit for the saved-box card: Dmytro Petishkin, CC BY 4.0.

## How to make the lesson better
1. Let the player add a 15th photo and rate it, then watch the table change.
2. Run the motion gate the same way with its own ratings.
3. Show the cost in cents beside the call counts.
4. Add a card for the next model failure we find.
5. Let the design challenge use the blocks of System design.
