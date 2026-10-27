# CC-36: the wall climb in two short Kimodo clips, joined

*Serves the Warped Wall demo beat: the Rookie runs up the 4.3 m curve, hangs from the top edge and pulls up onto the deck; CC-17 could not make it in one clip.*

## So what
- **Result:** two stages did not work yet; no clip ships and nothing was added to `public/`.
  - Round 1: 3 of 6 pass lines at best for each stage; round 2: 4 of 6 for each; the stop rule ended the series.
  - Joining was not built, because it needs both stages to pass.
- **What it means for the wall beat:** keep the current climb for the demo; Kimodo is closer than in CC-17 but still does not reach the top.
- **The finding:** the ceiling is the hips' height in the model's frame, not the size of the rise.
  - Round 1: each stage rises under 2.5 m, yet the hips stopped near 2.5 m (A) and 2.9 m (B, local frame) and fell back; A ended 1.0-1.15 m short, B 0.3-0.6 m short.
  - Round 2 (the one change: lower the frame by 0.7 m for A and 0.6 m for B): the shortfall dropped to 0.43-0.63 m for A and 0.19-0.44 m for B; the hips now peaked near 3.0 m of world height in both, so the ceiling is not a fixed 2.5 m either.
- **Nearest miss:** stage B, round 2, seed 7 (4 of 6): the hang and the wall line pass, the hips end 0.768 m over the deck (line needs 0.8 m), and the gate fails on knees and twisted legs.
- **Recommendation:** do not wire a Kimodo clip in; the next cheap try is a third frame drop (stage B by 1.0 m, stage A in a frame with the ground below zero) plus the knee fixes, with the owner's approval of one more round (about $0.05).
  - The cost so far is below budget; a physics tracker (CC-17 option C) remains the strong option if the lowered frame stalls.
- **Spend:** 7.5 GPU minutes on L4s, about $0.10 at list price (budget $0.50); queue time (about 20 minutes for stage B in round 1) is not billed.

## Hypothesis
- **If** the climb is cut at the foot-of-the-ledge moment into a run-up (A) and a hang-and-pull-up (B), each with the recipe of CC-17 (root path, hips pins, contact targets, Kimodo's own post-processing, then wall push-out and contact IK),
- **then** at least one of 8 seeds per stage meets every pass line of its stage,
- **because** CC-17 tracked the hips to within 5 cm along the run and failed only in height, and each stage now stays under 2.5 m of rise.
- **Baseline in every round:** the same seed with text only (the pose source before it is moved), shown beside the sample.

## The two clips (30 fps, 30-joint skeleton, y up, run along +z, left on +x)
- **Stage A, run-up (60 frames, 2.0 s), in world coordinates:**
  - Frames 0-29: sprint on level ground at 7 m/s toward the foot of the curve (hips 1.0 m up).
  - Frames 30-59: the simulator's `runWall` path (entry 7 m/s, 4.3 m curve, friction 0.1) from the foot to its feet at 2.23 m up the curve (`apexPath`, ticks 0-116).
  - Frames 40-44: right foot planted on the curve (ankle 8 cm off the surface, about 1.0 m up).
  - Frames 51-55: left foot planted on the curve (about 2.1 m up).
  - Frames 55-59: both wrists aimed 1.0 m from the hips toward the ledge (the arms start to rise; the ledge is 1.17 m from the hips there, out of reach by 0.10 m).
  - The hips are aimed 2 cm under the simulator's path (as in CC-17); the pass line is measured against the simulator's own path.
- **Stage B, hang and pull-up (48 frames, 1.6 s), in a frame local to the ledge:**
  - Local frame: the ledge's top edge is at z = 0 and y = 2.1 m (the world edge is at z = 4.3 m, y = 4.3 m, so world = local + (0, 2.2, 4.3)).
  - Frames 0-13: hanging by both hands, the hips 1.0 m under the ledge and 0.25 m before the edge, feet off the ground.
  - Frames 14-31: the simulator's mantle, 18 frames = 72 ticks at 120 Hz (`wallPath`, `MANTLE_TICKS`); the hips rise first and move over the edge later (a body is not a capsule), ending 1.0 m over the deck and 0.4 m past the edge (`MANTLE_RUN`).
  - Frames 32-47: standing on the deck.
  - Wrist targets on frames 0-20 (3 cm in front of the edge and 2 cm under it, 20 cm apart); ankle targets on the deck on frames 38-47.
  - The hips are 1.0 m from each wrist at the hang (the arm reaches 1.07 m), so the arms are a little bent.
  - Why 2.2 m: the model's floor is local y = 0, so the hang is generated with the feet a little above it; the game places the clip at the ledge.
- **The join (only if both stages pass):** the last frame of A to the first frame of B in 10 blend frames (bone lengths kept), B placed on the simulator's ledge point.
  - B starts 0.26 m past the simulator's grab point (a body must be within an arm's reach of the edge; the simulator's grab is 0.5 m short of that); the blend closes it.

## What it needs, and whether it exists
| Needs | Exists? |
|---|---|
| Simulator wall path (`runWall`, `wallPath`) | yes; `inputs/sim_path.json` from `scripts/wall-path-export.ts` (CC-17) |
| Kimodo on Modal | yes; `pipelines/kimodo_wall.py` (one small change: a prompt per stage from the targets file) |
| Contact IK, wall push-out | yes; `pipelines/ccpipe/wall_contacts.py` |
| Targets and scoring for the two stages | built in this issue, with unit tests, before round 1 (`ccpipe/wall_stages.py`) |
| Gate with the held-clip rule | yes; `pipelines/ccpipe/gate.py`, clip marked `supportedBy: ["a warped wall"]` |

## Pass lines (fixed before running; a sample is the best candidate only if it meets all of its stage)
- **Stage A, run-up (6 lines):**
  1. **Gate:** every hard rule passes (held-clip rule, `supportedBy`).
  2. **Hips on the path:** within 5 cm of the simulator's hips path (feet path plus 1.0 m) on every frame.
  3. **Plant:** a foot is still (under 0.3 m/s for at least 4 frames) with its ankle 5-12 cm from the curve and at least 0.4 m up it.
  4. **Arms rising:** on the last frame both wrists are above their shoulder joints.
  5. **Wall:** no joint, and no point 25 %, 50 % or 75 % along a bone, is more than 2 cm inside the wall.
  6. **Shape:** 60 frames, 30 joints, `len(names)` equals the joints in each frame.
- **Stage B, hang and pull-up (6 lines):**
  1. **Gate:** every hard rule passes, measured in world coordinates (held-clip rule).
  2. **Hang:** both wrists within 5 cm of their ledge targets for at least 9 frames (0.3 s) with no foot joint within 3 cm of the ground or the deck.
  3. **Pull-up:** after the hang, on the last 5 frames the hips are at least 0.8 m above the deck, and both ankles are within 10 cm of deck height and past the edge (z at least 4.3 m).
  4. **Wall and deck:** no joint, and no point 25 %, 50 % or 75 % along a bone, is more than 2 cm inside the wall or the deck.
  5. **Shape:** 48 frames, 30 joints, `len(names)` equals the joints in each frame.
  6. **Rise:** the hips rise less than 2.5 m over the clip (true by construction; checked on the sample).
- **Joined clip (if both pass):** the gate with the held-clip rule passes and no joint or bone point is more than 2 cm inside the wall after push-out.
- **Not pass lines, reported:** the soft gate rules, the distance of each target before and after IK, the raw Kimodo error before any repair.
- **The pass lines are not moved after a result;** "close" is a fail, with the nearest miss named.

## One change per round
- **Round 1 (the recipe, nothing extra):** root path + hips pins every 2nd frame + contact targets, Kimodo with its own post-processing, then on the CPU: repairs, push out of the wall, contact IK (twice), the gate.
- **Round 2 (one change, chosen from the nearest miss of round 1 and written in `run.json` before it runs):**
  - If a stage's hips leave the path: pin the hips on every frame instead of every 2nd (stronger guidance already failed in CC-17).
  - If the hips are good but a contact is far off: the body shift toward the pins (the mean offset of the pinned joints, eased to zero over 8 frames either side, smoothed over 5).
  - If stage B does not pull up in 0.6 s: a 30-frame mantle (1.0 s) with the same hang and stand; the join then time-warps it back.
  - If a stage fails only on the wall: push out inside the last 15 % of the denoising steps (the CC-17 plan).
  - Only the stage that failed is run again.

## Stop rule (written before round 1)
- Stop at the first round where both stages have a sample that meets all of their lines.
- Stop after round 2, or when the budget below would be exceeded, whichever comes first.
- If a stage fails after round 2, ship nothing into `public/` and document the nearest miss.

## Cost, stated before the first paid run
- **Modal L4:** about $0.80 an hour at list price.
- **One round:** 8 seeds per stage, each a text-only generation plus a constrained one and one model load per stage: about 6-8 GPU minutes in all, so about $0.11 per round.
- **Budget:** at most $0.50 in total, at most 2 rounds, at most 3 containers at once (this plan uses 2: one per stage); stop and report if it would be exceeded.
- **Credits:** whether workspace credits cover this is not visible from here.
- **Recorded:** GPU minutes and the estimated cost go into `run.json` after every round.

## Results
| Round | Change | Stage | Best seed | Pass lines (best, worst of 8) | Hips shortfall, max over frames | Wall depth after push-out |
|---|---|---|---|---|---|---|
| 1 | none: the recipe | A | 7 | 3 of 6, 2 of 6 | 0.95-1.15 m | 0.058-0.19 m |
| 1 | none: the recipe | B | 12 | 3 of 6, 3 of 6 | 0.30-0.61 m | 0.064-0.18 m |
| 2 | frame lowered 0.7 m (A) and 0.6 m (B) | A | 9 | 4 of 6, 2 of 6 | 0.43-0.63 m | 0.010-0.047 m |
| 2 | frame lowered 0.7 m (A) and 0.6 m (B) | B | 7 | 4 of 6, 3 of 6 | 0.19-0.44 m | 0.020-0.103 m |

- **Lines met in every sample:** A: 4 (arms rising) and 6 (shape); B: 2 (hang, after IK), 5 (shape) and 6 (rise).
- **Line 1 (gate) fails in all 32 samples:** knees (`knees_bend_forward`, `legs_not_twisted`, `knees_within_range`), plus `held_clips_are_held` in all 8 round-2 stage A samples (and 1 of 8 in round 1).
- **Stage A line 2 (hips on the path) fails in all 16 samples:** the shortfall is at the top of the climb; the best is 0.43 m.
- **Stage A line 3 (plant):** met in 7 of 8 samples in round 1 and 6 of 8 in round 2 (the IK puts a foot on the curve).
- **Stage A line 5 (wall):** met by none in round 1 and by one in round 2 (seed 9, 0.0098 m), which still fails the gate and line 2.
- **Stage B line 3 (pull-up):** met by none in round 1; in round 2 by 4 of 8 (seeds 8, 9, 10, 13), and each of those is 3-10 cm inside the deck or curve (line 4) and fails the gate.
- **Stage B line 4 (wall and deck):** met by one sample in round 2 (seed 7, 0.0196 m), which is the nearest miss: its hips end 0.768 m over the deck, 3 cm short of line 3, and it fails the gate.
- **Stage B line 2 (hang):** met in every repaired sample; the raw samples fail it (the wrists are off the ledge before IK).
- **Not run:** the join (`public/assets/motion/wall_climb.json`), because it needs both stages to pass.

## Pictures (every candidate, passing and failing alike)
- Left panel: the text-only motion of the same seed, not moved onto the path; right panel: the sample after repairs, push-out and IK, red rings are targets, the green square is the intended hips.
- Round 1, stage A: [seed 7](outputs/round1/a/gifs/seed7.gif) (best), [8](outputs/round1/a/gifs/seed8.gif), [9](outputs/round1/a/gifs/seed9.gif), [10](outputs/round1/a/gifs/seed10.gif), [11](outputs/round1/a/gifs/seed11.gif), [12](outputs/round1/a/gifs/seed12.gif), [13](outputs/round1/a/gifs/seed13.gif), [14](outputs/round1/a/gifs/seed14.gif).
- Round 1, stage B: [seed 12](outputs/round1/b/gifs/seed12.gif) (best), [7](outputs/round1/b/gifs/seed7.gif), [8](outputs/round1/b/gifs/seed8.gif), [9](outputs/round1/b/gifs/seed9.gif), [10](outputs/round1/b/gifs/seed10.gif), [11](outputs/round1/b/gifs/seed11.gif), [13](outputs/round1/b/gifs/seed13.gif), [14](outputs/round1/b/gifs/seed14.gif).
- Round 2, stage A: [seed 9](outputs/round2/a/gifs/seed9.gif) (best), [7](outputs/round2/a/gifs/seed7.gif), [8](outputs/round2/a/gifs/seed8.gif), [10](outputs/round2/a/gifs/seed10.gif), [11](outputs/round2/a/gifs/seed11.gif), [12](outputs/round2/a/gifs/seed12.gif), [13](outputs/round2/a/gifs/seed13.gif), [14](outputs/round2/a/gifs/seed14.gif).
- Round 2, stage B: [seed 7](outputs/round2/b/gifs/seed7.gif) (best, nearest miss), [8](outputs/round2/b/gifs/seed8.gif), [9](outputs/round2/b/gifs/seed9.gif), [10](outputs/round2/b/gifs/seed10.gif), [11](outputs/round2/b/gifs/seed11.gif), [12](outputs/round2/b/gifs/seed12.gif), [13](outputs/round2/b/gifs/seed13.gif), [14](outputs/round2/b/gifs/seed14.gif).
- Per-sample numbers: `outputs/round<n>/<stage>/summary.json`.

## Where things are
- Samples and final clips outside git: `../conquercourse-assets/cc-36-wall-two-stage/round1/` and `round2/` (with `SHA256SUMS`).
- Run record with GPU minutes and cost: `run.json`.
- Code: `pipelines/ccpipe/wall_stages.py` (targets, scoring, the join, the lowered frame), `pipelines/wall_two_stage_targets.py`, `pipelines/wall_two_stage_post.py`, tests in `pipelines/tests/test_wall_stages.py`.
