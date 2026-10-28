# CC-86: Graph Studio, pause and drag the ground

- **So what:** any course can be reshaped in place: Tab, drag a deck or a bar, read the verdict, "Play from here".
- **Pictures** (default course, software renderer):
  - `open.png`: the studio open, the baseline verdict ("clears in 17.5 s").
  - `dragged.png`: a deck dragged up, the verdict "working".
  - `verdict.png`: the verdict after the drag, with the arrow, the hardest gap and the words for the edit.
  - `after.png`: the Course after "Play from here" on the edited ground.
- **Check:** `scripts/graph-check.mjs` (pause holds, split and undo, drag, verdict, play from here).
- **Design:** `docs/graph-studio.md`.
