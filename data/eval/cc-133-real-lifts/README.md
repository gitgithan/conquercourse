# CC-133: real raw lifts for Cut-out, lift and bake

*Serves the Cut-out, lift and bake student: they see a simulation of real data, not a finished object turned back into a fake lift.*

## So what
- All 19 library objects were made from a photo through the lift (mask, lift, bake).
  - None is a plain download.
- The old Lab faked the raw lift for 17 of them because the real raw lifts were never kept (only the baked result was).
- We ran the real pipeline once more for all 19 (same photo, box, label, typed height, padding, seed 42) and kept the raw meshes and masks.
- Next step: switch Cut-out, lift and bake to `public/assets/lab/lift/real/index.json`.

## The split (honest)
- Photo-made through the lift: all 19 (rail-skate-01, box-skate-03, bench-concrete, railing-iron, rail-skate-02, stairs-park-07, bollard-iron, hydrant-red, barrel-oak, picnic-table, pullup-green, planter-concrete, pipe-concrete, bench-curved, railing-red, pullup-black, log-driftwood, stump-spruce, gabion-wall).
- Downloaded, never lifted: none of the 19.
  - What was downloaded is the photo (Wikimedia Commons); the 3D object came from our lift.
  - `monkey-bars-saienji-cc0.glb` is a 20th file in the folder and is also a lift (CC-133 bar photos); it is not one of the 19 and is not re-run here.
- The manifest keeps a `photoMade` field so a future download can be marked "downloaded, never lifted".

## What was run
- `pipelines/photo_to_object.py::main` on Modal: SAM 3 mask on an L4, SAM 3D Objects lift on an L40S, seed 42.
- Round a: 16 photos, no padding.
  - Round b: bench01, rail01 and gabion-wall with the photo padded 1.5x (as the shipped objects were).
  - Pad-and-retry off, as in the original rounds.
- The raw heights match the old runs (for example rail-skate-01 0.2604), so the lift is repeatable.
- The local bake was redone on the CPU for the yaw and tilt; a few yaws differ a little from the shipped file because the quadric thinning is not identical (for example bollard 30.5 against 34.5 degrees).
  - The old `mesh.json` values are in the CC-110 and CC-38 trails.
- The mask-sheet bake step of `main` failed on a missing plotting library on the laptop after the lifts had been saved; nothing paid was lost.

## Cost
- Estimated 0.153 USD for the 19 lifts (container seconds only, see `run.json`), plus a CPU-only import check and one aborted start (seconds of L4).
- Paid from the Modal workspace account; no cap applies.
  - Which credits covered it is unverified (the Modal billing page was not checked).

## Files
- Committed: `public/assets/lab/lift/real/` (19 raw-lift previews, 19 masks, 19 stats JSON, `index.json`), this README, `run.json`, `photos.json`, `evidence-masks.png`.
- Not committed: photos, full `raw.npz`, masked pictures and logs.
  - They are in `../conquercourse-assets/eval-full/cc-133-real-lifts/` with `SHA256SUMS`.
- Script: `scripts/cc133-real-lifts.py` (run with a Python that has numpy, scipy, Pillow, fast-simplification and xatlas).

## Manifest schema (`public/assets/lab/lift/real/index.json`)
- `objects[]`: `name`, `photoMade` (true), `photo`, `label`, `typedHeightM`, `credit`, `licence`, `rawMesh`, `maskPicture`, `bakedGlb`, `stats`, `note`.
- `stats`: `rawHeight` (lift units, z up), `rawExtents`, `rawFaces`, `previewFaces`, `previewBytes`, `yawDeg`, `tiltDeg`, `splatPoints`, `liftSeconds`, `maskSeconds`, `costUsd`, `costBasis`, `padded`.
- The raw mesh is z up, in the lift's own units, thinned to about 7,760 faces with colour from the splat.
  - `rawFaces` is the real face count before thinning.

## Not verified
- The previews were not opened in the browser Lab (another agent is changing it).
- Credit lines for CC BY and CC BY-SA photos must show wherever a preview is shown.
