# CC-156: readable HUD

## What it means for the game
- The speed gauge, time line, key card and hints now read on any background: bright text on a dark panel.
- The player no longer loses the words over a dark tunnel or a bright sky.
- `?hud=old` brings the old black text back; `?gauges=old` still keeps the old gauge place.

## What changed
- `src/ui/hud-style.ts`: one panel look, one key-cap look, and the contrast maths.
- `src/ui/gauges.ts`: each gauge is its own dark panel.
- `src/modes/course.ts`: time line, centre message, hint and key card use the same panel.
- The key card keeps the keys you need to run (with an R restart row) and puts F, N, I, G, B and the mouse in one "Also" line.

## Contrast numbers (WCAG ratio, text `#f4f7f1` on the panel over each background)
- White sky: 10.9 to 1 (the worst case; the panel is least dark here).
- Sky blue: 12.5 to 1.
- Grass: 14.5 to 1.
- Dark tunnel: 17.6 to 1.
- The goal was 4.5 to 1; the softer text `#cfd8d2` is 8.1 to 1 at worst.
- Old black text `#10141c` on the same backgrounds: white sky 18 to 1, grass 4.7 to 1, dark tunnel 1.1 to 1.
- `tests/hud-contrast.test.ts` fails if the worst case drops under 4.5 to 1.

## Pictures
- `new-*` and `old-*` files, over a white sky, a dark tunnel and grass, at 1280 and 390 wide.
- The backgrounds are flat colours with the 3D picture hidden, so the worst cases are exact.
- Made on VM2 with `node scripts/hud-shots.mjs`.

## Not tested
- The panel over the real 3D picture on a real GPU.
- The phone-width shots show buttons crowding each other; that is old and not part of this issue.
