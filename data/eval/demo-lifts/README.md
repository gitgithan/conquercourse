# Demo lifts: two Commons photos through the real Community pipeline (CC-133)

## So what
- We can show four of the six lifts in the promo demo as they are: both benches, the pole and the pull-up bar.
  - They are clean, recognisable and textured.
  - Use a simple box or capsule for collision, never the mesh.
- Two are weak:
  - The light-bulb string (photo 1) is a thin, sagging wire; it is recognisable only from far away and has no collision.
  - The monkey bars (photo 2) read as a flat dark plank from the side; the top view shows the loops.
- Segment Objects did NOT find the photo 2 objects (no monkey bars, no useful pull-up bar), nor the light-bulb string on photo 1.
  - In the demo film, those three must be shown as "our own box" picks (the flow's fallback), not as one-click picks.
- Recommendation: put benches, pole and pull-up bar in the film; show the monkey bars from above or as a primitive; leave the bulb string out or use it only as far-away scenery.
- Next step: add phrases "monkey bars" and "string lights" to `ccpipe/suggest.py` (extra issue or a CC-133 comment), then rerun `scripts/run_demo_lifts.sh`.

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
- Privacy (SAM 3): photo 1 blurred 10 people, 6 faces, 0 plates; photo 2 unchanged.
- Segment Objects (SAM 3 text phrases):
  - Photo 1: 5 benches (0.91 to 0.96), 2 poles (0.71, 0.82); no bulb string.
  - Photo 2: 9 poles, 2 walls, one weak pull-up bar (0.37, wrong place); no monkey bars.
- Lifts (SAM 3D Objects, seed 42):

| Object | How picked | Look | Collision | Fallback |
|---|---|---|---|---|
| Bench left | Segment Objects pick | Excellent (slats, legs, curved back) | Box | none needed |
| Bench right | Segment Objects pick | Excellent (armrests) | Box | none needed |
| Pole | Segment Objects pick | Good (tapered, base plate) | Capsule | none needed |
| Light bulbs | our box | Weak; `lift_check` flagged it (aspect 8.4 vs mask 18.7) | none | leave out |
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
- Photo 1: "string lights" is now found by Segment Objects (score 0.61, a wide strip across the top), so the bulb string can be a real pick; its lift is still weak (look only, no collision).
- Photo 2: "monkey bars" is still not found; "pull-up bar" is found with a low score (0.37).
- So the film shows the monkey bars from a box, not as a one-click pick.
- Next: try a box-free phrase such as "overhead ladder" or "horizontal ladder" before giving up.
