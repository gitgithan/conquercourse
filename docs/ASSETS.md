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

## Text
- `docs/sayings.md`: written for this project on 2026-10-27.
- Coaching texts used to make contact targets: Wikibooks "Parkour/Basic Moves/Tic Tac" and Wikipedia "Vault (urban movement)", both CC BY-SA 4.0 (credited wherever used).

## The product owner's own clips (to come)
- Filmed by the product owner, an adult, about themselves, with no bystanders; their written consent is recorded here when added.
