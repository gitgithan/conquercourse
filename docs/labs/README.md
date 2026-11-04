# University Labs: index

*One row per Lab, grouped into the pipelines the game was built with.*
*Open a Lab at its URL; the labs switch (`labs=1`) keeps new players from seeing them.*
*Every Lab doc has the same four sections: How it was designed, How we prove the lesson is right, Limits, How to make the lesson better.*
*The plan and the rules for all Labs are in [university-labs](../university-labs.md).*

*Read in series order: [the series map](pipelines.md) says which Lab teaches which stage, and which stages have no Lab.*
*Two tiers: Foundations (four sub-headers) and Pipelines (more join as new Labs land).*
*Pipeline Labs show "from", "uses" and "next"; Foundation Labs show "used in" (see [the series map](pipelines.md)).*
*The numbers are the stable ids; the order below is the order the pipelines are taught.*

### Photo to course object
| # | Stage | Lab | Question | URL | Tests | Biggest limit |
|---|---|---|---|---|---|---|
| 4 | Cut-out | [Computer vision](vision.md) | Which mask threshold trades photos kept against people missed? | `?mode=lab-vision&labs=1` | `tests/lab-vision.test.ts` (9) | The table counts overlapping masks twice (125 photos against the game's 131) and the photos are COCO, not the game's |
| 10 | Cut-out | [Evaluating a detector](detector.md) | Is this detector good enough to place holds? | `?mode=lab-detector&labs=1` | `tests/lab-detector.test.ts` (8) | 22 scored cases from one run on six hand-labelled objects |
| 5 | Lift to 3D | [Camera and perspective](camera.md) | Why can one photo not give depth? | `?mode=lab-camera&labs=1` | `tests/lab-camera.test.ts` (14) | Hand-made bodies and no real photo; the compare card is not checked against the game |
| 14 | Bake | [Cut-out, lift and bake](lift.md) | What is each bake step for when a photo becomes a game object? | `?mode=lab-lift&labs=1` | `tests/lab-lift.test.ts` (19) | The raw lift is a stand-in made from the baked object (recorded raw size only for the bench and the railing) |
| 15 | Collision | [Collision from a 3D lift](collision.md) | How does a noisy 3D lift become a clean collider, and what does the fit hold when the lift breaks? | `?mode=lab-collision&labs=1` | `tests/lab-collision.test.ts` (27) | The answer depends on the cell size, and the breaks act on the rung peaks, not on the mesh |
| 9 | Place and prove | [Generate and test](gentest.md) | How many proposals does the simulator throw out? | `?mode=lab-gentest&labs=1` | `tests/lab-gentest.test.ts` (10) | Recorded replies of one model only, and a simple easing instead of the editor's Fix it |

### Video to motion
| # | Stage | Lab | Question | URL | Tests | Biggest limit |
|---|---|---|---|---|---|---|
| 8 | Smooth, gate | [Signal processing](signal.md) | Jitter against lag when smoothing a clip | `?mode=lab-signal&labs=1` | `tests/lab-signal.test.ts` (15) | The noise is a stand-in (white, equal on all joints), not real video noise |
| 3 | Clip | [Inverse kinematics](ik.md) | Where does the arm bend and break when the hand must reach a bar? | `?mode=lab-ik&labs=1` | `tests/lab-ik.test.ts` (12) | Side plane only, and the joint limits are round numbers |
| 13 | Gate (the whole video pipeline) | [Video to motion](motion.md) | Which step of a filmed move can go wrong, and what stops it before the character moves? | `?mode=lab-motion&labs=1` | `tests/lab-motion.test.ts` (20) | The broken clips are made by us; only two failures are recorded, and the page runs the TypeScript gate, not the Python one |

### Idea to course
| # | Stage | Lab | Question | URL | Tests | Biggest limit |
|---|---|---|---|---|---|---|
| 16 | Fix it | [Design partner loop](partner.md) | Can a design partner's course be checked and repaired by the simulator? | `?mode=lab-partner&labs=1` | `tests/lab-partner.test.ts` (13) | Fix it applies the proved easing, not the editor's search; the run trail is a sketch |

### Map to lane
| # | Stage | Lab | Question | URL | Tests | Biggest limit |
|---|---|---|---|---|---|---|
| 18 | Map to lane | [World Slicer: map to lane](slicer.md) | How does a pin on a real map become a lane the simulator can prove? | `?mode=lab-slicer&labs=1` | `tests/lab-slicer.test.ts` (23) | Buildings only (no trees or fences), five of 47 places, and the what-if limits change only the quick look |

### Know the limits
| # | Stage | Lab | Question | URL | Tests | Biggest limit |
|---|---|---|---|---|---|---|
| 19 | Check | [What the model cannot do](limits.md) | Which model failures do we give up on, cover with a check, or never needed a model for? | `?mode=lab-limits&labs=1` | `tests/lab-limits.test.ts` (16) | 14 photos rated by eye; the curves are steps |

### Methods behind the pipelines
| # | Stage | Lab | Question | URL | Tests | Biggest limit |
|---|---|---|---|---|---|---|
| 1 | Search | [Search](search.md) | Which way of looking finds a clear run, and what does it cost? | `?mode=lab-search&labs=1` | `tests/lab-search.test.ts` (7) | The heuristic sliders are untested, and "what the game does" is a sentence, not a measured run |
| 2 | Optimize | [Optimization](optimization.md) | Which settings are fastest, and how many tries to find them? | `?mode=lab-optimization&labs=1` | `tests/lab-optimization.test.ts` (15) | Only 24 cells per map are replayed live, and the rope claim is pinned at 4 peaks, not 6 |
| 12 | Learn | [Reinforcement learning](rl.md) | Can a character learn the course from points you write? | `?mode=lab-rl&labs=1` | `tests/lab-rl.test.ts` (11) | One course and one seed per claim; several "What we saw" claims are not pinned |
| 19 | Wait | [Hide the wait](wait.md) | How do you make slow work short, smooth and never empty on screen? | `?mode=lab-wait&labs=1` | `tests/lab-wait.test.ts` (32) | The worker pool and the remembered jobs are a model over real recorded job costs, on three courses |
| 7 | Keys | [Statistics of timing](timing.md) | How does shaky timing change how often a run clears? | `?mode=lab-timing&labs=1` | `tests/lab-timing.test.ts` (15) | Presses are independent errors and only jumps move; the Park run gap between maths and simulator is not pinned |
| 6 | Replay | [Numerical integration](integration.md) | How much energy does a step rule invent, and does a replay match? | `?mode=lab-integration&labs=1` | `tests/lab-integration.test.ts` (10) | Several quoted numbers are not pinned, and the "recording" is the Lab's own RK4 run |
| 11 | Hash | [Verification and hashing](hashing.md) | Which part of a run do you hash so a changed tick shows up? | `?mode=lab-hashing&labs=1` | `tests/lab-hashing.test.ts` (14) | One course, one tick per change; the "what the game hashes" card is not checked against the golden files |
| 19 | Hash | [Same run, any machine](determinism.md) | Why does the same run differ on another machine, and what is the fewest pins that make every frame agree? | `?mode=lab-determinism&labs=1` | `tests/lab-determinism.test.ts` (17) | The machines are models of habits, not real hardware; the swing trace really differs in one browser engine |

### Finale
| # | Stage | Lab | Question | URL | Tests | Biggest limit |
|---|---|---|---|---|---|---|
| 17 | Finale | [System design](system-design.md) | If you build the whole game from blocks, which order keeps keys, faces and money safe? | `?mode=lab-systemdesign&labs=1` | `tests/lab-systemdesign.test.ts` (12), `tests/design-partner.test.ts` (7) | Costs are for the recorded runs; the partner's comment is one opinion and the judge wins on facts |
| 20 | Plan | [Spike the riskiest call first](spike.md) | Which test do you run first on a new move or obstacle, and what does the wrong order cost? | `?mode=lab-spike&labs=1` | `tests/lab-spike.test.ts` (28) | Chances and hours are our guesses; only the two stories hold measured numbers |

## When you open a Lab (owner, 2026-11-01)
- Every Lab opens with our setting already run and every output filled, so a demo needs no click on Run.
- A small label says so: "Showing our setting, already run", or "Precomputed with the same code (seed N)".
- Fast runs happen live on open, with the same code in the same worker:
  - Labs 1, 2, 6 and 11 run on open.
  - Labs 3, 4, 5, 8 and 10 were already filled at load.
- Slow runs are precomputed once with the same code and a fixed seed, and shipped as a small file:
  - Lab 7 (`timing-default.json`), Lab 9 (`gentest-default.json`) and Lab 12 (`rl-default.json`) in `public/assets/lab/`.
  - `scripts/labs-default-precompute.ts` makes them; `tests/lab-populated.test.ts` re-runs the code and fails if a file drifts.
- `scripts/labs-default-smoke.mjs` opens all 12 with no click at 1280 px and fails on a page error, a placeholder or an empty output; its first-paint times and shots are in `docs/evidence/cc-118-labs-default/`.
- The controls sit at our setting; Run stays for trying your own.

## Moving between Labs
- Every Lab page has a bar across the top with all the Labs by number and name, under a tier heading (Foundations, Pipelines) and a sub-header; the current one is highlighted.
- One click on a name opens that Lab; Previous and Next step along the list (no wrap at the ends).
- The keys `[` and `]` do the same when you are not typing in a box.
- Each switch is a link, so the browser closes the old Lab fully (workers, listeners, audio) and the Dojo music rule runs again on the new page.
- The grouping is one list, `LAB_GROUPS` in `src/ui/labs-series.ts`; a new Lab is one line there plus its card in the picker.
- The Courses picker shows the same groups ("Labs: Photo to course object" and so on).
- The bar is one file, `src/ui/labs-nav.ts`, mounted by one line in each Lab; it is hidden when the labs switch is off (`?labs=0`).

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
