# CC-146: Dojo redesign, before and after

- Serves the player learning one idea at a time in the Dojo (press T).
- `old-*.png` is the previous layout (`?dojo=old` still shows it).
- `new-*.png` is the redesign (default).
- Sizes: desktop 1280 wide, phone 390 wide.
- States: why it matters, try it, the shape, a rule of thumb, the exact formula, on the Course.
- Made by `scripts/dojo-states.mjs` on the VM.

## What changed
- Dark page with cream cards, like the welcome card and the Course.
- One scrolling row of lesson cards with progress.
- A belt-like path of six steps.
- The physics saying shows as a locked card until the player moves a slider.
- Big Back and Next buttons, sticky at the bottom on a phone.
- Calm fade-in, off when reduced motion is asked for.

## Known gaps
- The shared "Courses" chip from the onboarding menu floats in the empty part of the header.
- On desktop the drawing sits in the middle of a stage card that is as tall as the panel.
- No grading or coaching was added.
- Checks: `test:quick` shows only the known doc-style and JSON-format failures from other issues.
