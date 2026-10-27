# CC-29: video ingest (obstacles + motion + move recipe from a CC-licensed video)

*Serves the Warped Wall beat and the Park's "filmed move becomes motion" beat; the wall run-up and grab is the one Rookie move still missing (`data/eval/starter-clips/README.md`).*

## So what
- **Result for the game:** the real run on the three videos gave **no new Rookie move and no usable Kimodo targets yet**; both wall clips that could be measured failed the shared gate, and the third was skipped on purpose.
  - The wall run needs a steadier, closer, side-on clip (or a tripod film of our own) before a measurement can be trusted.
- **Recommendation:** make the next recipe from the **salmon ladder** (bar hops), not from these wall clips; the scan found it five times, with clean side views.
- **Next step:** ingest 96-118 s and 124-132 s of video 1 as a normal run, and for the wall use a clip with the whole wall in view and a still camera.
- **Spend:** about $1.2 in total at list prices (cap was $5); whether Modal credits cover it is still not visible from here.

## Answers
### 1. Can the 2:29-2:35 wall run serve as a starter clip or as contact targets?
- **Starter clip: no.** The shared gate says FAIL (`held_clips_are_held`: 2.64 s held with nothing the gate accepts as support, and the unrepaired `feet_dont_sink`); a clip that fails the gate does not ship.
  - It also fails the move check (plant 0.91 m, travel 3.7 m, grip 4 frames).
  - The clip's skeleton is not trustworthy: the body model measured the athlete at 2.44 m tall, the scale is about 1.4 times too big, and the camera pans and cuts away.
- **Contact targets for Kimodo: not yet either.** The fit did not find the wall at all: SAM 3.1 returned a `platform` 1.69 m high (box 480 x 225 px along the bottom) and two thin poles, so "height as a fraction of the obstacle" has no valid obstacle to divide by.
  - `--known-height` was **not** used: the 4.3 m top is never fully in view (the frame crops it at 2:32 and the camera pans), so a known-height scale would have been wrong.
  - What is usable by eye: the order of events (run-up on the curve, one foot on the face, hands to the top ledge, pull over); not the numbers.
- **Gate verdicts:**
  - 2:29-2:35 (`muan-warped-wall`): FAIL, `held_clips_are_held`; GIF: [move.gif](../muan-warped-wall/move.gif).
  - Short with Beth Lodge (`wnl-warped-wall-short`): **skipped**, no GIF; the tags say "girl" and "girl power" (the text screen skips any such tag without looking at a frame).
  - Rules video 0-38 s (`wnl-new-wall-rules`): FAIL, `held_clips_are_held` and `no_teleport` (17.6 m/s); GIF: [move.gif](../wnl-new-wall-rules/move.gif).
- **The skip on video 2 is a doubt, not a finding:** the description names an adult (UK athlete, Premier Series finals), so the tag is probably search wording, but the rule says skip on any doubt, so I did not override it.
  - To unlock it the product owner can say so in writing; the run then costs about $0.73.

### 2. What else did the scan find, and what is worth a recipe?
- Full table with time ranges: [muan-scan/README.md](../muan-scan/README.md); 21 segments, labels from the vision model at one frame per 2 s, so times are good to about 2 s.
- **Worth a recipe, best first:**
  - **Salmon ladder (bar hops), 96-118 s, 124-132 s, 176-190 s:** the same move five times, most with a side view; it would confirm the proposed `bar` primitive and teach hanging, pulling and timing.
  - **Rope and ring swings, 4 s, 24-28 s, 174 s, 192-198 s:** maps to the canonical `ropeAnchor` (pendulum) and the library already has swing clips; the 24-28 s ring swing is a clean side view.
  - **Warped wall, 148-166 s:** the clip we ran; later wall runs by other athletes in a cleaner shot would be better.
  - **Floating steps, 78 s, 170-172 s, 222 s:** short, and the scan saw one frame in two of the three, so check before spending.
- **Not worth it now:** wheels (10-22 s), sliders (32-62 s, 198-214 s) and trapeze (240-262 s) need grips and track primitives we do not have; the gap jump at 216 s has no visible landing.
- Nothing in the scan was measured, so no GIFs exist for these segments; a GIF is made when a segment is ingested.

### 3. Does the measured wall recipe agree with the videos?
- **Short answer: no, and it cannot be judged yet**, because the video measurements fail the gate and their scale is wrong.
- Reference recipe: CC-17's move check (plant 0.4-1.6 m up, grip with feet off the floor at least 0.3 s) and the CC-26 brick wall (plant 1.29 m, travel 2.24 m, grip 2.7 s); both are in `data/eval/starter-clips/README.md` and CC-26.
| Number | Brick wall (CC-26) | 2:29 warped wall | Rules video 0-38 s | Video 2 |
|---|---|---|---|---|
| Plant height as a fraction of the obstacle | not stored as a fraction (1.29 m on a 1.24 m wall) | 0.96 of a mis-fitted 1.69 m "platform" (1.62 m); about 0.38 of 4.3 m, or about 0.27 after the 1.4 times scale error | 0.83 of a 1.71 m "wall", but this is not a wall run | skipped |
| Grip time | 2.7 s | 0.2 s | 3.0 s on the first contact, not trustworthy (see below) | skipped |
| Run-up speed at the plant | not stored | 1.66 m/s (peak hip 10.3 m/s is a measurement artefact) | 0.25 m/s | skipped |
- **How well they agree:** the grip time of the first clip (0.2 s) is far from the brick wall (2.7 s), and a real warped wall run is short, so that is plausible, but the run-up speed (1.66 m/s) is far too slow for a run up a curved wall.
  - The only fair reading is "the shape of the move is the same (plant, grip, release)", not "the numbers agree".
- **Rules video:** the contact sheet (0-11 s of the clip) shows a head-mounted camera in a gym, with a person's legs close to the lens (2.9 m tall by the model) and no wall being climbed; I did not review 11-38 s frame by frame.
  - So this run says nothing about wall runs; the right fix is to pick the section of that video where someone actually climbs, which needs a scan first (about $0.12).

## What went wrong, so the next run is cheaper
- **The ingest broke at the GIF step** on this VM because `matplotlib` was not installed; I installed it and resumed from stage `seg`, which paid SAM 3.1 twice (extra $0.075).
- **The scan was refused by the cost guard** because the guard counted all 8,280 frames instead of the 138 scan frames; fixed in `pipelines/ingest_video.py` (estimate for a scan now 138 frames, $0.86; actual $0.12).
- **Body-height scale is unreliable on these clips:** it gave athletes of 2.44 m and 2.90 m; the pipeline should reject a clip whose athlete comes out above 2.2 m, and I have not added that rule (it is a next-step item, not done).

## Actual cost (list prices)
| Run | Modal | SAM 3.1 | Meta | Total | Expected |
|---|---|---|---|---|---|
| muan-warped-wall (2:29-2:35) | $0.126 | $0.15 (paid twice) | $0.006 | $0.28 | $0.31 |
| wnl-warped-wall-short | $0 | $0 | $0 | $0 (skipped) | $0.73 |
| wnl-new-wall-rules (0-38 s) | $0.69 | $0.075 | $0.012 | $0.78 | $1.06 |
| muan-scan (every 2 s) | $0.03 | $0 | $0.092 | $0.12 | $0.86 (after guard fix) |
| **Total** | | | | **$1.18** | |
- Never more than 2 Modal containers ran at once (the wall-rules measure plus the scan).

## Definition of Done
- The Linear issue's Definition of Done is **not fully met**, so no commit says "Fixes CC-29":
  - not met: one starter clip or one set of contact targets that passes the shared gate (neither does);
  - not met: the video 2 run (skipped on the adult-check rule);
  - not met: a recipe whose numbers agree with a trusted wall measurement.
  - met: the three runs and the scan with costs in `run.json`, the answers above, and a GIF for each measured move.

## Before the videos arrived (kept for the record)

- **Result for the game:** the ingest machinery is built and tested, but **none of the three videos has been processed yet**, so no Rookie move and no demo beat has been gained from them.
  - YouTube refused every download from this machine ("confirm you're not a bot"); I tried yt-dlp's default, tv, web_safari, android_vr and mweb clients with a JS runtime and stopped there.
  - I did not use cookies, proxies or download mirrors; a cookies file or the files themselves have to come from the product owner.
- **What does work (checked on real data):** on the CC-26 brick-wall clip as a stand-in, SAM 3.1 found the wall, its ledge caps and the poles with clean masks, and the fit gave the wall as a primitive with a metric height and an uncertainty (`data/eval/cc-29-fixture-brick-wall/`).
  - It is a pipeline check, not an ingest result: that clip is Pexels-licensed, not CC BY.
- **Recommendation:** send a yt-dlp cookies file (or the three downloaded videos with their `.info.json`), then run the commands below; expected spend is about $3.5 and about 133 GPU minutes over at most 3 containers.
- **Wall clip (task D), my expectation, not a result:** the 2:29-2:35 clip is most likely **contact targets for Kimodo, not a starter clip**.
  - The ingest's gate has just become stricter (see below), and a 480x480 side view has weak vertical scale (CC-26 found heights 30-80 % off).
  - The CC-26 brick-wall climb shows why: it meets CC-17's wall-run numbers (plant 1.29 m, travel 2.24 m, grip 2.7 s) yet **fails the gate** (1.23 s with nothing holding the body), so passing the move check does not make a clip shippable.
  - If the 2:29 clip passes the gate it can be a starter clip; the run will say.
- **Next step:** run the three ingests, then use the wall recipe's plant and grip points as Kimodo targets (CC-17's open wall move).

## Also done (all in this branch)
- **One gate (task E):** `pipelines/ccpipe/gate.py` is the only plausibility gate; the video code calls `run_gate_times`.
  - Effect: the strict rules now apply to video too, so CC-26's two "conditional pass" clips (monkey bars, brick wall) now **fail** `held_clips_are_held` (0.73 s and 1.23 s against 0.6 s); all four CC-26 clips fail (`gate_shared.json` in each folder).
  - Found on the way: `video_to_motion` and `ccpipe` listed the same 30 joints in different orders; motion files carry their names, so `regate.py` and the ingest pick by name.
  - `python -m pytest -q pipelines` runs clean: 77 pass, 1 expected fail (the open wall move).
- **Primitives (task B):** `docs/primitives.md` and `course/primitives.schema.json` (0.1.0): the 8 canonical primitives, roles stand/grab/vault/hazard, a curved wall as `ramp` with profile `arc` and radius, and `bar` held as proposed.
- **Move recipe (task C):** `pipelines/ccpipe/recipe.py`: phases, contact events with the primitive type and height as a fraction of the obstacle height, timing, transfer guesses, and `fit_to` for a known obstacle.
- **Cut, cost and safety (task A):** one command, cost printed first, `--max-usd` guard, licence refusal, a text screen for children, and an adult check on face-masked frames.

## How to run it when the videos are available
- Setup: `uv pip install yt-dlp pillow opencv-python-headless meta_sam_parser jsonschema numpy`; set `CC_ASSETS_DIR` to the folder that holds `video/` and `work/`; load the Meta key (`set -a; . ~/.config/ninja/meta.env; set +a`); a Modal token.
- On a machine YouTube lets in, or with `--cookies cookies.txt`, the command fetches everything itself:
  - `python pipelines/ingest_video.py https://www.youtube.com/watch?v=7soV521Xk1A --start 149 --end 155 --id muan-warped-wall --supported-by "a warped wall"`
  - `python pipelines/ingest_video.py https://www.youtube.com/shorts/NCq1BAUcXF8 --start 0 --end 24 --id wnl-warped-wall-short --supported-by "a warped wall"`
  - `python pipelines/ingest_video.py https://www.youtube.com/watch?v=hb5IOXSxqt0 --start 0 --end 38 --id wnl-new-wall-rules --supported-by "a warped wall"`
- Scan the rest of video 1 for other obstacles and moves with time ranges: `python pipelines/ingest_video.py <url> --start 0 --end 276 --id muan-scan --scan`.
- If the files were fetched elsewhere: `yt-dlp --write-info-json -o source <url>`, then pass `--info-json source.info.json --file source.mp4`.
- Add `--known-height "curved wall=4.3"` when the whole warped wall is in view (scale from its known 4.3 m); otherwise the scale is the athlete's body height (an adult at 1.75 m, about ± 8 %).
- Expected cost per run is printed before anything paid; a segment with any doubt about an adult is skipped and the README says so.

## Expected cost when the videos arrive
| Run | Frames | GPU minutes (L4) | Modal | SAM 3.1 (30 images) | Meta vision | Total |
|---|---|---|---|---|---|---|
| video 1, 2:29-2:35 | about 180 | about 13 | about $0.17 | $0.075 | about $0.06 | about $0.31 |
| video 1 scan (every 2 s) | 138 | about 7 | about $0.10 | none | 12 calls, about $0.6 | about $0.7 |
| video 2, 24 s vertical | about 720 | about 44 | about $0.59 | $0.075 | about $0.06 | about $0.73 |
| video 3, 38 s | about 1,140 | about 69 | about $0.92 | $0.075 | about $0.06 | about $1.06 |
- Frame counts assume 30 fps (the real rate is read from the file); GPU time uses CC-26's 3.5 s per frame plus 150 s fixed.
- Modal at $0.000222 per L4-second and SAM 3.1 at $2.50 per 1,000 images are list prices; whether event credits cover them is not visible from here.

## Pipeline check on the CC-26 brick-wall clip (what was actually run)
- **Command:** `python pipelines/ingest_video.py <fixture> --start 0 --end 10 --id cc-29-fixture-brick-wall --from-stage seg --supported-by "a brick wall" --view oblique` (stages 6-8 on files CC-26 already made; no Modal).
- **Adult check (Meta `muse-spark-1.3`, 6 blurred frames):** "all adults: yes, no children seen", but its reasons lean on the description ("a man"), so for real videos it adds to the text screen and never replaces it.
- **SAM 3.1:** 30 requests, all 200, 29 s; found `wall` (score 0.85), `ledge` (3 caps), `pole`; `curved wall`, `ramp`, `platform`, `rope`, `bar`, `box` and `steps` found nothing useful there.
- **Fit:** the wall is 1.24 m high (scale from the athlete's body height, ± 8 %); the camera is oblique, so thickness and length are typical values (0.5 relative uncertainty) and the README says so.
- **Recipe:** `wall-run-and-grab`, gate FAIL, so the recipe carries the warning "use the shape, not the numbers"; its contact heights are fractions of the wall height (a hand at 1.25 times the wall top means the hand was above the wall).
- **Cost (actual):** SAM 3.1 30 images about $0.075, Meta vision $0.022, Modal 0 GPU minutes; total about $0.10 from list prices.

## Limits found while building
- **Contacts are noisy on a moving camera:** the brick-wall clip's hands read as "held" for 10 s; phases from contacts need a clean side view to be trusted.
- **Body-height scale is a guess about the person:** adults are 1.6-1.9 m, so every size carries about 8 % before perspective; a known-height object is better (3-5 %).
- **A side view gives height and run, never width:** width falls back to 2 m and says so.
- **The adult check cannot see faces on purpose:** it reads body size, equipment, text; any doubt skips the segment, and a text hit (kids, junior, youth, ...) skips it without looking at a frame.
- **The GIF is schematic:** the skeleton is in the clip's world frame and the obstacle is drawn at the first contact, not registered to the picture.
- **Not tested:** the Modal masking call `mask_for_review` and the download path (both need the network or a GPU run); the cut was tested on a synthetic video.
