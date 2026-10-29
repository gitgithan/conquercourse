# CC-220: honest audit of the 19 lifted objects and a hard photo test

## So what
- The owner's suspicion is largely right: none of the 19 shipped objects came from a hard photo.
  - By eye, 11 of 19 (58%) were easy: one subject, a plain background, nothing overlapping.
  - 8 of 19 (42%) were moderate: neighbours or overlap, or a small object in a busy scene.
  - 0 of 19 were hard: none dark, backlit, or cut off by the photo edge, and no people.
- So the success numbers behind the 19 objects say nothing yet about what a player's photo will do.
- The hard set is ready (14 Commons photos, boxes checked, credits recorded) but NOT run: Modal gave no GPU.
  - A trivial test function on an L4 also waited more than 20 minutes, so the cause is the workspace, not our code.
  - Five Mask/Lift attempts over about 80 minutes never started a container; no GPU time was used, so the cost is $0.
- Recommendation: check the Modal workspace (credit, GPU limit), then run the one command below; about 15 to 20 minutes and under $2 of GPU.
- No success rate is claimed here; "usable, partly, bad" scores are still empty.

## Run it (not done yet)
- `modal run pipelines/photo_to_object.py::main --exp data/eval/cc-upload-hard-set --rnd r1`
- Then `python pipelines/photo_to_object.py bake --exp data/eval/cc-upload-hard-set --round r1 --texture` (needs xatlas and fast-simplification).
- Score each photo with the CC-110 rubric: usable (right shape, size, colour), partly (real but thin or odd), bad.
- Big files (`raw.npz`) go to `../conquercourse-assets/cc-upload-hard-set/` with `SHA256SUMS`.

## Audit of the 19 objects
- `audit/audit.py` measures the box as a share of the photo and the edge density of the background outside the box.
- Medians: box share 32%, background edge density 0.27.
- 8 objects fill 15% or less of their photo (smallest: stairs-park-07, 9%); the largest is gabion-wall (93%).
- The easy-or-moderate label is by eye on `audit/contact-sheet.jpg`; it is a judgement, not a measurement.

| Object | Box share of photo | Busy background (edge density) |
|---|---|---|
| rail-skate-01 | 13% | 0.17 |
| box-skate-03 | 22% | 0.18 |
| bench-concrete | 22% | 0.27 |
| railing-iron | 36% | 0.17 |
| rail-skate-02 | 14% | 0.22 |
| stairs-park-07 | 9% | 0.43 |
| bollard-iron | 14% | 0.19 |
| hydrant-red | 76% | 0.21 |
| barrel-oak | 44% | 0.07 |
| picnic-table | 53% | 0.45 |
| pullup-green | 36% | 0.54 |
| planter-concrete | 14% | 0.45 |
| pipe-concrete | 14% | 0.59 |
| bench-curved | 28% | 0.33 |
| railing-red | 81% | 0.17 |
| pullup-black | 35% | 0.30 |
| log-driftwood | 53% | 0.24 |
| stump-spruce | 32% | 0.30 |
| gabion-wall | 93% | 0.34 |

## The hard set (14 photos)
- Clutter, occlusion, a second look-alike object, edge contact, dark or backlit light, a tiny object (1% of the photo).
- Distant people in `railing-statue` are blurred by the privacy step; no face is shown.

| Photo | What it is | Why it is hard | Creator, licence |
|---|---|---|---|
| bollard-street | bollard | street scene, small object, a second bollard behind | Infrogmation of New Orleans, CC BY-SA 4.0 |
| bollard-row-edge | bollard | object cut by the bottom edge, neighbours overlap, bright metal | Stephen McKay, CC BY-SA 2.0 |
| bike-shelter | bicycle rack | thin frames behind glass, shelter roof | Ben Coleman, CC0 |
| bike-rack-tangle | bicycle rack | bicycles piled on the rack: heavy occlusion, indoor | Mia5793, CC0 |
| bin-scooters | trash bin | scooters and a tree against the bin, busy street behind | 玄史生, CC0 |
| bin-snow | trash bin | snow, sign text, pole in front | Andre Carrotflower, CC BY-SA 4.0 |
| bench-dusk | bench | dark, street lamps, other benches behind | Tdorante10, CC BY-SA 4.0 |
| bench-backlit | bench | backlit by sunset, reflections, dark side towards the camera | Roman Eisele, CC BY-SA 4.0 |
| skate-stairs | stairs | stairs between two ledges with a rail, graffiti, trees behind | Neoclassicism Enthusiast, CC0 |
| calisthenics-berlin | pull-up bar | bar frames overlap, bare trees behind, cut by the right edge | Singlespeedfahrer, CC0 |
| fitness-fence | fitness equipment | thin loops, fence and bench behind, harsh shadows | Tdorante10, CC BY-SA 4.0 |
| fitness-macombs | pull-up bar | wet ground reflections, overcast, many bars overlap | Tdorante10, CC BY-SA 4.0 |
| railing-statue | railing | thin rails, statue base, black railing against checker floor, tiny people far away (blurred by privacy step) | Tdorante10, CC BY-SA 4.0 |
| hydrant-cars | fire hydrant | tiny object (about 1% of the photo), cars, wires | Jim.henderson, CC0 |

## Known gaps
- Nothing was lifted, so there is no success rate, no per-photo outputs, no `run.json`.
- The audit scale is subjective.
