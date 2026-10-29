# CC-166: the black pill in the middle of the screen

## So what
- The pill was the game's message line (`#msg`), which only has words when something is cleared or the Dojo hands back.
- Since CC-156 it has a dark panel, and the panel stayed on screen with no words in it: a black pill at the middle of the screen the whole run.
- It was useless when empty, so it is now hidden until it has words.
- Recommendation: keep it.

## Evidence
- `scripts/pill-check.mjs` scans the Training course (start, three runs, a jump) for empty dark boxes over the picture.
- Before: 5 of 5 moments show `#msg` (38x18 px at 621,274).
- After: 0 of 5.
- Pictures: `before-*.png`, `after-*.png`.
- Other things checked and fine: hint line, ghost chip, gauges, drums lane, looking-ahead inset (all have words or a picture).

## Not tested
- The What next card (one-time) and the music chip were not on screen in these shots.
- A real GPU.
