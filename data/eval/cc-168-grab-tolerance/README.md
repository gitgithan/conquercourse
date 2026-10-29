# CC-168: hold-E ledge grab tolerance and the warped wall

## So what

- A bounce that falls a little short of the high deck on the Training course is now caught while E is held, and the runner climbs on.
- Nothing that was clearable became unclearable: every stored plan and every searched ideal run still clears.
- The warped wall now needs E held, so the course teaches the hands key.

## Rule

- The wall top edge is caught up to 0.3 m further forward (0.9 m) and 0.25 m higher (2.45 m over the feet).
- A body already higher than any plain jump (after a trampoline) is judged by its hands, not by the one-jump limit.
- It is a simulator rule, so golden hashes changed.
- Constants: `CLIMB_TOL_X`, `CLIMB_TOL_Y` in `src/sim/climb.ts`.

## Before and after (ticks at 120 Hz)

| Run                                         | Before  | After                   |
| ------------------------------------------- | ------- | ----------------------- |
| Training, stored plan                       | 3233    | 3228                    |
| Climb course, stored plan                   | 1022    | 1018                    |
| Training, searched ideal run                | 3636    | 3633                    |
| generated-1 (has a warped wall), searched   | 3243    | 3243                    |
| generated-1, stored plan with E on the wall | n/a     | 3284                    |
| Training, bounce press 20 to 40 (E held)    | splash  | cleared                 |
| Training, bounce press 0 to 18 (E held)     | cleared | cleared, 5 ticks faster |

- Every other demo course: same ticks, still cleared (25 courses; see `ideal-before.json`, `ideal-after.json`).

## Golden and meta changes, with reasons

- `public/assets/course-meta.json`: Training best line 3233 to 3228 (the 2 m wall is caught 5 ticks earlier).
- `tests/golden/search.json`, launch-bar-hard: release window 3 ticks wider (hi 251 to 254), best 241 to 240; still cleared.
- `tests/trebuchet-polish.test.ts`: the real run now holds E like the cue's preview does; agreement 0.99 with E, in both builds.

## Pictures

- `rim-on.png`: the bright rim on the wall top.
- `rim-off.png`: the same view with `?grabhint=0`.

## Not verified

- No live browser frame of the trampoline catch (sim table only).
- The "Hold E to grab" tip on the warped wall and `?warpedE=0` were not checked in a browser.
