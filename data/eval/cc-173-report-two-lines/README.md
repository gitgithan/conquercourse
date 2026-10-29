# CC-173: the end report picture shows two lines, You and Ghost
- So-what: the picture now reads as a race: the player's green line and the ghost's amber line over the course.
- The straight line the owner saw was the dashed finish marker, a two-point vertical line; it is gone from the new picture.
- No real path was sparse: Training paths had 819 points and lache 280.
## What it draws now
- Two solid lines: You (green) and Ghost (amber, wider and under the green so both show where the runs match).
- Ghost is whichever ghost is selected: the ideal run or a friend's run.
- No ghost selected: only the player's line.
- A path under 10 points is resampled along its own segments (`resamplePath`, `tests/report-path.test.ts`).
- `?report=old` keeps the first picture.
## Pictures (desktop 1280, friend run of the stored plan)
- Before: `before-training-new-picture.png`, `before-lache-new-picture.png`.
- After: `after-training-new-picture.png`, `after-lache-new-picture.png`.
- Old switch: `after-training-old-picture.png`, `after-lache-old-picture.png`.
- Made by `scripts/report-lines.mjs`.
## Not tested
- A real GPU.
- A ghost whose run differs a lot from the player's (the test run is the same plan, so the lines overlap).
- Phone widths (dropped by the owner).
