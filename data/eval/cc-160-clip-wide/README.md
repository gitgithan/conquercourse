# CC-160: the clip shows about 20 m of course

## What this means for the game
- The share clip used to show 2.9 m across, so a viewer saw a runner and no obstacle.
- The default clip now shows 20 m across, with the camera looking a fifth of the picture ahead of the runner.
- The tall 9:16 picture keeps the runner small (4.9% of the height, about 63 px), so a soft ring is drawn round them.
- The 16:9 picture (`?clipshape=wide`) shows the same 20 m and keeps the runner readable (15.6% of the height, about 112 px).
- Recommendation: post the 16:9 clip on X and YouTube, and keep the tall one for TikTok and Reels.
- The old close view stays behind `?clipzoom=close`.

## Measured (viewport 1280 x 720, 3 courses, 9 clips)
- Close: 2.9 m across, runner 34% of the picture, on all three courses.
- Tall 20 m: 20.0 m across, runner 4.9% of the picture, ring drawn.
- Wide 20 m: 20.0 m across, runner 15.6% of the picture, no ring.
- Courses: Training: every move (27.7 s), Park run (7.3 s), Climb: over a 2 m wall, then a big drop (8.5 s).
- Pictures: `<course>-<view>-<1|2|3>.png`, taken at 20%, 50% and 80% of each clip.
- The numbers per clip are in `run.json`.
- Zero page errors.

## How
- `src/share/clip.ts` now has a layout (picture size, band, metres across) for each of the three views.
- The camera distance comes from the metres across, so the same maths holds on any window shape.
- The wide camera sits about 24.5 m away in the tall view and about 15.4 m away in the 16:9 view on a 1280 x 720 window.
- No scenery was in the way in the nine clips I looked at.
- Check: `node scripts/clip-wide-check.mjs` (run on VM2, 497 s for the Training clip on the software GPU).

## Not checked
- The tall picture has a lot of sky above the runner; I did not try a shorter band.
- A phone viewer sees the runner small in the tall picture; I did not test it on a real phone.
- I did not offer a switch between the shapes in the page, only the address flags.
- Courses with scenery near the camera (trees or a tunnel) were not in the three courses.
