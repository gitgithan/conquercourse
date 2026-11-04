# Lab 19: Same run, any machine

*Run to shared link, stages 3 and 4 of 5: Replay and Hash (see [the series map](pipelines.md)).*
*Before it: [Verification and hashing](hashing.md) (what to hash) and [Numerical integration](integration.md) (the fixed step).*
*After it: nothing yet; opening a real share link is not a Lab.*
*The test that found the real problem is written up in [the cross-hardware lesson](../lessons-cross-hardware-testing.md); the fingerprint rules are in [hash-design](../hash-design.md).*

## When you open it
- Live: it opens on the Plank bridge course with machine B set to a last-digit habit, a late frame clock and its own walk order, and every pin on, so the strips are green.
- The challenge opens on level 2 with no pins, so the first red frame is already shown.
- Turn a pin off to see the first mismatch move.
- A small label says "Showing our setting, already run".

## The question
- A friend replays your keys, or the server replays them to prove a clear.
- Why can the same keys give a different fingerprint on another machine, and how do we make every machine agree?
- Open it at `?mode=lab-determinism&labs=1`.

## What runs
- The game's own simulator, `src/sim/world.ts`, unchanged, on four shipped demo courses (Plank bridge, Plank bridge thick then thin, Drop, Swing) and the best run stored with each.
- The keys of that run come from `playPlan` in `src/sim/ideal.ts`, one key state per tick.
- The stored traces are `tests/golden/sim-trace.json`: the whole world after every tick, hashed once.
  - The Lab recomputes the same hash in the page (a SHA-256 written out in `src/labs/hashing/core.ts`) and shows stored against this browser.
- Lab code only: `src/labs/determinism/determinism-core.ts`.
  - A machine is three habits: a rounding habit, a frame clock that runs late, a walk order for the saved state.
  - The per-frame fingerprint is a 32-bit FNV-1a hash of the runner's numbers written as text in the machine's walk order.
- Everything runs in the page; no worker, no paid call.

## The habits (what each one models)
- **Fused multiply-add:** `a x b + c` rounded once, not twice.
  - The widget shows `(1 + e)(1 - e) - 1`: two roundings give 0, one rounding gives `-e^2`.
  - In the machine it is a one-unit-in-the-last-place nudge to the runner's position and speed after each tick.
- **Single precision:** the runner's position and speed are rounded to 32 bits after each tick, like many GPUs.
- **Add order:** the same 200 speeds of the run summed forward, backward, small first and in pairs give different last digits.
- **Late frame clock:** a machine whose frame clock runs late by `f` reads key `i + floor(i x f)` at tick `i`.
  - This is the stand-in for a variable step: the physics step is fixed, the keys land on the wrong tick.
- **Walk order:** a machine whose maps are not ordered writes the state's names in its own order, so the same state gets another hash.
  - The same applies to a sort that is not stable: equal items can come out in another order.

## The pins
- **Fixed step:** keys are read by tick count, never by the frame clock.
- **Ordered walk:** names are sorted before they are hashed.
- **Round the hashed numbers:** each number is rounded to a grid (1e-9 m up to 10 cm) before it is hashed; this stands in for integer state.
  - The game's real fix was different and smaller: no `**` or `Math.pow` in the step, only `+ - * /` and `Math.sqrt`, so two Node versions give the same bits (see the lesson).

## The challenge
- Three machines, three levels:
  - Level 1: one machine walks the state in another order (fewest pins: 1).
  - Level 2: a fused machine and a 32-bit machine join (fewest: 2).
  - Level 3: one machine also has a late frame clock (fewest: 3).
- The page tries every pin set and grid in the browser to find the fewest, and says so only when every frame agrees.
- "Agree" is a hard check: all fingerprints equal on every frame, and every run ends the same way.

## How a run is verified
- The keys are the run; the checker replays them with a fixed step, fingerprints every frame and compares with the stored trace.
- The four levels of "these two runs match", from the lesson, are answered live for machine A and machine B:
  - Level 1: Outcome (cleared or fell).
  - Level 2: Tick count and end place to 6 decimals.
  - Level 3: Every frame within 1e-9.
  - Level 4: Exact bits: every frame hash equal.

## How it was designed
- **The one question:** why does the same run give another fingerprint on another machine, and what pins it?
- **The choices and why those:**
  - A strip of one colour per frame hash, because equal hashes then look equal and the first different one is a visible jump.
  - A red or green third strip, with red cells taller than green ones, so the first mismatch does not rely on colour alone.
  - A log-scale meter of how far apart the real numbers are, so the player sees a difference of 1e-13 that never changes the outcome next to hashes that all differ.
  - Machines are simulated habits (code that mimics a fused multiply-add, another sum order, a late clock); each habit is one that real machines have (see the lesson).
- Real machines are added next to them: the game's own golden-trace test (`tests/sim-trace.test.ts` logic) was run at build time on Node 24, Node 22, Chromium, Firefox and WebKit on Modal CPU containers (x86-64), and the Lab shows the recorded result.
  - The harness is `data/eval/cc-133-determinism-real/` (README, `run.json`, scripts); the Lab reads `public/assets/lab/determinism-real.json`.
  - The challenge always runs on the Plank bridge, so every level has an answer (the Lab tries every pin set to prove it); the swing difference has its own card, "A real difference we found".
- **Which real game code runs:** the simulator, `playPlan`, the stored traces; the machines only nudge its output.
- **Which data is precomputed:** none.
- **Order of the screen and why:** the three habits first, then two machines with pins, then the challenge, then the stored traces, then the maths.

## How we prove the lesson is right
- `tests/lab-determinism.test.ts` (17 tests) pins:
  - the page's trace equals `tests/golden/sim-trace.json` for all four courses.
  - the fused example is exactly `-e^2` and two roundings give 0.
  - a last-digit habit stays under 1e-9 and keeps the outcome, yet changes most frame hashes; a grid hides it.
  - a 32-bit habit is seen by a 1 mm grid (a number on a rounding edge) and hidden by a 1 cm grid.
  - a late clock changes the strip, a fixed step does not, and on the Drop course the late machine does not finish.
  - with no pins no level agrees, with all pins every level agrees, and the fewest pins are 1, 2 and 3.
  - the four levels are nested.
- What would make the claim false: a level that agrees with fewer pins than the brute-force search found (the search is the proof), or a stored trace that this code no longer reproduces.
- Browser check: `scripts/lab-determinism-check.mjs` opens the page at 1280 px, checks the stored traces, solves the three levels and fails on a page error.
- Picture: [the Lab at 1280 px](../evidence/cc-133-pipeline-labs/lab-determinism.png).

## What we saw
- Hash differences of one unit in the last place appear on most frames at once, while the real numbers stay about 1e-13 apart and the run still clears.
- A 32-bit machine is about 1e-6 away; a 1 mm grid still sees about 10 frames flip, a 1 cm grid sees none.
- Rounding does not cure the edge: on the Swing course no grid up to 10 cm hides the 32-bit machine on every frame.
- A late clock of 0.4 % does not change the plank run's result but changes every frame hash from the first key it misreads; on Drop the late machine does not finish.

## Limits
- The simulated machines are models of habits, not real hardware.
- The real machines are recorded, not live: Node 24, Node 22, Chromium 156, Firefox 157 and WebKit 27.2 on Modal x86-64 containers, plus the laptop Node 24.
  - No ARM machine and no real GPU was available (Modal has no ARM CPUs; no Apple machine was reachable), so ARM is untested.
  - WebKit here is Playwright's Linux build of JavaScriptCore, not Safari on a Mac.
  - The container hides the CPU model, so the CPU column says only x86-64.
- The browser itself is a real machine: the "this browser" column of stored traces is its own result, and a mismatch there is a real finding.
  - Found on 2026-11-04 in Chromium 1248 (software GL) on the Vultr VM: the plank and drop traces are the same as Node's, the swing (lache) trace has the same 1123 frames and a different hash, so a sin or cos is rounded another way in that engine.
  - The page says so in words under the table when it happens.
- Rounding the hashed numbers is a design choice of this Lab; the game's own trace hash is of the exact bits.
  - A coarse grid also hides a real physics change smaller than the grid.
- The late frame clock is a key shift, not a variable-step physics; the game never uses a variable step.
- The runner's position and speed are nudged; other state in the world (beams, carts, drones) is not.
- Sort stability and Map order are modelled together as one walk order.
- Four courses; the longest generated course is not included.

## How to make the lesson better
1. Run the same replay on two real machines and show their per-frame strips from stored files.
2. Add integer (fixed-point) state as a real fourth pin and run the plank with it.
3. Show where the first mismatch sits on the course picture, so a landing edge is visible.
4. Add our own sin, cos, tan and exp (the open item in the lesson) as a pin and test it in `workerd`.
5. Let the player build a machine from the habits for the challenge instead of three fixed ones.
