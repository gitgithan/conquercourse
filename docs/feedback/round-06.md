# Sayings and the first minute (2026-10-27)

*Tracked in Linear as CC-14 (sayings) and CC-15 (first-time flow).*

## CC-14: physics sayings are earned
- **Earning rule (`src/modes/sayings.ts`):** a saying shows only after the player has run an obstacle at clearly different settings.
  - At least 3 kept runs.
  - Their main knob (speed, angle, drop, knee-bend time) covers at least a third of its range.
  - Their answers differ by at least a fifth.
- **Not enough:** one lucky run, three runs with the slider nudged a hair, the same setting three times, or three settings that gave the same answer.
  - A run within 4 % of the range of an earlier one replaces it instead of counting again.
- **Cabinet:** earned sayings stay in the Dojo's trophy cabinet (saved in the browser).
- **Wording rules, now tested:** every obstacle has a saying, each is at most 15 words, and none has a number or a formula.
- **Changed from the old rule:** the Dojo no longer asks for a guess (round 5), so "predictions get close" became "settings clearly differ with clearly different answers".

## CC-15: the first minute
- **Controls taught in play:** one hint at a time (hold →, press Space before the edge, the trampoline cue, press Space to let go of the rope), none after the first clear or fall.
- **Controls card folds away after the first jump** unless the player has used H; it started as a permanent card.
- **Bot check, in the quick tests:** with presses about 60 ms off, and again about 80 ms off, at least 9 of 10 simulated players clear the whole Course within 3 minutes of game time.
- **Words on screen:** measured by `scripts/first-minute.mjs` (see the numbers in the issue).
- **A real person:** the product owner's five playtest rounds are the real-person trials; a first-time stranger trial happens with the public feedback form.
