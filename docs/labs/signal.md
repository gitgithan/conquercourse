# Lab 8: Signal processing

*Behind `?labs=1`. Open `?mode=lab-signal&labs=1`.*
*Serves the university Labs (`docs/university-labs.md`, subject 8).*

## When you open it
- Live: it opens on the game's smoothing (triangle, strength 2) already run on the leap clip; the numbers, the gate table and the 3D character view are filled.
- The 3D view needs a GPU, and on a software fallback it shows a plain note instead.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## The question
- A captured move wobbles a little in every frame.
- How much smoothing calms the wobble before it costs the move?
- Lag, a flattened peak and a sliding foot are the prices; the plausibility gate is the judge of what may be shown.

## What is real
- The filters are written for this Lab in `src/lab/signal-lab.ts`.
- The gate is a TypeScript port of `pipelines/ccpipe/gate.py` and `motion.py`: same rules, same limits.
- `tests/lab-signal.test.ts` runs both on 33 cases and checks every gate number against the Python gate (`tests/fixtures/lab-signal-reference.json`, made by `scripts/lab_signal_reference.py`).
- The noise is seeded, and the Python script draws the same numbers.
- The clips are the shipped ones: `run` and `leap` (CMU motion capture) and `vault` (filmed, London Parkour).
- The Rookie plays the result only if it passes the gate; a failed result shows which rule it broke.

## What is a stand-in
- The shipped clips are already clean, so the wobble is added on purpose: seeded Gaussian noise, the same on every joint and axis, 0 to 4 cm.
- That makes the true move known, so "wobble left", "late" and "shape lost" are measured, not guessed.
- Real video measurement noise is not white and not equal on all joints; this is a teaching model of it.

## The controls
- Clip: run, leap or vault.
- Filter: window average, triangle window, curve fit (Savitzky-Golay), or live one-pole smoothing.
- Strength: 0 to 8 (frames looked at on each side, or the one-pole weight 1 / (1 + s)).
- Wobble added: 0 to 4 cm.
- Optional: give every bone one length (the game does this after smoothing).
- Joint to plot: hips height, right foot height or forward, right hand height.

## What each output means
- Wobble that went in / left: the size (RMS) of the error against the true move, before and after the filter.
- Runs late by: how far the filter alone shifts the clean clip in time (best-fit shift, 0.05 frame steps).
- Shape lost: how far the filter alone moves the clean clip (squashed peaks and the shift together).
- Total error: filtered noisy clip against the true clip.
- Cut-off: the wiggle speed that is cut to 71%.
- Peak acceleration and planted-foot slide: the gate's own soft numbers (limits 200 m/s2 and 3 cm).
- The gate table lists every hard and soft rule for the clean clip, the measured clip and your result.

## What we chose and why
- The game smooths filmed clips with the 1-2-3-2-1 triangle and then fixes each bone to its median length (`smooth_joints`, `fixed_skeleton` in `pipelines/video_to_motion/post.py`).
- It is light on purpose: video wobble is small, a jump's arc must stay a parabola for the gravity rule, and planted feet must not move.
- A live one-pole filter lags by `(1 - a) / a` frames, which would put the Rookie behind the simulator.
- The shipped CMU clips are not smoothed by this step at all.

## Findings the Lab shows
- The shipped leap already sits over the jitter limit (about 210 m/s2 against 200), and the vault slides a planted foot about 9.6 cm against a 3 cm limit; both are soft rules and are reported, not blocking.
- Smoothing lowers the peak acceleration for every filter, and heavy wobble (4 cm) with the game's own setting can fail a hard rule, so nothing is shown.

## Not tested
- Real video-measurement noise (only the stand-in noise).
- Other joints' filters (all joints get the same filter and strength).
- Phones and touch (not in scope).
- The Rookie view in a real GPU browser (the check uses a software renderer).


## How it was designed
- **The one question:** how much smoothing calms the wobble of a captured move before it costs the move?
- **The choices and why those:**
  - Four filters (window average, triangle, curve fit, live one-pole), because each pays a different price: the window ones keep time, the curve fit keeps a parabola, the live one lags.
  - Seeded noise added to clean clips, so the true move is known and "wobble left", "late" and "shape lost" are measured and not guessed.
  - The game's own gate as the judge, because no motion is shown before it passes.
- **Which real game code runs:** the shipped clips `run`, `leap` and `vault`, and the game's smoothing and bone-length rule as written in `pipelines/video_to_motion/post.py`.
  - The filters, the noise and the TypeScript gate (`src/lab/signal-lab.ts`) are Lab code; the gate is a port of the Python gate.
- **Which data is precomputed:** `tests/fixtures/lab-signal-reference.json` holds the Python gate's numbers for the test only; the page itself computes live.
- **Order of the screen and why compare comes last:** goal, controls, the plotted joint, the numbers, the gate table, and "what the game does" last, so the player has felt the price of each filter first.
- **Scope:** a teaching model of video noise (white, equal on all joints), not a model of real video.

## How we prove the lesson is right
- `tests/lab-signal.test.ts` (15 tests):
  - Window kernels sum to 1 and the game's smoothing is the 1-2-3-2-1 triangle.
  - Every filter keeps a constant, and strength 0 changes nothing.
  - Symmetric windows keep a straight line, and the curve fit keeps a parabola too.
  - The live filter lags a ramp by (1 - a) / a frames and the window filters do not lag.
  - A stronger filter lets through less noise and has a lower cut-off.
  - White noise shrinks by the square root of the summed squared weights.
  - Only the live filter lags in the Lab's own number.
  - The same choices give the same numbers twice.
  - The TypeScript gate matches the Python gate on every case of the reference (more than 25 cases; noise, filter, bone lengths, then every gate number).
  - The game's smoothing keeps every bone one length.
  - Heavy noise fails the gate and the Lab names the rule; the shipped clips pass the gate unfiltered.
- Browser check: `scripts/lab-signal-check.mjs`, evidence `docs/evidence/lab-signal-default.png`, `docs/evidence/lab-signal-held-back.png` and `docs/evidence/lab-signal-live-lag.png`.
- What would make the Lab's claim false:
  - A gate number that leaves the Python gate's number.
  - A filter whose measured lag or noise gain differs from its law.

## Limits
- **Stand-in noise:** real video noise is not white and not equal on all joints; no real noisy clip is used.
- **One filter for all joints:** a different filter for feet and hands is not tested.
- **Findings quoted on the page** (the leap near 210 m/s2 against 200, the vault foot sliding about 9.6 cm against 3 cm) are not pinned by a test.
- **The reference must be rebuilt** by `scripts/lab_signal_reference.py` when the Python gate changes; no test notices a stale file.
- **The Rookie view** is checked in a software renderer only.
- Desktop keyboard and mouse at 1280 px only.

## How to make the lesson better
1. Pin the two quoted findings (leap acceleration, vault foot slide) in the test file.
2. Add a clip with real video noise and show the stand-in and the real one side by side.
3. Let the player choose a filter per joint group (feet against hands).
4. Add a test that fails when the reference file is older than the Python gate.
5. Read the goal text with a young reader and fix the words.
