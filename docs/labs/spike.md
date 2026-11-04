# Lab 20: Spike the riskiest call first

*Foundations, "Plan the work": the way we add a new move or obstacle, as a Lab.*
*It is a method behind all three pipelines, so it has no stage of its own in [the series map](pipelines.md).*
*The three lessons it comes from are [move creation](../lessons-move-creation.md), [obstacle creation](../lessons-obstacle-creation.md) and [move and obstacle interactions](../lessons-move-obstacle-interactions.md).*

## When you open it
- Live: it opens on "Add a bar obstacle" with the six risks ranked by scare, and "The finder outlines the bars" set as the thing that fails.
- Every output is filled: the risk board, the two timelines side by side, the challenge (starting from "build it all, test at the end", which does not pass), the "not tested" card and the wall story replayed to its end.
- A small label says "Showing our setting, already run"; change a control to try your own.

## The question
- A new move or obstacle has many things that can go wrong.
- Which one do you test first, with what, and what does a wrong order cost?
- Open it at `?mode=lab-spike&labs=1`.

## The five ideas, in the order the page teaches them
- **List the risks.**
  - Each risk is something that can stop the feature: a model that may not find the object, a motion that may not exist.
- **Rank by scare.**
  - Scare is the chance it fails times the hours of work riding on it.
  - Work "riding on it" is the risk's own build plus everything built on top of it.
- **Spike the riskiest one first, with the cheapest test.**
  - A spike is the smallest test that can say yes or no, for example a free check on the CPU before a paid run.
- **Keep a fallback.**
  - Every card has the hours it costs to switch; a failure that finds a fallback costs hours, not the project.
- **Order by dependencies.**
  - A test that needs another test's answer runs after it.
  - A weakened test that fails is "not tested", not "failed" ([lessons](../lessons.md), Process).

## What runs
- The logic: `src/labs/spike/spike-core.ts` (pure functions, no page).
  - `scare`, `rankByScare` and `riding` for the board.
  - `evaluate` runs a plan once with one thing really failing: when it is found, by what, how much work is thrown away, the whole project time and the money.
  - `checkChallenge` is the hard budget check.
  - `verdict` says "passed", "failed" or "not tested".
- The page: `src/modes/lab-spike.ts`.
- Data from our own experiments, read by the test against the files:
  - The wall clip story from [data/eval/cc-17-wall](../../data/eval/cc-17-wall/README.md) (`run.json`: 2.95 and 2.19 GPU minutes, about $0.07).
  - The monkey-bar motion story from [data/eval/bar-motion](../../data/eval/bar-motion/README.md) (`run.json`: 22 capture stretches, none pass travel; Kimodo 0 of 8; about $0.10).
- No worker, no model call, no paid step.

## The five cards
1. **The risk board.**
   - Six (bars) or five (wall) cards; drag one, or press Earlier and Later, to set your order of tests.
   - Two sliders per card: the chance it fails and the hours to build it.
   - The orange meter is the scare; "Sort by scare" puts them in order.
2. **The same project, two plans.**
   - Pick what really fails; the page draws "build it all, test at the end" and "test first in your order" on one clock.
   - A red flag marks the hour the failure was found; red blocks are work built again.
   - Put a test before the one it needs and its block turns grey with a question mark: not tested.
3. **Challenge: order the plan.**
   - Twelve (or ten) steps: a build and a test for each risk.
   - The hard rule: whatever fails, a real test finds it by the hour limit, at most the wasted-hours limit is thrown away, and the tests cost at most the money limit.
   - It starts from the plan that fails, and "Show one answer" fills the plan that passes.
4. **Not tested is not failed.**
   - The wall run-up test with four inputs to tick; with an input missing the answer is "NOT TESTED" whatever the sample count says.
5. **Replay a real story.**
   - Two real stories, event by event, with free and paid steps, minutes, dollars, what each told us and what we decided.

## How it was designed
- **The one question:** which test first, and what does the wrong order cost?
- **The choices and why those:**
  - A plan is a list of build and test steps, because the order is the lesson.
  - The cost of a late failure is measured in hours of work thrown away, which is what hurts in a half-day issue.
  - A test has "needs" so that the lab can show "not tested" with a real rule instead of a warning.
  - The challenge uses our fixed numbers, and the sliders only change the board and the two plans, so the pass line stays meaningful.
  - Two features are offered because one is a photo to obstacle (bars) and one is a clip to move (wall); the same rules cover both.
- **Which real game code runs:** none; this Lab teaches how we work, so it runs its own pure logic.
- **Which data is precomputed:** none.
  - The two stories are typed into `spike-core.ts` and the test reads `run.json` and the README to check them.
- **Which numbers are ours and which are measured:**
  - Measured: the dollars, GPU minutes, counts and pass lines in the stories, and the facts on the cards ("4 of 8", "2.42 m against 1.07 m").
  - Our guesses: the chances, the build hours, the test hours and the fallback hours; the sliders exist because they are guesses.
- **Order of the screen and why:** pick a feature, rank, compare plans, try the challenge, see why a missing input is not a fail, replay the real story, then the maths behind a button.

## The two real stories
- **The wall clip (CC-17).**
  - The first text-only tries gave 0 of 36 and were "not tested": no path, no contact targets.
  - The tools were built, then a free check on the CPU found that the simulator's grab is 2.42 m from the hips and a Rookie arm reaches 1.07 m.
  - Only then were two paid rounds run (about $0.04 and $0.03); both met 2 of 8 pass lines; the stop rule written before round 1 ended the series.
  - Order mattered twice: tools before the paid test (so a fail meant something) and the free check before the paid test (so the target was one a body can reach).
- **The monkey-bar motion.**
  - A free scan of the capture set found 0 of 22 hang stretches that pass hand over hand.
  - One paid Kimodo round (about $0.10) showed 0 of 8 on the bar check: the hands stay near 1.1 m, the rungs are at 2.2 m.
  - The fallback (procedural clips) was already the plan, so the failure cost one cheap round, not the feature.

## How we prove the lesson is right
- `tests/lab-spike.test.ts` pins:
  - The data is consistent: every dependency exists, no cycle, and every test is cheaper than the work it guards.
  - Scare is chance times riding hours, the ranking follows it, a slider changes it, and a tie goes to the cheaper test.
  - Test-at-the-end throws away exactly the work riding on the failure.
  - Spike-first wastes nothing and finds every failure inside the hours of all the tests, and its project is shorter than test-at-the-end in every case.
  - A property test over random plans: moving a test to the front never wastes more.
  - A test before the test it needs is "not tested" and the failure is found only by playing it all.
  - The challenge fails for test-at-the-end and for reversed test order, and passes for the reference plan; one early build passes and a larger one fails; the money limit is hard.
  - `verdict` returns "not tested" for any missing input.
  - The stories equal the files: the rounds, minutes, dollars and counts are `run.json`'s, and the README holds the numbers quoted.
- What would make the Lab's claim false: a valid plan where testing first loses more than testing at the end, which the property test looks for.
- Browser check: `scripts/lab-spike-check.mjs` opens the page at 1280 px, checks every output, drags and presses a button to reorder, reaches "Solved" and fails on a page error.
- Picture: the Lab at 1280 px is `docs/evidence/cc-133-pipeline-labs/lab-spike.png`.

## What we saw
- On the bar obstacle, with our numbers, the riskiest thing is the body motion (scare 6.8 h), then the finder (6.5 h), and test-at-the-end throws away 13 h when the finder fails.
- The cheapest test comes first only when it can: the finder, lift, fit and reach tests each need the one before, so the order is partly set by dependencies, not by scare.
- Moving the finder's chance slider to 90 makes it the scariest card.
- For the wall, the scariest risk by far is the free one (can a body reach the grab), which is why it goes first and costs $0.

## Limits
- The chances, build hours, test hours and fallback hours are our guesses; only the stories hold measured numbers.
- Failures are taken one at a time; two failures at once are not modelled.
- Hours of work are not recorded in the issues, so the stories show dollars and GPU minutes, not person hours.
- The wall story's order was not an experiment: we cannot prove another order would have cost more, only that this model says so.
- The model counts work thrown away as work built again; real rework is sometimes smaller and sometimes larger.
- "Scare" ignores how much a failure teaches; a cheap test that explains a cause (the hands stay at 1.1 m) is worth more than its number.
- Two features only; a photo, a clip, a move and an obstacle each have their own risks.
- Equations are behind a button and are the same as in the code.

## How to make the lesson better
1. Record person hours in each issue, then replace the build-hour guesses with the measured ones.
2. Add a third feature: a new key and move (the vault), with its replay and key-card risks.
3. Let the player add their own risk card with its chance and cost.
4. Show two failures at once and let the second test be skipped after the first fails.
5. Link the stage Labs by name (Lab 14, Lab 15, Lab 13) next to the card they came from.
