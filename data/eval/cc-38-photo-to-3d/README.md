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
  - Measured as the tilt of a plane fitted to the lowest 5 % of vertices, after the bake.
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
- **Round 3:** one more change from the same list, or the next item of the list if round 2's change helped.
- **Stop rule:** stop after round 3, when the round passes, or when the running cost reaches $4, whichever comes first; report the numbers either way.

## Results
*(added after each round)*
