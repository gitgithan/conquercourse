# CC-80: the round trip between the Course and the editor

- **What the pictures show** (from `scripts/roundtrip-check.mjs`, a 5 m gap between two decks):
  - `1-fall.png`: the fall panel with Make it easier and Edit this course.
  - `2-easier-preview.png`: the editor opened at the gap with the hollow outline and the sentence "The narrowest press window grows from 314 ms to 405 ms."
  - `3-back-in-course.png`: Apply and try it, back in the Course at the same obstacle.
  - `4-edit-this-course.png`: Edit this course again, with the undo list kept.
  - `5-cleared.png`: the changed lane cleared by the ideal-run bot.
- **Result:** every step of the check passes: found a change, applied it, back in the Course at x = 5 m, two pieces kept, undo list kept, back again, cleared.
