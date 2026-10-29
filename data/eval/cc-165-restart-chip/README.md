# CC-165: steady time line, no always-on R chip

## So what
- The time line has a fixed width (tabular numerals, `min-width: 31ch`), so nothing beside it moves while the time and metres change.
- The always-on "R Restart" chip is gone from the default run screen, because a fall already shows R.
- On screen during a run now: the time line (top left), the keys card (left, H hides it), the gauges (bottom left), the hint line, the drums lane, the obstacle strip, the top-right buttons and the Feedback and help buttons.
- The fall panel still says "(R)" on its main button, and phones keep the touch Restart button.
- `?hud=restart` brings the chip back (it never moves and the word Restart is never clipped).
- Recommendation: keep it.

## Evidence (`scripts/chip-jitter-check.mjs`, 8 pass, 0 fail)
- Pictures: `default-1280.png`, `default-390.png`, `chip-switch-1280.png`, `chip-switch-390.png`.
- Time line width over six samples: 414.3 px at 1280, 328 px at 390 (one value each).
- Chip x over six samples with the switch: one value each.

## Not tested
- Times past 99.9 s (the width is sized for them but no run was that long).
- A real GPU.
