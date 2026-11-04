# Posing a character (inverse kinematics)

## When you open it
- Live: it opens on the game's own pose choices for the first preset, already solved; the arm picture, numbers and compare card are filled.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## The question
- When the hand must land on a bar or a ledge, how does the arm bend, where does the pose break, and what does each rule change?
- Open it at `?mode=lab-ik&labs=1` (it is not in the Courses list yet).

## What runs
- The Rookie's stand and a crouched pose, built bone by bone from the clips' bone lengths and the model's own shoulders.
- The game's own `ik2` two-bone reach from `src/motion/compose.ts`, with the game's pole (elbow down and back).
- The game's own neck rule, `settleNeck` from `src/motion/neck.ts`.
- A second solver, damped least squares, which the game does not run; it is there to compare.
- Everything runs in the page; no worker, no asset, no paid call.

## The controls
- **Solver:** two-bone (the game) or damped least squares (with a damping slider).
- **Joint limits:** off (the game: only the full-stretch stop) or on (an elbow bends 0 to 150 degrees one way; a shoulder swings -60 to 180 degrees).
- **Neck rule:** on (the game) or off, with a crouch slider so the rule has something to correct.
- **The bar:** drag it, use the arrow keys, pick a preset, or slide it out to the breaking point.

## What each output means
- **Result and residual error:** how many centimetres the hand misses the bar; under 5 mm counts as on it.
- **Elbow bend and shoulder angle:** the two joint angles of the arm.
- **Elbow side and flips:** the elbow points the natural way, or has flipped (the bar crossed the line the elbow is pushed along); the picture marks where it flipped.
- **Arm reach:** the folded and full-stretch distances from the shoulder; beyond them the hand stops short.
- **Breaking point:** found by walking the bar out along its line from the shoulder, from a cold start each step, to a tenth of a millimetre; the ring in the picture.
- **Steps used:** how many small steps the iterative solver needed (the two-bone solver needs none).
- **Neck bend and shoulder offset:** the largest bend of the neck chain from the trunk and the largest shoulder offset from the chest, against what the rule allows.
- **Map:** for every bar position around the shoulder, whether the hand lands on it (green) or misses (red, darker is further).

## What we chose and why (shown last in the Lab)
- Two-bone solver: the arm has two bones, so the answer is exact and the same bar always gives the same pose.
- No joint limits of our own: the hand stops at full stretch, and a ledge only gets a full pull when it is within about one arm length.
- Neck rule always on while the body is blended or hanging: without it a crouch blended into a hang leaves the head bent further than a neck allows.

## How it was designed
- **The one question:** when the hand must land on a bar, how does the arm bend, where does the pose break, and what does each rule change?
- **The choices and why those:**
  - Solver (two-bone or damped least squares) shows the exact answer against an iterative one.
  - Joint limits and the neck rule are the two rules a character rig adds; each has an on and off switch.
  - Dragging the bar, plus a walk out to the breaking point, makes "where it breaks" a number.
- **Which real game code runs:** `ik2` from `src/motion/compose.ts` with the game's pole, and `settleNeck` from `src/motion/neck.ts`.
  - The damped least squares solver, the joint limits, the breaking-point walk and the map are Lab code (`src/labs/ik/ik-core.ts`); the game does not run them.
  - Everything runs in the page.
- **Which data is precomputed:** the body is built from the Rookie model file (`public/assets/characters/rookie-a.glb`) and the clips' bone lengths (`run` and `land`); nothing else is stored.
- **Order of the screen and why compare comes last:** the picture and the draggable bar first, then the numbers, the map, and what the game chose last, so the player has broken the pose before reading why the game has no limits of its own.

## How we prove the lesson is right
- `tests/lab-ik.test.ts` (12 tests), using the real Rookie model file read from disk:
  - The body stands on the floor, and the arm length is between 0.45 and 0.9 m.
  - The Lab's two-bone solver gives the same elbow and hand as the game's `ik2` to 6 decimals.
  - Law of cosines: a reachable target is hit to under 1e-6 m, both bones keep their length, and the bend equals the angle from the law of cosines.
  - Past full stretch the hand stops short by exactly the extra distance (0.2 m), and the breaking point found by the walk equals the full reach to 2 decimals.
  - A folded arm cannot be shorter than the difference of its bones.
  - The elbow flips when the target crosses the pole line (behind the shoulder flips, in front does not).
  - Limits on: the elbow stays between 0 and its maximum, and a behind-the-back target is missed by more than 1 cm.
  - Damped least squares reaches four targets under 5 mm, takes more than one step, and lands within 1 cm of the two-bone hand.
  - More damping takes more steps; out of reach it gives the same shortfall as two-bone.
  - The same choices give the same pose twice.
  - The neck rule keeps the head and shoulder inside the game's limit in a crouch, and without it the head goes more than 1 degree beyond.
  - Forward kinematics: straight down is zero, forward is positive.
- `scripts/lab-ik-check.mjs`: browser run at 1280 px; evidence `docs/evidence/lab-ik-elbow-flip.png` and `docs/evidence/lab-ik-breaking-point.png`.
- What would make the Lab's claim false:
  - A drag target that the two-bone solver hits but the Lab reports as missed, or the reverse.
  - A game change in `ik2` (the "same as the game" test fails) or in `settleNeck` (the neck test fails).

## Limits
- **Side plane only:** the sideways position of the hands is not solved.
- **Round-number limits:** 150 degrees for the elbow and -60 to 180 degrees for the shoulder are the Lab's own choices, not measured values.
- **The map and the "steps used" counter** are not pinned by a test beyond the solver tests.
- **The pole is a typed-in copy** of the game's (`GAME_POLE` in `ik-core.ts`, from `src/render/actor.ts`), so no test would notice if the game changed its pole.
- **Unbacked sentences on the compare card:**
  - "A ledge only gets a full pull within about one arm length" is about the game's rule and is not tested here.
  - "Without the neck rule a crouch blended into a hang leaves the head bent too far" is shown by the crouch test, not by a blend.
- **One body:** the Rookie A model only.
- Nothing grades a player's technique; the facts are about the algorithm.
- Desktop 1280 px only.

## How to make the lesson better
1. Export the game's pole from `src/render/actor.ts` and import it in `ik-core.ts` and the test, so a game change breaks the Lab test.
2. Add a third dimension (the z position of the hands) to show a three-bone chain and the elbow cone.
3. Replace the round-number limits with limits fitted to the motion clips, and cite the fit.
4. Add a test for the map (the share of green cells against a hand-computed reach disc).
5. Show the same bar reached from the crouch clip pose, since the game blends poses.
