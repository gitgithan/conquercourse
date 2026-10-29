# CC-182: Training course polish

## So what
- The Training run is now 34.4 s (4126 ticks), down from 40.1 s.
- The bar grab needs the hands within 0.35 m of the bar, down from 0.6 m.
- Missing the warped wall is no longer a fail: the runner slides to the foot and runs up again.
- E is asked for only in the last 0.2 s of the wall climb, and the strip now lists it.
- The first vault box could not be doubled: a vault tops out at 1.3 m, so it is 1.25 m (up from 1.0).

## What changed
- Grab reach: 0.6 m to 0.35 m (`DEFAULT_HANG.reach`, all courses).
- Wall hold: `WALL_HOLD_TICKS` 60 to 24 (0.5 s to 0.2 s), and the hint shows from 40 ticks before the top.
- Wall slide: `src/modes/course.ts` shows a toast instead of a fall; the sim already put the runner back at the foot with the run going on.
- Strip: `src/sim/drums.ts` adds an E drum on the warped wall (near its top) and on the rope.
- Layout: `scripts/training-layout.ts` holds every run-up, so the course maker and the line search agree.
- Tests: `tests/strip-keys.test.ts` walks every course zone and checks the strip lists the key from `docs/inputs.md`.
- Tests: `tests/wall-hold-e.test.ts` checks a missed wall keeps the run going and a second run up takes the top.

## Measurements
- Hand distance to the bar at the grab: 0.58 to 0.60 m before, in the ideal run and in late presses; the grab fires the moment the hands enter the circle.
- Now the distance is at most 0.35 m.
- Take-off window for the first bar: 129.5 to 130.9 m (1.4 m, about 190 ms), best at 130.2 m.
- Bars at 3.2 m were tried and dropped: the jump apex puts the hands at about 3.13 m, and no line cleared the skip.
- So the bars stay at 3.4 m, and the first lache stays where CC-161 put it, a run-up after the plank.
- Runner from standstill: 6.1 m/s after 1 s (3.6 m), 8.0 m/s after 2 s (10.8 m), 8.4 m/s after 14 m, top 8.83 m/s after 26 m.
- The 4 m warped wall needs about 6.1 m/s, so 14 m of run is enough.

## Flat runs cut (metres)
| Beat | Before | After |
| --- | --- | --- |
| Start to the gap edge | 24 | 16 |
| Gap landing to the box | 19 | 15 |
| Box to the step | 14 | 14 |
| Step to the warped wall | 14 | 14 |
| Wall top to the climb | 18 | 18 |
| Climb top to the plank | 24 | 2 |
| Plank to the first bar | 22 | 18 |
| Rope landing to the trampoline | 34 | 20 |

## Ideal run
- Before: 4814 ticks, 40.1 s.
- After: 4126 ticks, 34.4 s (skip the second bar); bar to bar is 4274 ticks.
- The shortcut saves 1.23 s.

## Known gaps
- No live browser check; the pictures are drawn from the sim by script.
- `tests/json-format`, `lane-consistency` and `place-photos` already failed on main.
- `tests/lache.test.ts` changed: with the tighter grab the best 9 m line hangs 0.4 s, not over 1 s, and letting go at once still fails.

## Pictures
- `whole-course-side.png`: the course from the side with the ideal line.
- `warped-wall-catch.png`: the catch at the wall top.
