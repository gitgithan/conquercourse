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

- **Unverified clears and the checks before the replay:** see [run-checks](run-checks.md) (CC-174); an unverified clear counts as cleared and never sets the best time.

## Countries tile (CC-108)
- The growth card at the top of the course picker (the page that lists the courses) shows a fifth tile: Countries, all time.
  - It is a plain box, not a button: there is no daily line for it, so there is no chart behind it.
  - The hover note says only a two-letter country code is kept, never an address.
  - With no visit counted yet it shows 0 and the note "No visits counted yet"; it is never hidden.
- Where it comes from: each course event stores the two-letter country Cloudflare reports for the request (migration 0009, column `country`); `/api/world-stats` counts the different codes over all time.
- Gap found on 2026-11-01: the preview database had no `country` column, so nothing was stored and the count stayed at 0; migration 0009 is now applied to the preview database.
  - Visits before that day have no country and cannot be filled in later.
  - The live database has the column but no events yet; production needs the owner's approval for any change.
- Only the picker shows the card; the switch `?growth=0` hides it.

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
- `functions/api/course-stats.ts`: the numbers for every course, cached for one minute; each course also has "plays today" (run starts since 00:00 UTC, one grouped count, nothing stored per person).
- Test database: a real SQLite database with the real migrations (`tests/helpers-d1.ts`).

## Known gaps
- The replay costs the server about 11 ms of processor time for a 27 s run; the free Cloudflare plan allows 10 ms.
  - If the live server refuses long runs, the plan or the run-length cap must change.
  - CC-169 measured it: real clears were never cut; the fallback for a cut is in [run-checks](run-checks.md).
- Until the migration is applied to the live database, the live site shows no numbers and no order change.
- Contraption courses with aimed or thrown moves can show plays but not clears.

## Fix: plays were not counted (CC-108)
- The browser sent `demo-training`; the server only keeps `demo/training`, so every play event was skipped.
- The browser now keeps the slash, and the server also maps the old dashed form, so cached pages count too.
- A card says "N plays today · M all time", and "No plays yet" when nothing is recorded.
- Counts start after the next deploy; earlier plays were never stored.
- Check: `scripts/event-key-check.mjs` loads the Training course and asserts the key.
- Picture: `docs/evidence/cc-108-cards-cannon.webp`.

## Daily growth chart on the course picker (CC-108)
- One card at the top of the picker holds the world numbers and the chart.
- Four tiles: players, runs, courses cleared and assets made today, each with a big number and a tiny line of the last 14 days.
- Under the tiles, small chips carry the news: new record, hardest zone, busiest course, your streak.
- Clicking a tile (or "Show the chart") opens one chart for that number; there is no menu, the tiles choose.
- The scales differ, so the numbers are never drawn on one axis.
- A segmented control cuts the time axis to 7 days, 30 days or all time.
- Every day is a dot with its value; a line joins the dots only when there are two or more days.
- One day of data shows one centred dot and a sentence such as "5 players on Oct 31", plus a note that the line grows as days pass.
- Days before the first day are not invented, so a young game shows the same single dot in every range.
- Hover (or the dot's column) shows the date and the value.
- Route: `GET /api/daily-stats`, cached for five minutes, built by `functions/api/daily-stats.ts` and `src/slice/daily-stats.ts`.
- Players are different random browser codes that started a run that day; no account, name or address is read or returned.
- Runs are run starts; assets made are photo-to-3D object slots taken plus community photos; cleared are replayed clears.
- Every metric has its own query, so a table that is missing leaves zeros and never breaks the reply.
- The chart starts on the first day anything happened; days with nothing are 0.
- A game with only zeros shows "Just starting: be one of the first", never a made-up number.
- No migration is needed: it reads `course_events`, `course_clears`, `upload_days` and `community` as they are.
- Switch: `?growth=0` hides the card (the world strip then stands alone); check it with `node scripts/growth-check.mjs` (1280 px).
- Test: `tests/growth-strip.test.ts` (a dot per day, a line only from two days, a dot at 0).
- Pictures: `docs/evidence/cc-108-growth-look/` (single day, 7 days, all time, before and after).
