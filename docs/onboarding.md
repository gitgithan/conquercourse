# Onboarding (CC-100)

*Serves the brand-new player who opens the game and does not know what to do.*

## What a first visit sees
- The stock course opens with a short guided tour before the runner moves.
- The big world chooser is gone for a first visit; the Courses button is the place to choose.
- Six steps, each 4.5 s, so the whole tour takes 27 s:
  - **Look around:** drag to turn, scroll to zoom, C switches the view, F the corner view.
  - **Run, jump and more:** the keys this course can use (read from its shape: a step up adds V, a bar adds E, a big drop adds X, a launcher adds K), with a small looping jump.
  - **Fell? Try again:** R, and Shift+R for the whole course.
  - **See the best line:** I for the next obstacle, Shift+I for the whole course.
  - **More to explore:** four cards (Courses, World Editor, World Slicer, Community) that go there.
  - **Need this again?** H hides or shows the controls; the ? button replays the tour.
- Every step moves on by Next, by Enter, by its own key, or by itself after 4.5 s; hovering the card holds the clock.
- Skip and Esc end the tour at any step; the tour is remembered and never repeats on its own.
- While the tour is open only the camera, restart and controls keys reach the game, so nothing starts the run.
- When the tour closes the run clock starts again, so the tour's seconds are not the player's time.

## The Help chip
- A round ? button, bottom left, on every Course.
- Its menu: Controls (H), Replay the tour, What can I do?, Courses.
- While the menu is open the controls card hides, so nothing is covered.

## After the first run
- A cleared run shows a one-time "What next" card at the top of the end report:
  - **Your controls:** every key as a small chip.
  - **Build:** the World Editor (with objects, bars, stacks, machines and your own photo), the World Slicer, the coaster builder.
  - **Do and share:** community courses, the feedback form.
- A first fall shows one calm hint instead: press R, press I.
- "What can I do?" in the Help menu shows the same card again.

## Who gets what
- First visit: the tour.
- Returning player (tour done, or the old world chooser seen): no tour, and their last course opens on a bare visit.
- `?tour=1` forces the tour; `?onboarding=0` or `ONBOARDING_ON = false` in `src/ui/onboarding-flags.ts` turns everything off.
- Automation keeps today's behaviour: `navigator.webdriver`, `?bot`, `?demo`, `?startx`, `?welcome=0`, `?course`, `?generate`, `?coaster`, and every other mode (editor, map, Dojo, gallery).
- `?tourstep=600` holds each step for 600 s (for checks); `?next=1` lets a bot's clear show the What next card (for checks).

## One line to change when the Training course lands
- `FIRST_COURSE_ID` in `src/ui/onboarding-flags.ts`: set it to the course path and a first visit opens it with the tour.

## Files
- `src/ui/onboarding-flags.ts`: the rules, pure and tested (`tests/onboarding-flags.test.ts`).
- `src/ui/onboarding.ts`: the tour, the chip, the cards.
- `scripts/onboarding-check.mjs`: the browser check (fresh profile, 1280x720 and 1024x640, 42 checks).
- Hooks: a few lines in `src/modes/course.ts` and `src/main.ts`.

## Known gaps
- Not yet tried with real first-time players.
- The tour does not demonstrate the ideal run itself; it names the key.
- The run's analytics send one extra "start" when the tour closes and resets the clock.
