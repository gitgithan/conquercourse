# Lab 2: Optimization

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

## Not tested
- No mobile or touch layout (desktop at 1280 px only).
- The mathematics box is not checked by a test beyond being present.
- Only two courses; no check that the map shape holds for other rope or drone courses.
- The game's drone search count (about 290 runs) is from reading the code, not metered.
