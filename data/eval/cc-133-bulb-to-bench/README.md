# CC-133: from the bulb lane (bars) down to a bench, then on along the bench lane

Serves the fork demo beat (demo photo 1): a runner who starts on the pole and bars may drop onto a bench and keep jumping to the join.

## So what
- **Yes: the simulator already allows it in play, with no change.**
  - In the real course both lanes' floors and bars exist together; only `routeCourse` (the proof) closes the other lane.
  - Letting go of a bar over a bench lands on it, and the bench jumps carry on to the join at x 26.
- **Mixed routes that clear (found by the sweep below):** after 1 to 6 bars, over benches 1, 2 or 3.
  - Landing on bench 3 after 3, 4 or 5 bars needs no extra jump at all (the last bench runs into the join gap, and the landing already carries over it).
  - Others need 1 to 3 jumps along the benches.
  - The fastest is 1 bar then bench 1: 1194 ticks (9.95 s), with jumps at x 13.6 and 17.9.
  - Slower than the pure bench lane (6.91 s) and quicker than the pure bulb lane (11.72 s).
- **Landing is survivable.**
  - The drop is 4.3 - 0.45 = 3.85 m.
  - Landing impact speed is about 5.9 to 6.8 m/s for most releases, up to about 10 m/s for the worst; peak slowing 28 to 38 m/s squared.
  - No release of the 1926 that landed was a hard landing (the world ends the run as hurt only on a hard landing; none occurred).
  - The runner squats in the plan, as the ideal runs do.
- **The lane logic reads a mixed run as the bench lane.**
  - It reads the lowest height between the fork (10.3) and the join (26); a mixed run lands at 0.45 m (and touches 0 at the join line), which is below the bulb band (1.0 and up).
  - It does not block anything: it is only a label, the strip and the report will say "bench lane" for a run that began on the pole.
- **What the editor and the ghost need to prove a mixed route (not built, no physics change):**
  - `proveFork` closes the other lane, so it can never see a mixed line.
  - A third route "mixed" would be proved on the whole course (nothing removed): one `Plan` with `climbXs`, the bar hang times, `airHands` false after the release, then `jumpXs`.
  - The search is `searchBulbLane` for the hang times, with the last hang time swept and a jump search after it, as this script does (about 60 lines in `src/sim/fork.ts`).
  - The lane band needs a rule for the label (for example, "touched a bar and then a bench" is its own lane), about 10 lines in `src/sim/branches.ts` and the branch data.
  - Golden hashes do not change; only the course file (new route data) would.
- **Room for error:** many release moments land on a bench: 10 to 124 per bench and bar count (see `run.json`, `releaseMomentsThatLandHere`).
  - One caution: the 1-bar to bench-1 landing is at x 12.52, only 2 cm past the bench edge (12.5), so it is the touchiest; a middle release of 2 or more bars is safer.

## Run it
- `node data/eval/cc-133-bulb-to-bench/bulb-to-bench.mjs` (about 1 minute; written to `out/`, which is out of git).
- Inputs: `public/assets/demo/fork-bench-bulb.course.json` and its stored bulb-lane plan (climb at x 9.6, hang times 56, 43, 43, 43, 49, 269, 0, 0).
- Method: for N bars swung (1 to 8) and a release moment on bar N from 0 to 320 ticks, play the plan with `playPlan` (the real world step), find the first touchdown and which bench it is, then search the bench jumps (greedy, every 0.1 m, up to 6) for the first, middle and last release moment that lands there.
- The fastest clearing route is recorded as keys, replayed with `verifyLog` (cleared, 1194 ticks, same as the plan) and its lane read with `routeOfTrack`.
- Files: `run.json` (all combinations, with `landOutcome` being the outcome of that release with no bench jumps, which is a splash for most), `mixed-route.keys.json` (the saved keys, with a challenge text in the share format), `out/sweep-rows.json` (every row, untracked).
- Ran on a VM (node 24).

## Watching the saved route
- The Course screen opens a ghost only from a short link (`?c=<id>`, `docs/challenge.md` Part 3c); the old `?challenge=` form is refused.
- So today the route can be watched by playing it into a share on a deployed preview (the server keeps the keys), or by replaying `mixed-route.keys.json` with `verifyLog` for a track.
- A small follow-up would be a local-only switch that takes the challenge text from the file (not done here).

## Gaps
- Only the first, middle and last release moment per bench and bar count had their jumps searched.
- Earlier bars use the bulb lane's proved hang times; other swing histories were not tried.
