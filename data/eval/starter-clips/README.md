# Starter clips through the plausibility gate (CC-17)

## So what
- **Result for the game:** 5 of the 6 Rookie moves ship: run, leap, land, hang and swing all pass the gate and the guard test (plus two extras, reach and a Kimodo leap).
- **The one missing move is the wall run-up and grab (the Warped Wall beat),** and the failure is about the method, not about the wall:
  - the 36 Kimodo samples were text-only prompts, tried before the simulator path and the contact targets existed;
  - the earlier practice project got wall moves working by feeding Kimodo the simulator's path plus hand and foot targets (`docs/pipelines.md`, pipelines 3, 5 and 6);
  - so "0 of 36" says text alone is not enough, not that the move is out of reach.
- **Recommendation:** do not drop the wall; build the wall move from CC-29 video measurements (a real wall run: path, plant height, grip height and timing) plus contact targets for Kimodo.
- **Next step:** CC-29 ingests the filmed wall run (side view, 2:29-2:35 of the first video) and writes a move recipe; use its plant and grip points as Kimodo's targets, then run the same move check.

*Serves: the motion library for the Rookies (run, leap, land, hang, swing, wall run-up and grab); demo beat "nothing impossible is ever shown".*

## Question
- Can CMU mocap (re-imported with new code) and Kimodo give a starter clip for each of the six moves, with every shipped clip passing the gate?

## Pass lines (fixed before the Kimodo runs, `inputs/pass_lines.json`)
- **Gate:** every hard rule passes (`pipelines/ccpipe/gate.py`).
- **Guard:** `pipelines/tests/test_guard_shipped_clips.py` runs the gate on every file in `public/assets/motion/`.
- **Move check for Kimodo text clips** (the gate alone cannot tell a leap from a stumble):
  - leap: a flight of at least 0.2 s while the hips travel at least 2 m;
  - wall run-up and grab: a foot planted 0.4-1.6 m up while running, then a hand grip above the head with the feet off the floor for at least 0.3 s;
  - grab: a hand grip above the head with the feet off the floor for at least 0.5 s.

## Commands
- Python setup: `uv venv <dir>`, then `uv pip install numpy pytest matplotlib modal`.
- CMU raw files (outside git): `http://mocap.cs.cmu.edu/subjects/<subject>/<subject>.asf` and `<trial>.amc`, kept in `../conquercourse-assets/cmu/`.
- Kimodo on Modal, one L4, detached with a log:
  - `modal run --detach pipelines/kimodo_clips.py --out <dir>` (round 1, seven prompts, six seeds each);
  - `modal run --detach pipelines/kimodo_clips.py --out <dir>_r2 --only wall_a3,wall_b3,wall_c3` (round 2).
- Build, repair, gate, place: `python pipelines/build_starter.py --cmu <cmu dir> --kimodo <dir> --kimodo <dir>_r2 --candidates <outside-git dir>`.
- Tests: `python -m pytest -q pipelines` from the repo root (42 pass, 1 expected fail: the open wall move).

## Results
| Clip | Source | Raw gate | Repairs | Shipped |
|---|---|---|---|---|
| `run` | CMU 09_01 | pass | none | yes |
| `leap` | CMU 49_04 | pass (fitted gravity 10.0 m/s²) | made ballistic (12 frames) | yes |
| `land` | CMU 49_05 | pass (10.6 m/s²) | made ballistic (8 frames) | yes |
| `hang` | CMU 01_10, held by playground bars | pass | none | yes |
| `swing` | CMU 01_10, held by playground bars | pass | none | yes |
| `reach` (extra) | CMU 14_09, held by something overhead | pass | none | yes |
| `kimodo_leap` (extra) | Kimodo, prompt `leap_a`, seed 10 | pass | none | yes |
| wall run-up and grab | Kimodo, 3 prompts at 5 s and 3 s, 6 seeds each (36 samples) | 4 of 36 pass the gate | none helped | **no** |
| `kimodo_grab` | Kimodo, 2 prompts, 6 seeds each (12 samples) | 8 of 12 pass the gate | none helped | no (0 of 12 show a grip) |

- **Flights in real mocap fit gravity:** the two CMU flights fitted 10.0 and 10.6 m/s² before any repair, inside the 15 % line (the repair only tidies them to 9.81).
- **Soft rules (reported, not fatal):** foot creep of 3-12 cm (line 3 cm) on the planted feet of every shipped clip except `run` (swing 11.7 cm, Kimodo leap 8.0 cm, hang 6.9 cm, land 3.7 cm, reach 3.5 cm, leap 3.2 cm); one acceleration spike (210 m/s², line 200) in the CMU leap; bones keep their length within 0.3 % (the hands are mittens, see below).
- **Kimodo leap:** 3 of 12 samples show a flight; the shipped one is a short hop with a deep squat on landing, so it is a candidate for the blind test against the CMU leap, not a judged winner.
- **Wall run-up and grab: not achieved.**
  - Text only makes Kimodo climb the wall to the top: the hips reach 3.5-3.9 m within 5 s and 2.5-3.3 m within 3 s, feet planted at 1.7-2.9 m.
  - 0 of 36 samples meet the move check; the nearest miss is `wall_c3` seed 5 (gate pass, grip 0.3 s, plant at 1.74 m against a 1.6 m line): `outputs/near_miss_wall_c3_s5.png`.
  - Stop rule applied: two rounds, one change (5 s to 3 s), no pass; the line was not moved after seeing the numbers.
- **Kimodo grab from text:** 0 of 12 show a hand grip with feet off the floor (Kimodo's training labels hold 0 hangs, `docs/research/motion-data.md`).

## What changed in the gate while building (each came from a real clip)
- **New hard rule `held_clips_are_held`:** a clip marked `supportedBy` skips the free-flight law, but no stretch longer than 0.6 s may have the feet off the floor with no still hand or foot.
  - Without it, a Kimodo "wall run" that floated 3 m up with nothing touching it passed.
- **Planted-foot slide:** counted only for a foot near the floor and slower than 1 m/s (a swinging foot skimming the floor read as 50 cm of slide).
- **Mitten hands:** CMU's finger curl changed the wrist-to-fingertip distance by up to 58 %, so thumb and middle-finger tips ride the wrist bone's turn.

## Limits
- **CMU has no true jump-and-grab with the feet off the floor:** "jump up to grab" trials are reaches and small hops (14_09 has two); `reach` is that, marked as an extra.
- **Hang and swing come from one trial** (01_10) and from a playground structure; the bar position is not in the clip yet (`geometry` comes with the simulator).
- **The gate judges bodies, not looks:** a pass means a real body could do it, not that it looks good; the blind test decides looks (`docs/pipelines.md`, pipeline 11).
- **Shipped clips are on a CMU-sized body** (about 1.6 m); retargeting to the Rookies is CC-16.

## Cost
- Modal L4, one container at a time: about 14 GPU minutes in five runs (10.6 recorded, the first run not timed), about $0.19 at list price ($0.80 an hour); whether workspace credits cover it was not checked.
- The cost was not stated before the runs (it was small; next time state it first).
- Meta API, Tripo, Linear: none used for generation.

## Where things are
- Shipped clips: `public/assets/motion/`; credits and rows: `docs/ASSETS.md`.
- First sample of each failed Kimodo prompt: `public/assets/experiments/starter-clips/`.
- Every sample and the CMU raw files: outside git (`../conquercourse-assets/`), manifest `SHA256SUMS`.
- Contact sheets and per-clip gate reports: `outputs/` (`index.json`, one PNG per shipped clip).
- Modal run records: `outputs/kimodo_modal_run.json`, `outputs/kimodo_r2_modal_run.json`; totals in `run.json`.
