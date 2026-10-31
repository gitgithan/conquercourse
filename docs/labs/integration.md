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
- Energy drift: the energy at each moment against the start, as a share. Zero is perfect.
- The axis is stretched like a log scale on both sides so tiny and huge drifts both show.
- Replay hash: a short code over x and v at every whole second. Equal hash means equal to the last bit.
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

## Not tested
- Hashes across different browsers or CPUs (the maths uses only exact operations here, since friction and drag are zero, so the `tanh` term is multiplied by zero).
- The game's own coaster with friction: the Lab uses the lossless bowl so energy can be the check.
- Touch or phone layouts (desktop 1280 px only).

## Evidence
- `docs/evidence/lab-integration-euler.png` and `docs/evidence/lab-integration-rk4.png`.
- Tests: `tests/lab-integration.test.ts`; browser smoke: `scripts/lab-integration-smoke.mjs`.
