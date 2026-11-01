# CC-200 and CC-91: does the World Editor agree with the World Slicer?

## So what
- Where the Slicer says a lane has a path, the Editor says the same: 844 of 844 cases.
- The Slicer's winning keys, replayed in the course the Editor builds, clear the run in 844 of 844 cases.
- Roof start on or off makes no difference to that.
- 21 of the 844 cases build a course that differs by 0.01 m on a few steps (a rounding tie); the verdict and the replay were the same in all 21.

## What was run
- Script: `scripts/lane-equal-sweep.ts`, one process per place, on VM2; `scripts/lane-equal-aggregate.mjs` joins the results.
- 47 ready places, each at its stored shrink.
- Cut heights every 3 m, from 3 m to the top of the place; roof start off, then on.
- 1176 cases in all (588 heights, two modes).
- Slicer verdict: `provedLane`, the ideal-run proof the Slicer uses for "a path exists".
- Editor verdict: the hand-over as `map.ts` and `editor.ts` do it.
  - The picked buildings arrive as separate pieces where they stood.
  - The Editor sinks them by the cut height and starts the water at 0.
  - The lane is read by `roleCourse` (the Editor's own course builder), then the Editor's ideal-run search runs on it.
- Replay: the keys of the Slicer's own ideal run are played in the Editor-built course.
- Not covered: the Editor's own "find a lane" button, and a lane the player drags by hand.

## Results
- `scores.json`: totals.
- `run.json`: per place, with every case that differs in any way.
- `table.md`: the table also shown in `docs/cut-height.md`.
- Verdict disagreements: 0.
- Replay failures: 0.
- Course differs: 21 cases, all with roof start off; a step top that rounds to 0.79 in one and 0.80 in the other.
  - Cause: the Editor sinks the pieces by the cut in 32-bit numbers, so a height of exactly 0.795 can fall either side of the rounding.
  - It is a 1 cm step; it changed no verdict.

## Roof start losses
- Cut heights that clear: 349 of 588 with roof start off, 495 of 588 with it on.
- 38 places gain heights, 3 stay equal, 6 end with fewer; 29 places lose at least one height.
- Eixample (Barcelona): lost at 12 m and 15 m.
  - `eixample-why.json`: the lane the old rule proves at those heights reads the same and clears with roof start on.
  - The loss is the search, not the place: the Slicer proves at most 4 candidate lanes per height, and with roof start the ranking puts other lanes first.
  - With 40 proofs allowed, a path is found at both heights.
- The other places with losses were not checked one by one; the same cause is the likely one.

## Raw output
- Per-place files: `../conquercourse-assets/eval-full/cc-200-lane-equal/`.
