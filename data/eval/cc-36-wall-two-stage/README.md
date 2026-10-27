# CC-36: the wall climb in two short Kimodo clips, joined

*Serves the Warped Wall demo beat: the Rookie runs up the 4.3 m curve, hangs from the top edge and pulls up onto the deck; CC-17 could not make it in one clip.*

## So what
- **Status:** plan written before any run; results are filled in below after each round.
- **Why two clips:** CC-17 showed Kimodo cannot lift the hips 4.3 m in one clip (all 8 seeds ended 2.4 m too low), and it works up to about 2.5 m of rise.
- **The two rises:** stage A lifts the hips 2.23 m (1.0 m to 3.23 m), stage B lifts them 2.0 m (about 3.3 m to 5.3 m), so both are under 2.5 m.
  - The task note said stage B rises about 1.5 m; the simulator's own numbers give 2.0 m (hang with the hips 1.0 m under the ledge, finish 1.0 m over the deck).
- **Recommendation and next step:** written after round 1 (see Results).

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
- Filled in after each round.
