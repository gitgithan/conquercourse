# Where the models are weak: challenging inputs we hit (CC-133)

*Written 2026-11-03 for Meta's reviewers and for anyone judging what our product can promise.*
*Every number below is copied from a tracked file in this repo; each row links the file.*
*Where the repo does not say, the row says "not recorded".*
*Rows marked "practice project" come from `docs/experiments.md`, which holds knowledge from before this repo (see `docs/PRIOR-WORK.md`), not runs made here.*

## So what
- Our product does not depend on any one model being right.
  - A model proposes; a cheap check, the simulator or the player decides.
  - That is why the weak spots below cost us a worse picture or a slower step, and never a broken course.
- Eight weaknesses shape the design, and each one has a route-around that is already in the product:
  - Thin or edge-on things (bars, rails, strings, steps) lift badly: collision is always a plain shape and the mesh is only a skin (`docs/lessons.md`).
  - The finder (SAM 3 text phrases) misses things it was not asked about: it asks 17 phrases per photo and the player clicks the result.
  - Single-photo size is a guess: size comes from a typed or typical height, never from the model.
  - Video body scale and depth are noisy: no motion is shown before the plausibility gate passes it, and 4 of 4 Pexels test clips failed it.
  - Kimodo has no hangs and cannot lift the hips 4.3 m: the hang, swing and bar motion come from motion capture or from our own procedural clips.
  - The safety check is a language model: it fails closed (any error becomes "review") and a person looks at the rest.
  - Photo triage by a model was wrong on 11 of 14 photos: the lift itself, at about 1 cent, is the gate.
  - People SAM 3 misses stay visible: we say so in `docs/trust-and-safety.md` and reject close-up people on street photos.
- The biggest open weakness for the demo is the finder on thin overhead bars (today's case, section C).
  - On the monkey-bars photo no outline touched either bar pattern.
  - The product still makes the lift when a box is given, so the demo shows it from a lab box and says so.
- Next step, cheap and not yet run: crop to the bar region and re-run the finder, then try more phrases (section D, options 1 to 3).
- Folded in (CC-133, 2026-11-03): the finder now also asks for "overhead bars", "metal bars" and "bar grid", and keeps an outline for those three only if it is wide and low (box width 120 px or more, wide:high 2.5 or more, height 160 px or less).
  - Result on photo 2 with the redeployed finder: 12 outlines, and one is now bar-labelled, "overhead bars" (score 0.46, a wide low box at the left bar pattern, about 300 x 27 px in the 1280 px copy); before, none touched a bar pattern. The right-hand bar pattern the lab box covers is still not found.
  - Not folded in: the upper-half second pass, upscaling and tiles (see `data/eval/crop-finder/README.md`).
  - From recorded job times (1.1 to 4.2 s per finder run in `data/eval/demo-lifts/run.json`) a few dozen finder runs are cents of GPU time, plus a cold start of about 14 s.
  - Nothing in this page was run on a paid job.

## How to read this page
- Section A: one row per model, with the hard input, the measured failure, the evidence and what we do about it.
- Section B: the same facts by what a player or judge cares about (photo to obstacle, privacy, safety, motion, character, map, tips), so you can enter from either side.
- Section C: one worked case, the monkey bars on photo 2.
- Section D: ways to extract thin or edge-on objects more cleanly, marked TRIED or NOT TRIED.
- Section E: places where two docs disagree.
- Section F: weaknesses we did not measure.

## A. By model

### A1. Meta models

| Model | Job in our product | Hard input | What went wrong (measured) | Evidence | What our product does about it |
|---|---|---|---|---|---|
| **SAM 3** (open weights, Modal) and **SAM 3.1** (Meta API): the finder | "Segment Objects" outlines things in a player's photo; one text phrase per pass, 17 phrases | Thin overhead bars seen from the side (monkey bars, photo 2) | Not found; 12 outlines came back: 9 poles, 2 walls, 1 weak "pull-up bar" (0.37) in the wrong place; no bar-labelled outline overlaps either bar pattern | [demo-lifts README](../data/eval/demo-lifts/README.md), [overlap numbers](../data/eval/demo-lifts/finder_vs_red_boxes.json) | The 3D maker accepts a box and a name; the demo uses a lab box (section C) |
| SAM 3 / 3.1 finder | Same | A phrase the model does not know for that object | Core five phrases found something useful on 8 of 10 park photos; 9 of 10 after adding `platform`, `handrail`, `concrete block`; nothing on a net-and-sand playground | [sam31-park](../data/eval/sam31-park/README.md) | Many phrases per photo, merged by overlap, at most 12 shown |
| SAM 3 / 3.1 finder | Same | Label mismatch and too many pieces | `wall` also painted a ledge-like bank; `concrete block` returned 43 pieces on one wall; `steps` and `stairs` found nothing on balustraded stairs while `handrail` found both rails | [sam31-park](../data/eval/sam31-park/README.md) | Overlap merge (IoU 0.6), small pieces dropped, cap of 12 |
| SAM 3 finder | Same | A wide, sagging wire (string lights, photo 1) | First run: no phrase found it; after adding "string lights" it is found (0.61, a wide strip); a second hit at 0.35 | [suggest.json photo 1](../data/eval/demo-lifts/suggest/photo1/suggest.json), [README rerun note](../data/eval/demo-lifts/README.md) | Phrase list now includes it; the lift of it is still weak (see SAM 3D Objects) |
| SAM 3 mask step | Mask for the lift, text first, box prompt as fallback | An object that fills the frame or touches the photo edge | A painted wall was lifted as a table until the photo was padded 1.5 times; the mask-touches-edge check flagged the wall and the second mural | [cc-38](../data/eval/cc-38-photo-to-3d/README.md), [cc-145](../data/eval/cc-145-triage-v2/README.md) | Pad and retry (CC-170); the test for it was weak: only 1 of 5 finished pairs touched the edge, so the gain is **not shown** ([cc-170](../data/eval/cc-170-pad-retry/README.md)) |
| SAM 3 mask step | Same | Text phrase finds nothing under the box | For the monkey bars the text prompt under the lab box had 0 candidates; the box prompt gave a mask (score 0.91) | `lifts/p2_monkey_bars/lift.json` in [demo-lifts](../data/eval/demo-lifts/README.md) | Falls back to the box alone, then to the plain box |
| SAM 3 privacy blur | Blur people, pixelate faces and plates before any other model sees an upload | A person or face SAM 3 does not find | Recorded as a limit, no miss rate measured; on photo 1 SAM 3 blurred 10 people and 6 faces while a separate detector counted 12 people (different detectors and thresholds, so not proof of a miss) | [trust and safety](trust-and-safety.md), [people check](../data/eval/demo-lifts/people_check.json), [run.json](../data/eval/demo-lifts/run.json) | The page says unfound people stay visible; the safety check also looks at the photo; EgoBlur is named as a possible second blur, not used ([model ledger](model-ledger.md)) |
| SAM 3 privacy blur | Same | Busy photos with plates and people | In 14 hard photos people and plates in the scene were blurred and did not break the lift | [cc-upload-hard-set](../data/eval/cc-upload-hard-set/README.md) | Nothing needed |
| SAM 3.1 (video frames) | Obstacle outlines in the video-ingest pipeline | A wall run with a panning camera | Returned a `platform` 1.69 m high (box 480 x 225 px) and two thin poles instead of the 4.3 m wall | [cc-29](../data/eval/cc-29-video-ingest/README.md) | Clip not used; ingest keeps `--known-height` unused when the top is out of frame |
| SAM 3.1 (character cut-out) | Cut the figure out of a Muse Image picture | Thin limbs on a blob character | 7 of 8 masks good; the potato blob scored 0.53 and lost its noodle arms; 12 to 17 s a call | [cc-char-muse](../data/eval/cc-char-muse/README.md), [community characters](community-characters.md) | The blob still plays; the load-time fit clamps arms (hand gap 0.16 m left for the blob) |
| **SAM 3D Objects** | Photo plus mask to a textured 3D piece | Steps and stair-like things | Steps came out as a slab; 9-photo round: 7 of 9 "yes" or "partly", steps and a thin strip failed | [cc-38](../data/eval/cc-38-photo-to-3d/README.md), [pipelines](pipelines.md) section 7 | "Leave steps out"; the editor builds steps from our own pieces |
| SAM 3D Objects | Same | A thin, long strip | A shadow strip was lifted as a slab and scaled to 33 m by its typical height; the 33 m slab was refused for size | [cc-38](../data/eval/cc-38-photo-to-3d/README.md), [object-bakeoff](../data/eval/object-bakeoff/README.md) | Box is checked before the lift; `lift_check` compares mesh and mask shape |
| SAM 3D Objects | Same | Rails and railings | Split-rail fence: rails came out as one heap (not shipped); picnic table, canal railing "partly" (thin); boom barriers too thin | [cc-110](../data/eval/cc-110-real-objects/README.md) | Not shipped; hang bars are placed with a hold bar at the real crossbar height |
| SAM 3D Objects | Same | Hard photos (clutter, two parts, thin frames) | Hard set of 14: 9 usable, 3 partly, 2 bad (64% usable, 86% at least partly); bad: a bike-rack tangle (bikes lost, flat grid) and skate stairs (two slabs); the lift check flagged the stairs | [cc-upload-hard-set](../data/eval/cc-upload-hard-set/README.md) | Plain failure reason and a retry; the audit says none of the first 19 objects came from a hard photo |
| SAM 3D Objects | Same | Monkey bars from the side | Medium: loops show from above, flat dark plank from the side | [demo-lifts](../data/eval/demo-lifts/README.md), [turntables](../data/eval/demo-lifts/evidence/lifts_turntables.jpg) | Primitive bar for collision; show the plan view |
| SAM 3D Objects | Same | Monkey-bars frames from clear photos (CC-133, bar-photos) | 7 of 8 photos gave a usable frame with posts and separate rungs (2 of them rated 5 of 5); 1 failed where posts hide the bars; the finder outlined the whole frame on 4 of 8 under "pull-up bar" | [bar-photos](../data/eval/bar-photos/README.md), [turntables](../data/eval/bar-photos/evidence/lifts_turntables.jpg) | Use a clear three-quarter photo; plain bar for collision |
| SAM 3D Objects | Same | String lights | Weak, recognisable only from far; `lift_check` flagged it (aspect 8.4 against mask 18.7); no collision | [demo-lifts](../data/eval/demo-lifts/README.md) | Leave it out or use as far scenery |
| SAM 3D Objects | Same | Real-world size from one photo | One photo's depth gets proportions right and size wrong (a bench at a third of its size); monkey bars typed 2.4 m came out 52 m wide because height is the thin side | [pipelines](pipelines.md) section 7, [demo-lifts](../data/eval/demo-lifts/README.md) | Size comes from a typed or typical height; check the box before the lift |
| SAM 3D Objects | Same | A cold GPU container | The client stream dropped (robot cat 3 tries, jellyfish 1; hard-set runs stalled on the laptop link) | [cc-char-muse](../data/eval/cc-char-muse/README.md), [cc-upload-hard-set](../data/eval/cc-upload-hard-set/README.md) | Spawn and poll with retries (CC-221) |
| **SAM 3D Body** (with MHR, DINOv3 encoder) | Measure a body from filmed moves | Small or far runner, panning or hand-held camera | Depth jumped by metres for a far runner; 3 of 4 Pexels clips had moving cameras; the 4 clips all fail the shared gate | [pipelines](pipelines.md) section 1, [cc-26](../data/eval/cc-26-pexels-motion/README.md) | Nothing is shown before the gate; use still, side-on, landscape clips |
| SAM 3D Body | Same | Real height and scale | Flights fit 13 to 18 m/s² (heights 30 to 80% too big or timing off); athletes measured 2.44 m and 2.90 m; default focal 800 px adds error | [cc-26](../data/eval/cc-26-pexels-motion/README.md), [cc-29](../data/eval/cc-29-video-ingest/README.md) | Reject athletes above 2.2 m is a next-step item, **not built** |
| SAM 3D Body | Same | Hanging or held body (monkey bars, wall) | Monkey-bars clip: 0.73 s with nothing the gate accepts as holding the body (limit 0.6 s); brick wall 1.23 s; a brief 0.1 s foot plant never looks still | [cc-26](../data/eval/cc-26-pexels-motion/README.md), [cc-41](../data/eval/cc-41-mhr-look/README.md) | Hang and swing ship from motion capture; bar motion is procedural ([bar-motion](../data/eval/bar-motion/README.md)) |
| SAM 3D Body | Same | Person upside down, head-on roll | "A flipped body when the person is upside down"; a head-on roll failed the roll check until the turn was read along the hips' travel; the real roll clip still fails (air time 0.30 s against 0.25 s) | [motion from you](motion-from-you.md) | Check not loosened; "My move" is off by default and refuses a failed clip |
| SAM 3D Body (MHR body shapes) | Custom look from shape numbers | Height | Height barely moves with the 45 shape numbers (about 3 cm at 3 standard deviations); MHR rests in an A-pose, the Rookie in a T-pose | [cc-41](../data/eval/cc-41-mhr-look/README.md) | Scale the whole rig for height; T-pose fix listed as the blocker |
| **MoGe 2** (depth and lens) | Focal length for video; point map inside SAM 3D Objects | A short flight or a wobbling depth | Vertical scale stays the weak part even with MoGe's focal length; "a depth that wobbles" | [cc-26](../data/eval/cc-26-pexels-motion/README.md), [motion from you](motion-from-you.md) | Smooth depth over a short stretch; no height trusted without a gate pass |
| **Muse Spark Open** (Baseten): upload safety check | ok, review or block for every upload | Unusual or tricky content | 37 of 38 must-flag runs not "ok"; the miss was an invented street sign with a house number; a valid 1 x 1 white pixel returns "ok"; child safety **not tested** on purpose | [cc-120-safety-real](../data/eval/cc-120-safety-real/README.md) | Fails closed; human queue; real child-safety content needs hash-matching services, not this model |
| Muse Spark Open: safety check | Same | Lawful borderline art and history | 2 of 23 must-pass runs held for review (a Botticelli, one David photo); Nazi-era history photos 3 of 3 blocked, which also blocks lawful history | [cc-120-safety-real](../data/eval/cc-120-safety-real/README.md) | Review, not block, for art; blocked history stays a known cost |
| Muse Spark Open: safety check | Same | Prompt injection | Never turned a bad verdict into "ok" in 8 of 8 combined runs, but a safe photo plus injection text was "ok" 5 of 5 (not detected as an attack, only outweighed) | [cc-120-safety-real](../data/eval/cc-120-safety-real/README.md) | The caption can only make the answer stricter |
| Muse Spark Open: safety check | Same | Run-to-run variation and time | Same cartoon "review" twice and "block" once; median 7 s, p90 36 s, max 78 s per call (the demo's photo 2 took 88.9 s) | [cc-120-safety-real](../data/eval/cc-120-safety-real/README.md), [demo-lifts run.json](../data/eval/demo-lifts/run.json) | Anything that must always be refused should not hang on one answer; second pass is a recommendation, not built |
| Muse Spark Open: safety check | Same | The first prompt | v1 caught 4 of 7 unsafe text cases (it ignored captions); v2 caught 7 of 7, tuned on the same set | [cc-119-moderation](../data/eval/cc-119-moderation/README.md) | v2 shipped; set is small, no rate can be claimed |
| Muse Spark Open: photo triage | Predict whether a photo will lift well | Crops, clutter, odd angles | Agreed with what really happened on 3 of 14; rejected or downgraded 9 of the 10 that lifted well; on the cut-out it said "block" on 14 of 23 photos (5 lifted well) | [cc-123](../data/eval/cc-123-photo-triage/README.md), [cc-145](../data/eval/cc-145-triage-v2/README.md) | Not used as a gate; "lift it and look" is the gate; free mask-edge check drives pad-and-retry |
| Muse Spark Open: move tips | Which of our moves get past this object | An object seen without a size | Key move listed 13 of 19, first 13 of 19 after one prompt tuned on the same 19 objects; the model sees a photo, not a size | [cc-119-move-tips](../data/eval/cc-119-move-tips/README.md) | Moves outside our list are dropped; tips are only for new objects |
| Muse Spark Open: designer | Course layouts in the editor | Asking for many layouts | One call median 14.8 s, max 38 s; of 100 asks, 95 gave a layout and 33 cleared in the simulator; only 3 move sets, no vault or climb | [cc-122](../data/eval/cc-122-bulk-courses/README.md) | The simulator proves every layout; "Make me a new course" draws from a pre-proven pool |
| Muse Spark Open: Course Agent | Repair loop with the simulator as the tool | Photo-in drafts | 40 of 40 cleared in at most 3 steps, but only photo-in runs; the photo input was dropped, so this is **not a claim about shipped code**; the 6-step cap was never reached | [cc-126](../data/eval/cc-126-course-agent/README.md) | No player entry since 2026-10-31 |
| Muse Spark Open: all calls | Hosted reasoning model | A small `max_tokens` | It reasons first and counts that against the limit: 4,000 gave an empty answer (picnic table in the tips run) | [lessons](lessons.md), [cc-119-move-tips](../data/eval/cc-119-move-tips/README.md) | One retry with 8,000 |
| Muse Spark Open: all calls | Same | Idle host | 6 calls over 21 minutes showed no cold start; nothing is known for gaps over 15 minutes or under load | [cc-baseten-latency](../data/eval/cc-baseten-latency/README.md) | One host and one key; the fallback to the Meta API was promised and **not built** ([model ledger](model-ledger.md)) |
| **Muse Spark 1.3** (Meta API) | Vision labels in video ingest; contact targets from coaching text | Text about a wall plant; one frame every 2 s | Text guessed the wall plant at 1.15 m, the real athlete planted at 0.77 m; scan times good to about 2 s; labels are the model's, not measured | [pipelines](pipelines.md) section 6, [muan-scan](../data/eval/muan-scan/README.md) | Video measurements calibrate the text |
| **Muse Wonder** | Code review of the simulator (build time only) | The contraptions chunk | 21 claims: 13 real, 7 false alarms, 1 unclear; the contraptions chunk gave nothing; $2.38 | [cc-wonder-review](../data/eval/cc-wonder-review/README.md) | Every claim checked by a test; not a game feature |
| Muse Wonder vs Spark Open | Photo triage comparison | Same photos | Wonder no more accurate than Spark Open, 2 to 3 times the cost per photo | [cc-145](../data/eval/cc-145-triage-v2/README.md) | Neither is a gate |
| **Muse Image** and SAM 3.1 (character maker) | One sentence to a picture, a cut-out and a mesh | Strange figures | Clean full-body picture 8 of 8; all 8 characters moved; 3 of 8 faced backwards because our yaw step fits a box with no front (the picture was fine); a figure with no T-pose (snake, dog on four legs) would fit badly | [cc-char-muse](../data/eval/cc-char-muse/README.md), [cc-chars-facing](../data/eval/cc-chars-facing/README.md), [community characters](community-characters.md) | Load-time fit turns back-facing skins; the preview shows the fit before publish; fallback to Rookie A |
| **Mapillary** (Meta-owned street photos) | Real photos beside real places | People and faces | Mapillary's blur can miss a face or a child; a strict "no person" rule threw away 90% or more of busy-street photos; at the chosen limit 0.2, coverage is 72% at Montmartre and 88% at Eixample; a big search box returned a third of photos or fewer with no error | [trust and safety](trust-and-safety.md), [cc-90-no-filter](../data/eval/cc-90-no-filter/README.md), [lessons](lessons.md) | Close-up or large people rejected (0.2 of picture height); photos never stored; tiles of about 50 m |
| **MusicGen** (AudioCraft) | A loop per screen | Licence and licence of the weights | Weights are CC BY-NC 4.0; AudioCraft's pip package failed to build; judged by measured wrap and brightness, not by a listening test | [music](music.md), [meta-ai-pipelines](meta-ai-pipelines.md) | Demo only; "swap before a sale" in `docs/ASSETS.md` |
| **Muse Glimmer** with SAM 3 (practice project) | Find "somewhere safe to land" in a photo | Open-ended affordance questions | 7 to 9 masks proposed, 0 kept by the check | [experiments](experiments.md) | Not used |
| **V-JEPA 2** (practice project) | Flag impossible physics by "surprise" | Possible against impossible clips | Peak error 2.02 to 2.06 for both, no separation | [experiments](experiments.md) | Not used; the simulator is the judge |
| **DINOv3** and gated Meta weights | Encoder inside SAM 3D Body; needed by TRELLIS.2 and Pixal3D | Gated access | 403 for the project's account; both rival lifters were never run | [object-bakeoff](../data/eval/object-bakeoff/README.md) | SAM 3D Objects is the only object source with results |
| **SA-3DAO** dataset (Meta) | Possible parkour terrain | Access and licence | No script-reachable download; licence CC BY-NC 4.0; nothing downloaded | [cc-45](../data/eval/cc-45-sa3dao/README.md) | Research-only unless asked |

### A2. Models that are not Meta's

| Model | Job in our product | Hard input | What went wrong (measured) | Evidence | What our product does about it |
|---|---|---|---|---|---|
| **Kimodo** (NVIDIA, with a Llama 3 8B text encoder) | Generated motion (roll, slide) | Hangs and monkey bars | Hands stay near 1.1 m instead of the 2.2 m rungs (grip error about 1 m); travel 3 of 8 pass the gate and 0 of 8 the bar check; Kimodo has no hangs in its training labels | [bar-motion](../data/eval/bar-motion/README.md) | Procedural bar clips ship |
| Kimodo | Wall run-up | A rise of 4.3 m | Tracked the run within 5 cm but ended 2.4 m too low in all 8 seeds of round 1; at most 2 of 8 pass lines in 16 samples; its own bodies jitter above about 2.5 m of rise | [cc-17-wall](../data/eval/cc-17-wall/README.md), [lessons](lessons.md) | No wall clip ships; the wall is composed from run and reach clips |
| Kimodo | Swing and vault from key poses | A body held by a bar or box | Hang passes 4 of 4 seeds, swing 0 of 8, vault 0 of 4 | [pose-kimodo](../data/eval/pose-kimodo/README.md) | Motion capture keeps run, leap, land, hang, swing |
| Kimodo | Slide | Prompts | 1 of 36 samples shows a real low slide; most prompts run on with a dip | [motion-slide](../data/eval/motion-slide/README.md) | That one sample ships; a bone-built crouch is the fallback |
| Kimodo | Roll | Text only | 4 passing rolls in 18 samples (CMU has no forward roll) | [lessons](lessons.md) | The 4 passing rolls ship |
| Kimodo | Anything with obstacles | Obstacle boxes | "It has no idea obstacles exist"; text alone cannot make unusual gravity | [lessons](lessons.md), [pipelines](pipelines.md) | Push out of boxes late in denoising, then IK |
| **CMU motion capture** (data) | Run, leap, land, hang, swing | Hand-over-hand, forward roll | 22 hang stretches, 0 pass the travel check; no forward roll; "mocap jumps look weak" in a blind test (Kimodo chosen 3 of 3) | [bar-motion](../data/eval/bar-motion/README.md), [lessons](lessons.md) | Procedural bars; Kimodo roll |
| **Tripo** (3D service) | Both Rookie meshes | Rigging | Front reversed (knees backwards) and a shoulder 10 cm above the arm until measured from the mesh; 110 credits a character, 60 left | [lessons](lessons.md), [object-bakeoff](../data/eval/object-bakeoff/README.md) | No Tripo code in the game |
| **PartLLM** (practice and CC-49) | Find hang points on meshes | Absent parts | 2 of 9 real parts found, 11 of 13 "absent" prompts got a part anyway | [world-slice](world-slice.md), [partllm answer key](../data/eval/partllm/answer-key.json) | Holds are placed by hand or by proved bar tools |
| **MediaPipe Pose** | Read key-pose pictures | Side-view mannequin | Front picture found 4 of 4, side picture 1 of 4 | [pose-kimodo](../data/eval/pose-kimodo/README.md) | Authored joints used instead |
| **Faster R-CNN / Mask R-CNN** (torchvision) | People size rule on street photos | A small, far figure | Rule is size only; the detector can miss a person | [trust and safety](trust-and-safety.md) | Mapillary's blur is the base layer |
| **TRELLIS.2, Pixal3D, Hunyuan3D** | Rival photo to 3D | Gated weights, licences | Not run: DINOv3 gated; TRELLIS.2 also needs a gated cut-out model; Hunyuan excludes the EU, UK and South Korea | [object-bakeoff](../data/eval/object-bakeoff/README.md) | Not used |

## B. By what it is for

| Use | Models | Where it is weak (short) | Where to read | What the player or judge sees instead |
|---|---|---|---|---|
| Photo to obstacle: find things | SAM 3, SAM 3.1 | Thin overhead bars, wires, phrases it was not asked | A1 finder rows, section C | A clickable outline list; a lab box in the demo |
| Photo to obstacle: lift | SAM 3D Objects, MoGe 2 | Thin, stair-like, cluttered or two-part things; size from one photo | A1 lift rows | A skin on a plain collider; typed height |
| Photo triage | Muse Spark Open, Muse Wonder | Wrong on 11 of 14; blocks good photos | A1 triage rows | Lift and look; pad and retry |
| Privacy blur | SAM 3 | Misses stay visible; miss rate not recorded | A1 privacy rows | A stated limit; close-up people rejected on street photos |
| Safety check | Muse Spark Open | One miss in 38; slow (7 s median); child safety untested; run-to-run variation | A1 safety rows | Fails closed; review queue |
| Motion from video | SAM 3D Body, MoGe 2, SAM 3 | Scale, depth, camera, hangs, upside down | A1 body rows | Gate first; only 2 of 12 shipped clips are from video |
| Generated motion | Kimodo, Llama 3 encoder | No hangs; cannot rise 4.3 m; keys ignored for swing and vault | A2 Kimodo rows | Mocap and procedural clips |
| Bars and hangs | Kimodo, CMU, SAM 3D Body | All three fail hand-over-hand | A2, [bar-motion](../data/eval/bar-motion/README.md) | Procedural bar clips |
| Character | Muse Image, SAM 3.1, SAM 3D Objects, Tripo | Thin limbs; facing; no-T-pose figures | A1 character row | Fit at load; preview; Rookie A fallback |
| Map and world photos | Mapillary, torchvision detectors | Blur misses; short search boxes; coverage | A1 Mapillary row | Live photos, never stored |
| Design and course repair | Muse Spark Open | 33 of 100 cleared; slow; thin variety | A1 designer rows | Simulator proof; pre-proven pool |
| Tips and feedback | Muse Spark Open | Tuned on its own set; no size sense | A1 tips row | Moves limited to our list; no coaching of technique |
| Code review | Muse Wonder | 7 false alarms of 21; nothing on contraptions | A1 Wonder row | Every claim tested |
| Music | MusicGen | NC licence | A1 music row | Demo only |

## C. Today's case: monkey bars on photo 2

Folder: [data/eval/demo-lifts](../data/eval/demo-lifts/README.md).

### The two pictures are two different stages
- `evidence/photo2_segment_objects.jpg` is the output of the **finder** (Segment Objects, SAM 3 text phrases).
  - Each coloured outline carries its phrase and score.
  - It shows what the finder outlined, accepted or not, and it shows no lifts.
  - It has 12 outlines: 9 poles (0.59 to 0.69), 2 walls (0.52, 0.39) and one "pull-up bar" (0.37).
  - The picture holds exactly 12 outlines and `MAX_ITEMS` in `pipelines/ccpipe/suggest.py` is 12, so a lower-scoring bar outline may have been cut by the cap; the raw per-phrase candidates were not saved, so this is **not recorded**.
- `evidence/lifts_turntables.jpg` is the **lift** stage (SAM 3D Objects), six turning views per object.
  - `p2_monkey_bars` and `p2_pullup_bar` were run from boxes the lab script drew.
  - When this was written the product had no player box tool; since 2026-11-03 it has **Mark it yourself** (`docs/community-flow-guide.md`), which shows a box-prompted cut-out first and lifts only after the player presses Use this.
  - Lab lifts must follow the same order: cut-out picture first (`evidence/maskbox_*.jpg`), then the lift.
  - For the monkey bars the text prompt under the lab box had 0 candidates, so the mask came from the box prompt (score 0.91).

### What the finder missed, with numbers
- The product owner marked two bar patterns with red boxes on a copy of the evidence picture.
  - Loops across the top.
  - A grid of bars on the left.
- The red boxes were read by eye from a copy shown at about 1010 x 760; they are rescaled to the finder's 1280 x 960 picture (factor 1280 / 1010), so they are **approximate, a few pixels either way**.
  - Loops: x 570 to 1039, y 264 to 375.
  - Left grid: x 57 to 406, y 345 to 425.
- Script: [finder_vs_red_boxes.py](../data/eval/demo-lifts/scripts/finder_vs_red_boxes.py); output: [finder_vs_red_boxes.json](../data/eval/demo-lifts/finder_vs_red_boxes.json).
  - It compares boxes only, since the cut-out masks are not tracked.

| Red box | Share covered by any finder box | By a bar-labelled outline | Best IoU with one finder box | Which outlines touch it |
|---|---|---|---|---|
| Loops across the top | 4% | 0% | 0.02 | two pole uprights, a sliver each (1.3% and 2.7% of the box) |
| Left grid | 18% | 0% | 0.05 | five pole uprights (0.9% to 7.7% each) |

- Plain reading: no outline labelled "pull-up bar" or "monkey bars" touches either pattern, so "zero overlap" is true for the bars.
  - Pole boxes do cross the red boxes at their edges, because uprights hold the bars; those are the posts, not the bars.
  - The one "pull-up bar" outline (box 246, 288 to 554, 316) is a top rail of the left frame, just left of the loops box, and above the left grid box.
- The lab box that was sent for the monkey-bars lift (551, 288 to 1222, 349) covers 55% of the loops red box and none of the left grid.
  - The left grid was never lifted.
  - The loops box is taller than the lab box (y 264 to 375 against 288 to 349), so part of the loops are not in the lifted mask; this is by-eye geometry, **not a measured loss**.
- Why the finder may have missed (reasoned, not tested):
  - The bars are thin dark-on-sky lines a few pixels wide in a 1280 px picture.
  - They sit among tree branches and a building.
  - "Monkey bars" is a play-equipment name, and the loops are a different shape from a ladder.
  - The score floor is 0.35 for a phrase; a weak hit under it is dropped.

## D. Other ways to extract thin or edge-on objects more cleanly

Each option: what it is, expected gain, cost, risk, and whether we have run it.
Costs use recorded job times: a finder run is 1.1 to 4.2 s on an L4 at about $0.80 an hour, a lift is about 8 to 15 s on an L40S at about $1.95 an hour, and a cold start adds about 14 s (L4) or 46 s (L40S) (`data/eval/demo-lifts/run.json`).

| # | Option | Status | Expected gain | Cost | Risk |
|---|---|---|---|---|---|
| 1 | Crop to a region, then re-run the finder | **TRIED 2026-11-03**: upper-half crop alone does nothing (loops IoU 0.20, not in top 12); with the new phrases and the shape check it puts the loops at rank 2 (IoU 0.40); see [crop-finder](../data/eval/crop-finder/README.md) | More pixels per bar, so thin bars may pass the 0.35 floor | A crop and one finder run each; cents for dozens | The crop must come from somewhere: a person, or a coarse first guess; a bare crop adds a decision step |
| 2 | Tiles or sliding-window crops over the whole photo | **TRIED 2026-11-03**: nine 2x tiles, 22.5 s, loops rank 7 (IoU 0.34), left grid not found; 2x upscaling of the full photo did nothing; not worth the cost | Finds small things without a person choosing | 6 to 12 finder runs per photo, about 10 to 30 s | More false outlines (a wall gave 43 pieces once); needs the merge rule and the cap of 12 to cope |
| 3 | More phrase variants ("overhead ladder", "horizontal ladder", "bar grid") | **TRIED**: "monkey bars" and "string lights" added earlier on 2026-11-03 (string lights found, monkey bars not); on 2026-11-03 the eight new phrases were tried: "overhead bars" and "metal bars" find both patterns (scores 0.25 to 0.57), "overhead ladder", "horizontal ladder" and "bar grid" find almost nothing (4 to 6 hits) | Cheap; extra phrases rescued photos before (`platform`, `handrail`, `concrete block` took 8 of 10 to 9 of 10) | One extra finder pass per phrase | Each phrase adds time and more outlines under the cap of 12 |
| 4 | SAM 3 with exemplar (visual) prompts | **NOT TRIED** (the repo uses text and box prompts only) | Shows the model what a bar looks like instead of naming it | A few lines of code and a sample crop; the exact SAM 3 interface is **not recorded** in this repo | Needs an example crop per bar type |
| 5 | Box or point prompts | Box: **TRIED** (what the lab did; mask score 0.91 for the monkey bars, 0.93 for the pull-up bar). Point: **NOT TRIED** | Works when a box exists; the lift came out medium and good | Free once a box exists | The product has no box tool; box height must be typed right (52 m wide at 2.4 m) |
| 6 | Classic computer vision proposals (edges, Hough lines, colour thresholds for galvanised metal against sky) used only to draw a candidate box | **TRIED 2026-11-03 (Hough lines only)**: one box over the whole upper half, IoU 0.11 and 0.06; colour thresholds not tried | Cheap on CPU; thin lines are what these methods are good at | A small script; CPU only, so it could be run free | Trees and the building also make lines; metal colour changes with light |
| 7 | Depth from MoGe to find thin structures | **NOT TRIED** as a finder (MoGe already runs inside the lift) | Separates bars in front from trees behind | A depth pass is a GPU job, about seconds | Depth at thin lines is the weakest part of any depth map; "a depth that wobbles" is recorded |
| 8 | Rectify perspective (homography) before lifting | **NOT TRIED** | A frontal view of a long bar row; the lift may see rungs rather than a plank | A homography needs four points a person picks, or an estimate | Wrong points warp the picture; the lift model was not shown warped photos |
| 9 | Lift from a top-down or second photo | **NOT TRIED** (the lift's own top view was used for the film, not a second photo) | The loops show from above | Needs a second photo | Few park photos have an overhead view |
| 10 | Lower the score threshold, with a geometry sanity check | **TRIED 2026-11-03**: the shape check (width 120 px or more, wide-to-high 2.5 or more, height 160 px or less) is the biggest single gain; a floor of 0.10 to 0.20 is needed only for the left grid. Before the trial: today's floor is 0.35 per phrase and 0.3 inside the model | Weak real hits (the pull-up bar was 0.37) may surface | Free in code, one finder run to see | More false hits; the sanity check (a long thin shape between two uprights) must be written |
| 11 | Clean primitive bar for collision, mesh for looks | **TRIED** (demo-lifts rows use a primitive bar for monkey bars and pull-up bar) | Collision is right even if the mesh is weak | Free | The look stays medium for thin things |
| 12 | A player "mark it yourself" box | **BUILT** (CC-133, owner decision 2026-11-03, switch `markbox`, on by default); it reverses the old rule "you never draw a box" | The most direct fix for anything the finder misses | A box tool in the Pick step | Adds a step for the player; the lab box already shows the lift works from one |

- Suggested order if the product owner agrees: 1, 3, 10 and 6 first (cheap, no new player step), then 2, then 4 (exemplars) if those fail, and 12 last.
- Results of the crop-finder trial (options 1, 2, 3, 6, 10; one photo, one L4 run of about $0.04): [data/eval/crop-finder](../data/eval/crop-finder/README.md).
  - Works: new phrases ("overhead bars", "metal bars") plus the shape check, on an upper-half crop: the loops come out at rank 2 of 12 (IoU 0.40); the left grid only at rank 12 and only at a floor of 0.10 to 0.20 (IoU 0.57).
  - Does not work: 2x upscaling, nine tiles (22.5 s), Hough lines.
  - Recommendation: add the phrases and the shape check to the finder; a second pass over the upper half is a switchable option, not proven beyond this photo.
  - Still untried: options 4, 5 (point), 7, 8, 9.

## E. Places where the docs disagree

- Checked and fixed on 2026-11-03 (CC-133), deciding each from the saved data:
  - Stale demo files: `data/eval/demo-lifts/run.json`, `objects.json`, the README top and `photo1_segment_objects.jpg` now say the rerun finds "string lights" (0.61 and 0.35).
  - Real harmful images: `docs/trust-and-safety.md`, `docs/meta-ai-pipelines.md` and `docs/model-ledger.md` now give the CC-120 result (37 of 38 must-flag not "ok"); child safety is still untested.
  - Street-photo masking: `docs/meta-ai-pipelines.md` section 6 now states Mapillary's blur plus the 0.2 height limit, and no masking by us.
  - Safety latency: the worst call seen is 88.9 s (demo photo 2); CC-120 had 78 s over 84 calls.
    - Both now say so.
  - Thin things: `docs/lessons.md` now says "fail as a good skin", still placeable.
  - Hand-drawn box: settled by the product owner on 2026-11-03; the guide has "Mark it yourself" and the demo-lifts README no longer calls the lab box "the flow's fallback".
  - Also fixed: `docs/spec/SPEC.md` privacy masking is SAM 3; `docs/pipelines.md` section 7 mask stage runs on L4 (scaledown 60 s).
- Still open:
  - **People in photo 1.**
    - 12 by the size rule (Faster R-CNN) against 10 blurred by SAM 3.
    - Only SAM 3's counts were saved, not its boxes, so whether it missed any is not recorded; answering it needs one more run of the privacy step on a GPU.

## F. Weaknesses we did not measure
- **Mask edge quality** of SAM 3 and 3.1 (only looked at by eye) and **repeat-run variation** (`data/eval/sam31-park/README.md`).
- **Miss rate of the SAM 3 privacy blur** on faces, plates and people: not recorded.
- **Muse Spark Open on a real harmful picture of a weapon pointed at a person:** only text was tested.
- **Latency under load, or after idle gaps over 15 minutes** on Baseten (`data/eval/cc-baseten-latency/README.md`).
- **The text-only Course Agent** (`docs/meta-ai-pipelines.md` section 4c).
- **MusicGen** quality beyond measured wrap and brightness; a listening test is not recorded.
- **SAM 3D Objects on photos that are cut off by the frame** (the pad-and-retry test had too few such photos; `data/eval/cc-170-pad-retry/README.md`).
- **Meta credit balance and total spent:** not written in any repo file (`docs/model-ledger.md`).
