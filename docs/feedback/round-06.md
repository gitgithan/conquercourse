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

## Dojo: back to where you were
- **Leaving for the Dojo saves the Course** (the course in play, the runner's whole state, the facing and the fall count) in the tab's session storage; coming back by T or by the Back button puts it back.
  - A run in progress waits for a key ("Back from the Dojo. Press any key to carry on.") so you are not dropped mid-jump.
  - After a fall (the Train button on the fall panel), you come back standing at the start of the obstacle you fell at, as "Try this obstacle again" does.
  - A community or Park course comes back too, not the default one.
- **Checked** by `scripts/resume-check.mjs`: same tick and place after T, after the button, waits for a key, carries on.

## Wall composition and anticipation (CC-16)
- **Why:** a baked clip fits one wall height; the wall can be edited to other heights, so the climb is composed from parts that follow the course.
- **The hands reach the real ledge:** two-bone reach from the shoulders to the wall's top edge.
  - How much they reach depends on how far the edge is from the shoulder, so a taller or shorter wall just starts the reach earlier or later.
  - They let go once the shoulders pass the edge.
  - Checked with the ideal bot at the default 4.3 m wall and a 5 m wall (`scripts/ledge-check.mjs`, `?wallh=5`): the hands come within 13 cm and 15 cm of the edge, and the run clears.
- **Anticipation:** the body gets ready about half a second before an obstacle, building smoothly.
  - Before a gap or the trampoline it sinks a little, leans in and swings the arms back; before the rope the hands begin to rise; before the wall it leans in.
  - It is only how the Rookie looks; the physics and the landing do not change.
- **Not checked:** walls lower than the curve (3 m or less): the curve and the deck would need new geometry.

## The text that flashed before the rope (CC-15)
- **Cause:** the trampoline cue started 14 m before the trampoline, which is before the rope, so it showed for about 0.09 s and was replaced by the rope hint.
- **Fix:** the trampoline cue waits until the rope is behind the runner; the other messages before the rope (the edge hint, 0.9 s) stay.
- **Checked:** `scripts/text-watch.mjs` lists every message with how long it stayed on screen: the trampoline cue now shows once, for about 3.4 s of game time, after the rope.
