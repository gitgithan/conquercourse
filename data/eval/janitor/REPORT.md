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

## 4. JSON format of the CC-90 photo files (CC-90, Part of)
- **Problem:** `tests/json-format.test.ts` (and `npm run test:quick`) failed on main because 10 files in `data/eval/cc-90-photos/` were committed unformatted.
- **Fix:** `npm run format:json` (whitespace only, no values changed).
- **Tests run on VM3:** `node scripts/format-json.mjs --check` (0 of 634 unformatted), `tests/json-format.test.ts`.
- **How to test it by eye:** nothing to look at; run `npm run test:quick` on a VM and the json-format test is green.

## 5. Edit this course no longer overlaps Whole course (CC-80, Part of)
- **Problem:** in the Course the "Edit this course" button sat on top of "Whole course (Shift+I)" at 1280x720 and 1024x640.
- **Cause:** both buttons had their own fixed right offsets (312 px and 158 px), but the Whole button is wider than 154 px.
- **Fix:** the two buttons now share one flex row (`#coursebtns`, right 158 px, top 56 px), so they cannot overlap whatever their text widths are.
- **Check added:** `scripts/course-buttons-check.mjs` fails when any two controls in the top 120 px overlap.
  - Before the fix it reported "wholeideal x editcourse" at both sizes; after: none.
- **Tests run on VM3:** the new check at both sizes, `tsc --noEmit`.
- **Not covered:** the other modes' top bars (the editor cleanup agent owns those) and phone widths (390 px).
- **How to test it by eye:**
  1. Open `/?course=/assets/demo/lache.course.json&welcome=0` in a 1024 px wide window.
  2. Look under "Ideal run (I)": "Edit this course" and "Whole course (Shift+I)" sit side by side with a gap.
  3. Wrong would be one covering the other's text.
  - Screenshots: `data/eval/janitor/course-buttons/1280x720.png` and `1024x640.png`.

## 6. Generated lache gaps need the bars (CC-47, Part of)
- **Problem:** all 24 generated courses with a lache could be skipped with a plain jump, so the bars taught nothing.
- **Cause:** the generator drew the lache gap from 5.5 to 6.8 m, and a plain jump clears up to 8 m.
- **Fix:** the gap is drawn from 8.5 to 10 m (12 m still clears with bars, 14 m does not, so there is margin); `generated-1` and its plan were rebuilt; golden hash for `generateCourse(2)` updated (the course itself changed); a new test checks every generated lache is 8.5 to 10 m.
- **Tests run on VM3:** `generator`, `shortcut-generator`, `demo-plans`, `golden-search` (all pass).
- **Not covered:** seeds beyond the 12 in the generator tests were not re-proved; the 24-seed shortcut job was not repeated with the new range (about an hour).
- **How to test it by eye:**
  1. Open `/?course=/assets/demo/generated-1.course.json&welcome=0`.
  2. Press Shift+I and watch the run: at the Lache pair the runner must hold the bars and swing; a plain jump from the deck should fall short.
  3. Try yourself: run at the lache, jump without E, and you drop into the water.
  - Screenshot: `data/eval/janitor/lache-gap/ideal-run.png`.

## 7. Drum lane check matches the new default (CC-57, Part of)
- **Problem:** `scripts/drums-check.mjs` reported the stock course lane as "not off".
- **Cause:** the game changed on purpose: the drum lane is on for every course that has a planned route (`src/modes/course.ts`, comment "on by default wherever the course has a planned player route"); the check and `docs/world-slice.md` still said "off for the stock course until G".
- **Fix:** the check now expects the lane on at the stock course, hidden by G and shown again by G, and fails the run (exit code 1) when any check is false; the doc line was corrected.
  - No game code changed.
- **Tests run on VM3:** `drums-check.mjs`, all 6 checks true, no page errors.
- **Not covered:** the drum timing itself (covered by `drum-roll` and `roll-window` tests).
- **How to test it by eye:**
  1. Open `/` (the stock course).
  2. The drum lane (dark strip, bottom) is already showing with drums sliding in.
  3. Press G: the lane hides; press G again: it shows.
  - Screenshot: `data/eval/janitor/drums/stock.png`.

## 8. Search second-best branch (CC-69, Part of)
- **Problem:** the search picks, at each edge, the middle of the presses that reach farthest, which can strand a later edge (why the Park rail run as first built could not be cleared).
- **Fix:** when the run reaches the last edges and still does not clear, the search tries presses spread over the whole range at the last two take-off edges and keeps the first plan that clears (`src/sim/ideal.ts`, `alt` option; about 16 lines).
- **Golden hashes:** none changed.
  - Every golden course either cleared on the first try (the branch does not run) or does not reach the branch.
- **Tests run on VM3:** `tests/search-second-best.test.ts` (new: the old Park rail run layout now clears with a 4th jump under 21 m); `test:changed` on `ideal.ts` selects every test (95 files, 848 tests, all passed, 144 s); a sweep of 5 old layouts went from 0 of 5 clearing to 5 of 5.
- **Not covered:** the cost on a lane that cannot clear near its end (up to about 10 times a search); Fix it and the advice tests passed in the same time as before, but a long impossible lane was not timed.
- **How to test it by eye:** nothing new to see; courses that already worked are unchanged.
  - In the editor (`/?mode=editor`), build the first Park rail run layout (rails at 3, 8.5, 13.5 m and the skate box at 19 m) and press Play: the lane is now green (clears).

## 9. test:changed ran no tests for source changes (CC-95, Part of)
- **Problem:** `npm run test:changed` printed "0 total" when only `src/` files changed.
- **Cause:** it passed `related` after `run`, which vitest treats as a name filter.
- **Fix:** it now runs `vitest related <files> --run`.
- **Tests run on VM3:** a change to `src/sim/ideal.ts` now selects 95 files, 848 tests.
- **How to test it by eye:** edit any file under `src/`, run `npm run test:changed` on a VM: it lists the tests that import it and runs them.
