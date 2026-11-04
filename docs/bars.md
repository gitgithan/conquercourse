# Monkey bars: a row of rungs, hand over hand

- Serves the Course player who has learned the Lache and now wants a long hang; written for CC-133.
- Code: `src/sim/bars.ts`; tests: `tests/bars.test.ts`, `tests/bars-course.test.ts`.

## What the player does
- Hold E in the air near a rung: the hands close (same as a bar).
- Press Q (left hand) and T (right hand) to reach for the next rung.
- Left and right arrows are the kip, as in the Lache: they restart or build the swing.
- Let go of E to fly on with the swing.
- Nothing in the row makes you fall; only letting go of E does (or the hands opening at a swing the grip cannot hold, as on a bar).

## States
- `run`: not on the bars.
- `bars`: hanging from the hands, a pendulum about the point between the two hands.
- A stall is not a state: it is a reach that does nothing, and the player keeps hanging.

## Key map (new keys, and why)
- Q: left hand reaches (a fresh press only; holding it does nothing more).
- T: right hand reaches (a fresh press only).
- Both pressed on the same tick: neither hand reaches (a stall).
- Q and T were free; E, W, A, S, D, X, V, K, R, C, F, G, H, I, M, N, P are taken.
- In the replay mask they are two new bits, `reachL` and `reachR`, added after the old ones, so old recordings and hashes do not change.

## The rules (all in metres, seconds, 120 Hz)
- Both hands start on the same rung when the grab happens.
- The hands alternate: the hand that reached last cannot reach again until the other has (wrong order is a stall).
- The hands leapfrog: a reaching hand goes to the rung after the front hand, so the back hand overtakes it and each reach moves the body half a gap on.
- Last rung: a hand never goes past the end; once one hand is on the last rung the other may reach in any order, and when both are there nothing is left to reach (let go of E to fly off).
- No timer or phase slows the keys: Q and T can alternate as fast as the player can press; only the swing decides whether a reach lands, so a big swing first lets the player go faster.
- A hand reaches only while the body is swung forward of the pivot (angle above 0), whichever way it is moving.
- The shoulder is one arm length (0.8 m) down the body from the point between the hands.
- The straight arm reaches a circle of that radius about the shoulder, and the rung is at the height of the hands.
- That gives the reach: the rung must be between 0 and 2 x 0.8 x sin(angle) ahead of the point between the hands.
- So the gap a pair can cross is decided by how far the body swings, not by a timer.
- The most a rung may be ahead is 1.0 m in the editor (a 0.3 m rung needs about 12 degrees and a 1.0 m rung needs about 46 degrees at the first reach; the hands are one rung apart, so the pivot between them moves half a gap per reach).
- Rung spacing: 0.3 m to 1.0 m; default 0.6 m.
- Each reach costs swing: the swing speed keeps 0.93 of itself (the hand catch absorbs some).
- Swing damping: the same drag as a bar (0.04 per second).
- The kip is the only source of energy: the same pump as the Lache (6 rad/s squared, limited by the grip).
- The body is carried onto the new pivot over 8 ticks (a fifteenth of a second), as at a bar grab, so nothing jumps.

## What a stall looks like
- No swing, wrong order, or a gap too wide for the swing: the reach does nothing and nothing else changes.
- The player keeps hanging, kips with the arrows, and tries again.
- A test hangs for 20 seconds with every kind of stall and checks the runner is still on the bars.

## From a bar to the bars
- Hold E on a single bar, swing with the arrows, let go of E near the first rung, hold E again: the hands close on the rung.
- The regrab uses the same wide zone as the Lache pair (1.2 m along, 0.6 m up and down).
- A row of rungs over a lifted object works the same: the editor places the row over the object's top.

## Course data and the editor
- Course field `bars`: a list of rows `{ x, y, n, gap }` (first rung x, height, how many rungs, spacing).
- Editor piece "Monkey bars" (behind `?bars=1`; code `src/slice/bars-world.ts`, `src/modes/editor/tools/bars.ts`): rung count, spacing and height are sliders in the piece panel.
- Its src is `bars:<rungs>:<gap>`, so saving, copying and undo keep the knobs; `roleCourse` turns it into `course.bars` and `piecesFromSource` brings it back.
- "Fit to selected" (toolbar) lays a new row along the top of the chosen piece (a box, or an object lifted from a photo): its longer side, its top height, rungs and spacing to cover the length.
- In the piece panel, "Fit to the piece under it" does the same for a row already placed.
- "Bar then bars" puts a swing bar and a row after it (first rung 2.4 m on, same height): the pull-up bar to monkey bars flow.
- The panel says how to play it: hold E near the first rung, then Q and T.
- Turning: the piece bar's 15 degree buttons turn any piece, the swing bar and the row included; a row turned across the lane is ignored, like a plank.
- The piece is overhead scenery (`noGround`), so it never changes the ground lane.

## Tests (physics laws first)
- Energy never grows through a reach: the swing's energy after a reach is at most what it was before.
- Energy grows only with the kip, and not at all with the kip off.
- The reach follows the arm rule exactly: just inside works, just outside stalls.
- A stall never leaves the bars (every kind of stall, 20 seconds).
- Determinism: the same keys give the same state, bit for bit.
- Replay equals live: the recorded keys, packed into the mask and run again, end in the same place.
- Bar to bars: release near the first rung, hold E, and the hands close.
- A whole course clears with a recorded key list (`public/assets/demo/bars.run.json`).
- Swing bar to bars clears with a recorded key list (`public/assets/demo/swing-to-bars.run.json`, `tests/swing-to-bars.test.ts`).
- The editor piece: knobs in the src, not ground, found along the lane, course and save round trips, fit to an object, 15 degree turns (`tests/editor-bars.test.ts`).

## The ideal run on monkey bars (CC-133)
- `src/sim/ideal.ts` finds the run by trying the simulator, as for the other obstacles; "Race the ideal run" plays that plan as the ghost.
- Plan fields: `barsStart` (ticks hanging from the first rung before the first reach), `barsWait` (per reach: ticks to wait after the swing allows it), `barsKip` (the swing angle the kip builds to), `barsRelease` (ticks after the last reach to let go).
- Search order: a coarse joint grid (press, hang on the bar before, kip, release); then the kip and release with the most clearing neighbours; then each timing on its own, twice.
- The windows are measured in ticks of 1/120 s, reported in ms; the plan sits inside each one, not on its edge.
- After the last bar, the plan keeps its hands off until the first rung is within the catch zone, so it does not grab the bar it just let go of.
- Windows found: see `docs/lessons.md` (monkey bars entry) for the numbers.
- `public/assets/demo/swing-to-bars.run.json` is now the plan's own keys, played once (re-recorded 2026-11-03); `bars.run.json` is unchanged.

## Browser check on a VM (2026-11-03, stepped clock, 960 x 540)
- Evidence is in `docs/evidence/bars-browser/`; the films are retimed to the game clock because every picture is one clock step.
- Editor (`?bars=1`): "Bar then bars" places a bar and a row, the panel shows rungs, spacing and height, the side view shows both, "Play this lane" checks the lane (about 5 minutes on a software renderer) and opens the Course with the Q and T line on the controls card.
  - Pictures: `editor-1-bar-then-bars.png`, `editor-2-lane-check.png`, `editor-3-course-from-editor.png` (the 3D canvas is blank on the software renderer, only the page is real).
- The Rookie on both courses, from the ideal-run plan with the bot:
  - `rookie-bars-course.mp4` with `rookie-bars-sheet.jpg`, and `rookie-swing-to-bars-course.mp4` with `rookie-swing-to-bars-sheet.jpg`.
  - Hands are on the rungs, the arms follow the rung, and the bar to bars hand-off looks right.
- The ghost (the "Ghost: Ideal run" chip, on by default; there is no button named "Race the ideal run"):
  - `ghost-race-bars.mp4` and `ghost-race-swing-to-bars.mp4` (sheets beside them).
  - The ghost appears and stays level with the bot (about 0.5 s ahead, as the chip says).
- Found: the Course never drew the rungs (only the editor did); another change landed the same fix in `src/modes/course/scene.ts` (rungs and end posts) while this check ran, so this change keeps that one.

## The ghost is posed like the player (CC-133, 2026-11-03)
- The ghost track now keeps the actor state the Course gives the player at every tick (`states` in `src/sim/replay.ts`, built with `courseActorState` in `src/motion/actor-state.ts`).
- `src/ui/ghost-look.ts` poses the figure from it, so the ghost hangs with its hands on the rungs, swings, vaults and climbs like the player.
- A track with no states (an old one) still falls back to the running guess.
- Tests: `tests/ghost-states.test.ts`.
- Browser check on a VM, stepped clock, 1280 x 720 (`scripts/ghost-pose-check.mjs`), pictures in `docs/evidence/cc-133-ghost-pose/`:
  - `ghost-bars-sheet.jpg` and `ghost-swing-to-bars-sheet.jpg`: the bot on the bars; the ghost sits exactly under the player, so no upright figure floats beside the swing any more (see `ghost-bars-hang-crop.png`).
  - `ghost-rope-sheet.jpg` (wide lache) and `ghost-vault-sheet.jpg` (training): nothing regressed.
  - Gap: the ghost runs about a second ahead later on, so a frame with both figures on the rungs at once was not captured; the plain lache course timed out on the software renderer, so the wide lache was used.

## Looks wrong, not fixed
- The kip builds a swing of about 80 degrees, so the body is nearly flat along the rungs at the top of the swing.
- After the release at a high swing the body turns head over heels once (upside down in the air); the ghost plays the same state, so it turns the same way (not fixed here).

## What is not done
- The arms pose for reaching hands is the procedural `src/motion/bars-pose.ts`; a filmed capture does not exist yet.
