# CC-177: World editor UX and camera

## So what
- The "wheel and pan do nothing" bug was mostly the Design partner card: it started open and covered the right half of the 3D picture, so the wheel and drags there never reached the camera.
- Even on free ground the wheel always zoomed toward a fixed point (9, 0.5, 0), not toward the pieces or the cursor, and middle-drag zoomed instead of sliding.
- Fixed: the card starts closed, the wheel zooms toward the cursor, middle-drag slides, Fit (key F) frames the pieces.
- The buttons now have three levels, the four repair actions live in one Fix menu, and a hideable glossary explains them.

## Measured before (origin/main, 1280x720, scripted wheel and drags)
- Cursor over the open Design partner card (right half): 8 wheel notches, a right-drag of 300 px and a middle-drag changed nothing (distance 19.93 m, look-at (9, 0.5, 0) throughout).
- Cursor on free ground: 8 notches only went from 19.9 m to 13.2 m and the look-at point stayed (9, 0.5, 0); middle-drag zoomed (19.9 to 21.5 m) instead of sliding.

## Measured after
- Free ground: 8 notches go from 19.9 m to 10.3 m and the look-at point moves under the cursor (9 to 4.97 m); zooming out returns to the start.
- Right-drag of 300 px slides the look-at point 18 m; middle-drag slides it.
- F and the Fit button return to the pieces from any zoom or pan (look-at x 9.99 m, distance 24.8 m).
- `node scripts/editor-ux-check.mjs`: 14 checks pass.

## Pictures
- `old-layout.png`: ?editorui=old (before).
- `new-first-visit.png`, `new-layout.png`, `new-fix-menu.png`, `new-fix-it-pressed.png`, `new-after-fit.png`.

## Not verified
- Trackpad and touch gestures; desktop only at 1280 px.
- The Fix menu proxies were pressed for Fix it only; the other three press the same hidden originals.
