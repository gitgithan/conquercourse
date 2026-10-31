# Lab 9: Generate and test

## When you open it
- Precomputed: our setting (the recorded ideas, two repairs, 25 proposals, 2 s budget each) tested ahead of time with the same code (`scripts/labs-default-precompute.ts`, about two minutes); a test re-runs the first proposals and compares.
- Facts, strip, picture and reasons are filled.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## The question
- A helper proposes a course.
- Which of its proposals does the simulator throw out, and how does that change when you limit what it may propose?

## Where to open it
- `?mode=lab-gentest&labs=1`.
- It sits behind the labs switch, so new players never see it.

## What it runs
- The helper's proposals are recorded replies of Muse Spark Open (100 asks from CC-122, 95 readable), shipped as `public/assets/lab/gentest-proposals.json`.
- A built-in random proposer draws more, from a seed, inside your rules.
- The page makes no model call at all.
- Every proposal goes through the real code in a worker: the editor's lane builder, then the game's own ideal-run search.
- The search is driven with a work cap so a proposal that cannot clear does not run for a minute.

## The controls
- Who proposes: recorded Muse, random draw, or both.
- Pieces it may use: gaps, blocks, bars (ground is always allowed).
- Sizes it may use: gap width and block height, each with a least and a most; and the most pieces in one proposal.
- Repairs per proposal: 0 to 4.
- How much to test: the most proposals, and the search time per test in work seconds.

## What each output means
- Proposals tested: how many were run, out of those that fit your rules.
- Cleared as proposed: the ideal-run search found a clear on the first test.
- Cleared after repairs: a repair eased the piece where the best try stopped by a fifth (never past your minimum), and the test was run again, up to the repairs allowed.
- Thrown out: not cleared in the end.
- Why thrown out: the piece where the runner's best try stopped on the first test (gap, block, bar, plain ground), or the reply was not a course, or the lane was under 8 m.
- Cut off by the time limit: thrown out because the search stopped, not because it proved there is no clear.
- Proposals until the first clear, and expected tries for one clear (1 / p).
- A strip of one square per proposal; click one to see its side view, and the repaired version beside it.

## The maths (shown after a run)
- p = cleared / tested.
- Expected tries until the first clear is 1 / p, from the geometric distribution.
- A repair raises the rate to p + (1 - p) q, where q is the share of thrown-out proposals it saves.

## What we chose and why (shown last)
- In the game the models only propose and the simulator decides, last.
- A course idea reaches a player only after the ideal-run search has cleared it, and a repair is kept only if it is cleared too.
- The reason: a model can write a course that sounds fine and cannot be cleared, and only the simulator can tell.
- Recorded numbers: 95 of 100 asks gave a course, 20 cleared as drawn, 33 after the editor's Fix it.

## What the replay found
- The replay of the first 38 readable proposals agreed with the recorded run on every one (cleared or not as drawn).
- The lane builder squeezes any gap to 5 m (14 m with a bar), so a gap wider than 5 m is tested as a 5 m gap; "gap too wide" is therefore rare, and most rejections are blocks the runner cannot get over.
- A failing search can run for tens of seconds, so the page caps it; that is why some rejections say "cut off".

## What is not tested
- New model ideas: nothing is asked of a model, so the Lab cannot show a different model or prompt.
- The repair is a simple easing, not the editor's Fix it, so its gain is lower than Fix it's.
- Layouts with walls to climb, ropes or trampolines: the proposal grammar has only ground, gap, block and bar.
- The cut-off is counted in work, so it gives the same answer on a slow device, but the time it takes is not.


## How it was designed
- **The one question:** which of a helper's proposals does the simulator throw out, and how does that change when you limit what the helper may propose?
- **The choices and why those:**
  - Recorded replies of a model plus a seeded random proposer, so the page makes no model call and gives the same answer every time.
  - Rules the player sets (pieces, sizes, most pieces), because a limit on the proposer is the lever a designer really has.
  - A repair step that only eases the piece where the best try stopped, so the player sees what a cheap repair buys.
- **Which real game code runs:** the editor's lane builder and the game's ideal-run search (`src/sim/ideal.ts`), in a worker with a work cap.
  - The proposal grammar, the rules filter, the repair and the tally are Lab code (`src/labs/gentest/core.ts`).
- **Which data is precomputed:** `public/assets/lab/gentest-proposals.json`, 100 recorded asks (95 readable).
- **Order of the screen and why compare comes last:** goal, rules, the tested strip, the throw-out reasons, the maths on request, and "what the game does" last, so the player has seen a model's mistakes before reading why the simulator decides last.
- **Scope:** educational; the Lab cannot show a different model or prompt.

## How we prove the lesson is right
- `tests/lab-gentest.test.ts` (10 tests):
  - The pool holds the recorded proposals.
  - The simulator keeps the last word: an easy gap clears and a 4 m wall is thrown out and named.
  - A 40 m gap is tested as a 5 m one, a fact the Lab states.
  - A tiny time limit cuts the search off and says so, without claiming the proposal can never clear.
  - A reply that is not a course, and a lane under 8 m, are thrown out.
  - A repair eases only the stopping piece and never past the player's minimum.
  - Repair never lowers the number cleared, and the same input gives the same answer.
  - The rules filter recorded proposals and bound the random ones.
  - Expected tries to one clear is 1 over the clear rate.
  - The replay of the first 38 readable proposals agrees with the recorded run on whether each clears as drawn.
- Browser check: `scripts/lab-gentest-check.mjs`, evidence `docs/evidence/lab-gentest-recorded.png` and `docs/evidence/lab-gentest-repairs.png`.
- What would make the Lab's claim false:
  - A proposal the search clears but a player cannot, or the other way round.
  - A replay that stops agreeing with the recorded run.

## Limits
- **No new model ideas:** nothing is asked of a model, so the Lab cannot compare models or prompts.
- **The repair is a simple easing,** not the editor's Fix it, so its gain is lower.
- **The grammar is ground, gap, block and bar;** walls, ropes and trampolines are not tested.
- **Replay agreement covers the first 38 readable proposals,** not all 95.
- **The recorded numbers on the card** (95 of 100 gave a course, 20 cleared as drawn, 33 after Fix it) come from CC-122 and no test reads them.
- **Cut-off counts work, not seconds,** so the answer is the same on a slow device but the waiting time is not.
- Desktop keyboard and mouse at 1280 px only.

## How to make the lesson better
1. Replay all 95 readable proposals in a long test run and report any that differ.
2. Use the editor's real Fix it as the repair, so the gain matches the game.
3. Add walls, ropes and trampolines to the grammar.
4. Record a second model's replies and show two proposers side by side.
5. Add a test that reads the CC-122 numbers from the data and compares them with the card.
