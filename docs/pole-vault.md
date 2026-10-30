# Pole vault: speed bent into a pole and handed back as height

Serves the player who wants a fun way up (CC-239).
Status: the physics model and its law tests are built; the controls, the course obstacle and the motion clips are not.

## So what
- The physics works on paper with no energy added: speed bends the pole, the bend gives height back.
- The pole has to suit the run: a soft pole at a fast run is too weak, a stiff pole at a slow run stands the runner up and drops them back.
- That makes picking the pole the first choice of the obstacle (soft, medium or stiff), and it is true to the sport.
- Release timing is a real window: 217 ms (8 m/s, medium pole, 4.5 m bar), long enough for a person to hit.
- Next step: wire the keys and a course obstacle behind `?pole=1`, then make the motion clips on the VM.

## The model (one honest simplification)
- The planted pole is a spring leg; the runner is a point at its top (a spring pendulum around the planted tip).
- No muscle adds energy, so the highest point is never above the hands' start height plus the run's speed height.
- The pole is a straight spring, not a full beam: a known gap.
- Code: `src/sim/pole.ts`; tests: `tests/pole.test.ts`.

## What the tests prove
- With no damping the pole keeps the energy it was given.
- The body never goes higher than speed and start height allow.
- Faster reaches higher; too slow falls back.
- A release has a window: too early is short, in the window clears, held too long knocks the bar.
- A higher bar needs more speed and a stiffer pole.
- A cleared vault lands beyond the bar on the cushion.

## Numbers from the sweep (bar 3.6 m, hands 2.6 m when planted)
| Run speed | Pole (stiffness) | Release window | Highest point |
| --- | --- | --- | --- |
| 6 m/s | any tried | none: falls back | 2.7 to 3.3 m |
| 7 m/s | soft (9) | 283 ms | 4.2 m |
| 8 m/s | medium (12 to 16) | 217 to 758 ms | 4.5 to 5.0 m |
| 9 m/s | stiff (20) | 542 ms | 5.5 m |

## Controls (first idea, to be tried in the browser)
- Walk over a pole on the ground and press E to pick it up.
- Run with ← →; the runner carries the pole.
- Hold E at the plant box to jam the pole.
- Let go of E at the top; the pole falls away.
- Too slow: the pole stands up and the runner falls back; roll (X) to break the fall.
- Too late: the pole leans onto the bar and knocks it.

## Saying (to earn by discovery)
- "The pole cannot lift you; it hands your speed back as height."
- True in the model: no energy is added, and the tests check it.

## Motion plan (not started)
- Moves needed: pick-up and carry, plant and rise, release and fly over, land on the cushion, fall back, then the existing roll.
- Order of sources: CMU capture search first, then Kimodo text prompts, then captured video, then bones (see `docs/motion-pipeline.md`).
- A paid step needs its cost stated first: Kimodo on one L4 was about $0.04 for the roll.

## Known gaps
- The bend is one spring, so the pole's shape is not shown by the physics.
- The body arch over the bar is a single allowance (0.1 m), not a body model.
- The ideal-run search has not been run on a pole course yet.
