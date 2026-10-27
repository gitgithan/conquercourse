# CC-38: a community photo becomes a textured 3D object

*Serves the hero beat and the community courses: a player photographs a real railing, bench or painted wall, and the Course gets an object that looks like it.*
*Plan written 2026-10-27, before the first paid run; results are added below the plan after each round.*

## Question
- Can a community photo of a real obstacle become a recognisable, upright, correctly sized, textured 3D object the game can use as a skin?
- Collision stays a primitive (box, wall, bar); the mesh is only the skin.

## Hypothesis
- SAM 3 (mask) plus SAM 3D Objects (lift) plus a CPU bake gives a "yes" or "partly" look on most solid objects (bench, wall, platform, rail on a wall).
- Thin objects (a bare handrail) and stair-like objects (steps) come out flat or blobby; that is the known weak spot (`docs/challenges.md` A4).
- A painted wall is a box with a picture: the vertex colours from the splat should carry the mural, so it should look right from the front, and only approximately from the sides.

## Pass lines (fixed before running; judged per object unless stated)
- **Size of file:** the GLB is at most 1.5 MB and at most 6,000 faces.
- **Size of object:** the mesh's height is within 10 % of the typed height, or of the typical height for the label when none is typed.
  - This checks the scale step; it is true by construction when the bake works, so proportions are judged by eye on the sheet.
  - Also reported, not a pass line: the mesh's width-to-height ratio against the photo box's ratio for side-on photos.
- **Upright:** the mesh's up axis is within 5 degrees of vertical.
  - Measured as the angle between vertical and the mean normal of the downward-facing faces, after the bake.
  - *Changed before the first run:* the first idea (a plane fitted to the lowest 5 % of vertices) failed a unit test on a tilted flat box, where the lowest vertices form a line.
- **Recognisable:** judged by eye on the contact sheet, one word per object: yes, partly or no.
  - Round passes when at least 6 of the 9 photos are "yes" or "partly", and the painted wall (mural01) is at least "partly".
- **Time:** under 60 s per object after the image build (mask plus lift, one warm container).
- **Whole task passes** when the round passes on every line above; a single failed object does not fail the round if it is a known weak type (bare handrail, steps), but it is reported as a gap.

## What it needs
| Piece | Exists? | Where |
|---|---|---|
| SAM 3 weights | yes | Modal volume `sam-checkpoints`, `hf/sam3/sam3.pt` |
| SAM 3D Objects weights | yes | `sam-checkpoints`, `objects/hf/` (pipeline.yaml, generators, decoders) |
| MoGe (the depth model SAM 3D Objects calls) | yes | `sam-checkpoints`, `hf/hub/models--Ruicheng--moge-vitl` |
| MapAnything (metric depth) | no | optional extra, not required; size comes from the typed or typical height |
| SAM 3D Objects container image | no | built once here (see Cost) |
| SAM 3 container image | partly | the video pipeline has one (`pipelines/video_to_motion/modal_app.py`); a new smaller one is written here |
| People and faces masking | in a Modal class only | not in `pipelines/ccpipe`; rewritten here as `ccpipe/privacy.py` (CPU) with SAM 3 finding the people |
| Bake, scale, GLB writer | no | `pipelines/ccpipe/objbake.py`, `glb.py` (new, with unit tests) |
| Photos | 5 starters in `public/assets/park/`; 4 more fetched | see `docs/ASSETS.md` |
| Game wiring | not in this task | the laptop wires `public/assets/objects/index.json` into `src/` |

## Photos (9) and boxes
- Starters, with the boxes saved by the SAM 3.1 spike: park01 (handrail), park02 (handrail), park03 (platform), park06 (ledge), park07 (stairs).
- New, openly licensed (CC0 or CC BY): rail01 (iron railing on a stone wall), mural01 and mural02 (painted walls), bench01 (concrete bench).
- Labels, boxes and typed heights live in `photos.json`; no typed heights in round 1, so every object uses the typical height for its label.
- The two murals are paintings by street artists photographed by someone else; the photo licence is CC0, the artwork's own rights are not ours to grant, so the murals stay in the experiment and are not shipped unless the owner decides otherwise.

## Cost (stated before the first paid run)
- **Modal L40S:** about $1.95 an hour (about $0.00054 a second); the lift runs here.
- **Modal L4** (mask and privacy): about $0.80 an hour; a few seconds per photo.
- **SAM 3D Objects image build:** one time, 20 to 40 minutes on Modal's builders, up to about $1 (the builders are CPU machines, so likely less).
- **Per object after that:** about 10 to 40 s of L40S, about $0.02.
- **Credits:** Modal credits on this workspace pay for all of it; no Meta API call, no Tripo.
- **Budget:** at most $4 in total and at most 3 containers at once (this app limits itself to 1 GPU container per class).
- **Tracked:** GPU seconds and estimated dollars go into `run.json` after every round; if the running total passes $4, stop and report.

## Method
1. **Privacy:** SAM 3 finds people, faces and plates; people are blurred, faces and plates pixelated, before anything else sees the photo; a receipt of counts is kept.
2. **Mask:** SAM 3 with the label as text; the mask that best overlaps the typed box wins; a box-only prompt is the fallback.
3. **Lift:** SAM 3D Objects from photo and mask, seed 42, giving a mesh and a Gaussian splat.
4. **Bake (CPU):** keep the mesh upright in its own frame (no camera layout), turn the widest side to face the side-on camera, centre it, stand it on the ground, simplify to at most 6,000 faces, colour each vertex from its nearest Gaussians, scale to the height, write a GLB with vertex colours and a `mesh.json`.
5. **Sheet:** photo, mask, and the mesh from the front, the side and the top (our own software renderer, so the sheet shows the real GLB).

## One change per round
- **Round 1:** the plan above, unchanged; no typed heights.
- **Round 2:** one change, chosen from this ordered list by the failure seen in round 1:
  1. if thin objects vanish or come out as slabs: feed the lift the mask grown by 8 px;
  2. else if colours look washed out or blotchy: colour each vertex from 8 nearest Gaussians weighted by opacity, instead of 4;
  3. else if the wrong thing is masked: choose the mask by overlap with the box and the label score together.
- **Round 2 as run (the list above was amended before running it):** the failure seen in round 1 was blotchy mural colour, and a check of the splat showed it holds the painting crisply (`r1/splat-check.png`) while the 2,900 vertices left after decimation cannot; so the one change is to bake the splat's colour into a 1024 x 1024 UV texture (xatlas unwrap, nearest Gaussians per texel) instead of per-vertex colour.
  - It is CPU only and re-uses round 1's saved lifts, so it costs no GPU.
- **Round 3:** one more change from the same list, or the next item of the list if round 2's change helped.
- **Round 3 as run (decided after round 2 passed its lines):** the stop rule below says stop when a round passes; round 2 did, but the hero object (a painted wall) still fails on one of two murals (mural02 is lifted as a table), so one more round is run inside the three-round limit.
  - The one change: the photo and mask are pasted onto a canvas 1.5 times as wide and as tall (edge pixels repeated, mask zero outside), so a wall that fills the frame is not cut off at the edges.
  - Only mural01, mural02, rail01 and bench01 are lifted again (the two murals and rail01 touch the frame edges; bench01 is the control that should not change); cost about $0.1.
  - Round 3 keeps the texture bake from round 2.
- **Stop rule:** stop after round 3, when the round passes, or when the running cost reaches $4, whichever comes first; report the numbers either way.

## Results (three rounds, 2026-10-27)

### So what
- A community photo of a bench, a railing or a skate box becomes a recognisable, upright, correctly sized, textured object in about 15 seconds and about 2 cents.
- A painted wall works when the wall is padded into a larger canvas first (round 3): the painting lands on a thin standing wall; without padding one of two murals came out as a table.
- Four objects ship (`public/assets/objects/`); the murals stay in the experiment until the owner decides on the artists' rights.
- Recommendation: turn it on for approved community courses only, as a skin on a primitive, with the flat photo-textured wall as the fallback; steps, thin strips and walls that are a table in the lift's eyes are the known failures.

### What each round changed
| Round | One change | GPU | Result |
|---|---|---|---|
| smoke | none; one photo (bench01) to catch run-time errors | 1.6 min, about $0.05 | works end to end |
| r1 | the plan as written, vertex colours | 2.4 min, about $0.07 | 6 of 9 yes or partly; the mural is blotchy ("partly"); mural02 is a table |
| r2 | colour baked into a 1024 x 1024 texture (CPU, re-uses r1's lifts) | 0 | mural01 becomes "yes"; the rest unchanged or slightly crisper |
| r3 | photo and mask padded onto a 1.5 x canvas (4 photos) | 1.8 min, about $0.05 | mural02 becomes a standing wall ("partly"); bench01 (control) unchanged |

### Per object (best of the rounds; sheets are links)
| Photo | Label | Look | Height | Faces | GLB | Up axis off vertical | Sheet |
|---|---|---|---|---|---|---|---|
| park01 | handrail | yes: level rail with posts | 1.0 m | 5,819 | 330 KB | 0.96 degrees | [r2](r2/park01/sheet.png) |
| park02 | handrail | partly: the rail follows the stairs, so its posts end at different heights | 1.0 m | 5,820 | 342 KB | 8.62 degrees (fails; the feet sit on a slope) | [r2](r2/park02/sheet.png) |
| park03 | platform | yes: long low box with a step | 0.5 m | 5,820 | 351 KB | 0.5 degrees | [r2](r2/park03/sheet.png) |
| park06 | ledge | no: the saved box is a thin shadow strip, scaled to a 33 m slab | 0.5 m | 5,820 | 318 KB | 0.63 degrees | [r2](r2/park06/sheet.png) |
| park07 | stairs | no: a flat block with a cut side (known: steps come out flat) | 0.7 m | 5,820 | 346 KB | 1.35 degrees | [r2](r2/park07/sheet.png) |
| rail01 | rail | partly: an iron railing panel with spear tops; gate and fence merged | 1.0 m | 5,820 | 565 KB | 1.55 degrees | [r3](r3/rail01/sheet.png) |
| mural01 | wall | yes: red face, white moon, flames and figure in place; soft | 0.9 m | 5,820 | 366 KB | 0.6 degrees | [r3](r3/mural01/sheet.png), [r1 for comparison](r1/mural01/sheet.png) |
| mural02 | wall | partly: orange wall, red field and blue figure in place; the middle is smeared (r1 and r2: a table, no) | 0.9 m | 5,820 | 385 KB | 1.46 degrees | [r3](r3/mural02/sheet.png), [r2 (table)](r2/mural02/sheet.png) |
| bench01 | bench | yes: back, arms and seat; a little grey | 0.8 m | 5,820 | 348 KB | 1.7 degrees | [r3](r3/bench01/sheet.png) |

### Against the pass lines
- **File size and faces:** pass on all 9 (at most 565 KB and 5,820 faces; a vertex-colour GLB is about 115 KB).
- **Height within 10 %:** pass on all 9, by construction (the scale step); the proportions are the open question, judged by eye above.
- **Upright within 5 degrees:** 8 of 9; park02 is 8.6 degrees because the rail's posts stand on a slope; counted as the known weak type (a handrail on stairs), and reported as a gap.
- **Recognisable:** 7 of 9 are "yes" or "partly" (needed: 6), and the painted wall is a "yes" (mural01) and a "partly" (mural02); the two "no" objects are a bad input box (park06) and steps (park07).
- **Time:** 8 to 10 s for the lift and 0.3 to 2 s for the mask per object with the containers warm (about 15 s wall per object, including the upload and download), 90 to 100 s for the first object because both model loads happen then; under the 60 s line once warm; the CPU bake takes 5 to 9 s.
- **Cost:** about $0.17 of GPU container time for everything (3 GPU rounds, 5.8 GPU minutes); with scale-down idle time a safe upper bound is about $0.35; the image build ran on Modal's CPU builders (three builds, about 25 minutes in all), which the CLI does not meter; budget $4 was never close.

### What we learned
- **Vertex colours cannot carry a painting:** after simplifying to 6,000 faces there are only about 2,900 vertices; the splat itself holds the painting crisply (`r1/splat-check.png`), so the colour goes into a 1024 x 1024 JPEG texture instead (GLBs stay under 600 KB).
- **A wall that fills the frame can be lifted as a table:** padding the photo onto a larger canvas fixed it (one example; the control bench did not change).
- **The mesh comes out upright in its own frame, z up:** a plain rotation about x puts it on the game's ground; the camera layout is never needed.
- **Size still comes from the typed or the typical height:** the two thin or long objects (park06) show the weakness; a typed height or a known-size object in the photo is the next step.
- **Privacy:** none of the nine photos had a person, a face or a plate (receipts in `<round>/<photo>/privacy.json`), so the blur path ran but changed nothing here; it is unit-tested on synthetic masks.
- **The image build took four tries:** see `docs/pipelines.md`, pipeline 7.

### Known gaps
- MapAnything (metric depth) was not tried; it is optional.
- Round 3 padded only four photos; padding every photo was not tested (the bench control suggests it is harmless).
- The lift is one sample per photo (seed 42 as specified); the "table" result shows a different seed or framing can change a wall's shape.
- Collision is a primitive, never the mesh; `index.json` has the extents so the laptop can size the primitive.
- The raw lifts (about 100 MB) are in `../conquercourse-assets/cc-38-raw/` with `SHA256SUMS`; `python pipelines/photo_to_object.py bake --round r2 --raw-from r1 --texture` re-makes round 2 from them.

### Commands
- Image check (no GPU): `modal run pipelines/photo_to_object.py::check_lift_image`.
- Round 1: `modal run pipelines/photo_to_object.py::main --exp data/eval/cc-38-photo-to-3d --rnd r1`.
- Round 2: `python pipelines/photo_to_object.py bake --exp data/eval/cc-38-photo-to-3d --round r2 --raw-from r1 --texture`.
- Round 3: `modal run pipelines/photo_to_object.py::main --exp data/eval/cc-38-photo-to-3d --rnd r3 --only mural01,mural02,rail01,bench01 --pad 0.25 --texture`.
- Ship: `python pipelines/ship_objects.py --pick park01@r2=rail-skate-01 park03@r2=box-skate-03 bench01@r3=bench-concrete rail01@r3=railing-iron`.
