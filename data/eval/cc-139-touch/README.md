# CC-139: touch controls

## So what
- A friend who opens a challenge link on a phone can now play the run, not only watch it.
- The buttons press the same keys as the keyboard, so a run made by touch is logged, proved and shared like any other.
- The page shows them on a touch device, and `?touch=1` shows them anywhere; `?touch=0` hides them.
- Real-phone feel (size, latency) still needs the product owner's own phone.

## What was built
- `src/share/touch.ts`: the button table, the on/off switch, a finger tracker, and the drawn pad.
- Buttons: left, right, jump, bend, hold, vault, roll, retry, and aim and fire on cannon courses.
- Each button sends the keyboard event of its key, so nothing in the simulator changed.
- Two fingers work together (run and jump); two fingers on one button press the key once.
- On a touch device the keys card and the small corner view are hidden.
- A challenge link on a touch phone now plays normally; the watch-only notice (CC-138) stays for `?phone=1` with touch off.

## Checks (software GL, 390 x 844 touch phone, VM2)
- Unit: 6 tests (table, two fingers, one button, lost finger, switch).
- Browser: 8 PASS.
  - A computer shows no buttons; `?touch=1` shows them; `?touch=0` hides them on a phone.
  - Plank bridge cleared by holding the right button only; the report offers the share link, so the run was proved.
  - Run and jump held at once are both down, and every key is released when the fingers lift.
  - A challenge link on a touch phone says "Beat this time" and has the buttons.

## Known gaps
- A timed run with jumps by touch (lane 1) was tried and not completed in software GL: the page polled too slowly to hit the jump spots, so that is not tested rather than failed.
- The layout is checked by eye on one size; cannon buttons are not photographed.
- The drum lane sits behind the pad; both stay usable.

## Evidence
- `pad.png`, `two-fingers.png`, `lane-done.png` (the earlier lane try), `challenge-on-phone.png`.
