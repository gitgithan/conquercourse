# Monkey-bar arm motion (CC-133)

## So what
- We have a motion we can show: three procedural clips (hand-over-hand travel, idle hang, kip).
- All three pass the plausibility gate with no soft failures, and pass the new bar checks.
- Quality: readable and physically sound (hands hold each rung, hips hang under the hands, knees bend forward); stiff and stick-figure like, not a captured human.
- No learned or captured source worked: Kimodo and CMU both failed the hand-over-hand test.
- Recommendation: ship the procedural fallback now; film a real hand-over-hand clip later if the look matters.

## Results
- Procedural clips: `public/assets/experiments/bars/bars_{travel,idle,kip}.json`, made by `scripts/bars-fallback-clips.ts` from `src/motion/bars-pose.ts`.
  - Travel: 3 to 4 forward steps per hand, hips travel 3.35 m, 0.6 to 0.75 m/s.
- CMU trial set 01 (`outputs/cmu-scan.json`): 22 hang stretches of 1.5 s or more.
  - 0 pass travel, 12 pass idle, 11 pass kip.
  - Kip candidates: 01_06 [197,361], 01_12 [605,751], 01_14 [302,446], 01_11 [614,740].
  - Idle candidate: 01_04 [218,386].
  - Not shipped: not rendered or checked by eye; the procedural clips cover all three moves.
- Kimodo round 1 (`outputs/r1-travel.json`, `outputs/r1-kip.json`): constrained samples, 8 each.
  - Travel: 3 of 8 pass the gate, 0 of 8 pass the bar check.
  - Kip: 1 of 8 pass the gate, 0 of 8 pass the bar check.
  - Cause: the hands stay near 1.1 m, not on the 2.2 m rungs (grip error about 1 m); Kimodo has no hangs in its training labels.
  - Text-only baselines pass the gate (travel 6 of 8, kip 8 of 8) but are not hangs (0 of 8 bar checks).
- Idle Kimodo job never started (queued on Modal), stopped; not retried since travel and kip show the same cause.
- Pexels monkey-bars clip: vertical bar climbing, not hand-over-hand; not run through SAM 3D Body.

## Cost
- Modal L4 about 0.80 USD per hour, 2 runs of about 2 minutes each, about 0.10 USD in all; no spending cap (owner, 2026-10-25).

## Ranked next steps
- 1. Wire `barsPose` into the actor behind a feature switch (a minimal hook; `src/render/actor.ts` was not touched).
- 2. Film a real hand-over-hand clip (adult, our own footage) and run it through video to motion and the gate.
- 3. Kimodo round 2: stronger guidance (cfg [2.0, 6.0]), a hang as the source pose; low odds given 0 hangs in its labels.
- 4. Check the CMU kip candidates by eye (render with `pipelines/bars_render.py`) for a more natural kip.

## Files
- Inputs: `inputs/` (Kimodo targets from `pipelines/bars_targets.py`; `*_r1.json` are the round-1 versions).
- Checks: `pipelines/ccpipe/barscheck.py`, tested by `pipelines/tests/test_barscheck.py` (negative controls: a standing body and a plain hang fail travel).
- Pose tests: `tests/bars-pose.test.ts`.
- Film: `pipelines/bars_render.py <clip> <out> --mp4` draws one frame per clip frame at the clip's fps (stepped clock); results in `evidence/`.
- Raw outputs: `../conquercourse-assets/eval-full/bar-motion/`.
