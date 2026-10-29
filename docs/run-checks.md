# Run checks: cheap guards around the server replay of a clear (CC-174)

## So what for the game
- A cleared run is never lost and never trusted as a record by accident, whatever Cloudflare does.
- Only what the physics or a person's hands cannot do is rejected.
- A run faster than the stored best line is not rejected: the best line is a search result, not a limit.
- The replay stays the judge.

## What the server does for each outcome
- **Impossible run** (too fast for the physics, too short, too long, a key rate no hand reaches, a broken log): answer 422 with a `code`, store nothing, replay nothing.
- **Replay passes:** store the simulator's time as `verified`; it counts as cleared and may set the best time.
  - If the time beats the stored best line by more than the margin, it is also flagged `beats_ideal` for a human to look at; it still counts as a record, because the replay verified it.
- **Replay fails** (the keys do not reach the finish): answer 422 and remove the pending row.
- **Replay is cut** (Cloudflare Error 1102, HTTP 503), **throws**, or **is switched off** (`REPLAY=off`): the clear stays as `unverified`.
  - The row is written before the replay starts, because a cut Worker cannot be caught in code; that row is what survives.
  - An unverified clear counts as cleared on the card and never sets the best time or the median.
  - An unverified clear that also beats the stored best line is held out of the card completely until a replay (the same keys sent again, or a script on a VM) verifies it.
- **Same run or same keys sent again:** answer `duplicate` without replaying, unless the first copy is still unverified; then it is replayed and updated in place.
- **Too many submissions from one address** (more than 20 in 10 minutes): 429.
  - It lives in one Worker's memory, so it slows a flood and does not stop one; the per-browser limit of 500 events an hour in the database stays.
- **Course changed** (hash differs): 409, as before.
- **Unknown course:** 404.

## The checks and their constants
- All constants are exported from `src/sim/run-checks.ts`, which is pure TypeScript and also usable in the browser and in scripts.

| Check | Constant | Value | Why this value | On failure |
|---|---|---|---|---|
| Too short | `MIN_CLEAR_TICKS` | 60 (0.5 s) | The shortest best line is 3.0 s | reject |
| Too long | `MAX_CLEAR_TICKS` | 14 400 (2 min) | Also the replay cap; CC-169 showed a legal log never reaches the Cloudflare cut | reject |
| Too fast for the physics | `MAX_AVG_SPEED` | 9.55 m/s | 1.05 times the fastest stored best line (the coaster, 9.07 m/s) | reject |
| Key changes over the run | `MAX_CHANGES_PER_SECOND` | 15 | The busiest best line has 1.9 | reject |
| Key changes in one second | `MAX_CHANGES_IN_ONE_SECOND` | 30 | A fast mash is about 20; the busiest best line has 5 | reject |
| Log structure | (no constant) | | Not empty, every entry whole and at least 1 tick, equal neighbours merged, masks legal (the decoder), at most 6 000 entries | reject |
| Claimed ticks (optional field) | `TAIL_SLACK_TICKS` | 120 (1 s) | The keys may run up to 1 s past the claim | reject |
| Beats the stored best line | `BEATS_IDEAL_FACTOR` | 0.98 | Equal or within 2% is normal; below that a person should look | FLAG only |
| Replays per address | `REPLAYS_PER_ADDRESS`, `REPLAY_WINDOW_MS` | 20 per 10 min | A real player clears a few times in 10 minutes | 429 |
| Course hash | (in the endpoint) | | A changed course makes an old run meaningless | 409 |
| Duplicate run | (in the endpoint) | | `run_id` and a hash of the keys are unique | duplicate, no replay |

- **Too fast, in numbers:** the fewest ticks a course allows is `floor((finishX - startX) / 9.55 * 120)` (`physicsFloorTicks`).
  - A run below it is rejected before the replay and, if it somehow got through, after it.
  - The physics floor comes from distance only, so it needs no stored plan and works on every course.
- **The stored best line is a SOFT flag, not a limit.**
  - The ideal line comes from a search; it is not proven the fastest, and the product owner has already beaten it by hand.
  - So `BEATS_IDEAL_FACTOR` flags and never rejects; the replay decides whether the faster run is real.
  - The best-line ticks come from `public/assets/course-meta.json` (`idealTicks`), fetched by the function; a course with no entry is simply not flagged.
- The claimed ticks use the smaller of the claim and the keys sent, so a short claim cannot hide a fast run.

## When a genuine faster run is found
- The run replays fine and is stored as `verified` with `beats_ideal = 1`; it is already a record.
- Then the stored plan should learn from it: see "Learning from a human line".
- When the plan is better, run `npm run course-meta`; the flag moves with `idealTicks`, so later runs near the new time are normal.
- If the physics speed cap is ever in the way (a new course or move reaches a higher average speed), raise `MAX_AVG_SPEED` to 1.05 times the new fastest best line; the test below tells you.

## Learning from a human line
- A verified run that beats the stored line is worth more than a record: it shows the search missed something.
- Built in CC-176: `src/sim/seed-plan.ts` turns the keys into a plan and keeps the faster of the plan and the stored line.
  - `planFromLog` reads each press where it happened (jump x, vault x, climb x, hang ticks, rope release, bounce press).
  - `polish` nudges each number in small steps and keeps a change only when the run still clears and gets faster.
  - `chooseWithSeeds` keeps the stored plan unless a seed is faster; a seed that does not clear is not used.
- Use it:
  - `npx tsx scripts/seed-plan.ts <course.json> <log.json>... [--write]` compares and (with `--write`) stores the faster plan; then run `npm run course-meta`.
  - Logs kept in `data/seeds/<course name>/*.json` are applied by `scripts/plans.ts` after each search.
- Not built: the export of flagged logs from the table (`beats_ideal = 1`) needs the database (migration 0004 is written, not applied); until then a log is saved by hand.
- Known gap: a contraption course (cannon, drone, coaster) has non-key inputs and cannot be seeded from keys.
- Beating the stored line stays a flag, not an error.

## The database column (needs the owner's yes)
- `migrations/0004_clear_verified.sql` adds `verified` (default 1, so every old row stays verified) and `beats_ideal` (default 0).
- It is written and NOT applied.
- Without it the code works as before: a replayed clear is stored, and an unverified one is not kept (the answer says `stored: false`); the stats query falls back to the old one.
- The check for the column runs once per Worker (`SELECT verified FROM course_clears LIMIT 1`).

## How to tune
- Edit the constant in `src/sim/run-checks.ts`; the real-data test fails if a stored best line would be rejected.
- Tighter is safer for records and riskier for real players; the hard rejects are set far from any human run on purpose.
- `REPLAY=off` (a Pages environment variable) skips the replay and keeps every pre-filtered clear as unverified: the switch for a day when Cloudflare cuts replays.

## Numbers from the real data
- 30 stored best lines replay as plain keys (public courses and `data/`); two more (the cannon, one test course that does not clear) are skipped.
- Average speed of the best lines: 3.0 to 9.07 m/s; key changes per second: 0 to 1.9; most in one second: 5.
- Ticks: 363 to 3 284; the 26.9 s Training clear (3 233 ticks) passes.
- A log with every held run halved is rejected as too fast on Training.

## Tests
- `npx vitest run tests/run-checks.test.ts` (real data, each check, each server outcome, with and without the column).
- `npx vitest run tests/course-stats.test.ts` (the card numbers).
- `npx tsx scripts/run-checks-measure.ts` prints ticks, speed and key rate for every stored best line.
- Browser: nothing to check; the player sees nothing different.
