# Demo lifts: two Commons photos through the real Community pipeline (CC-133)

## So what
- We can show four of the six lifts in the promo demo as they are: both benches, the pole and the pull-up bar.
  - They are clean, recognisable and textured.
  - Use a simple box or capsule for collision, never the mesh.
- Two are weak:
  - The light-bulb string (photo 1) is a thin, sagging wire; it is recognisable only from far away and has no collision.
  - The monkey bars (photo 2) read as a flat dark plank from the side; the top view shows the loops.
- The first run of Segment Objects found neither the photo 2 objects (no monkey bars, no useful pull-up bar) nor the light-bulb string on photo 1.
  - The rerun with new phrases (last section) finds the string ("string lights", 0.61), so it can be a one-click pick.
  - The monkey bars and the pull-up bar are still not found; the lifts of all three were made from our own boxes, drawn by us to test the lift.
  - In the demo film, the monkey bars and pull-up bar must be shown as lifted from a box (the lab box; whether players get a box tool is decided in `docs/community-flow-guide.md`), not as one-click picks.
- Recommendation: put benches, pole and pull-up bar in the film; show the monkey bars from above or as a primitive; leave the bulb string out or use it only as far-away scenery.
- Next step: the two phrases were added and rerun (last section); try "overhead ladder" or "horizontal ladder" for the monkey bars.

## Method rule: segment, show, then lift
- Lifts must go through segment-then-confirm (owner principle, 2026-11-03), as the product does.
  - Step 1: a cut-out of the box (`modal_calls.py maskbox`) writes `evidence/maskbox_<name>.jpg`, a cheap L4 call with no lift.
  - Step 2: someone looks at the picture; a wrong cut-out means a new box, not a lift.
  - Step 3: only then the lift; `modal_calls.py lift` refuses an object with no cut-out picture.
- The earlier lifts in this folder were made straight from lab boxes, before this rule; the cut-out pictures were added afterwards (below).
- Real cut-outs, 2026-11-03: monkey bars score 0.91 (0.5 s), pull-up bar 0.93 (0.5 s), left bench 0.98 (3.8 s with a cold start).
  - The monkey bars cut-out follows the loops along the top bar and ignores the posts, so the lift would get the bar and not the frame.

## Photos (originals stay outside git, with checksums)
- Photo 1: `Dansbana_-_Ystad-2016.jpg`, CC BY 3.0, credit "Jonn Leffmann", 1550x793.
- Photo 2: `Street_Workout_&_Parkour_Park_w_Parku_Rataje_-_marzec_2017_-_1.jpg`, CC BY-SA 4.0, credit "Koefbac", 2592x1944.
  - Demo only; swap before a sale (see `docs/ASSETS.md`).
- Photo 1 shows people, so only its blurred version is committed (`evidence/photo1_privacy_after.jpg`).

## Steps and results
- People rule (`scripts/photos_people.py` logic, limit 0.2 of picture height):
  - Photo 1: 12 people, tallest 0.16, passes.
  - Photo 2: no people, passes.
- Safety check (Muse Spark Open): both `ok`, reason `none` (5.0 s and 88.9 s).
  - 88.9 s is slower than the worst call in `data/eval/cc-120-safety-real/README.md` (78 s of 84 calls), so the worst seen so far is 88.9 s.
- Privacy (SAM 3): photo 1 blurred 10 people, 6 faces, 0 plates; photo 2 unchanged.
  - The people rule above counts 12 with a different detector (Faster R-CNN, score 0.4 or more), and SAM 3 blurred 10.
  - Only the counts were saved for SAM 3, not its boxes, so which 2 were not blurred, or whether it missed them, is not recorded.
  - Several of the 12 are tiny (the smallest box is 15 px wide), so a miss on far figures is possible but unproven.
- Segment Objects (SAM 3 text phrases), first run:
  - Photo 1: 5 benches (0.91 to 0.96), 2 poles (0.71, 0.82); no bulb string (the rerun finds it: below).
  - Photo 2: 9 poles, 2 walls, one weak pull-up bar (0.37, wrong place); no monkey bars.
- Lifts (SAM 3D Objects, seed 42):

| Object | How picked | Look | Collision | Fallback |
|---|---|---|---|---|
| Bench left | Segment Objects pick | Excellent (slats, legs, curved back) | Box | none needed |
| Bench right | Segment Objects pick | Excellent (armrests) | Box | none needed |
| Pole | Segment Objects pick | Good (tapered, base plate) | Capsule | none needed |
| Light bulbs | our box (made before the rerun) | Weak; `lift_check` flagged it (aspect 8.4 vs mask 18.7) | none | leave out, or far-away scenery |
| Monkey bars | our box (box prompt) | Medium; loops show from above, flat plank from the side | Primitive bar | show the plan view |
| Pull-up bar | our box (box prompt) | Good (4 rungs, 2 uprights, clamps) | Primitive bar | none needed |

- Typed height matters: monkey bars first came out 52 m wide when typed 2.4 m (it is the thin side); retyped to 0.25 m.
- Pictures: `evidence/lifts_turntables.jpg`, `evidence/photo1_segment_objects.jpg`, `evidence/photo2_segment_objects.jpg`, `evidence/photo1_privacy_after.jpg`.

## Cost
- Modal (deployed app `cc-photo-to-object`, nothing deployed): job seconds about $0.034; realistic total with cold starts and retries about $0.30 to $0.60.
- Baseten: 2 small calls, sponsor credits.
- Cold L40S containers drop the client stream; `modal_calls.py` spawns and polls with retries.

## Files
- `scripts/run_demo_lifts.sh` reproduces everything (not re-run end to end after the final edits; each step was run on its own).
- `run.json`, `chips.json`, `objects.json`, `safety/`, `people_check.json`, `suggest/*/suggest.json`, `lifts/*/lift.json`, `lifts/*/mesh.json`.
- Raw GLBs, raw lifts, masks and prepped photos: `../conquercourse-assets/eval-full/demo-lifts/` with `SHA256SUMS`.

## Rerun with the phrases "monkey bars" and "string lights" (2026-11-03)
- Photo 1: "string lights" is now found by Segment Objects (score 0.61, a wide strip across the top, and a weak 0.35 hit in the middle; `suggest/photo1/suggest.json`), so the bulb string can be a real pick; its lift is still weak (look only, no collision).
- Photo 2: "monkey bars" is still not found; "pull-up bar" is found with a low score (0.37).
- So the film shows the monkey bars from a box, not as a one-click pick.
- Next: try a box-free phrase such as "overhead ladder" or "horizontal ladder" before giving up.

## Crop trial for the monkey bars (2026-11-03)
- With crops, extra phrases and a shape check, the finder does find the loops across the top (rank 2 of 12, IoU 0.40, score 0.57) and the left grid only weakly (rank 12, IoU 0.57, floor 0.10 to 0.20).
- 2x upscaling, nine tiles and classic Hough lines did not help.
- Details and numbers: [crop-finder](../crop-finder/README.md); one run, about $0.04.

## Two confirmed lifts after the cut-out preview (CC-133, 2026-11-03)

- Cost before the run: about $0.006 each in Modal seconds (L4 mask plus L40S lift at $1.95 per hour; about 10 s warm), at most about $0.03 each with a cold start; the Modal credits cover it, and no other paid service was used.
- Monkey bars (a box the player draws): the cut-out was shown first (score 0.91), then the lift ran; 28,416 splats, estimated $0.0051; picture: `docs/evidence/cc-133-lifts/monkey-bars-preview-then-lift-input.jpg`.
- Bench beside two people (photo 1, a box drawn next to them): the people are grey blobs in the lifted picture; mask score 0.94, 171,168 splats, estimated $0.0056; picture: `docs/evidence/cc-133-lifts/bench-beside-people-preview-then-lift-input.jpg`.
- The same box drawn on a person is refused by the page rule (checked with the real person boxes).
- No photo in our licensed set has a person standing next to a bar; the bench is the nearest case.
