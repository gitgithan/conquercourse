# Ideal-run search benchmark with a per-stage profile (CC-133, 2026-11-03)

## So what (read this first)

- **Where the time goes:** nearly all of it (99.9% of the ticks on 7 of 8 courses) is trials, the runs the search plays to try a timing.
  - The searching logic between the trials costs almost nothing (under 0.2 s on every course that goes through batches).
  - The one exception is the cannon, whose whole search (1.6 s) is a loop on the calling thread that the pool cannot help.
- **The slow course is not the bars course:** the monkey-bars courses take about 10 s, but `training` takes 75 s and `fork-bench-bulb` 131 s on one thread, all in plain take-off edges and steps.
  - So "bars are the slow stage" (from `docs/lessons.md`) is true for one obstacle, not for the search as a whole.
- **The pool is worth it:** 3 workers on a 4 vCPU machine give 3.9 to 5.4 times the speed of one thread (more than 3, see the note below).
  - The longest course falls from 131 s to 33 s, the longest page-visible wait from about 75 s to 16 s.
- **What it means for the demo:** a new course with take-off edges and no stored plan can still make a player wait 15 to 35 s on a 4 core machine, even with the pool.
  - The shared cache (this issue) stops that wait from being paid two or three times.
  - Storing the plan with the course (next step 4 in `docs/ideal-search.md`) removes it for saved courses.
- **Recommendation:** after the cache and the stored plan, look at the cost per trial before the choice of method.
  - The average trial plays 1,100 to 3,600 ticks (9 to 30 s of game time), because a failing trial still runs until it falls or sticks.
  - Next step: measure how many ticks failing trials spend after the last obstacle they could still pass (an early stop), and how much a saved start state would skip (the prefix replay).
  - Both are cheap to prototype and the answer must stay identical (golden hashes).

## What was run

- Script: `scripts/bench-search-stages.ts` (run: `npx tsx scripts/bench-search-stages.ts out.json --runs=3 --pool=3`); it drives `searchGen` batch by batch, so each batch is timed and its ticks counted with the `meter`.
- Courses (stored plan deleted): `bars`, `swing-to-bars`, `training`, `lache`, `fork-bench-bulb`, `launch-bar` (trebuchet and bars), `cannon` (machine search), `cannonballs` (timed balls, start delay).
- 3 runs each; the median run is reported (the ticks are the same every run, so the answers are identical too: `sameAnswerEveryRun` is true for all 8, and the pool gives the same hash as one thread).
- Machine: a 4 vCPU Vultr VM (Intel Xeon Skylake class, Node 24), nothing else of ours running.
  - One thread runs first, then the pool (3 workers, as the page picks `min(6, cores - 1)`).
  - Load average (1 minute) just before each course is in `run.json` (`loadBefore`): 1.4 to 2.9; the rise is the benchmark's own earlier course, not another job.
- Raw per-run logs: `../conquercourse-assets/eval-full/search-bench/` (not in git).

## Results (median of 3, seconds)

| Course | One thread | Pool of 3 | Speed-up | Ticks | Jobs | Ticks per second (one thread) |
|---|---|---|---|---|---|---|
| lache | 2.5 | 0.47 | 5.4x | 0.55 M | 516 | 220 k |
| cannon | 1.6 | 1.6 | 1.0x | 0.36 M | (loop on the thread) | 217 k |
| launch-bar | 5.8 | 1.5 | 3.9x | 1.26 M | 1,905 | 218 k |
| bars | 9.7 | 1.8 | 5.3x | 1.88 M | 1,662 | 194 k |
| swing-to-bars | 10.1 | 2.4 | 4.3x | 2.20 M | 1,966 | 217 k |
| cannonballs | 36.7 | 7.7 | 4.8x | 8.49 M | 3,987 | 231 k |
| training | 74.8 | 15.9 | 4.7x | 16.7 M | 4,641 | 223 k |
| fork-bench-bulb | 131.1 | 32.7 | 4.0x | 31.8 M | 27,546 | 243 k |

## Per-stage profile (median run; ms and ticks on one thread)

| Course | Stage | Wall (ms) | Ticks | Jobs |
|---|---|---|---|---|
| bars | monkey bars | 9,677 | 1,874,713 | 1,662 |
| bars | final run | 6 | 1,237 | 1 |
| swing-to-bars | monkey bars | 10,116 | 2,196,244 | 1,966 |
| swing-to-bars | final run | 7 | 1,369 | 1 |
| training | edges and steps | 74,713 | 16,667,515 | 4,641 |
| training | between batches | 84 | 14,070 | 0 |
| lache | edges and steps | 2,503 | 551,649 | 516 |
| fork-bench-bulb | edges and steps | 131,063 | 31,814,026 | 27,546 |
| launch-bar | trebuchet | 5,722 | 1,259,291 | 1,905 |
| cannon | between batches (machine loop) | 1,632 | 354,818 | 0 |
| cannonballs | edges and steps | 36,542 | 8,469,627 | 3,987 |
| cannonballs | between batches (start delay) | 134 | 18,069 | 0 |

- "Between batches" is everything the search does on the calling thread outside a batch (the machine searches, the start delay scan, the generator's own work).
- The routes option was not run (the page does not ask for it).

## Notes and gaps

- Pool speed-up above 3 with 3 workers: the one-thread run keeps the generator and the trials on one thread and one JIT profile, and the pool splits the trials across workers; the cause is not measured.
- Ticks per second is 190 to 240 k on this machine, below the 330 k per "work second" in `src/sim/ideal.ts`; a work-second budget therefore takes about 1.4 to 1.7 s here.
- A 4 vCPU virtual machine is slower per core than the laptop; the page's wait on a player's machine will differ.
- Ticks of the failing and the clearing trials are not separated here, so the early-stop saving is not measured.
- Fork-bench-bulb makes 86 batches (the second-best branch re-searches the last edges); how much of its 131 s that branch costs is not split out.
