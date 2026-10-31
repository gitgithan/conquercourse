# University Labs: index

*One row per Lab.*
*Open a Lab at its URL; the labs switch (`labs=1`) keeps new players from seeing them.*
*Every Lab doc has the same four sections: How it was designed, How we prove the lesson is right, Limits, How to make the lesson better.*
*The plan and the rules for all Labs are in [university-labs](../university-labs.md).*

| # | Lab | Question | URL | Tests | Biggest limit |
|---|---|---|---|---|---|
| 1 | [Search](search.md) | Which way of looking finds a clear run, and what does it cost? | `?mode=lab-search&labs=1` | `tests/lab-search.test.ts` (7) | The heuristic sliders are untested, and "what the game does" is a sentence, not a measured run |
| 2 | [Optimization](optimization.md) | Which settings are fastest, and how many tries to find them? | `?mode=lab-optimization&labs=1` | `tests/lab-optimization.test.ts` (15) | Only 24 cells per map are replayed live, and the rope claim is pinned at 4 peaks, not 6 |
| 3 | [Inverse kinematics](ik.md) | Where does the arm bend and break when the hand must reach a bar? | `?mode=lab-ik&labs=1` | `tests/lab-ik.test.ts` (12) | Side plane only, and the joint limits are round numbers |
| 4 | Computer vision (in progress) | Which mask threshold trades photos kept against people missed? | not on `main` yet | none yet | Not merged, so nothing to prove yet |
| 5 | [Camera and perspective](camera.md) | Why can one photo not give depth? | `?mode=lab-camera&labs=1` | `tests/lab-camera.test.ts` (14) | Hand-made bodies and no real photo; the compare card is not checked against the game |
| 6 | [Numerical integration](integration.md) | How much energy does a step rule invent, and does a replay match? | `?mode=lab-integration&labs=1` | `tests/lab-integration.test.ts` (10) | Several quoted numbers are not pinned, and the "recording" is the Lab's own RK4 run |
| 7 | Statistics of timing (removed from main) | How does shaky timing change how often a run clears? | not on `main` now | none on `main` | Code and tests were merged, then deleted from `main` by commit `3d6c97b0`; see below |
| 8 | Signal processing (removed from main) | Jitter against lag when smoothing a clip | not on `main` now | none on `main` | Same: deleted by `3d6c97b0` |
| 9 | Generate and test (removed from main) | How many proposals does the simulator throw out? | not on `main` now | none on `main` | Same: deleted by `3d6c97b0` |
| 10 | [Evaluating a detector](detector.md) | Is this detector good enough to place holds? | `?mode=lab-detector&labs=1` | `tests/lab-detector.test.ts` (8) | 22 scored cases from one run on six hand-labelled objects |
| 11 | [Verification and hashing](hashing.md) | Which part of a run do you hash so a changed tick shows up? | `?mode=lab-hashing&labs=1` | `tests/lab-hashing.test.ts` (14) | One course, one tick per change; the "what the game hashes" card is not checked against the golden files |
| 12 | [Reinforcement learning](rl.md) | Can a character learn the course from points you write? | `?mode=lab-rl&labs=1` | `tests/lab-rl.test.ts` (11) | One course and one seed per claim; several "What we saw" claims are not pinned |

## What to read in each doc
- **How it was designed:** the question, the choices, the real game code that runs, the data that is precomputed, and the order of the screen.
- **How we prove the lesson is right:** the test files and what each pins, and what would make the Lab's claim false.
- **Limits:** what is not tested, and what could mislead.
- **How to make the lesson better:** ranked next steps.

## Reading the status of a Lab
- Lab 4 is in progress: its files are not on `main` and not in history.
- Labs 7, 8 and 9 were merged (commits `6d030909`, `4a447f68`, `acfa2552`), then deleted from `main` by `3d6c97b0` (an unrelated commit that removed 75 files).
  - Their code, tests, recorded data and docs are still in history and on the branches `hanqi91/cc-lab-timing`, `-signal` and `-gentest`.
  - They have no doc here until they are restored and their docs get the four sections.
- Where a claim in a doc has no test behind it, the doc says so in its Limits section.
