# Playtest feedback, round 5 (2026-10-27)

*Tracked in Linear as CC-35.*

## Answers
- R5-D1 (why guess at all? what is interactive?):
  - The guess, the lock and the "make a new prediction" button are gone.
  - The sliders are the values: the picture and the answer update while you drag.
  - "Run it" only keeps the line so the next one can be compared with it.
  - A lesson's saying is earned by running three different settings.
- R5-D2 (scrubbing belongs on the formula page):
  - The formula step has sliders for exactly the numbers in the formula, and shows the sum with those numbers.
  - Moving one slider leaves the others where they are; the wall height has a slider that visibly does nothing, because it is not in the formula.
  - The simulator's own answer is shown beside it, so the gap between "exact" and "realistic" is visible.
- R5-D3 (Landing): the graph is the push on you against time.
  - The block's width is the time spent stopping, its height the push, its area the speed you lose.
  - More time means a wider, shorter block with the same area.
  - The red dashed line is the Course's stumble limit (60 m/s²).
  - The pain meter is gone; the answer is the push in m/s² and in multiples of gravity.
  - The time axis now ends at 0.5 s, the end of the slider.
- R5-D4: the Landing picture is my reading of "areas of impact spread out over time"; if you meant the older height-against-time picture, say so.

## Changes
- R5-G1: the standing pose is built bone by bone (upright, slight forward lean, soft knees, arms hanging with bent elbows); it was a captured frame before.
- R5-G2: the controls are a card of key caps at the top left (H hides it).
- R5-G3: the camera button is a ring with three nodes that turns a third each time C is pressed (or when it is clicked), with the view's name under it.
- R5-G4: the side camera is further back, so the whole trampoline is in view.
- R5-F1: every question on the feedback form says "(optional)", and a banner says so.

## Open
- Interactive objects on the picture itself (drag the take-off point or the release angle) are not built; the sliders are the interaction for now.

## Follow-up (same day)
- R5-G1b: the forward lean made the Rookie look hunched; the ready stance now stands straight up with no lean.
- R5-S1: the wall's hand reach is now 1.3 m above the hips (it was 2.1 m, more than a body can stretch; the CC-17 finding).
  - The feet must now climb 2.0 m instead of 1.2 m, so the wall needs about 6.6 m/s at its foot instead of 5.1 m/s.
  - The Dojo, the speed meter and the ideal run follow the new number; the bot still clears the whole Course.
- R5-G1c: the stance had shoulders slightly forward and bent elbows; now the shoulders are level with the body and the arms hang straight down with straight elbows.
- R5-G1d: the shoulders looked tense and raised; the stance now takes the shoulder and upper-arm directions from the model's own T-pose (kept level, never raised), then lets the arms hang straight down.
- R5-G5: the trampoline message flashed too fast to read.
  - It only showed during the bounce itself; now it appears about 14 m before the trampoline and stays up to 4 seconds (measured 3.95 s of game time before the bounce with the ideal bot).
  - It switches to "Press Space now" when the bounce starts.
- R5-G5b: after a full restart the trampoline cue showed again; the cue now starts over whenever the runner is far from the bed or the attempt is over (checked: no cue after Shift+R).
- R5-G6: an obstacle strip under the speed meter.
  - One icon per obstacle of the course in play (gap, precision block, wall, rope, trampoline); cleared ones are dimmed and grey.
  - The ones still ahead glow gold in a wave that runs along the strip; the next one is bigger and shows its name.
  - An obstacle counts as cleared once the runner is past the end of its zone; it follows the course, so a redesigned course gets its own icons.
- R5-G7: the controls card only lists the three keys you hold or press while running (arrows, Space, down arrow).
  - R and Shift+R are on the fall panel, where they matter; I (Ideal run) and T (Dojo) are on their buttons.
  - "Rotate Camera (C)" is the caption of the camera ring; the view's name shows briefly when it changes and as a tooltip.
- R5-G8: the trampoline shows one message only ("Trampoline ahead: press Space the moment you land on it for extra height"); the two others are gone.
- R5-G9: the mouse turns the camera around the runner.
  - Drag turns the view (up to 80 degrees either way, never under the ground), the wheel zooms, a double-click or C goes back to the preset.
  - In first person, drag turns your head.
  - The three presets stay; the mouse only changes the view on top of them.
- R5-G10: the Rookie sank into the wall and the deck.
  - Cause 1: on the steep top of the curve the body leaned forward, into the wall; the deepest sink-in over a whole run was 0.51 m.
  - Cause 2: during the climb over the edge the simulator's feet are in the corner of the deck block.
  - Fix: the body now tilts back toward the curve's centre where the curve is steep, every body point is pushed out of platforms and the curve (`src/course/collide.ts`), and the whole body is moved out of a corner, eased so it does not jump.
  - Measured with the ideal bot (`scripts/overlap-check.mjs`): the deepest overlap is 0.135 m including an 0.08 m skin margin, so about 5 cm of real sink-in, at a toe; it was 0.51 m.
