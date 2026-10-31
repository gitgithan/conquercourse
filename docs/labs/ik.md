# Lab 3: Posing a character (inverse kinematics)

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

## Not tested
- Only the side plane is solved; the sideways (z) position of the hands is not part of the Lab.
- The limits (150 degrees, -60 to 180 degrees) are the Lab's own round numbers for a person's arm, not measured values.
- The elbow-flip and reach facts are about the algorithm; nothing here grades a player's technique.
- Phone and touch are not supported (desktop 1280 px only).

## Tests
- `tests/lab-ik.test.ts`: the two-bone solver is the game's `ik2`; law of cosines and bone lengths; reach limit and breaking point; the elbow flip; limits; damped least squares agrees with two-bone; the neck rule keeps the head within its limit.
- `scripts/lab-ik-check.mjs`: the browser run at 1280 px (labs off, drag, flip, limits, breaking point, neck, equations box).
