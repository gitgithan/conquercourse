# CC-163: top-right buttons stay off the time line and the Restart chip

## So what
- On a phone-width screen nothing covers the time line or the R Restart chip any more.
- Desktop (1280) keeps its layout; the runner pick moved 12 px left so it no longer touches Ideal run.
- Recommendation: keep it.
- Next step: playtest on a real phone.

## What moves at 390 px (CSS only, under 700 px wide)
- Dojo (T) drops to a second row, the ghost chip goes to its left, Rotate Camera below.
- The obstacle strip and the keys card step down.
- Hidden on narrow screens: runner pick, Edit, Whole course, Ideal run, Debug, Community courses (their keys and the fall panel still work).

## Check
- `scripts/narrow-shots.mjs` tests every pair of top boxes for overlap: before 1 overlap at 390 (chip and course buttons); after 0 at 390 and 0 at 1280.
- Pictures: `before-*.png`, `after-*.png`.

## Not tested
- A real phone.
- Landscape phones between 700 and 900 px.
