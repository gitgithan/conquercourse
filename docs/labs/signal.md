# Lab 8: Signal processing

*Behind `?labs=1`. Open `?mode=lab-signal&labs=1`.*
*Serves the university Labs (`docs/university-labs.md`, subject 8).*

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
