# Lab 7: Statistics of timing

*A workbench on the press window, the number the game uses as difficulty.*

## When you open it
- Precomputed: the trap chain at 40 ms of shakiness, normal shape, 400 runs, seed 7, played ahead of time with the same code (`scripts/labs-default-precompute.ts`); a test re-runs it and compares.
- Facts, charts and windows are filled; "time played" is the time on the machine that made the file.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## The question
- How wide must the press window be for a shaky presser to clear a course half the time, and nine times in ten?
- The Lab answers it for a simulated presser on a real course, never for a person.

## Where to open it
- `?mode=lab-timing&labs=1`, or the Labs group in the world picker (labs switch on).
- Desktop keyboard and mouse at 1280 px only.

## The controls
- Course: a trap chain (3 jumps), Lane 1 (3), Park rail run (5), Park run (7).
- How shaky the presses are: the standard deviation of the jitter, 0 to 200 ms.
- Shape of the shakiness: uniform, normal or heavy tail; all three have the same standard deviation, so only the shape changes.
- Runs to play (N): 100, 400, 1000 or 3000.

## What runs
- The real simulator plays the course with the game's own plan player (`playPlan` in `src/sim/ideal.ts`).
- Each jump press is moved along the course by speed times its jitter, the way the game writes its own windows (metres over speed).
- Every run has its own seeded random stream, so the same choices give the same numbers on any machine.
- Before the runs, the Lab measures each press window on the simulator: how early and how late that press may be, with the others on time, in steps of 4 ms.
- The work runs in a web worker, so the page stays smooth.

## What each output means
- Clear rate with a 95% interval: clears out of N, with the Wilson interval; more runs make it narrower.
- Window table: for each press, how early and how late it may be, the width, and how far the simulated presser's aim was moved from the game's plan.
- The simulated presser aims at the middle of each window (the game's own ideal press is the middle of the good presses), looking at most 300 ms either side; the game's stored press is often at one end, because an early press is queued until the feet land.
- The maths says: the product of the chances that each press lands inside its window, if presses are independent; the Lab shows it beside the simulator's number.
- When the two differ (the 7-jump Park run at 60 ms: maths 54%, simulator 83%), the Lab says so: the presses are not independent, because one press can make up for another; this is a finding of the Lab, not a bug.
- Window for 50% and 90%: the width, centred on the ideal press, that gives that clear rate at this jitter and this number of presses.
- Failure histogram: the first press that left its own window, by how early or late it was.
- Clear rate against shakiness: simulator dots with intervals, and the maths line from the measured windows.
- Window width against clear rate: the curve for this jitter, with the windows this course really has marked.

## What we chose and why (the Compare card)
- The game does not set a shakiness for anyone and never grades a person.
- It measures each press as a window in milliseconds and takes the narrowest window as the course's difficulty number.
- Make it easier looks for the smallest change that widens the narrowest window by a quarter.
- The launcher's release is flagged when its window is under 250 ms.
- The Lab turns a width into a rate for a simulated presser, so a designer can see what a window means.

## What it is not
- It is not a mark for the player, and the Course never shows any of this.
- It models presses as independent errors; a real person is more correlated (a tired run is shaky all through).
- Only jump presses are moved; hold times, swings and vaults are not.
- Time is quantised at the simulator's 120 steps a second (8.3 ms), and windows are measured to 4 ms.
- The window is reported up to 600 ms; a wider one is marked with a plus.

## Not tested
- Courses with vaults, bars, ropes or other moves.
- Phones and touch (out of scope).
- A study of real players' timing.


## How it was designed
- **The one question:** how wide must the press window be for a shaky presser to clear a course half the time, and nine times in ten?
- **The choices and why those:**
  - Four real courses from 3 to 7 jumps, so the player sees that more jumps make the window matter more.
  - Three shapes of shakiness with one standard deviation, so only the shape changes (a heavy tail is a few big misses, not a wider spread).
  - A seeded random stream per run, so the same choices give the same numbers on any machine.
- **Which real game code runs:** `playPlan` and `edges` from `src/sim/ideal.ts`, and the simulator `stepWorld` under it.
  - The jitter, the window measuring, the Wilson interval and the maths line are Lab code (`src/labs/timing/core.ts`).
- **Which data is precomputed:** nothing; the windows are measured on the simulator each time a course is picked, and the runs are played in a worker.
- **Order of the screen and why compare comes last:** goal, controls, clear rate, window table, then the failure picture and the two curves, and "what the game does" last, so the player has seen what a width means before reading how the game uses it.
- **Scope:** a simulated presser on a course, never a mark for a person.

## How we prove the lesson is right
- `tests/lab-timing.test.ts` (15 tests):
  - Presses on time clear exactly as the plan does, and a press 500 ms early or late loses the run.
  - The aimed plan still clears, and each measured window holds the ideal press and is between 20 ms and 1.5 s wide.
  - Zero jitter clears every run, and more jitter never clears more often (0, 30, 80 and 200 ms).
  - The same seed gives the same numbers and another seed differs.
  - The simulator's rate sits within 6 points of the interval around the maths (product of window chances) for all three shapes on Lane 1.
  - Failures are blamed on a press that was off, and almost never on one made on time.
  - The jitter has the stated standard deviation and the heavy tail has more far values.
  - The cdf matches sampling, the width for a rate inverts the rate for a width, and the Wilson interval stays in 0 to 1 and narrows with N.
  - The choices are kept in range, and `measureWindows` equals a direct check.
- Browser smoke: `scripts/lab-timing-smoke.mjs`, evidence `docs/evidence/lab-timing-park-run-1280.png`.
- What would make the Lab's claim false:
  - A window that the simulator accepts but the Lab says is outside, or the reverse.
  - A simulated rate that leaves the maths line by more than the interval on a course the tests do not use.

## Limits
- **Independent presses:** a real person is more correlated (a tired run is shaky all through); the Lab says so on the page.
- **The 7-jump Park run at 60 ms (maths 54%, simulator 83%):** the Lab reports the gap, but no test pins it.
- **Only jump presses move:** hold times, swings, vaults, bars and ropes are not tested.
- **Time steps:** the simulator runs at 120 steps a second (8.3 ms) and windows are measured to 4 ms.
- **Windows above 600 ms** are shown with a plus and not measured.
- **The Compare card** (how the game uses the narrowest window, the 250 ms launcher flag, "make it easier" by a quarter) is not checked against the game's code by a test.
- **No study of real players' timing.**
- Desktop keyboard and mouse at 1280 px only.

## How to make the lesson better
1. Add a test that pins the Park run gap between the maths and the simulator, so the finding cannot drift.
2. Add a correlated presser (a tired run is shaky all through) and show how far the rate falls.
3. Move hold times and vault presses too, and add a course with a bar or a rope.
4. Add a test that reads the narrowest-window rule and the 250 ms flag from the game and compares them with the Compare card.
5. Read the goal text with a young reader and fix the words.
