# Lab 2: Optimization

## When you open it
- Live: it runs the first search over the stored table on open (a fraction of a second); the table of methods, the picture and "what the game picks" are already filled.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## The question
- Which settings make the run fastest, and how many tries does it cost to find them?
- Behind the labs switch: `?mode=lab-optimization&labs=1`.

## The controls
- Settings to tune (the course):
  - Rope swing: where to press jump, and how many ticks after catching the rope to let go.
  - Drone ferry: where to lean back (brake), and where to climb down onto the far deck.
- Search method, any mix of the three:
  - Grid: an even lattice of settings (the spacing is a slider).
  - Hill-climb: start at a cell you click, step to the fastest of the 8 neighbours, stop when none is faster.
  - Random restarts: hill-climb from several seeded random cells (the count is a slider).
- A cap on how many simulator runs each method may use.

## What the outputs mean
- The map: every cell is one pair of settings played in the real simulator.
  - Colour is the finishing time (viridis-style ramp, light is fast, dark is slow).
  - Hatched grey cells never finish; their score is worse than every clear and slopes toward the finish line, so a climb can still move.
  - Lettered black boxes are local peaks: cells faster than all 8 neighbours, merged when within 6 cells, kept when at least 60 cells lead down to them.
  - Square, circle and triangle mark where the grid, hill-climb and random restarts stopped.
- The table: runs used (each different cell counts once), where each method stopped, the best time found, seconds slower than the map's best, and whether it matched the fastest peak (within 0.05 s).
- The peak list: setting values, time, and how many cells lead down to each peak.
- The maths box (closed at first): the objective, the finite-difference step, why a hill-climb stops at a local minimum of time, and the cost of a grid.
- What the game picks comes last, as a pink diamond and a sentence:
  - The stored plan is played live, and its time is shown against the fastest peak.
  - It also shows how many of its 8 neighbouring cells still clear.
  - Rope: the game's search keeps the presses that reach farthest, takes the middle of that run and centres the release in its window, so it trades a little time for a pick that survives a small slip.
  - Drone: the game's search takes the fastest clear on a two-metre lattice then a half-metre lattice, about 290 runs.

## What is real
- Every score on a search is a `playPlan` run of the real simulator, in a worker.
- The map is a stored table of the same runs (`scripts/lab-optimization-scan.ts`), so it shows at once; a test replays 24 spread cells per map live and compares.
- Same choices give the same numbers; random restarts use a seeded generator.

## What the lesson looks like
- Drone map: two peaks.
  - A hill-climb from the default start stops on the slower peak; random restarts and a fine grid reach the faster one.
- Rope map: six peaks, separated by ridges of failures.
  - One climb sticks in whichever basin it starts in; restarts spend runs to see several.

## How it was designed
- **The one question:** which settings make the run fastest, and how many tries does it cost to find them?
- **The choices and why those:**
  - Two settings per course, so the answer is a 2D map the player can see whole.
  - Three searches (grid, hill-climb, random restarts), because they are the three ways to trade tries for certainty.
  - A cap on runs, so "how many tries" is a number the player sets and reads.
  - A failing cell scores worse than every clear but slopes toward the finish, so a hill-climb can still move on a flat plain of failures.
- **Which real game code runs:** `playPlan` from `src/sim/ideal.ts` on the real simulator, in a worker (`src/labs/optimization/worker.ts`).
  - The search methods and peak finder (`src/labs/optimization/core.ts`) are Lab code.
- **Which data is precomputed, and where from:**
  - `public/assets/lab/opt-rope.table.json` (39 by 73 = 2847 cells) and `public/assets/lab/opt-drone.table.json` (45 by 37 = 1665 cells): one real simulator run per cell, made by `npx tsx scripts/lab-optimization-scan.ts` (about 15 s).
  - The rope course `public/assets/lab/opt-rope.course.json` was written by hand from the first course's rope numbers; the drone course is `public/assets/demo/drone.course.json`.
  - The table only draws the map at once; every score a search uses is a live `playPlan` run in the worker.
- **Order of the screen and why compare comes last:** choices, the map, the table of results, the peak list, the maths on request, and the game's own pick last, so the player has seen the peaks before seeing which one we took and what it gives up.

## How we prove the lesson is right
- `tests/lab-optimization.test.ts` (15 tests):
  - Each table has the size of its axes.
  - Live runs match the table on 24 spread cells per map (the table is the live simulator, sampled).
  - The game's stored plan clears both courses.
  - The drone map has exactly two local peaks and the second is over 0.5 s slower.
  - The rope map has at least four local peaks.
  - A failing cell scores worse than every clear and has a slope.
  - A hill-climb from the default start on the drone map stops on the slower peak, and none of its 8 neighbours is faster.
  - A climb from the other basin reaches the fastest peak.
  - Random restarts (8) reach the fastest drone peak and spend more runs than one climb.
  - A grid costs exactly the cells of its lattice, and a finer grid costs more and does no worse.
  - Every method stays under its budget cap and says when it was hit.
  - The same choices give the same numbers twice, and another seed gives other restarts.
  - Each different cell is counted once.
  - On the rope map, restarts do no worse than one climb.
  - A hill-climb asking the live simulator gives the same trace as asking the table (drone, 200 runs).
- Browser evidence: `docs/evidence/lab-optimization-drone.png` and `docs/evidence/lab-optimization-rope.png`; there is no scripted browser smoke for this Lab.
- What would make the Lab's claim false:
  - The drone map having one peak (the climb would never stick).
  - A table that no longer matches the live simulator after a simulator change (the 24-cell check fails).

## Limits
- **Only 24 cells per map are replayed live;** the rest of the table is trusted from the scan script.
- **The live-versus-table search check is on the drone map only;** rope searches are not compared run for run.
- **The rope claim is looser than the doc text:** the test pins at least four peaks, while the Lab says six; the test title also mentions a cliff next to the game's pick, but it only counts peaks.
- **Peak rules** (merge within 6 cells, keep with at least 60 cells leading down) and the "within 0.05 s" match rule are not tested directly.
- **The game's pick panel** (live time against the fastest peak, how many of 8 neighbours still clear) has no test.
- **"About 290 runs"** for the game's drone search is from reading the code, not metered.
- **The maths box** is not checked by a test beyond being present.
- **Only two courses** and two settings each; no check that the map shape holds elsewhere.
- Desktop 1280 px only.

## How to make the lesson better
1. Pin the peak count of the rope map exactly (and fix the test title), and test the game's pick panel.
2. Meter the game's own drone search and show the real count.
3. Add a third setting as a slider through the map, to show why grids explode with more settings.
4. Add simulated annealing or a smarter restart rule, and show it on the same maps.
5. Replay more cells live in the test, or all of them in a nightly job.
6. Show how wide each peak's safe zone is, so "fastest" and "robust to a slip" can be compared.
