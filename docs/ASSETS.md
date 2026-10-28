# Assets: every file we didn't write as code, with its source, date and licence

*Draft v0.1, 2026-10-27.*
*Rule: nothing goes into the game without a row here.*
*Big files live outside git in `../conquercourse-assets/` with a checksummed manifest (`SHA256SUMS`); small finished files the game loads live in `public/assets/`.*

## Characters (made during the event)
| File | What | Made | How | Cost | Licence and notes |
|---|---|---|---|---|---|
| `public/assets/characters/rookie-a.glb` | Rookie A: orange top, navy trousers, teal headband; rigged on the SOMA 30-joint skeleton | 2026-10-27 | Tripo P2 text-to-model (task `91a9907c`), quad, 5,000 faces, standard texture | 110 Tripo credits | Tripo output; commercial rights depend on the Tripo plan (to confirm) |
| `public/assets/characters/rookie-b.glb` | Rookie B: violet top, navy leggings, orange headband, hair in a bun; rigged the same way | 2026-10-27 | Muse Image reference drawn in Rookie A's style (`/images/edits`), then Tripo P2 image-to-model (task `e698db27`), `texture_alignment: original_image`, autofix off | 110 Tripo credits; one Muse Image call | As above; the Muse Image reference is kept with the sources |
- **Sources kept outside git:** the Tripo FBX files, Tripo's renders, the Muse Image reference and prompts, and each request (without keys), in `../conquercourse-assets/characters/`.
- **Rigging:** joints measured from each mesh (shoulder at the armpit, elbow and wrist on one straight line through the arm, no stretching); both models turned 180° to face forward; checked by posing on nine real motion clips.

## Footage (third-party, downloaded by hand)
| File | Move | Creator | Source | Licence |
|---|---|---|---|---|
| `Jump_over_an_obstacle_vault.mp4` | Jump over an obstacle | Anh Nguyen | [Pexels](https://www.pexels.com/video/dynamic-parkour-jump-over-blue-obstacle-32109501/) | Pexels License (free use and modification; credit given) |
| `Precision_jumps_between_concrete_blocks.mp4` | Precision jumps between blocks | Mary Taylor | [Pexels](https://www.pexels.com/video/a-man-jumping-around-concrete-structures-6002472/) | Pexels License |
| `Monkey_bars_hang_and_swing.mp4` | Hang and swing on bars | Mary Taylor | [Pexels](https://www.pexels.com/video/man-doing-parkour-on-a-playground-6002530/) | Pexels License |
| `Over_a_brick_wall_vault_or_wall_move.mp4` | Climb up and drop down a wall | Mary Taylor | [Pexels](https://www.pexels.com/video/a-man-jumping-off-the-wall-6002059/) | Pexels License |
- Kept outside git in `../conquercourse-assets/footage/`.
- Faces and bystanders are masked before any model processes a frame; only the measured motion is kept in the repo.
- Rejected and not used: two clips whose athlete might be under 18, and one dive from height (against "safe by design").
- More openly licensed candidates (about 45, with licences) are listed in `docs/research/motion-data.md`.

## Park photos for the SAM 3.1 spike (third-party, downloaded 2026-10-26, CC-24)
| File | Photo | Creator | Source | Licence |
|---|---|---|---|---|
| `data/eval/sam31-park/inputs/park01.jpg` | Ledges, stairs with rail and a bank of the IOR Skatepark in Bucharest (01) | Neoclassicism Enthusiast | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ledges,_stairs_with_rail_and_a_bank_of_the_IOR_Skatepark_in_Bucharest_%2801%29.jpg) | CC0 |
| `data/eval/sam31-park/inputs/park02.jpg` | Ledge of the IOR Skatepark in Bucharest (01) | Neoclassicism Enthusiast | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ledge_of_the_IOR_Skatepark_in_Bucharest_%2801%29.jpg) | CC0 |
| `data/eval/sam31-park/inputs/park03.jpg` | Krefeld, Germany - Voltaplatz skatepark, ledge | Alexis Jazz | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Krefeld,_Germany_-_Voltaplatz_skatepark,_ledge.jpg) | CC BY 4.0 |
| `data/eval/sam31-park/inputs/park04.jpg` | Engineer's Gate's North wall and bench, Central Park, Upper East Side, Manhattan | Deansfa | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Engineer%27s_Gate%27s_North_wall_and_bench,_Central_Park,_Upper_East_Side,_Manhattan.jpg) | CC BY-SA 4.0 |
| `data/eval/sam31-park/inputs/park05.jpg` | Bench and wall, Durlston Castle Park - geograph.org.uk - 7742638 | Robin Webster | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bench_and_wall,_Durlston_Castle_Park_-_geograph.org.uk_-_7742638.jpg) | CC BY-SA 2.0 |
| `data/eval/sam31-park/inputs/park06.jpg` | Stairs in Massandra Park | Dmytro Petishkin | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Stairs_in_Massandra_Park.jpg) | CC BY 4.0 |
| `data/eval/sam31-park/inputs/park07.jpg` | Stairs in the Haasberg Mansion park 02 | Ajznponar | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Stairs_in_the_Haasberg_Mansion_park_02.jpg) | CC0 |
| `data/eval/sam31-park/inputs/park08.jpg` | Park bench in a Hawley city park | FargoLee58103 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Park_bench_in_a_Hawley_city_park.jpg) | CC BY-SA 4.0 |
| `data/eval/sam31-park/inputs/park09.jpg` | Street Workout - Parkour - Poznań Rataje | Za3ini | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Street_Workout_-_Parkour_-_Pozna%C5%84_Rataje.jpg) | CC BY-SA 4.0 |
| `data/eval/sam31-park/inputs/park10.jpg` | Playground in Arnulfpark 02 | Kritzolina | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Playground_in_Arnulfpark_02.jpg) | CC BY-SA 4.0 |
- Each file is the Commons copy scaled to 1280 px wide (park05 is smaller at source); full details in `data/eval/sam31-park/inputs/sources.json`.
- Credit the creator and link the licence wherever the photo or an overlay of it is shown.
- CC BY-SA 4.0 and 2.0 photos (park04, park05, park08, park09, park10): overlays and any other adaptation must be shared under the same licence; keep them out of the shipped game unless that is accepted.
- park09 has two small, distant bystanders at the left edge; it is used for the spike only, not for the demo.
- The overlays in `data/eval/sam31-park/outputs/overlays/` are our own drawings on these photos (same licence as the photo).

## Park photos shipped in the game (CC-25)
| File | What | Author | Source | Licence |
|---|---|---|---|---|
| `public/assets/park/park01.jpg` | park01 above, scaled to 1024 px wide, metadata removed | Neoclassicism Enthusiast | see park01 above | CC0 |
| `public/assets/park/park02.jpg` | park02 above, same treatment | Neoclassicism Enthusiast | see park02 above | CC0 |
| `public/assets/park/park03.jpg` | park03 above, same treatment | Alexis Jazz | see park03 above | CC BY 4.0 (credit shown on the Park page) |
| `public/assets/park/park06.jpg` | park06 above, same treatment | Dmytro Petishkin | see park06 above | CC BY 4.0 (credit shown on the Park page) |
| `public/assets/park/park07.jpg` | park07 above, same treatment | Ajznponar | see park07 above | CC0 |
| `public/assets/park/<photo>.objects.json` | boxes, phrases and scores from the saved SAM 3.1 results, merged by overlap (ours) | ConquerCourse | `scripts/make-park-assets.mjs` | same as the photo |
- Only CC0 and CC BY photos ship; the CC BY-SA photos (park04, 05, 08, 09, 10) stay in the spike folder.
- Each file is under 300 KB.
## Derived from the footage (made during the event, CC-26)
- **What:** `data/eval/cc-26-pexels-motion/<clip>/`: measured 30-joint `motion.json`, contacts, gate report, privacy receipt, and a contact sheet (people blurred, faces pixelated) for each of the four clips above.
- **Made by:** SAM 3, SAM 3D Body, MoGe 2 and SOMA-X on Modal (2026-10-26), with code written in this repo (`pipelines/video_to_motion/`).
- **Licence:** derived from Pexels-licensed videos; the creators stay credited in the footage table; none of these motions is shown in the game before it passes the plausibility check (two of four fail).
- **Kept outside git:** frames, masked frames, MHR parameters (`../conquercourse-assets/work/`).

## Video ingest sources (CC-29; not fetched yet)
| Video (kept outside git in `../conquercourse-assets/video/<id>/` once fetched) | Uploader | Licence (as given in the brief, to be confirmed by the ingest's licence check) | URL | Fetched |
|---|---|---|---|---|
| 7soV521Xk1A, ninja warrior runs, side view, 276 s, 480x480 (warped wall at 2:29-2:35) | Andrew Muan | CC BY | https://www.youtube.com/watch?v=7soV521Xk1A | not yet: YouTube's bot check blocked the download (2026-10-27) |
| NCq1BAUcXF8, warped wall, 1080x1920, 24 s | World Ninja League | CC BY | https://www.youtube.com/shorts/NCq1BAUcXF8 | not yet (same) |
| hb5IOXSxqt0, "New Warped Wall Rules", 38 s | World Ninja League | CC BY | https://www.youtube.com/watch?v=hb5IOXSxqt0 | not yet (same) |
- **Rule:** the ingest records the real uploader, licence, URL and date in each run's `inputs/source.json` and refuses anything but CC BY or CC0; update these rows from it after each run.
- **Nothing derived from these videos is used by the game yet;** no motion is shown before it passes the plausibility check.
- **Dev fixture:** `data/eval/cc-29-fixture-brick-wall/` re-uses the CC-26 Pexels brick-wall clip (see the Pexels row above) to check the ingest code; its overlay and GIF show a blurred person only.
- **Derived outputs** (per run, in `data/eval/<id>/`): obstacle overlay (people blurred, faces pixelated), contact sheet, GIF, `primitives.json`, `recipe.json`; credit the uploader wherever they are shown.

## Motion data (third-party)
- **CMU Graphics Lab Motion Capture Database:** free to use, credit requested ("The data used in this project was obtained from mocap.cs.cmu.edu"); re-imported here with new code.
- **Candidates checked as publishable:** 100STYLE (CC BY 4.0), HDM05 (CC BY-SA 3.0, derived files must stay CC BY-SA), Kimodo's own generated output (NVIDIA claims no rights in outputs).
- **Not usable in a public repo:** AMASS, HumanML3D, Motion-X, GRAB, BEHAVE, PROX, Nymeria, LAFAN1, AIST++, Ego-Exo4D (non-commercial or no sharing); BONES-SEED (bans public repos).

### Starter clips (made 2026-10-27 by `pipelines/build_starter.py`; each passes the plausibility gate)
| File | Move | Source | Licence and credit |
|---|---|---|---|
| `public/assets/motion/run.json` | Run (1.2 s) | CMU trial 09_01, "run" | CMU: free to use; "The data used in this project was obtained from mocap.cs.cmu.edu." |
| `public/assets/motion/leap.json` | Run-up, leap, landing (2.1 s) | CMU trial 49_04, "run, leap" | CMU, same credit |
| `public/assets/motion/land.json` | Landing from a leap (0.8 s) | CMU trial 49_05, "run, leap", frames 17 on | CMU, same credit |
| `public/assets/motion/hang.json` | Hang by the hands, feet off the ground (1.8 s; `supportedBy` "playground bars") | CMU trial 01_10, "playground - climb, swing, lean back, drop", frames 385-440 | CMU, same credit |
| `public/assets/motion/swing.json` | Hang and swing the legs (3.3 s; `supportedBy` "playground bars") | CMU trial 01_10, frames 360-460 | CMU, same credit |
| `public/assets/motion/reach.json` | Hop up to reach overhead (1.8 s; `supportedBy` "something overhead"); an extra, not the wall grab | CMU trial 14_09, "jump up to grab, reach for, tiptoe", frames 625-680 | CMU, same credit |
| `public/assets/motion/kimodo_leap.json` | A leap made by Kimodo from text (4 s); kept, not loaded by the game (the product owner chose to stay with motion capture until a move cannot be fixed by composing clips) | Kimodo-SOMA-RP (`kimodo-soma-rp`, commit `e1c219c`), prompt `leap_a`, seed 10 | NVIDIA Open Model License; NVIDIA claims no ownership of outputs |
| `public/assets/motion/roll.json` | Forward roll out of a drop (1.8 s, 30 fps; played in 0.7 s) | Kimodo-SOMA-RP text prompt, sample 4 of prompt `roll_a` ("A person runs forward, drops into a forward roll on the ground with the head tucked, and springs back up to run."); passed the gate and the roll check (`pipelines/motion_on_demand.py`, `data/eval/motion-roll/`) | Kimodo output: NVIDIA's Open Model License claims no rights in outputs; the Rookie keeps motion capture for its other moves (CMU has no roll) |
| `public/assets/motion/vault.json` | Speed vault over a step (0.7 s, 30 fps; the simulator carries the body, the clip gives the limbs) | Kimodo-SOMA-RP text prompt, sample 0 of prompt `vault_b` ("A parkour runner does a speed vault over a low wall with one hand on top, then runs on."); passed the gate and the vault check (`pipelines/motion_on_demand.py vault`, `data/eval/motion-vault/`); NOT played in the game since CC-68 round two: it shows no hands on the top of the step, so the vault pose is built from the contact point instead (`src/motion/vault-pose.ts`) | Kimodo output: NVIDIA's Open Model License claims no rights in outputs; CMU has no vault (only step-overs), so this is the one source |
| `public/assets/motion/vault.json` | Speed vault over a step (0.7 s, 30 fps; the simulator carries the body, the clip gives the limbs) | Kimodo-SOMA-RP text prompt, sample 0 of prompt `vault_b` ("A parkour runner does a speed vault over a low wall with one hand on top, then runs on."); passed the gate and the vault check (`pipelines/motion_on_demand.py vault`, `data/eval/motion-vault/`) | Kimodo output: NVIDIA's Open Model License claims no rights in outputs; CMU has no vault (only step-overs), so this is the one source |
| `public/assets/motion/hurt.json` | Hard fall onto the front (2.1 s, 30 fps; played at its own speed, then the body lies still and gets up slowly) | CMU trial 90_16, "fall on face" (subject 90); passed the gate and the hurt check (`pipelines/motion_on_demand.py hurt`, `data/eval/motion-hurt/`) | CMU, same credit: "The data used in this project was obtained from mocap.cs.cmu.edu." |
- **How they were made:** CMU ASF/AMC re-imported with new code (`pipelines/ccpipe/cmu.py`: forward kinematics, 120 to 30 fps by taking every 4th frame, 30 joints), repaired, gated; raw files kept outside git in `../conquercourse-assets/cmu/`.
- **Experiments (CC-17 wall, targets on the simulator's path):** `public/assets/experiments/cc-17-wall/*.json` are the nearest miss of each round (they fail the gate and the pass lines, are not game assets; same licence as the Kimodo row); the GIFs are in `data/eval/cc-17-wall/outputs/round<n>/gifs/` and every sample is outside git in `../conquercourse-assets/cc-17-wall/` with `SHA256SUMS`.
- **Experiments:** `public/assets/experiments/starter-clips/*.json` are the first sample of each Kimodo prompt that was tried and did not ship (they are not game assets; same licence as the Kimodo row); every sample is kept outside git in `../conquercourse-assets/starter-clips/`.

## Text
- `docs/sayings.md`: written for this project on 2026-10-27.
- Coaching texts used to make contact targets: Wikibooks "Parkour/Basic Moves/Tic Tac" and Wikipedia "Vault (urban movement)", both CC BY-SA 4.0 (credited wherever used).

## Photos for the photo-to-object experiment (third-party, downloaded 2026-10-27, CC-38)
| File | Photo | Creator | Source | Licence |
|---|---|---|---|---|
| `data/eval/cc-38-photo-to-3d/inputs/rail01.jpg` | Churchyard Gates & Railings to St.Mary's Parish Church, Queen's Square | Peter Broster | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Churchyard_Gates_%26_Railings_to_St.Mary%27s_Parish_Church,Queen%27s_Square.jpg) | CC0 |
| `data/eval/cc-38-photo-to-3d/inputs/mural01.jpg` | Mural by Zue | Milhojas 72 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Mural_by_Zue.jpg) | CC0 (the photo; the painting belongs to its artist) |
| `data/eval/cc-38-photo-to-3d/inputs/mural02.jpg` | Mural by LOSE | Milhojas 72 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Mural_by_LOSE.jpg) | CC0 (the photo; the painting belongs to its artist) |
| `data/eval/cc-38-photo-to-3d/inputs/bench01.jpg` | Concrete bench in Valley Wood Park | Rick Obst | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Concrete_bench_in_Valley_Wood_Park.jpg) | CC BY 2.0 (credit shown wherever the photo or an object made from it appears) |
- Each file is the Commons copy scaled to 1024 px wide, metadata removed; the five starters in the same folder are copies of `public/assets/park/`.
- No people are visible in any of the four; the murals show painted faces, which are artwork, not people.
- The murals are in the experiment only: a street artist's painting is theirs even when the photographer's licence is CC0, so no mural object ships without the owner's decision.
- The raw lifts (`raw.npz`, several MB each) are kept outside git in `../conquercourse-assets/cc-38-raw/` with `SHA256SUMS`.

## Objects made from photos (made during the event, CC-38)
| File | What | Photo and author | Licence | Made with |
|---|---|---|---|---|
| `public/assets/objects/rail-skate-01.glb` | level handrail with posts, 1.0 m high, 5,819 faces, 330 KB | park01, Neoclassicism Enthusiast | CC0 | SAM 3 mask, SAM 3D Objects lift (seed 42), CPU bake with a 1024 texture (round 2) |
| `public/assets/objects/box-skate-03.glb` | low box with a step, 0.5 m high, 5,820 faces, 351 KB | park03, Alexis Jazz | CC BY 4.0: credit "Alexis Jazz, Voltaplatz skatepark, ledge" wherever the object is shown | same (round 2) |
| `public/assets/objects/bench-concrete.glb` | concrete bench with a back, 0.8 m high, 5,820 faces, 348 KB | bench01, Rick Obst | CC BY 2.0: credit "Rick Obst, Concrete bench in Valley Wood Park" wherever the object is shown | same, photo padded (round 3) |
| `public/assets/objects/railing-iron.glb` | iron railing panel, 1.0 m high, 5,820 faces, 565 KB | rail01, Peter Broster | CC0 | same, photo padded (round 3) |
| `public/assets/objects/rail-skate-02.glb` | handrail (follows stairs, posts uneven), 1.0 m high, 5,820 faces, 342 KB | park02, Neoclassicism Enthusiast | CC0 | same (round 2); editor-only test object |
| `public/assets/objects/stairs-park-07.glb` | park stairs as a soft block, 0.7 m high, 5,820 faces, 346 KB | park07, Ajznponar | CC0 | same (round 2); editor-only test object |
| `public/assets/objects/index.json` | maps each photo and box to its GLB, with height, extents, look and credit (ours) | ConquerCourse | same as each photo | `pipelines/ship_objects.py` |
- Each GLB is a skin only (no collision), made from one photo with open-weight models (SAM 3 and SAM 3D Objects, Meta; their licences are in `docs/PRIOR-WORK.md`); the sizes come from typical heights, not from the photo.
- Not shipped: the two mural walls (`data/eval/cc-38-photo-to-3d/r3/mural0*/mesh.glb`), because a mural belongs to its artist even when the photo is CC0; the park06 object (a 33 m slab). park02 and park07 are in the editor for size tests only, judged "partly".
- Kept outside git: the raw lifts (`raw.npz`, about 100 MB) and the privacy-masked photos in `../conquercourse-assets/cc-38-raw/` with `SHA256SUMS`.

## Body shapes from MHR (made during the event, CC-41)
| File | What | Source | Licence | Made with |
|---|---|---|---|---|
| `public/assets/experiments/mhr-look/mhr-<name>.glb` | the neutral MHR body and 5 shape variants (tall, short, broad, slim, stocky), 18,439 vertices, 36,874 faces, 0.89 MB each, fitted to 1.75 m | the MHR body model (`assets/mhr_model.pt`, lod1) from the SAM 3D Body checkpoint; no photo of a person | MHR: Apache 2.0; SAM 3D Body checkpoint: SAM License (see below) | `tools/mhr_look/export_variants.py`, CPU only |
| `public/assets/experiments/mhr-look/mhr-<name>-rookie-rig.glb` | the same bodies with the Rookie's 34-node skeleton and bone weights copied from the nearest Rookie vertices, 1.34 MB each | same, plus `rookie-a.glb` | same | same |
| `public/assets/experiments/mhr-look/mhr-<name>-t.glb` | the six bodies posed from A-pose to the Rookie's T-pose, fitted to the Rookie's joints and skinned to its 34 bones (MHR skin weights mapped bone by bone); the root node `mhr-height` scales the whole rig for real height; 1.34 MB each | same as above, plus `rookie-a.glb` | same | `tools/mhr_look/retarget.py`, CPU only |
| `public/assets/experiments/mhr-look/mhr-stock-adult-t.glb` | one body from SAM 3D Body's shape numbers for one adult in a Pexels clip frame (`Precision_jumps_between_concrete_blocks.mp4` at 7.97 s; face pixelated before the model saw it), height 1.70 m; no face, no photo in the file; 1.34 MB | Mary Taylor, [Pexels](https://www.pexels.com/video/a-man-jumping-around-concrete-structures-6002472/) (row above); the numbers come from the body model, the frame stays in `../conquercourse-assets/work/cc-41-photo/` | Pexels License for the frame; body model as above | `modal_app.py::shape_from_photo` then `retarget.py --shape`; a stock test only, not the owner's look |
| `data/eval/cc-41-mhr-look/retarget-*.png` | screenshots of the new bodies in the run, leap and hang poses next to the Rookie (ours) | ConquerCourse | ours | `tools/mhr_look/shots.mjs` |
| `public/assets/experiments/mhr-look/variants.json`, `index.html` | the shape numbers used, and the test page (ours) | ConquerCourse | ours | same |
- **MHR** (https://github.com/facebookresearch/MHR): the repo `LICENSE` opens "Apache License / Version 2.0, January 2004"; SOMA-X's `ATTRIBUTIONS.MD` carries the same text headed "MHR Apache License".
- **SAM 3D Body** (https://huggingface.co/facebook/sam-3d-body-dinov3): the model card says `license: other`, `license_name: sam-license`, and the `LICENSE` file opens "SAM License / Last Updated: November 19, 2025".
  - 1.a: "You are granted a non-exclusive, worldwide, non-transferable and royalty-free limited license ... to use, reproduce, distribute, copy, create derivative works of, and make modifications to the SAM Materials."
  - 1.b.i: "If you distribute or make the SAM Materials, or any derivative works thereof, available to a third party, you may only do so under the terms of this Agreement and you shall provide a copy of this Agreement with any such SAM Materials."
  - 1.b.iv: "Your use of the SAM Materials will not involve or encourage others to reverse engineer, decompile or discover the underlying components of the SAM Materials."
  - 5.a: "with respect to any derivative works and modifications of the SAM Materials that are made by you, as between you and Meta, you are and will be the owner of such derivative works and modifications."
- **To confirm before the bodies ship:** the `mhr_model.pt` we used came inside the SAM 3D Body checkpoint, so the SAM License may apply to the file even though the MHR repo is Apache 2.0; ship the licence texts with the GLBs until it is settled.
- Used only behind the switch `?look=custom` in the Course (a third Rookie button); the default Rookies are unchanged.

## Places from open map data (made during the event, CC-46)
| File | What | Source | Licence | Made with |
|---|---|---|---|---|
| `data/eval/cc-46-osm-world/<place>/overpass.json` | building outlines and height tags for three places (Eixample, Montmartre, Circular Quay), 120 m around a point, kept to the tags we use | © OpenStreetMap contributors, via the Overpass API (https://overpass-api.de), fetched 2026-10-27, no key | ODbL 1.0 (https://www.openstreetmap.org/copyright); credit "© OpenStreetMap contributors" wherever a course made from it is shown | `scripts/osm-lane.ts` |
| `data/eval/cc-46-osm-world/montmartre-paris/elevation.json` | ground height on a 20 m grid around Montmartre | AWS Terrain Tiles (Terrarium, zoom 15, `s3://elevation-tiles-prod`), fetched 2026-10-27, no account | open data (NASADEM, USGS 3DEP and others); credit as in https://github.com/tilezen/joerd/blob/master/docs/attribution.md | same |
| `public/assets/experiments/osm/<place>.glb`, `.course.json` | extruded, shrunk building meshes (56 to 141 KB) and the best lane cut from each | derived from the two rows above | ODbL (a derived database: keep the credit and share alike); course JSON is ours | same |
| `data/eval/cc-46-osm-world/*.png`, `run.json`, `README.md` | screenshots, numbers and the report (ours) | ConquerCourse | ours | `scripts/osm-shots.mjs` |

## The product owner's own clips (to come)
- Filmed by the product owner, an adult, about themselves, with no bystanders; their written consent is recorded here when added.
| (runtime, not stored) map tiles and style for `?mode=map` | the street map behind the pin | OpenFreeMap (https://openfreemap.org), style `https://tiles.openfreemap.org/styles/liberty`, no key; map data from OpenMapTiles and OpenStreetMap | free to use, no key, no limits stated; credit "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (shown by the map's own credit line, plus "© OpenStreetMap contributors") | `src/modes/map.ts` |
| `maplibre-gl` (npm package) | draws the map | MapLibre GL JS (https://maplibre.org) | BSD-3-Clause; fine for any use | `package.json` |
| (runtime, not stored) place search for `?mode=map` | name to latitude and longitude | Nominatim at `nominatim.openstreetmap.org`, no key | usage policy (https://operations.osmfoundation.org/policies/nominatim/): at most 1 request a second, no autocomplete, identify the app (the browser sends no Referer, so the app name is the only mark; no bulk use); results are © OpenStreetMap contributors, ODbL; if it fails, a short list of famous places is shown | same |
| `tests/fixtures/overpass-quay.json` | 10 building outlines near Circular Quay, Sydney, for `tests/osm.test.ts` and `scripts/map-check.mjs` | cut from `data/eval/cc-46-osm-world/circular-quay-sydney/overpass.json` (row above) | ODbL 1.0, credit "© OpenStreetMap contributors" | `tests/osm.test.ts` |
| (code, no file) event sounds: jump, land, vault, grab, let-go, splash, finish | timing feedback in the Course (CC-53) | `src/ui/audio.ts` | made in code with WebAudio (short sine, triangle and square tones, a burst of noise for the splash and the landing); no recording, no sample, no outside source | free | our own code, so no licence to track; nothing from Freesound or any sound library is used |
| (runtime, not stored) ground height for `?mode=map` ("Real hills") | height of the ground under a pin, from 7 to 9 map tiles per place | AWS Terrain Tiles, Terrarium format, zoom 15, `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, no key, no account | open data (SRTM, ASTER, USGS 3DEP and others); credit as in https://github.com/tilezen/joerd/blob/master/docs/attribution.md; shown in the map mode's footer | `src/world/terrain.ts` |
| `data/eval/cc-46-osm-world/{san-francisco-lombard,eixample-barcelona-hills,circular-quay-sydney-hills}/` and `public/assets/experiments/osm/san-francisco-lombard.{glb,course.json}` | Overpass answer, ground heights and the best lane for a steep San Francisco block, plus Barcelona and Sydney re-run with hills | the Overpass and AWS Terrain Tiles rows above, fetched 2026-10-28 | ODbL 1.0 (share alike, credit "© OpenStreetMap contributors") plus the terrain credit above; course JSON is ours | `scripts/osm-lane.ts --terrain` |
| `data/eval/cc-51-terrain/elevations.json`, `run.json`, `lanes.json` | ground height at seven places against Open-Meteo (https://open-meteo.com, Copernicus GLO-90) and two known heights | Open-Meteo elevation API, no key, fetched 2026-10-28 | one-off check only, nothing from it ships: Open-Meteo's free API is for non-commercial use and its data is CC BY 4.0 (credit Open-Meteo); numbers and report are ours | `scripts/terrain-check.ts` |

## Photos for the photo-to-course experiment (third-party, downloaded 2026-10-28, CC-52)
| File | What | Author | Source | Licence |
|---|---|---|---|---|
| `data/eval/photo-course/inputs/new01.jpg` | Box of the IOR Skatepark in Bucharest (02) | Neoclassicism Enthusiast | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Box_of_the_IOR_Skatepark_in_Bucharest_(02).jpg) | CC0 |
| `data/eval/photo-course/inputs/new02.jpg` | Skatepark, Crabtree Park, Camberley, Surrey | Mertbiol | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Skatepark,_Crabtree_Park,_Camberley,_Surrey.jpg) | CC0 |
| `data/eval/photo-course/inputs/new03.jpg` | Klimmzugstangen Neues Ufer Berlin 1v2 (pull-up bars) | Singlespeedfahrer | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Klimmzugstangen_Neues_Ufer_Berlin_1v2.jpg) | CC0 |
| `data/eval/photo-course/inputs/new04.jpg` | Stair obstructed by handrail and sign, Skilled Park, Robina, Gold Coast (IMGP9749) | John Robert McPherson | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Stair_obstructed_by_handrail_and_sign,_Skilled_Park,_Robina,_Gold_Coast_IMGP9749.jpg) | CC0 |

- Scaled by Commons to 1280 px wide; no people in any of the four (checked by eye); details in `data/eval/photo-course/inputs/sources.json`.
- The experiment also reuses park01, park02, park03, park05, park07 and park08 from the rows above (park04 and park09 are left out because people are in them).
- `data/eval/photo-course/outputs/*.json` are the model's raw answers for these photos (our own output, no third-party content).

## Cup stacks (CC-60)
- `public/assets/demo/stack.course.json`: our own course, made by `scripts/make-stack-demo.ts`; no third-party content.
- `public/assets/demo/climb.course.json`: our own course (a 2 m wall and a 5 m drop), written by hand; no third-party content.
- The cups are drawn from code (instanced cones, standard colours, no logos); there are no image or model files.

## Object bake-off inputs and outputs (made during the event, CC-55)
| File | What | Photo and author | Licence | Made with |
|---|---|---|---|---|
| `data/eval/object-bakeoff/inputs/*.png` | six RGBA cut-outs (the box of each shipped object plus 12% margin, background transparent) | the six photos behind `public/assets/objects/` (rows above for park01, park02, park03, park07, bench01, rail01) | as each photo: CC0, CC BY 4.0 (park03, Alexis Jazz) or CC BY 2.0 (bench01, Rick Obst: credit shown wherever the photo or an object from it appears) | SAM 3 masks from CC-38 |
| `../conquercourse-assets/objbake/*.glb` (outside git, `SHA256SUMS`) | twelve meshes: TRELLIS.2 and Pixal3D on each cut-out, 100,000 faces, 1,024 texture | same | same as the photo; the models are MIT, both load the DINOv3 encoder (DINOv3 License) | Modal L40S, `pipelines/objbake/modal_app.py` |
| `data/eval/object-bakeoff/sheet-3q.png`, `sheet-side.png` | grey-shaded shape comparison of SAM 3D, TRELLIS.2 and Pixal3D | same | same | `scripts/bakeoff_sheet.py` |

## Real photos beside the real worlds (third-party, downloaded 2026-10-28, CC-85)
- Wikimedia Commons files under a free licence only (CC0, public domain, CC BY or CC BY-SA), each checked on its file page; no identifiable people, no minors.
- Each photo is scaled to 1200 px wide and recompressed as JPEG (under 250 KB); the credit is shown under every photo in the game and in the large view.
| File | What | Author | Source | Licence |
|---|---|---|---|---|
| `public/assets/places/montmartre-paris/photo-1.jpg` | The dome of the Sacré-Cœur on the Montmartre hill, with the Paris rooftops beyond. (Montmartre, Paris) | Gareth Williams | https://commons.wikimedia.org/wiki/File:Paris_-_c.1987_-_The_Rooftops_of_Paris_from_the_Sacre_Coeur.jpg | CC BY 2.0 (https://creativecommons.org/licenses/by/2.0) |
| `public/assets/places/montmartre-paris/photo-2.jpg` | The church of Saint-Vincent-de-Paul among the Paris rooftops, seen from Montmartre. (Montmartre, Paris) | iMahesh | https://commons.wikimedia.org/wiki/File:%C3%89glise_Saint-Vincent-de-Paul_-_Elevated_view_from_Montmartre_with_Paris_rooftops.jpg | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0) |
| `public/assets/places/montmartre-paris/photo-3.jpg` | The view from the Sacré-Cœur steps over the gardens to the Paris skyline. (Montmartre, Paris) | cherisam | https://commons.wikimedia.org/wiki/File:Eternal_skyline-View_of_Paris_from_Basilique_de_Sacre_Coeur_-_panoramio.jpg | CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0) |
| `public/assets/places/eixample-barcelona/photo-1.jpg` | The Eixample and Gràcia districts seen from the Montjuïc hill: blocks as far as you can see. (Eixample, Barcelona) | Ilkka Simomaa | https://commons.wikimedia.org/wiki/File:Barcelona_Eixample_%26_Gr%C3%A0cia_cityscape_from_Montju%C3%AFc_2026-08-14.jpg | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0) |
| `public/assets/places/eixample-barcelona/photo-2.jpg` | The Dreta de l’Eixample district of Barcelona, seen from above. (Eixample, Barcelona) | Matti Blume | https://commons.wikimedia.org/wiki/File:Dreta_de_l_Eixample,_Barcelona_(P1170596).jpg | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/deed.en) |
| `public/assets/places/circular-quay-sydney/photo-1.jpg` | Office towers above Circular Quay, seen from the water’s edge. (Circular Quay, Sydney) | Alan and Flora Botting | https://commons.wikimedia.org/wiki/File:Circular_Quay_skyline,_Sydney.jpg | CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0) |
| `public/assets/places/circular-quay-sydney/photo-2.jpg` | The Sydney skyline from the harbour. (Circular Quay, Sydney) | zombieite | https://commons.wikimedia.org/wiki/File:Sydney_skyline_from_Sydney_Harbour,_May_2021.jpg | CC BY 2.0 (https://creativecommons.org/licenses/by/2.0) |
| `public/assets/places/circular-quay-sydney/photo-3.jpg` | Circular Quay’s ferry wharfs 4 and 5 seen from the water. (Circular Quay, Sydney) | Ymblanter | https://commons.wikimedia.org/wiki/File:Sydney_Circular_Quay_Wharfs_4_and_5_seen_from_the_water.jpg | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0) |
| `public/assets/places/san-francisco-lombard/photo-1.jpg` | The crooked block of Lombard Street seen from above. (Lombard Street, San Francisco) | Christopher Michel | https://commons.wikimedia.org/wiki/File:Lombard_Street_in_2020_01.jpg | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0) |
| `public/assets/places/san-francisco-lombard/photo-2.jpg` | Looking down Lombard Street from the top of the hill. (Lombard Street, San Francisco) | Miscellaneous contributor | https://commons.wikimedia.org/wiki/File:Lombard_Street_from_the_top_of_the_street.jpg | CC0 (http://creativecommons.org/publicdomain/zero/1.0/deed.en) |
| `public/assets/places/san-francisco-lombard/photo-3.jpg` | The crooked section of Lombard Street, looking towards Telegraph Hill. (Lombard Street, San Francisco) | Edocarli | https://commons.wikimedia.org/wiki/File:Lombard_Street,_crooked,_looking_towards_Telegraph_Hill,_San_Francisco,_CA_(August_2009).jpg | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0) |

## Real-object demo courses (CC-84)
| File | What | Made from | Licence | Made with |
|---|---|---|---|---|
| `public/assets/demo/park-rail-run.course.json` | demo course: three handrails and a skate box in a row | the CC0 objects rail-skate-01, rail-skate-02, railing-iron, box-skate-03 (`public/assets/objects/`) | CC0 (objects), our code | `scripts/make-real-demos.ts` |
| `public/assets/demo/bench-and-stairs.course.json` | demo course: a skate box, a bench and park stairs | the CC0 objects box-skate-03, bench-concrete, stairs-park-07 | CC0 (objects), our code | `scripts/make-real-demos.ts` |
| `public/assets/demo/skate-box-and-rail.course.json` | demo course: stairs, a long box, a handrail and a bench | the CC0 objects stairs-park-07, box-skate-03, rail-skate-01, bench-concrete | CC0 (objects), our code | `scripts/make-real-demos.ts` |
