# CC-87: the drone ferry

## So what
- The game has a flying machine: a cargo drone carries the character across a 40 m gap that no jump can make.
- It teaches thrust against weight, leaning, battery and the limits of lift, each with a number the player can change.

## What is here
- `drone-flying.png`, `drone-leaning-debug.png`: the drone leaning forward over the gap with the debug view (B) open; the preview says where it would set the rider down.
- `drone-landing.png`: the rider set down on the far deck: "You made it".

## How it was checked
- `tests/drone.test.ts`: hover, lean, payload limit, battery energy, drag, wind, touchdown.
- `tests/demo-drone.test.ts`: the course, the crash cases, the preview.
- `tests/drone-editor.test.ts`: the editor piece, Fix it, the Hover lesson.
- `scripts/drone-check.mjs`: the browser check; the ideal-run bot boards, flies across and clears the course.

## Known gaps
- 2D side-view flight only.
- The stabiliser is always on in the Course; raw thrust is only in the Hover lesson numbers.
- The rider uses the seated cart pose, not a harness pose.
