# Lab 7: Statistics of timing

*A workbench on the press window, the number the game uses as difficulty.*

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
