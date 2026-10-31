# Lab 9: Generate and test

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
