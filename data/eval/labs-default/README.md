# Labs open already run (CC-118)

*Owner request, 2026-11-01: every Lab shows our setting, already run, with no click on Run.*

## What was done
- Nine Labs fill themselves on open from the same code: four run live in their worker, five were already filled at load.
- Three slow Labs (7 timing, 9 generate and test, 12 reinforcement learning) ship a precomputed result made by `scripts/labs-default-precompute.ts` with the same code and seed 7.
- Nothing is mocked: each number on screen came from the real code, either now or in the script.

## Files
- `run.json`: the settings, sizes and the time each precompute took.
- `public/assets/lab/timing-default.json`, `gentest-default.json`, `rl-default.json`: the results.
- `docs/evidence/cc-118-labs-default/`: one shot per Lab and `timings.json` (first populated paint, headless Chromium on a remote machine, dev server, 1280 px).

## How we keep the files honest
- `tests/lab-populated.test.ts` re-runs the timing and RL code and compares with the shipped files; for Generate and test it re-runs the first proposals.
- Regenerate with `npx tsx scripts/labs-default-precompute.ts all` after any change to the Lab code.
