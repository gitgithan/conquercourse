# CC-161: the roll after the second lache bar

- Serves the all-obstacles course ("Training course: every move").
- The product owner meant the second bar of the lache pair, not the rope.
- The rope is back to its old design (anchor 90, 6.6, length 9).

## What the numbers say

- Before: the best line skipped bar 2 (3283 ticks against 3410 for bar to bar), so nobody dropped off bar 2 in the best line.
- Off bar 2 on the old deck the landing was 7.1 m/s, which a squat takes cleanly (limit about 8.5 m/s), so no roll was needed.
- The skip line landed on the deck at about 4 m/s.

## What changed (the smallest change that works)

- The far deck now starts at x 74 instead of 71.8, and its top is 0.5 m lower (-0.5 instead of 0).
- The gap is 12 m, so a flight from bar 1 alone cannot reach the deck; skipping bar 2 is no longer possible.
- The drop off bar 2 is bigger: 8.24 m/s at landing.
- A stiff landing at that speed would be about 82 m/s², above the 80 m/s² hurt limit; the line rolls instead.

## Result (search on VM2, 231 s)

- Routes: only "bar to bar", 3492 ticks (29.1 s), chosen; no shortcuts left.
- Rolls: one after bar 2 (tick 1579, 8.24 m/s) and one at the end (tick 3356, 9.9 m/s).
- The rope landing is a plain squat at 6.6 m/s, no roll.
- Picture: `roll-path.png` (the roll lands at about x 75 on the far deck).

## Known gap

- The old lesson "the best line skips the second bar" is gone from this course; it still lives in the other courses with routes.
- The path chart does not mark the roll; the roll is read from the run events.
