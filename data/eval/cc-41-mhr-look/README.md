# CC-41: custom player look from MHR

## So what
- **Look-from-shape works on a CPU, for free:** the MHR body model loads without a GPU and gives six bodies (neutral plus tall, short, broad, slim, stocky) as 0.89 MB GLBs.
- **Wearing them is half done:** each body is skinned to the Rookie's 34-node skeleton and bends with it (arm up and knee bent in `variants.png`), but the result is a rough first cut, not shippable.
- **Two things block shipping:**
  - MHR rests in an A-pose (arms down) and the Rookie in a T-pose, so shoulders and upper arms take the wrong bones; the fix is to pose the MHR arms to T first (needs the MHR skeleton), then copy the weights.
  - Height barely moves with the 45 shape numbers (about 3 cm at 3 standard deviations); real height lives in MHR's separate scale parameters, so "tall" and "short" here are mostly proportions; in the game, scale the whole rig for height.
- **The motion clips are unchanged:** all four CC-26 clips still FAIL the shared gate, so none may be shown.
- **Next step:** the owner's consented adult photo (command below) gives a real shape; do the T-pose fix before that.

## 1. Shared gate on the four CC-26 clips
Run: `uv run --no-project --with numpy python pipelines/video_to_motion/regate.py data/eval/cc-26-pexels-motion` (re-run on 2026-10-27; the CC-26 files were left as they were; the new reports are in `regate/`).

| Clip | Shared-gate verdict | Failing rule |
|---|---|---|
| Jump_over_an_obstacle_vault | FAIL | `flight_is_ballistic`: fall of 0.78 m/s² against 9.81 (off by 92%), frames 0-46 |
| Monkey_bars_hang_and_swing | FAIL | `held_clips_are_held`: 0.73 s with nothing holding the body (limit 0.6 s) |
| Over_a_brick_wall_vault_or_wall_move | FAIL | `held_clips_are_held`: 1.23 s with nothing holding the body (limit 0.6 s) |
| Precision_jumps_between_concrete_blocks | FAIL | `flight_is_ballistic`: fall of -1.30 m/s² against 9.81 (off by 113%), frames 142-173 |

## 2. Six bodies from shape numbers
- **Model:** `mhr_model.pt` (lod1, TorchScript) from the Modal volume `sam-checkpoints`, path `body/sam-3d-body-dinov3/assets/`; same size as SOMA-X's `mhr_model_lod1.pt` (its copy in the clone was only a Git LFS pointer).
- **Method:** vertices = `base_shape + sum(coefficient[i] * shape_vectors[i])` over the 45 identity vectors; the mixes are found from the model (which vectors change height, torso width, torso depth, shoulder width); no pose, no face parameters.
- **Numbers used:** in `public/assets/experiments/mhr-look/variants.json`.
- **Fit:** every body is scaled to 1.75 m (the Rookie's height) with feet on the floor; the scale used is in `variants.json`.
- **Size:** 0.89 MB each static, 1.34 MB each on the Rookie's rig; both under the 1.5 MB limit.
- **Honest look:** `broad` and `stocky` come out heavy (belly and wide hips) because identity vector 0 mixes girth and mass; the numbers need a gentler mix.

## 3. Wearing them
- **Done:** `tools/mhr_look/export_variants.py` copies bone weights from the nearest Rookie vertices (4 nearest, best 4 bones) and keeps the Rookie's skeleton and bind matrices.
- **Seen:** `variants.png` (top: Rookie and six bodies; bottom: the same posed with the right arm up and the left knee bent); page `public/assets/experiments/mhr-look/index.html` (needs `npm run dev`).
- **Blocker, plainly:** retargeting is the blocker. The nearest-vertex copy is wrong where the A-pose and T-pose differ (shoulders, upper arms), so the raised right arm barely lifts the MHR bodies' arms; the legs bend fine.
- **Not done:** textures and clothes (the bodies are plain skin), hands and face bones, any game code change.

## 4. Cost
- **Modal GPU: $0.** Everything ran on the CPU; only the checkpoint file was downloaded from the volume.
- **Other paid steps:** none.

## 5. For the owner's photo (later)
- **No photo of a real person was used.**
- **Command once a consented adult photo exists:** `modal run pipelines/video_to_motion/modal_app.py::shape_from_photo --photo ../conquercourse-assets/owner-photo/photo.jpg --out ../conquercourse-assets/work/owner-look/`
  - **Not real yet:** `modal_app.py` has the SAM 3D Body class (`@app.cls`) but no `shape_from_photo` entrypoint; that small entrypoint is the first step of the next issue.
  - **Then:** feed the 45 `shape_params` it returns to `export_variants.py` as one more variant; the photo and the numbers stay outside git.
