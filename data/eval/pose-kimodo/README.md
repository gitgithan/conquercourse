# Pose-conditioned Kimodo (CC-54)

- **So what:** holding Kimodo to a hand-set key pose works for a plain hang (all four seeds pass the gate) and does not yet work for a swing or a vault (none pass).
- **Decision:** the Rookie keeps motion capture (owner, 2026-10-27); nothing here is shown in the game.

## What was run
- **Key poses:** hang, swing front and back, vault (two versions), as the 30 SOMA joints, from hand-set bone directions with the bone lengths of the CMU hang clip (`pipelines/posekimodo/poses.py`).
- **Pictures:** each pose drawn as a plain mannequin, front and side (`inputs/pictures/`).
- **MediaPipe Pose (Apache-2.0):** found the body in the front picture for 4 of 4 poses and in the side picture for 1 of 4; on the vault it was 0.06 m from the authored joints on average (`inputs/pictures/mediapipe.json`).
- **Kimodo:** `FullBodyConstraintSet` (positions of the 30 joints on chosen frames; Kimodo ignores the rotations) against the same text without key poses, four seeds per move (`outputs/`, `outputs-r2/`).
- **Gate:** the plausibility gate (`pipelines/ccpipe/gate.py`), unchanged, with the clip marked as held by a bar or a box.

## Results (gate passes, out of 4 seeds)
| Move | Text only | Held to key poses | Mean joint error at the key frames |
|---|---|---|---|
| Hang (key poses held from 2.7 s) | 4 | **4** | 0.57 m to 0.23 m |
| Swing, round 1 (four poses, 0.5 rad) | 4 | 0 | 1.41 m to 0.37 m |
| Swing, round 2 (two poses, 0.3 rad) | 4 | 0 | 1.39 m to 0.30 m |
| Vault, round 1 (legs out to the side) | 2 | 0 | 0.96 m to 0.45 m |
| Vault, round 2 (knees tucked in front) | 2 | 0 | 0.91 m to 0.42 m |

## Why the failures
- **Swing:** the knees bend backwards or fold (114 to 178 degrees against a 120 limit) and the hands drift off the bar for 0.8 to 1.8 s (limit 0.6 s); the key poses are not followed (`figures/keyed-swing.png`).
- **Vault, round 1:** the side-swung key pose itself fails the gate (legs turned 70 degrees from the side axis); this is the pose's fault.
- **Vault, round 2:** the tucked key pose passes the gate alone; the result fails only "held clips are held" (0.63 to 1.47 s with nothing touching, limit 0.6 s) and, in two seeds, feet under the floor.
- **Hang:** the result is the figure hanging by raised hands with feet off the floor (`figures/keyed-hang.png`).

## Not tested
- **MediaPipe's own poses as Kimodo's input:** the side picture was found for only one pose, so the key poses Kimodo got are the authored ones, not MediaPipe's.
- **Photos of real people:** none were used (no identifiable people, no minors).
- **Fix of the held rule or the swing:** the gate was not changed; a swing may need physics tracking instead (see `docs/lessons.md`).

## Cost
- About 8 minutes of one Modal L4 for the three Kimodo runs, plus two small CPU runs; about $0.2 by the L4 price, exact figure on the Modal dashboard (cap was $15).

## Files
- **In git:** `inputs/`, `outputs/results.json`, `outputs/kimodo_run.json`, the same under `outputs-r2/`, `figures/`.
- **Outside git:** the samples (about 6 MB each) are in `../conquercourse-assets/pose-kimodo/` with `SHA256SUMS`.
- **Comparison:** `figures/procedural-hang.png` is the lache demo's own hang (a Rookie with procedural arms).
