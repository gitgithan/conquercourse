# Sayings and the first minute (2026-10-27)

*Tracked in Linear as CC-14 (sayings) and CC-15 (first-time flow).*

## CC-14: physics sayings
- **Decision (product owner):** the sliders change the picture at once, so there is nothing to "run"; the saying shows immediately.
- **What changed:** the Run it button, the kept grey lines, the earning rule, the stars on the tabs and the trophy cabinet are gone.
  - Each obstacle's saying sits under the live answer on its Try it step, always.
  - Wording rules stay tested: every obstacle has a saying, each is at most 15 words, and none has a number or a formula.
- **Still yours to judge:** whether each saying reads well beside the numbers.

## CC-15: the first minute
- **Controls taught in play:** one hint at a time (hold →, press Space before the edge, the trampoline cue, press Space to let go of the rope), none after the first clear or fall.
- **Controls card folds away after the first jump** unless the player has used H; it started as a permanent card.
- **Bot check, in the quick tests:** with presses about 60 ms off, and again about 80 ms off, at least 9 of 10 simulated players clear the whole Course within 3 minutes of game time.
- **Words on screen:** measured by `scripts/first-minute.mjs` (see the numbers in the issue).
- **A real person:** the product owner's five playtest rounds are the real-person trials; a first-time stranger trial happens with the public feedback form.

## Dojo: back to the Course
- **T closes the Dojo,** as it opens it from the Course (not while typing in a box).
- **"Back to the Course (T)"** is a large button fixed in the top-right corner of every Dojo step, the same place every time.
