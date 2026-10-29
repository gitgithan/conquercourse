# Course cards: plays, clears, best time and the difficulty order (CC-149)

## What a card shows
- "1,204 plays, 311 cleared, best 41.2 s" under the course name.
- Four dots and a word (Easy to Very hard) once enough runs are in.
- A part with nothing to say is left out; with no data the card shows nothing at all.
- The switch `?stats=0` hides all of it for one visit.

## Where each number comes from
- **Plays:** run starts, from the `start` events that the course page already sends (CC-129 telemetry).
  - It is a rough count: one person can start many runs, and a retry is a new play.
  - A browser may send at most 500 events an hour.
- **Cleared:** runs the server played again with the simulator and saw reach the finish.
  - The browser sends its keys (the same compact keys as a challenge link), the course name and the course hash.
  - The server loads the course file itself, refuses a changed course, plays the keys and stores the simulator's time.
  - The same run or the same keys sent twice count once.
  - A run that used anything but plain keys (the cannon's aim, a throw speed) has no recorded keys, so it is never offered; those courses show plays only.
- **Best time:** the smallest simulator time among the clears of the newest version of the course.
  - A changed course makes an old time meaningless, so only clears with the newest course hash count.
- **Failures:** the `fail` events; they are used for the difficulty order and never shown as a number.

## What is not counted, on purpose
- **People.** A browser id overcounts (another device, a private window, cleared site data) and can be forged.
  - Owner decision, 2026-10-29: no player id is added and no count of people is shown.
  - The clears table holds no id of a player: only the course, its hash, the time, and two ids that stop double counting.

## The difficulty order
- Cards in each group are listed from easiest to hardest.
- The score is a number from 0 (easy) to 1 (hard); it is never on screen.
- **From failures:** the share of attempts that failed is spread over the obstacles, so a long course is not harder just for being long.
  - Obstacles are the presses of the best line (jumps, vaults, climbs); a course with no best line counts its marked zones.
  - A 35% chance of failing at each obstacle is the top of the scale.
- **From time:** the median clear compared with the best line, per obstacle.
  - Five seconds lost at each obstacle is the top of the scale.
  - A course with no best line is judged on failures alone.
- **Mix:** 65% failures and 35% time.
- **Few runs:** the data's score is blended with the designer's guess.
  - The designer's guess is the card's place in its group in the menu (0.1 for the first, 0.9 for the last).
  - With 20 attempts the data and the designer count the same; with 200 the data counts 91%.
  - With no attempts the order is the menu order.
- **Labels:** the dots show only after 5 attempts (clears plus failures), so a guess is never shown as a measurement.
- **Ties** keep the menu order, so the order never jumps about.
- The code is `src/ui/course-stats.ts`, with tests in `tests/course-stats.test.ts`.

## Obstacles and best-line time
- `public/assets/course-meta.json` holds both numbers for each card course.
- Make it again with `npm run course-meta` after a course or its best line changes; a test fails when it is out of date.

## The pieces
- `migrations/0003_course_clears.sql`: one new table, `course_clears` (about 60 bytes a row), no change to the old tables; undone with `DROP TABLE course_clears`.
- `functions/api/course-clear.ts`: takes a cleared run and replays it.
- `functions/api/course-stats.ts`: the numbers for every course, cached for five minutes.
- Test database: a real SQLite database with the real migrations (`tests/helpers-d1.ts`).

## Known gaps
- The replay costs the server about 11 ms of processor time for a 27 s run; the free Cloudflare plan allows 10 ms.
  - If the live server refuses long runs, the plan or the run-length cap must change.
- Until the migration is applied to the live database, the live site shows no numbers and no order change.
- Contraption courses with aimed or thrown moves can show plays but not clears.
