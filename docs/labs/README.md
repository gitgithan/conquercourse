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
| 4 | [Computer vision](vision.md) | Which mask threshold trades photos kept against people missed? | `?mode=lab-vision&labs=1` | `tests/lab-vision.test.ts` (9) | The table counts overlapping masks twice (125 photos against the game's 131) and the photos are COCO, not the game's |
| 5 | [Camera and perspective](camera.md) | Why can one photo not give depth? | `?mode=lab-camera&labs=1` | `tests/lab-camera.test.ts` (14) | Hand-made bodies and no real photo; the compare card is not checked against the game |
| 6 | [Numerical integration](integration.md) | How much energy does a step rule invent, and does a replay match? | `?mode=lab-integration&labs=1` | `tests/lab-integration.test.ts` (10) | Several quoted numbers are not pinned, and the "recording" is the Lab's own RK4 run |
| 7 | [Statistics of timing](timing.md) | How does shaky timing change how often a run clears? | `?mode=lab-timing&labs=1` | `tests/lab-timing.test.ts` (15) | Presses are independent errors and only jumps move; the Park run gap between maths and simulator is not pinned |
| 8 | [Signal processing](signal.md) | Jitter against lag when smoothing a clip | `?mode=lab-signal&labs=1` | `tests/lab-signal.test.ts` (15) | The noise is a stand-in (white, equal on all joints), not real video noise |
| 9 | [Generate and test](gentest.md) | How many proposals does the simulator throw out? | `?mode=lab-gentest&labs=1` | `tests/lab-gentest.test.ts` (10) | Recorded replies of one model only, and a simple easing instead of the editor's Fix it |
| 10 | [Evaluating a detector](detector.md) | Is this detector good enough to place holds? | `?mode=lab-detector&labs=1` | `tests/lab-detector.test.ts` (8) | 22 scored cases from one run on six hand-labelled objects |
| 11 | [Verification and hashing](hashing.md) | Which part of a run do you hash so a changed tick shows up? | `?mode=lab-hashing&labs=1` | `tests/lab-hashing.test.ts` (14) | One course, one tick per change; the "what the game hashes" card is not checked against the golden files |
| 12 | [Reinforcement learning](rl.md) | Can a character learn the course from points you write? | `?mode=lab-rl&labs=1` | `tests/lab-rl.test.ts` (11) | One course and one seed per claim; several "What we saw" claims are not pinned |

## What to read in each doc
- **How it was designed:** the question, the choices, the real game code that runs, the data that is precomputed, and the order of the screen.
- **How we prove the lesson is right:** the test files and what each pins, and what would make the Lab's claim false.
- **Limits:** what is not tested, and what could mislead.
- **How to make the lesson better:** ranked next steps.

## Reading the status of a Lab
- All twelve Labs are on `main` with their code, tests and a doc with the four sections.
- Labs 7, 8 and 9 were deleted from `main` once by a stale-base ship and restored by PR 420.
  - `tests/no-conflict-markers.test.ts` and the delete guard in `scripts/ship.sh` exist so that cannot happen quietly again.
- Every Lab has a card in the world picker, shown only with the labs switch on.
- Where a claim in a doc has no test behind it, the doc says so in its Limits section.
