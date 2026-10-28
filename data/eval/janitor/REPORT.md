# Janitor report

## 1. Park rail run clears again (CC-84, Part of)
- **Problem:** the course the welcome chooser opens on could not be cleared by the search, and `tests/roll-window.test.ts` failed on it.
- **Cause:** the plan keeps one list of jump spots, and a jump fires on the first ground touch after its spot.
  - On the old layout the search picked a 4th jump that landed the runner on the last deck with a jump still left over.
  - The left-over jump fired right at the finish and flew into the water.
  - The stored plan only cleared because it leapt over a whole deck and landed on the very edge of the next one (a roll drum at x = 20.00 that is not a window start).
- **Fix:** the third rail moved from x = 13.5 m to 14 m in `scripts/make-real-demos.ts`; the course and its plan were rebuilt (`make-real-demos.ts park-rail-run`, then `plans.ts`); the golden hash for this course was updated.
  - A sweep of 10 layouts found 4 that clear; this is the smallest move of one piece (all gaps stay 1.6 to 3 m).
- **Tests run on VM3:** `golden-search`, `roll-window`, `demo-plans` (53 passed, about 45 s); `test:changed` found no other failure from this change.
- **Not covered:**
  - The search itself still picks a left-over jump on layouts like the old one (a greedy search; not changed, the CC-69 work owns it).
  - No by-hand play of the course.
- **How to test it by eye:**
  1. Open `/?course=/assets/demo/park-rail-run.course.json`.
  2. Press Shift+I (whole-course ideal run); the runner should vault or jump all five edges and stop on the last deck with "You made it".
  3. Press R, then play it yourself: run with the arrow keys, Space to jump at each edge; each gap is 1.6 to 3 m, so every jump should be easy.
  4. Wrong would be: falling in the water at the last edge, or the runner stopping before the last deck.
  - Screenshots: `data/eval/janitor/park-rail-run/start.png` and `ideal-run.png` (cleared, 6.0 s, report 100%).

## 2. "Make it easier" cannot-clear test (CC-80, Part of; shipped in the commit before this one)
- **Problem:** `tests/easier.test.ts` "says so when the lane cannot be cleared at all" failed (the search found a fix for a lane the test called impossible).
- **Cause:** the test used a 2.5 m step "nobody jumps"; since CC-76 the climb (hold E) gets over steps of 1.0 to 2.83 m, so the lane is clearable and the game was right.
- **Fix:** the test now uses a 3.5 m step, taller than any jump, vault or climb.
  - No game code changed.
- **Tests run on VM3:** `tests/easier.test.ts`, 5 of 5 (14 s).
- **Not covered:** nothing in the game changed, so there is no new visual check.
- **How to test it by eye:** nothing to look at.
  - To see the fact behind it, open `/?mode=editor`, place a 0.5 m box and a 2.5 m box 4 m apart, press Play, and hold E at the tall box: the climb gets the runner up.

## 3. fixbars test timeout under load (CC-47, Part of)
- **Problem:** `tests/fixbars.test.ts` failed with "Test timed out in 60000ms" in the slow tier (the file takes 38 s and 27 s alone, 104 s with other tests running).
- **Cause:** an explicit 60 s timeout on the first test overrides the 180 s slow-tier setting; the second test used the default.
- **Fix:** both tests now have 180 s.
- **Tests run on VM3:** `tests/fixbars.test.ts` alone, 2 of 2 (65 s, with 4 other jobs running).
- **Not covered:** the Fix it for bars feature was not changed; a faster Fix it would remove the need.
- **How to test it by eye:** nothing to look at.
