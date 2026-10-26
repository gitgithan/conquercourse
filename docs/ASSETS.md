# Assets: every file we didn't write as code, with its source, date and licence

*Draft v0.1, 2026-10-27.*
*Rule: nothing goes into the game without a row here.*
*Big files live outside git in `../conquercourse-assets/` with a checksummed manifest (`SHA256SUMS`); small finished files the game loads live in `public/assets/`.*

## Characters (made during the event)
| File | What | Made | How | Cost | Licence and notes |
|---|---|---|---|---|---|
| `public/assets/characters/rookie-a.glb` | Rookie A: orange top, navy trousers, teal headband; rigged on the SOMA 30-joint skeleton | 2026-10-27 | Tripo P2 text-to-model (task `91a9907c`), quad, 5,000 faces, standard texture | 110 Tripo credits | Tripo output; commercial rights depend on the Tripo plan (to confirm) |
| `public/assets/characters/rookie-b.glb` | Rookie B: violet top, navy leggings, orange headband, hair in a bun; rigged the same way | 2026-10-27 | Muse Image reference drawn in Rookie A's style (`/images/edits`), then Tripo P2 image-to-model (task `e698db27`), `texture_alignment: original_image`, autofix off | 110 Tripo credits; one Muse Image call | As above; the Muse Image reference is kept with the sources |
- **Sources kept outside git:** the Tripo FBX files, Tripo's renders, the Muse Image reference and prompts, and each request (without keys), in `../conquercourse-assets/characters/`.
- **Rigging:** joints measured from each mesh (shoulder at the armpit, elbow and wrist on one straight line through the arm, no stretching); both models turned 180° to face forward; checked by posing on nine real motion clips.

## Footage (third-party, downloaded by hand)
| File | Move | Creator | Source | Licence |
|---|---|---|---|---|
| `Jump_over_an_obstacle_vault.mp4` | Jump over an obstacle | Anh Nguyen | [Pexels](https://www.pexels.com/video/dynamic-parkour-jump-over-blue-obstacle-32109501/) | Pexels License (free use and modification; credit given) |
| `Precision_jumps_between_concrete_blocks.mp4` | Precision jumps between blocks | Mary Taylor | [Pexels](https://www.pexels.com/video/a-man-jumping-around-concrete-structures-6002472/) | Pexels License |
| `Monkey_bars_hang_and_swing.mp4` | Hang and swing on bars | Mary Taylor | [Pexels](https://www.pexels.com/video/man-doing-parkour-on-a-playground-6002530/) | Pexels License |
| `Over_a_brick_wall_vault_or_wall_move.mp4` | Climb up and drop down a wall | Mary Taylor | [Pexels](https://www.pexels.com/video/a-man-jumping-off-the-wall-6002059/) | Pexels License |
- Kept outside git in `../conquercourse-assets/footage/`.
- Faces and bystanders are masked before any model processes a frame; only the measured motion is kept in the repo.
- Rejected and not used: two clips whose athlete might be under 18, and one dive from height (against "safe by design").
- More openly licensed candidates (about 45, with licences) are listed in `docs/research/motion-data.md`.

## Motion data (third-party)
- **CMU Graphics Lab Motion Capture Database:** free to use, credit requested ("The data used in this project was obtained from mocap.cs.cmu.edu"); re-imported here with new code.
- **Candidates checked as publishable:** 100STYLE (CC BY 4.0), HDM05 (CC BY-SA 3.0, derived files must stay CC BY-SA), Kimodo's own generated output (NVIDIA claims no rights in outputs).
- **Not usable in a public repo:** AMASS, HumanML3D, Motion-X, GRAB, BEHAVE, PROX, Nymeria, LAFAN1, AIST++, Ego-Exo4D (non-commercial or no sharing); BONES-SEED (bans public repos).

### Starter clips (made 2026-10-27 by `pipelines/build_starter.py`; each passes the plausibility gate)
| File | Move | Source | Licence and credit |
|---|---|---|---|
| `public/assets/motion/run.json` | Run (1.2 s) | CMU trial 09_01, "run" | CMU: free to use; "The data used in this project was obtained from mocap.cs.cmu.edu." |
| `public/assets/motion/leap.json` | Run-up, leap, landing (2.1 s) | CMU trial 49_04, "run, leap" | CMU, same credit |
| `public/assets/motion/land.json` | Landing from a leap (0.8 s) | CMU trial 49_05, "run, leap", frames 17 on | CMU, same credit |
| `public/assets/motion/hang.json` | Hang by the hands, feet off the ground (1.8 s; `supportedBy` "playground bars") | CMU trial 01_10, "playground - climb, swing, lean back, drop", frames 385-440 | CMU, same credit |
| `public/assets/motion/swing.json` | Hang and swing the legs (3.3 s; `supportedBy` "playground bars") | CMU trial 01_10, frames 360-460 | CMU, same credit |
| `public/assets/motion/reach.json` | Hop up to reach overhead (1.8 s; `supportedBy` "something overhead"); an extra, not the wall grab | CMU trial 14_09, "jump up to grab, reach for, tiptoe", frames 625-680 | CMU, same credit |
| `public/assets/motion/kimodo_leap.json` | A leap made by Kimodo from text (4 s); a candidate for the blind test, not yet judged by eye | Kimodo-SOMA-RP (`kimodo-soma-rp`, commit `e1c219c`), prompt `leap_a`, seed 10 | NVIDIA Open Model License; NVIDIA claims no ownership of outputs |
- **How they were made:** CMU ASF/AMC re-imported with new code (`pipelines/ccpipe/cmu.py`: forward kinematics, 120 to 30 fps by taking every 4th frame, 30 joints), repaired, gated; raw files kept outside git in `../conquercourse-assets/cmu/`.
- **Experiments:** `public/assets/experiments/starter-clips/*.json` are the first sample of each Kimodo prompt that was tried and did not ship (they are not game assets; same licence as the Kimodo row); every sample is kept outside git in `../conquercourse-assets/starter-clips/`.

## Text
- `docs/sayings.md`: written for this project on 2026-10-27.
- Coaching texts used to make contact targets: Wikibooks "Parkour/Basic Moves/Tic Tac" and Wikipedia "Vault (urban movement)", both CC BY-SA 4.0 (credited wherever used).

## The product owner's own clips (to come)
- Filmed by the product owner, an adult, about themselves, with no bystanders; their written consent is recorded here when added.
