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
| `public/assets/motion/kimodo_leap.json` | A leap made by Kimodo from text (4 s); a candidate for the blind test, not yet judged by eye | Kimodo-SOMA-RP (`kimodo-soma-rp`, commit `e1c219c`), prompt `leap_a`, seed 10 | NVIDIA Open Model License; NVIDIA claims no ownership of outputs |
- **How they were made:** CMU ASF/AMC re-imported with new code (`pipelines/ccpipe/cmu.py`: forward kinematics, 120 to 30 fps by taking every 4th frame, 30 joints), repaired, gated; raw files kept outside git in `../conquercourse-assets/cmu/`.
- **Experiments:** `public/assets/experiments/starter-clips/*.json` are the first sample of each Kimodo prompt that was tried and did not ship (they are not game assets; same licence as the Kimodo row); every sample is kept outside git in `../conquercourse-assets/starter-clips/`.

## Text
- `docs/sayings.md`: written for this project on 2026-10-27.
- Coaching texts used to make contact targets: Wikibooks "Parkour/Basic Moves/Tic Tac" and Wikipedia "Vault (urban movement)", both CC BY-SA 4.0 (credited wherever used).

## The product owner's own clips (to come)
- Filmed by the product owner, an adult, about themselves, with no bystanders; their written consent is recorded here when added.
