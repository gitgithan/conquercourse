# CC-26: four Pexels clips to measured motion

*Serves the Park beat: a filmed move becomes measured motion (pipeline 1 in `docs/pipelines.md`).*

## What was run
- **Clips:** the four Pexels videos in `../conquercourse-assets/footage/` (credits in `docs/ASSETS.md`); videos and frames stay outside git.
- **Frames:** cut by frame number to 1920 px on the long side; each frame's time comes from the video's own timestamps (`pipelines/video_to_motion/cut_frames.py`).
- **Privacy first (Modal L4):** SAM 3 finds person (0.5), face (0.4) and licence plate (0.4); faces and plates are pixelated before anything else sees the frame.
- **Kept images:** people blurred as well (Gaussian, sigma 2 % of the long side), faces pixelated on top; only these leave the container.
- **Measure:** SAM 3D Body (`sam-3d-body-dinov3`) on the face-masked frame, focal length from MoGe 2 (median of 5 frames per clip).
- **MHR to SOMA:** SOMA-X `PoseInversion` (mhr identity), posed joints from its forward kinematics.
- **30 joints:** the 30 names of Kimodo's model skeleton picked from SOMA's joints.
- **World:** body from SOMA, path from the camera translation (x, -y, -z); depth smoothed as a straight line over 9 frames; a frame whose depth jumps by more than 0.6 m from its neighbours is bridged.
- **Fixed body:** every bone gets its median length for the clip, with each frame's bone directions kept.
- **Floor:** a plane fitted to the feet's lowest points on frames where a foot is nearly still.
- **Contacts:** a hand or foot under 1.0 m/s for at least 3 frames (4 for hands, 3 well above the hips), plus brief wall plants; off the ground (over 0.25 m) means an obstacle, written as a thin implied slab.
- **Gate:** the pipeline 4 rules (`pipelines/video_to_motion/gate.py`, tests in `pipelines/video_to_motion/tests/`), run on the raw and the repaired motion (knee mirror, lift to floor).
- **Commands (set `CC_ASSETS_DIR` to the folder that holds `footage/` and `work/`):** `python pipelines/video_to_motion/run_clip.py CLIP` then `python pipelines/video_to_motion/post.py CLIP`.

## Results
| Clip | Frames (athlete) | Faces masked in | Contacts | Gate | Why |
|---|---|---|---|---|---|
| Jump over an obstacle | 91 of 124 | 116 of 124 frames | 9 | **FAIL** | flight fits g = 0.8 m/s² (rule: 9.81 ± 15 %); the athlete flips; short plants on the bench are not seen as support |
| Precision jumps | 240 of 240 | 216 of 240 | 13 | **FAIL** | flight not ballistic and feet 4 cm under the floor; the camera moves (blocks shift in frame) |
| Monkey bars | 300 of 300 | 249 of 300 | 45 | PASS (conditional) | passes only with `supportedBy` "playground bars" and the floor lift; the free-flight rule alone gives g = 0.18; the camera pans |
| Brick wall | 300 of 300 | 174 of 300 | 37 | PASS (conditional) | passes only with `supportedBy` "a brick wall" and the floor lift; free-flight g = 4.7; the camera pans |

- **Faces first:** every frame with a face found had it pixelated before measuring; frames without a found face have the whole person blurred in the kept image.
- **Clock:** `motion.json` times are the clip's own (25 fps for the jump clip, 29.97 fps for the others), never a typed-in rate.
- **Shown?** No motion here is shown in the game: the gate verdict is mechanical, and two PASSes lean on a human-chosen `supportedBy` label.
- **Per-clip files:** `motion.json` (30 joints, metres, y up, run along +z), `contacts.json`, `gate.json` (raw, repaired, soft rules), `privacy_receipt.json`, `modal_run.json`, `contact_sheet.jpg`.
- **Not in git:** frames, masked frames, `measured.json` (MHR parameters) and `soma.json` stay in `../conquercourse-assets/work/`.

## Findings
- **The pipeline runs end to end:** all 964 frames were measured (SOMA fit vertex error mean 0.8 to 1.3 cm).
- **Vertical scale is the weak part:** flights fit 13 to 18 m/s² on the jump clip's real flight (frames 27 to 47), so heights are 30 to 80 % too big or the timing is off; the default-focal and depth pitfalls in `docs/pipelines.md` apply even with a MoGe 2 focal length.
- **A bystander is picked up:** the jump clip shows a far person at both ends; the athlete segment is the longest run of frames with a person box at least 35 % of the typical height.
- **The cameras are not static** in three of the four clips (Mary Taylor's are hand-held and pan); the still-camera world is wrong there, so paths and floor are rough.
- **Support from still feet is too strict** for brief plants on a bench (0.1 s); the gate sees a 1.8 s flight; a plant detector from pipeline 1 step 8 should feed the gate's support rule.
- **Skeleton:** the 30 joints are SOMA joint positions as measured; Kimodo's rotation fit (step 5) was not done, so there are no rotations yet.
- **Floor lift hides real sinking:** the repaired gate lifts feet up to 5 cm; raw feet sink on every clip.

## Cost
- **Modal L4, clip runs:** about 52.8 container minutes (four clips; up to 3 containers at once), about $0.70 at $0.000222 per second.
- **Smoke and debug runs:** about 25 minutes (rough), about $0.33.
- **Total:** about 78 GPU minutes, about $1.04 (an estimate from in-container timers; Modal bills container lifetime).
- **Credits:** not checked whether they cover it; the spend is on the workspace's Modal account.

## Bugs fixed on the way (for the next person)
- SAM 3 needs bf16 autocast; the body model's TorchScript fails under it, so autocast only around SAM 3.
- SAM 3D Body needs `braceexpand` (and `numpy<2` after MoGe); DINOv3 code downloads from GitHub at start.
- `PoseInversion(low_lod=True)` fails to import; use the full mesh.
- The fit returns 78 rotation matrices (world root first); `pose()` takes 77 matrices with `pose2rot=False`; its joint names list has 110 entries (32 twist joints), so filter names that contain "Twist" and the "Root".
- SOMA joints are pelvis-relative in the body frame: add the camera translation of the pelvis, taken from SAM's keypoints, not the model origin.
