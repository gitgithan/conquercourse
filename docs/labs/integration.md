# Lab 6: Numerical integration

## The question
- When a computer moves a cart in small steps, how much energy does it invent or lose?
- Does a replay at your step still come out exactly the same as the game's recording?

## The controls
- Rule: Euler, semi-implicit Euler or RK4.
- Step size: 10 to 960 steps a second.
- Run length: 10, 60, 300 or 1200 seconds of game time.

## What runs
- The cart's own equations from `src/sim/cart.ts`: the same acceleration, the same speed along the rails, the same spline rails.
- The rail is a private frictionless bowl made with the game's rail code, so the energy should never change.
- RK4 at 120 steps a second gives the game's cart step bit for bit (a test checks this against `cartStep`).
- Euler and semi-implicit Euler are private copies in `src/labs/integration/engine.ts`, because the game only has RK4.
- The work runs in a worker (`src/labs/integration/worker.ts`); the plots are canvas.

## What each output means
- Energy drift: the energy at each moment against the start, as a share.
  - Zero is perfect.
- The axis is stretched like a log scale on both sides so tiny and huge drifts both show.
- Replay hash: a short code over x and v at every whole second.
  - Equal hash means equal to the last bit.
- Replay gap: how far your cart is from the game's recording, in metres, over time; the first second it is a millimetre apart.
- Measured order: halve the step and see how the error at 3 s shrinks (about 1 for Euler, about 4 for RK4).
- Cost: looks at the push per game second (1 for each Euler step, 4 for RK4).

## What we chose and why
- The game uses RK4 at 120 steps a second, always.
- A replay is only the key presses played again, so every machine must reach the same run.
- A fixed step and a fixed rule give that; a step that follows the frame rate would not.
- The compare card is shown after your first run, with the measured drift of that setting.

## What we found
- Explicit Euler gains energy until the cart leaves the rails, even at a fine step (about 93 s at 240 steps a second).
- Semi-implicit Euler drifts far more slowly, but here it still creeps up (about 1 % per 200 s at 240 a second), because the rail slope is in the position update.
- RK4 at 120 steps a second drifts about 1e-8 over 300 s.
- A finer RK4 (240 or 960 a second) is more accurate but has a different hash from the recording.

## How it was designed
- **The one question:** when a computer moves a cart in small steps, how much energy does it invent or lose, and does a replay at your step match the game's recording?
- **The choices and why those:**
  - Three rules (Euler, semi-implicit Euler, RK4) are the classic ladder from first to fourth order.
  - Step size from 10 to 960 steps a second shows the trade between accuracy and cost.
  - Run length shows that small drifts only matter when they add up.
  - The track is a lossless bowl, so the true energy is a constant and any change is the method's fault.
- **Which real game code runs:** the cart's equations from `src/sim/cart.ts` (acceleration, speed along the rails) and `makeRails` for the spline rails.
  - Euler and semi-implicit Euler are Lab copies (`src/labs/integration/engine.ts`), because the game only has RK4.
  - The bowl itself is five points `[0,6] [10,1.2] [20,0.2] [30,1.2] [40,6]`, typed in by hand.
- **Which data is precomputed:** none; every trace is computed live in a worker (`src/labs/integration/worker.ts`).
- **Order of the screen and why compare comes last:** choices, energy plot, replay plot, measured order and cost, then the card on what the game uses; the card appears after the first run so it can quote the drift of the player's own setting.

## How we prove the lesson is right
- `tests/lab-integration.test.ts` (10 tests):
  - RK4 at 1/120 s equals the game's `cartStep` bit for bit over 600 steps, with and without the brake, on a test rail.
  - RK4 at 240 steps a second keeps the bowl's energy to under 1e-6 over 120 s, and explicit Euler at 120 steps a second drifts at least 10000 times more over 30 s.
  - Semi-implicit Euler drifts under a third of Euler at 90 s, stays on the rails for 600 s with a maximum drift under 0.05, and its final drift is over 0.01 (a slow rise, not zero).
  - RK4 at 240 steps a second stays under 1e-6 over 600 s.
  - Measured order: 0.9 to 1.2 for Euler and semi-implicit Euler, 3.5 to 4.6 for RK4.
  - A smaller step drifts less, for each of the three rules.
  - The same choices give the same hash twice; the game's setting (RK4, 120) reproduces the recording with an end gap of exactly zero.
  - Four other settings (RK4 at 240 and 60, semi at 120, Euler at 120) all give a different hash from the recording.
  - A run that leaves the rails (Euler at 10 steps a second) stops and says when.
  - Divergence and first-apart are measured in metres, with a millimetre threshold.
  - The bowl starts under both rims, and the options are clamped to the menus.
- `scripts/lab-integration-smoke.mjs` is the browser run; evidence `docs/evidence/lab-integration-euler.png` and `docs/evidence/lab-integration-rk4.png`.
- What would make the Lab's claim false:
  - RK4 at 120 not equal to `cartStep` (the first test fails and "the game's setting" label is wrong).
  - Euler not gaining energy in the bowl, or RK4 order not near 4.

## Limits
- **The recording is the Lab's own RK4 run on the bowl,** not a stored file from the game; only the single step is proved equal to the game's `cartStep`, on another rail.
- **Numbers quoted in "What we found" are not all pinned by a test.**
  - Pinned: RK4 at 240 under 1e-6 over 600 s; semi-implicit creeps over 0.01 and stays under 0.05; Euler leaves the rails at 10 steps a second.
  - Not pinned: "Euler leaves the rails after about 93 s at 240 steps a second", "about 1 % per 200 s" for semi-implicit, and "RK4 at 120 drifts about 1e-8 over 300 s".
- **The cost line** (1 push per Euler step, 4 per RK4) is a count printed by the page; no test checks it.
- **Hashes across browsers or CPUs** are not tested: the maths avoids inexact functions here because friction and drag are zero, so the `tanh` term is multiplied by zero.
- **The bowl has no friction or drag,** so the game's real coaster is not checked for drift.
- **The log-like energy axis** can make a tiny drift look large; it is a display choice, not tested.
- Desktop 1280 px only.

## How to make the lesson better
1. Add tests for the three quoted "What we found" numbers, or change the text to match what is pinned.
2. Store a recording from the real game coaster, with friction, and compare the Lab's step against a full game replay.
3. Run the same hash on two browsers and two CPUs, and publish the result.
4. Add a symplectic rule that really conserves energy on this rail (leapfrog or Verlet) to show the missing fourth step of the story.
5. Let the player add friction and see energy fall as it should.
