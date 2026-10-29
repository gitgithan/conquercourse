# Slicing screen, owner's eight questions (CC-201 to CC-207)

- The product owner tried the slicing screen and asked eight questions; this folder holds the runs behind the answers.
- Plain answers are in `docs/world-slice.md`, section "Slicing screen: the eight questions (CC-201 to CC-207)".

## What is here
- `strip-<slug>.json`: for six places, the old strip (shape only) next to the simulator's proof at every height (`scripts/slice-strip-eval.ts`, shrink 0.2, no dragged line).
- `dots-check.json` and `drag-*.png`: a real-mouse drag on each of the three dots after the fix (`scripts/slice-ux2-dots.mjs`).
- `dots-check-old.json`: the same drag with `?slice2=old` (the screen as it was); the file keeps the numbers read from that run.
- `browser-check.json` and `shots/`: the 1280 px browser run on four places (`scripts/slice-ux2-check.mjs`): 16 of 16 clicked green heights gave a path.

## Numbers (old strip against the proof)
| Place | Old green | Old green with no path | Path found at a height the old strip did not show green |
|---|---|---|---|
| Edinburgh old town | 6 | 1 (16 m) | 0 |
| Eixample, Barcelona | 0 | 0 | 8 |
| Gas Works Park, Seattle | 4 | 0 | 1 |
| Montmartre, Paris | 5 | 0 | 0 |
| Shibuya, Tokyo | 2 | 0 | 4 |
| Bryant Park, New York | 8 | 0 | 0 |

- The old strip was wrong in both directions: it showed one green that had no path, and it hid 13 heights that do have a path.
- The new strip paints a height green only after the same proof, so both counts are zero by construction.
