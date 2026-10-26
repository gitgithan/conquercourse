# Pipelines: recipes to rebuild

*Draft v0.1, 2026-10-27; knowledge from the practice project (`docs/PRIOR-WORK.md`).*
*These are recipes, not code: each says what goes in and out, the steps, the settings that mattered, what broke and how to check it.*
*Rebuild them in this repo from these descriptions; the facts (model versions, thresholds, settings) are the parts to keep exactly.*
*Reference, not requirements: the spec decides; numbers are starting points to re-measure in this project.*

## Index
| # | Pipeline | Runs on | Demo beat |
|---|---|---|---|
| 1 | Video → motion | Modal (L4) + CPU | The Park: a filmed move becomes measured motion |
| 2 | CMU mocap → 30 joints | CPU | Everyday moves for the library |
| 3 | Kimodo on the simulator's path | Modal (L4) | Smooth bodies that follow exact physics |
| 4 | Plausibility gate and repairs | CPU | Nothing impossible is ever shown |
| 5 | Contact IK | CPU | Hands and feet exactly on obstacles |
| 6 | Coaching text → contact targets | Meta Model API | New moves from written coaching |
| 7 | Photo → obstacle | Modal (L4 + L40S) + CPU | The hero beat: the park becomes the course |
| 8 | Character: generate, rig, check | Tripo + Meta Model API + Blender (CPU) | The rookies |
| 9 | Filming at true speed | Laptop or VM (headless Chromium) | Every clip in the video |
| 10 | Ideal-run search, par times, size ideals | CPU (Node) | Timing windows, difficulty, the "line that would have made it" |
| 11 | Blind-test pages | CPU + a static page | Deciding looks by evidence |

## Shared conventions
- **Skeleton:** NVIDIA SOMA, the 30 joints Kimodo uses as its model skeleton (Hips, Spine1, Spine2, Chest, Neck1, Neck2, Head, Jaw, LeftEye, RightEye, Left/Right Shoulder, Arm, ForeArm, Hand, HandThumbEnd, HandMiddleEnd, Left/Right Leg (hip joint), Shin (knee), Foot (ankle), ToeBase).
- **Clip file:** `{"names", "parents", "fps", "frames": [frame][joint][x, y, z]}` in metres, y up, run along +z, the character's left on +x; optional `gravity`, `takeoff`, `landing`, `supportedBy` (list of what holds the body, e.g. "a bar"), `geometry` (obstacle boxes as `{min, max}`).
- **Always assert `len(names) == number of joints in each frame`** (the off-by-one lesson).
- **One clock:** a clip's times come from its source (the video's frame times, the mocap's rate, the simulator's ticks); never from a typed-in frame rate.
- **Experiment trail:** each run writes `data/eval/<experiment>/` with `inputs/`, `outputs/`, `run.json` (timings, versions, cost, errors) and a README with the exact command; big files go outside git with `SHA256SUMS`.
- **Long GPU jobs:** start detached in the background with a log file, then poll a status command; never wait on a GPU job in one blocking shell call.
- **Modal limits:** keep at most 3 containers at once (the workspace caps at 10 GPUs); weights live on volumes (`sam-checkpoints` read-only for SAM 3, SAM 3D Body, SAM 3D Objects and MoGe; `hf-cache` for Hugging Face downloads).

---

## 1. Video → motion
- **Purpose:** turn a short clip of a real person into a 30-joint motion on the clip's own clock, with its contacts; feeds the Park's "film a move" and moves no mocap has.
- **Inputs:** a constant-frame-rate video (a file whose average rate differs from its nominal rate is refused); a start and end time; licence and author.
- **Outputs:** frames plus `times.json` (each frame's time from the video's own rate); `measured.json` (MHR parameters per frame); `soma.json`; `motion.json` (30 joints at the frame times); a contacts/targets file; a contact sheet.
- **Steps:**
  1. **Cut frames by frame number, not by seek time** (seeking before the input put early sheets about 3 s off); write each frame's time.
  2. **Privacy first (Modal L4):** SAM 3 with text prompts "person", "face", "license plate" (score thresholds 0.5, 0.4, 0.4); grow the masks a little, blur people (Gaussian, sigma at least 8 px or 2 % of the image's longer side), then pixelate faces and plates on top; process in memory and return only masked images plus a receipt (counts). EgoBlur can replace or join SAM 3 once its weights are obtained.
  3. **Measure (same container):** SAM 3D Body (`sam-3d-body-dinov3` checkpoint, its `mhr_model.pt`) gives per frame 45 shape and 204 MHR model parameters, scale parameters, the camera translation `pred_cam_t`, 70 keypoints (3D and 2D) and the focal length.
  4. **MHR → SOMA (Modal L4):** SOMA-X (NVIDIA, Apache 2.0, `py-soma-x` plus its repo) the way its `tools/mhr2soma.py` does it: run the MHR body (`mhr_model_lod1.pt`), then `PoseInversion` onto the SOMA layer (identity model "mhr", warp mode, centimetres); take joint names from `PoseInversion.joint_names`.
  5. **SOMA → Kimodo's 30 joints:** keep SOMA-X's joint positions and fit Kimodo's rotations to them through Kimodo's own forward kinematics (about 400 steps), with penalties for a knee hinge turned away from the hips' side axis, a knee past 165°, and jerky motion.
  6. **World placement:** the body is body-centred, so the path comes from the camera translation; depth is the noisiest axis (smooth it as a straight line in time over a short stretch).
  7. **Contacts (CPU):** a hand or foot nearly still is touching something: under 1.0 m/s for at least 3 frames at 25 fps (a running arm swing also stops for about 3 frames, so a hand needs 4, or 3 when well above the hips); off the ground (more than 0.25 m up) it touches an obstacle; each off-ground contact implies an obstacle surface, written as axis-aligned boxes.
  8. **Brief plants:** a foot touching a wall for about 0.1 s never looks still; a foot above knee height, out to the side of the hips, at its own speed minimum counts as a plant.
- **Pitfalls and fixes:**
  - SAM 3D Body's keypoints are in the camera's convention (y down, z away): read as y-up, the feet came out above the hips.
  - Ground levelling by "first and last frames' lowest joints at the same height" is wrong when a stretch starts on a wall top or ends hanging (it tilted a vault 21.4° and a tic-tac −10.4°); build the world from the camera (the image's up is up for a level camera, forward is the hips' travel).
  - A short flight can't set the scale or the vertical: a 0.4 s flight at 25 fps fitted 22-23 m/s² and 5.7 m/s²; scaling by it would have shrunk the athlete to 44 %.
  - Joint names were one off once (SOMA-X's positions have no world root but the name list started with one): the fit chased the wrong targets and bent knees backwards (fit error 12.2 cm → 2.2 cm after the fix).
  - A typed-in frame rate once replaced the measured per-frame times and stretched the landing.
  - SOMA-X's low-detail refit imported from the wrong package (use the full mesh); its fit returns 78 joints with a world root first and 32 twist joints mixed in; Kimodo's 77-joint skeleton failed in its forward kinematics, so use the 30-joint model skeleton.
  - SAM 3D Body uses a default focal length (800 px) without a field-of-view estimate, so absolute sizes carry that error; add a known-size object in frame or estimate the field of view.
- **Check it worked:** the contact sheet (frames, mask, skeleton over the frame); the clip passes the gate (pipeline 4); flights fit gravity within 15 % when long enough; contact points sit on plausible surfaces.
- **Measured:** Marey's 1900 jump, 58 frames: model load 26 s plus 2 min for privacy and measurement on one L4; MHR → SOMA for 24 frames in 10 s (vertex error mean 0.66 cm, median 0.30 cm); a 3 s parkour stretch about 20 min of L4 and a 1.8 s one about 8 min; about $0.25 per move.
- **What failed and why:** a far, small runner gave depth that jumped by metres; a panning camera breaks the still-camera world; use static, side-on, landscape clips with the whole body and the ground in frame.

## 2. CMU mocap → 30 joints
- **Purpose:** everyday real moves (run, jump, hang, climb, stop) for the motion library.
- **Inputs:** CMU Graphics Lab ASF (skeleton) and AMC (motion) files; trial IDs and their rate from the CMU index (120 fps for the trials we used).
- **Outputs:** one clip per trial (30 joints, 30 fps of the same seconds), an index entry with its move, licence credit, `supportedBy` and the gate report.
- **Steps:**
  1. **Forward kinematics, the standard ASF/AMC recipe:** each bone has an axis frame C (its `axis`, degrees, XYZ, applied as Rz·Ry·Rx) and per-frame rotations for its `dof`; world = parent · C · R(dof) · C⁻¹; a bone's end sits `length` along its `direction` from its start.
  2. **Units:** ASF lengths × (1 / 0.45) × 0.0254 → metres.
  3. **Joint map (a joint is where a CMU bone starts):** Hips ← root, Spine1 ← upperback, Spine2 ← thorax, Chest ← lowerneck, Neck1 ← upperneck, Head ← head, Arm ← humerus, ForeArm ← radius, Hand ← wrist, Leg ← femur, Shin ← tibia, Foot ← foot, ToeBase ← toes (left and right); Neck2, Jaw, the eyes and the shoulder joints are placed between two CMU points.
  4. **Time:** take every 4th frame (120 → 30 fps of the same seconds; assert the division is exact); nothing is retimed.
  5. **Length:** keep the busiest 8 s of a longer trial (most hip travel) to keep the library small.
  6. **Mark support:** moves held by equipment carry `supportedBy` (for example "jump up to grab" ← "something overhead", "hang and swing" ← "playground bars", "pull up" ← "a bar", "climb backwards off a ledge" ← "a ledge", "hang on ropes" ← "ropes", "climb a ladder" ← "a ladder", "jump over an obstacle" ← "a stool").
  7. **Repair (knees, floor) and gate (pipelines 4);** a clip that fails a hard rule isn't published, its report stays in the index.
- **Pitfalls:** CMU's credit line must travel with every clip; the published library on Kimodo's skeleton was regenerated from raw files each time, never hand-edited.
- **Check it worked:** a contact sheet of the library; every clip passes the gate test.
- **Measured:** 16 moves covered; CPU only, seconds per trial.

## 3. Kimodo on the simulator's path
- **Purpose:** a smooth, human-looking body that follows the simulator's exact centre-of-mass path, for moves and outcomes mocap doesn't cover; the blind test preferred it to mocap leaps 3 times out of 3.
- **Model:** `kimodo-soma-rp`, Kimodo repo commit `e1c219c99b4b94ba48be1fb6a1cbc64ecee4c954`, installed from git into a Debian slim Python 3.11 image (with git, cmake, build-essential, libeigen3-dev, pybind11), environment `TEXT_ENCODER_MODE=local`, `HF_HOME` on the `hf-cache` volume.
- **GPU:** L4 (24 GB; Kimodo with the Llama 3 text encoder needs about 17 GB); the Llama 3 encoder (Meta-Llama-3-8B-Instruct, gated, about 16 GB) downloads once to the cache; the Hugging Face token comes from a Modal secret, never the repo.
- **Inputs:** the simulator's run at an obstacle (hip path at 30 fps, phase per frame, events, contact points), a prompt (often empty), targets (pipelines 1 and 6), obstacle boxes.
- **Outputs:** 30-joint motion (and rotations) per variant, plus measurements (target error, joints and bones inside obstacles, hips off the path, GPU seconds).
- **Steps:**
  1. **Pose source:** generate from the prompt alone (or borrow a real clip's pose by phase), turned to face +z, then moved onto the simulator's ground path.
  2. **Constraints:** a 2D root (hips) path on every frame; full-body keyframes every 4 frames in flight (every 4-8 frames keeps the body within about 2 cm of the arc); hand and foot targets on their frames; 100 DDIM denoising steps; seed fixed.
  3. **Hand and foot targets, the way that works:** a hand or foot constraint pins its whole chain (wrist and fingers, ankle and toes) plus the hips' height and heading on its frames; so group all joints pinned on a frame into one end-effector constraint; move the body toward the pins by their mean offset, eased to zero over 8 frames either side and smoothed with a 5-frame moving average (the hip path moves with it); then move each chain the rest of the way.
  4. **Keep the body out of obstacles (in-loop projection):** replace the model's denoising step with a copy that, after the clean prediction and before the sampler, decodes the joint positions (local positions + the smoothed root's x and z), pushes every joint and sampled bone point (at 25 %, 50 %, 75 % of each bone) out of the obstacle boxes grown by 6 cm (3 push rounds; the top face counts as half as near so bodies over a box go up, not back), recomputes velocities, and re-encodes; apply only on the last 15 % of steps; read the final pose from the position block, not the rotations.
  5. **Clearance rule from geometry:** while the hips pass over a box lower than 1.6 m, pin the feet (not the hips during a hand plant) above its top.
  6. **Push-out rounds after generation:** any hand or foot still inside is pinned to the nearest point outside and the move regenerated, up to 3 times.
- **Pitfalls and fixes:**
  - Build every constraint on the CPU and move it whole with `.to(device)`: built directly on the GPU, its joint indices stayed behind and targets failed.
  - Editing positions alone is ignored: Kimodo carries constraints in rotations and its rotation-side clean-up, so the position block sits 16-30 cm off targets even with no projection; read positions only when projecting, and snap contacts with IK afterwards (pipeline 5).
  - A separate body shift per pinned joint pulled left and right apart (right side on target, left 15-41 cm off); a shift on single frames made the hips jump at 20-25 m/s.
  - Projection with the final pose from rotations does nothing (late) or harm (every step: bone hits 153 and 382).
  - Text alone can't make unusual physics: told it was on the Moon, it still fell at Earth gravity; above about 2.5 m of rise its own bodies jitter, so stretch a mid clip instead.
  - Lifting the hips during a kong vault's hand plant put the shoulders out of reach of the box.
- **Check it worked:** hips within 3 cm of the simulator's path; contacts within 10 cm before IK; bone hits near zero; the gate.
- **Measured:** about 5-20 s per generation once loaded (7 s with late projection); six grid clips in 34 s on one L4 (model load 7 s); collision spike: tic-tac 108 → 2-5 bones inside with contacts within 6 cm; kong vault 41 → 23 with hands 16-22 cm off (open).
- **What failed and why:** targets can only nudge a pose the source already has (a rope grip with arms down never reached the grip, 155-161 cm off); the vault's hands remain the open problem.

## 4. Plausibility gate and repairs
- **Purpose:** no clip that a real body couldn't make is ever shown; a guard test runs the gate on every shipped clip.
- **Hard rules (a fail blocks publishing):**
  - **Knees bend forward:** the knee's hinge axis (thigh × shin) must point like the hips' side axis; reversed (near 180°) is backwards; judged only when bent more than 15°.
  - **Legs not twisted round:** the hinge axis within 60° of the hips' side axis (hips rotate a leg about 45° out, 35° in).
  - **Knees within range:** bend at most 165° (a full deep squat reaches about 160°).
  - **Flight is ballistic:** over the longest unsupported stretch, the centre of mass (Winter's segment masses) falls at the clip's gravity within 15 %.
  - **Feet don't sink:** the lowest foot no more than 3 cm under the floor.
  - **No teleport:** hips never faster than 12 m/s (the fastest sprinters reach about 12.4 m/s briefly).
- **Soft rules (reported, not fatal):** bones keep their length within 2 % of their median; feet on the ground (within 5 cm of the lowest point) slide no more than 3 cm; no joint accelerates more than 200 m/s² between frames.
- **Support detection:** a body is supported when its lowest joint is within 15 cm of the floor (sand-pit landings and flat shoes sit about 10 cm up) or any hand or foot is still (under 0.3 m/s for at least 4 frames; a hand above the head counts as gripping up to 1.0 m/s, since the wrist rolls round a bar); a clip with `supportedBy` isn't judged as free flight.
- **Repairs (the only ones allowed, before the gate):**
  - **Fix knees:** a knee bent backwards is mirrored across the hip-ankle line; a leg turned round gets its knee on the plane whose hinge axis is the hips' side axis; hip and ankle stay, bone lengths stay (two-bone IK by the law of cosines).
  - **Lift to floor:** a frame whose lowest joint is under the floor is raised.
  - **Limit knee bend:** a knee folded past 164° on a foot in the air is opened by turning the shin about the knee.
  - **Make ballistic:** each airborne frame moved until the centre of mass is on a parabola pinned at take-off and landing, pose unchanged.
- **Check it worked:** unit tests on synthetic clips for every rule; the guard test over all shipped clips stays green.
- **Pitfall:** experiment clips that haven't passed must live outside the shipped motion folders, or the guard test (rightly) fails the build.

## 5. Contact IK
- **Purpose:** put a wrist or ankle exactly on its contact point (a box top, a wall face, a bar) after a generator got close.
- **Input:** a clip and targets `{joint, frames: [first, last], point}`; points already moved 6 cm off the surface along its normal (a wrist or ankle sits that far from what it touches).
- **Steps:** on the target's frames the end joint goes to the point; over 4 frames either side it eases there and back; the shoulder (or hip) stays put, the two bones keep their median lengths, the elbow (or knee) stays on its own bend plane (pole from its current offset), fingers (or toes) move rigidly with the end; a point out of reach is reached at full stretch and the leftover error reported.
- **Check it worked:** tests: the hand lands within 0.1 cm and fingers keep their offset; frames outside the blend unchanged; the ease is monotone; out-of-reach stops at full length.
- **Pitfall:** IK can pull a limb back inside an obstacle; re-check bone hits after it and iterate with push-out; run the floor and knee repairs first and IK last (repairs after IK moved a wall foot 32 cm off).

## 6. Coaching text → contact targets (Muse Spark)
- **Purpose:** make targets for moves the simulator doesn't model (tic-tac, kong vault) from written coaching, for pipeline 3.
- **Model:** `muse-spark-1.3` on the Meta Model API (`/chat/completions`), temperature 0.2, `max_tokens` 20,000 (it reasons first and counts that against the limit: 4,000 gave an empty answer; a call used about 10,000 tokens, 8,300-9,600 of them reasoning, and took about 40 s).
- **Prompt structure:** a role line (turn coaching into motion targets); the body (an adult 1.75 m tall: hip height 0.95 m, shoulder height 1.45 m, standing reach 2.2 m, running speed 3.5-5 m/s, 30 fps); the coordinate convention; the obstacle in words with exact boxes; the coaching text quoted with its source and licence; the output schema.
- **Output schema (one JSON object):** `prompt` (one sentence, no numbers); `duration_s` (3-6); `hips_path` (`[t, x, z]` waypoints, at least 6); `targets` (`{joint, t_start, t_end, point, why}`, `why` quoting the phrase it came from); `clearance` (`{joint, t, min_y, why}`); plus `geometry` (the obstacle boxes) added by us.
- **Check it worked:** contacts land on obstacle surfaces at sensible heights and times; the `why` fields cite real phrases; compare with a measured video of the same move.
- **What failed and why:** text guessed the tic-tac's wall plant at 1.15 m; the real athlete planted at 0.77 m ("foot at navel height"); use a few measured videos per move family to calibrate the text track.
- **Sources used:** Wikibooks "Parkour/Basic Moves/Tic Tac" and Wikipedia "Vault (urban movement)" (CC BY-SA 4.0).

## 7. Photo → obstacle
- **Purpose:** the hero beat: a photographed object becomes a game obstacle with real size; collision comes from a fitted primitive, never the mesh.
- **Inputs:** a photo, a text prompt for the object ("bench"), licence and author.
- **Outputs:** a masked photo plus a privacy receipt; a mask; a mesh with a layout (rotation, translation, scale in the camera's frame from MoGe's point map); a baked game asset (GLB, at most 6,000 faces); `mesh.json` (extents, photo height, typical height); a primitive in a world file.
- **Steps:**
  1. **Privacy (Modal L4):** as in pipeline 1, for people, faces and plates.
  2. **Mask (L4):** SAM 3 from the text prompt; keep the best mask; on the Meta Model API, SAM 3.1 takes one noun phrase per request, up to 16 objects, masks as base85 text.
  3. **Lift (Modal L40S, 48 GB; the model needs about 32 GB):** SAM 3D Objects turns photo + mask into a mesh and its Gaussian splat, seed 42.
  4. **Bake (CPU):** keep the mesh upright in its own frame (don't apply the camera layout: it tilts objects by the camera's pitch); turn it so its widest side faces the side-on camera; centre it and stand it on the ground; colour each vertex from its nearest Gaussians in the splat (the mesh itself has no colour); scale to a typical height for the label (bench 0.8 m, wooden crate 1.0 m, rail 1.0 m, bollard 0.95 m, cone 0.7 m), keeping both heights; reduce to at most 6,000 faces.
  5. **Fit and place (CPU):** fit a primitive to the extents with its role (platform, vault rail, wall, hazard); space obstacles about 7 m apart on one deck (a running jump flies about 6 m) so a run can be timed; prove the course clearable with the simulator.
- **Image-build fixes for SAM 3D Objects on Modal:** use `pypi.nvidia.com` (not `pypi.ngc.nvidia.com`, which doesn't resolve from Modal's builders) and drop `nvidia-pyindex`; install `wheel` and `setuptools` before `--no-build-isolation` builds; set `CC=gcc CXX=g++ LDSHARED='g++ -pthread -shared'` (Modal's Python was built with clang); set `CONDA_PREFIX` and `CUDA_HOME` to `/usr/local/cuda`; install nvdiffrast v0.3.3 from its repository (no requirements file lists it); CUDA arch list "8.0;8.6;8.9"; flash-attention 2.8.3 wheel for cu12/torch 2.5/py3.11.
- **Pitfalls:** one photo's depth gets proportions right and size wrong (a bench at a third of its size); "parallel bars" found nothing where "metal bars" found the rail; thin and stair-like objects come out flat (steps became a slab: leave them out).
- **Check it worked:** a sheet per photo (photo → privacy → mask → mesh from three sides → primitive); each mesh sits on its primitive at its measured width; under 1.5 MB per mesh; licences travel with each object; a bot runs the course without falling.
- **Measured:** 10-38 s per object on the L40S once loaded; the image build is a one-time cost.
- **Fallback that must exist:** the photo as a backdrop with editable boxes the player drags onto the objects.

## 8. Character: generate, rig, check
- **Purpose:** game-ready characters on the SOMA skeleton.
- **Generate (Tripo, `https://openapi.tripo3d.ai/v3`):**
  - Settings: model `P2-20260801`, `quad: true`, `face_limit: 5000`, `texture: true`, `pbr: false`, `texture_quality: "standard"`, `auto_size: true`; about 110 credits per character from text or from an image; P2 now returns FBX.
  - Prompt pattern: stylised, matte, flat colours; natural proportions with a stated height; fitted clothes, each part one solid colour; mitten hands with a separate thumb; strict symmetrical T-pose with gaps under the arms and between the legs; an explicit list of what not to add (logos, loose cloth, capes, ponytails, accessories); a negative prompt for chibi, big heads, fused fingers, A-pose.
  - For a second character in the same style, go image-first: Muse Image `/images/edits` (`muse-image-1.0`) with the first character's concept image as the reference and the new description (one call, about 13,600 tokens), approve the image, then Tripo image-to-model with `texture_alignment: "original_image"` and `enable_image_autofix: false`; upload the image first (`POST /files` → `file_token`); credits are frozen at task creation and returned if the task fails.
  - Keep each request without keys, the task response and the renders.
- **Rig (headless Blender, CPU):**
  1. Import (FBX or GLB), apply transforms, stand on the ground, centre, scale to the stated height; turn 180° if the front render shows the back (`--turn`; the automatic front check misjudged both rookies).
  2. Build the armature from SOMA's own T-pose rest joints (Kimodo assets), scaled uniformly by height.
  3. **Measure the arm joints from the mesh** (don't stretch an average arm): sample about 80,000 points evenly over the surface (a low-poly torso side has no vertices between its big faces); slice the upper body every 1 cm along the arm; the arm's underside is the median lowest point between 55 % and 75 % of the half-span; the armpit is the first slice whose lowest point is within 8 cm of it; the shoulder joint sits 2 cm inside the armpit; fit one straight centre line through the arm slices' box centres (a sleeve wraps the arm evenly); the wrist sits 7 % of the height in from the fingertip; the elbow 55 % of the way from shoulder to wrist; the collarbone runs level to the shoulder.
  4. Add non-deforming contact bones: palm grips and soles.
  5. Merge vertices split at texture seams (within 0.1 mm) before binding, or automatic weights fail on every vertex.
  6. Bind with Blender's automatic (heat) weights; any vertex left unweighted gets its two nearest bones by inverse distance to the fourth power.
  7. Export GLB (y-up, metres) with armature and skin.
- **Check (the part that matters):** render T-pose, arms up (front and side) and crouch (front and side); then pose the character in the game's own viewer on nine real clips (leap, run, run-leap, jump to grab, bar swing, pull-up, sudden stop, jump over, climb off a ledge) and compare with a reference character; judge by the renders, not the weight counts.
- **What failed and why:** an average-body skeleton put the shoulder 10 cm above the arm and opened a gap when the arms rose (weight smoothing hid it but didn't fix it); vertex-only slicing put the shoulders at the neck; the thinnest slice picked a wrist inside the glove (7 cm hand) and then mid-forearm (25 cm hand), so the wrist is set by proportion.

## 9. Filming at true speed
- **Purpose:** every clip in the video and every visual check plays at real speed, even on software rendering.
- **Steps:**
  1. Serve the page from `localhost` (WebGPU needs a secure context); headless Chromium with `--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-angle=swiftshader --disable-vulkan-surface --ignore-gpu-blocklist`.
  2. In an init script, replace `performance.now` with a stepped value; for each output frame, advance it by one frame (1000/30 ms), wait two animation frames, take a screenshot; hide UI panels with a style tag when filming the scene only.
  3. Encode with ffmpeg at the game's rate (`-framerate 30`, libx264, yuv420p, a CRF around 22-24, `+faststart` for the web).
  4. Contact sheets: `fps=N/duration`, scale, `tile=4x2` (or `xstack` for labelled grids).
- **Pitfalls:** faking the whole clock (Playwright's clock API) froze screenshots; Playwright clears `test-results/` on every run (copy films out); recorded video from software rendering plays at 0.2-0.4× (if recording real-time video instead, retime with `setpts=<game time / wall time>*PTS`); wait for game states, never fixed durations; a test run over about 10 minutes needs the background.
- **Measured:** about 150 s per 150-frame clip at 960×540 on a laptop with software rendering.

## 10. Ideal-run search, par times and size ideals
- **Purpose:** each obstacle's ideal input timing, its clearing window in milliseconds (difficulty), a par time, and the "line that would have made it" in the replay.
- **What is searched:** a recorded run is a list of input edges (key down/up with tick numbers); keep the moves and their order, nudge one or two edges in time (up to a maximum shift in ticks), replay the real simulator, keep the change when the run still clears (lands on the same box, ends the same way) and is faster; a seeded random walk (hill climbing), so the same seed gives the same result.
- **Time is measured** from the first press to the run's end.
- **Edge sensitivity:** nudge each edge 100 ms either way; an edge whose timing changes nothing is "any time" and not graded; a clearing window under about 60 ms is not a fair timing for a player.
- **Stored per obstacle:** ideal time, par time, gain, the edges, lines tried and cleared, the landing box, the outcome, the free edges; per course size (XS to XXL): status (ideal still clears, a searched line clears, or none), outcome, box, time, the changed parameters, total ticks, edges, and each press's window in ms.
- **Pitfalls:** after any change to an obstacle or a default, every stored ideal goes stale and must be searched again; a full size search took about 13 minutes on a laptop.

## 11. Blind-test pages
- **Purpose:** decide looks by evidence: the product owner judges unlabelled versions.
- **Steps:** physics checks run first (only clips that pass are shown); pairs of clips of the same move on the same character, viewer and camera, at true speed (pipeline 9); the order inside each pair shuffled with a fixed seed and the key kept out of the page; trim clips to the same window (for example from 40 frames before take-off to 30 after landing) so length doesn't give a source away; per pair, "which looks better?" and "which is real?" (or a similar question) plus optional notes; a "copy answers" button produces text to paste back; reveal from the key afterwards.
- **Results so far:** Kimodo leaps preferred to CMU mocap 3/3 ("mocap jumps look weak"); Unity and Godot judged the same.
- **Pitfall:** without trimming, the generated clips were noticeably longer than mocap; keep obstacles, if any, drawn in both versions.
