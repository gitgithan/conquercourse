# CC-148: character gauges in one bottom-left stack

## What the pictures show
- `course-old.png`, `drone-old.png`: `?gauges=old`, the speed bar at the top centre, no battery bar.
- `course-new.png`, `drone-new.png`, `cannon-new.png`: the stack at the bottom left, with the ghost panel open and the drums on.
- `phone-new.png`, `phone-drone.png`: a 390 px wide phone with `?touch=1`; the stack sits above the thumb buttons.
- The scene is dark because the VM draws with a software GPU; the HUD is what matters here.

## What we found
- The drone battery was never a bar; it was one line of text that is blank while the runner is in the air.
- Now the drone course has a battery bar, full before boarding, red at 20 percent or less.
- While the keys card is open the stack steps to its right; on a narrow screen it steps over the drum lane.
- Reproduce: `node scripts/gauge-shots.mjs` (set `PORT` if 5173 is taken).
