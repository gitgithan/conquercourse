# the pose finder's raw output

## So what
- Video to motion now starts from what the pose finder really said, not from cleaned clips.
- Straight from the model, both rolls fail the gate and the soft rules show why smoothing exists.
  - Bones change length by 45% (crouch) and 24% (standing) over a clip; the limit is 2%.
  - Peak acceleration is 421 and 300 m/s2; the limit is 200.
- The game's smoothing brings both under the limits; the hard fail (the jump does not fall like a body) stays, so the clip is held back.
- No new GPU spend: the raw output of the real Modal runs of 2026-10-30 was still on disk.

## What is here
- `run.json`: inputs, outputs, cost and results.
- `raw-vs-smoothed.png`: left forearm length and hip height of the crouch roll, raw and smoothed.
- Raw model output (about 4 MB) is in `../conquercourse-assets/eval-full/cc-133-lab13-pose/` with `SHA256SUMS`.

## How it was made
- `python scripts/lab13_pose_pack.py` turns the stored output into 30 joints in metres (turned to face +z, set on the floor) and writes `public/assets/lab/motion/real/`.
- Not done on purpose: frame smoothing, one length per bone, repairs.
- The pose finder's own pipeline step also straightens the depth axis a little (a 9-frame line fit); that stays in.
- The Python gate runs on each track and its verdict is stored in the manifest; `tests/lab-motion.test.ts` checks that the page's gate agrees.

## Limits
- One film, one adult, one still camera, two rolls.
- Numbers only: no picture of the person is stored.
