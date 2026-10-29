# CC-153: one more X roll after the rope swing on the Training course

## What the product owner asked
- The all-obstacles course ("Training course: every move") needs one more X roll after the second swing.
- The drop off it is big and breaks the run for a player who lands without a roll.

## What we found
- The second swing is the rope (the lache pair is the first).
- Before: the best line let go of the rope at 3.1 m and hit the deck at 7.2 m/s, a fall of 2.6 m in energy terms.
- A squat landing was clean there, so the best line never rolled; a player who did not squat stood to be hurt (a stiff stop is 86 m/s², past the 80 m/s² limit).
- The roll rule asks for a roll once the fall passes 90 % of what a squat takes cleanly (3.3 m), so 2.6 m never asked for one.

## What changed
- The rope anchor is 1.2 m higher (6.6 m to 7.8 m); the length (9 m) and the decks are the same.
- The best line now lets go later (58 to 86 ticks after the grab) at 3.4 m and lands at 8.1 m/s, a fall of 3.35 m in energy terms.
- That passes the 3.3 m line, so the best line presses X in the roll window and rolls out (`roll` at x = 97).
- The rest of the chain is unchanged: same jumps, vault, bar, climb and trampoline.

## Tried and dropped
- Rope 7.8 m and 8.4 m, and 7.8 m with a 10 m rope: all three give the same roll at x = 97 and the same apex, so the smallest change (7.8 m, 9 m rope) was kept.
- Lowering the landing deck by 0.6 m (and raising the wall deck to keep it 2 m): the search then let go of the rope earlier and skipped the roll, so it was dropped.

## Honest limits
- A squat is still clean at 3.35 m (it fails at about 3.67 m), so the roll is the best line's choice at the edge of the rule, not forced.
- Without the roll the same landing costs a stiff player the run; with a squat it is fine.
- The golden search hashes do not change: the Training course is one of the slow cases the golden test skips.

## Numbers
- Plans searched on VM2 (8 cores, about 3.5 minutes each): `scratch/train-{a,b,c,d}`; kept `a`.
- `public/assets/course-meta.json` changed because the best line is 3283 ticks, not 3323.
- Test added in `tests/training-course.test.ts`: two rolls, the first within 10 m past the rope anchor, the second past x = 150.

## Evidence
- `rope-path.png`: the best line over the rope before (grey) and after (green), from the simulator; the roll is at x = 97.
- `report-after.png`: the bot plays the whole new course in the browser on VM2 and gets "You made it in 27.4 s", the same as the best line (3283 ticks).
- Known gap: no close-up picture of the roll itself; the film tool's stepped clock ran the bot about 60 times too fast per frame, so the three attempts only caught the finished report.
- Known gap: the report's path icons show one roll icon (the last drop), not a second one at the rope landing; the test counts two rolls in the run log.
