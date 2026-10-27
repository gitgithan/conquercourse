# CC-17: the wall run-up and grab clip (Kimodo on the simulator's path)

*Serves the Warped Wall demo beat: the Rookie runs up the 4.3 m curve, grabs the top edge and pulls up onto the deck; it is the one starter move still missing.*

## So what
- **Status:** the plan is written and fixed here before any GPU run; results are added below the line "Results", never above it.
- **Why the earlier 0 of 36 was "not tested":** the text-only tries had no simulator path and no contact targets; both exist now (`src/sim/wall.ts`, `wallPath`, the CC-29 recipe, `pipelines/kimodo_clips.py`).
- **A finding before any paid step (free, on the CPU):** the simulator's own grab tick cannot be done by any body.
  - At 7 m/s the simulator grabs at tick 64 (0.53 s after entering the curve), with the feet 1.22 m up the curve and the hips 1.0 m above them.
  - The hips are then 2.42 m from the top edge, and a Rookie's arm reaches 1.07 m from the hips at full stretch (shoulder joint 0.52 m from the hips, upper arm 0.29 m, forearm 0.27 m, measured on 36 Kimodo bodies).
  - So "hips on the simulator path" and "hands on the top edge at the simulator's grab tick" cannot both hold; the spec's `reach` of 2.1 m above the hips is a game number, not a body.
  - The body-feasible version keeps the simulator's own climb and its own mantle (72 ticks at 120 Hz) and grabs when the hands can first reach the edge: frame 65 (2.17 s), 0.95 m from the hips.
  - Game consequence to decide later (not changed here): the wall is easier in the simulator than for a body; a reach of about 1.3 m would need a faster entry.

## Hypothesis
- **If** Kimodo is given the simulator's hips path on every frame, the hips pinned every 2nd frame, a foot target on each of two wall plants, both wrists on the top edge, and both feet on the deck at the end,
- **then** at least one of 8 seeds gives a 3 s clip that meets every pass line below,
- **because** the practice project's wall moves worked this way and the 0 of 36 had none of these inputs.
- **Baseline in every round:** the same seed with text only (the pose source before it is moved), so the effect of the targets can be read against it.

## What it needs, and whether it exists
| Needs | Exists? |
|---|---|
| Simulator wall path (`runWall`, `wallPath`) | yes; exported by `scripts/wall-path-export.ts` to `inputs/sim_path.json` |
| Contact targets (plants, wrists, deck feet) | yes; `pipelines/ccpipe/wall_geom.py` makes `inputs/targets.json` |
| Plausibility gate with the held-clip rule | yes; `pipelines/ccpipe/gate.py`, clip marked `supportedBy: ["a warped wall"]` |
| Kimodo on Modal | yes; `pipelines/kimodo_wall.py` (same image as `kimodo_clips.py`) |
| Contact IK and wall push-out | built in this issue, with unit tests, before round 1 |
| CC-29 recipe numbers | hints only: the numbers disagree and the 2:29 video failed the gate; plant heights here come from the simulator's curve |

## The clip (30 fps, 90 frames = 3.0 s, 30-joint skeleton, y up, run along +z, left on +x)
- Frames 0-29: sprint on level ground at 7 m/s toward the foot of the curve (hips 1.0 m up).
- Frames 30-62: the simulator's climb (entry 7 m/s, 4.3 m curve, friction 0.1) up to its apex at 2.27 m.
- Frames 49-55: right foot planted on the curve (ankle 8 cm off the surface, about 2.1 m up).
- Frames 56-62: left foot planted (about 2.4 m up).
- Frames 65-74: both wrists on the top edge (3 cm in front of it and 2 cm under it, 20 cm apart); the grab is frame 65.
- Frames 65-80: the simulator's mantle, the hips go from 3.4 m to 5.3 m over the edge.
- Frames 80-89: both feet standing on the deck (4.3 m up), the Rookie upright.
- The hips are aimed 2 cm under the simulator's path so a straight leg can reach the planted foot; the pass line is measured against the simulator's own path.

## Pass lines (fixed before running; a sample is the best candidate only if it meets all)
1. **Gate:** every hard rule passes in `pipelines/ccpipe/gate.py`, with `supportedBy: ["a warped wall"]` (the held-clip rule applies).
2. **Hips on the path:** the hips are within 5 cm of the simulator's hips path (feet path plus 1.0 m) on every frame.
3. **Grab:** at frame 65 both wrists are within 5 cm of the grab point (the top edge moved 3 cm toward the player and 2 cm down, where a wrist sits when the fingers are over the lip).
4. **Hang:** the hands stay within 8 cm of the grab point for at least 0.3 s (9 frames) with no foot joint within 3 cm of the ground or the deck.
5. **Plant:** a foot is still (under 0.3 m/s for at least 4 frames) with its ankle 5-12 cm from the curve, at least 0.4 m up it, before the grab.
6. **Pull-up:** on the last 5 frames the hips are at least 0.8 m above the deck, within 0.5 m of the grab point's distance along the run, and both feet are within 10 cm of the deck height.
7. **Wall:** no joint, and no point 25 %, 50 % or 75 % along a bone, is more than 2 cm inside the wall.
8. **Shape:** 90 frames, 30 joints, `len(names)` equals the joints in each frame.
- **Not a pass line, reported:** the soft gate rules, the distance of each target before and after IK, the raw Kimodo error before any repair.

## One change per round (the order is fixed now; the choice of round 2 and later waits for what round 1 shows)
- **Round 1 (the recipe, nothing extra):** root path + hips pins + contact targets, Kimodo with its own post-processing, then on the CPU: push out of the wall, two-bone contact IK, the knee and floor repairs, the gate.
- **Round 2, if the contacts are far off but the hips are good:** change only one thing, the body shift toward the pins (the mean offset of the pinned joints, eased to zero over 8 frames either side, smoothed over 5).
- **Round 2, if the body is inside the wall after push-out and IK:** change only the collision, push out inside the last 15 % of the denoising steps instead of afterwards.
- **Round 3 and 4:** one change each, chosen from the nearest miss, written in the log before it runs; the change is named in the README table at the time, not afterwards.

## Stop rule (written before round 1)
- Stop at the first round with a sample that meets all 8 pass lines; ship that sample's clip.
- Stop after round 4, or when the budget below would be exceeded, whichever comes first.
- Stop early after round 2 if no sample got nearer than round 1's best on the count of pass lines met and on the worst target error.
- The pass lines are not moved after a result; "close" is reported as a fail, with the nearest miss named.

## Cost, stated before the first paid run
- **Modal L4:** about $0.80 an hour at list price.
- **One round:** 8 seeds, each a text-only generation plus a constrained one (5-20 s each) and one model load: about 6-8 GPU minutes, so about $0.11 per round and about $0.45 for four rounds.
- **Budget:** at most 4 GPU hours or $3.20 in total, at most 3 containers at once (this plan uses 1); stop and report if it would be exceeded.
- **Also spent:** one dry run of the constraint builder on a CPU container (seconds, a few cents at most) before round 1.
- **Credits:** whether workspace credits cover this was not checked and is not visible from here.
- **Recorded:** GPU minutes and the estimated cost go into `run.json` after every round.

## Where things are
- Plan and results: this file; inputs in `inputs/`; per-round outputs in `outputs/round<n>/` (small); every sample's raw JSON outside git in `../conquercourse-assets/cc-17-wall/` with `SHA256SUMS`.
- GIFs for every candidate, passing and failing: `outputs/round<n>/gifs/`, linked below.
- Failed samples worth keeping: `public/assets/experiments/cc-17-wall/`; nothing is shipped to `public/assets/motion/` unless all pass lines are met.

## Results
*(none yet)*
