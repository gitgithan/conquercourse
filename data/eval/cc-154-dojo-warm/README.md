# CC-154: Dojo round 2, before and after

- Serves the player learning one idea at a time in the Dojo (press T).
- `before-*.png` is the dark Dojo from CC-146.
- `after-*.png` is the warm, lighter Dojo with four steps.
- Sizes: desktop 1280 wide, phone 390 wide.
- Made by `scripts/dojo-states.mjs` on VM2.

## What changed
- The page is warm cream and sand with dark text.
- The floating "Courses" pill is not shown in the new Dojo.
- A small hint under the title says "T: back to courses".
- T opens the course picker; Esc closes it; picking a course leaves the Dojo.
- Four steps: Why it matters, Try it, The shape, The exact formula.
- Each lesson shows its graph once.
- The rule of thumb is a caption under the graph once a slider has moved.
- The formula is drawn in a strip over the same graph, only on the last step.
- The way back to the Course sits at the end of the last step.

## Where the Courses pill still shows
- Every mode except the Course and the new Dojo: the editor, the map, the coaster builder, the park, the gallery, the labs, diagrams and the old Dojo (`?dojo=old`).

## Known gaps
- The formula shows twice on the last step: in the strip over the graph, and as the working in the panel.
- The Landing chart's side label is long on a phone.
