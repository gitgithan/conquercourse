# Assets: every file we didn't write as code, with its source, date and licence

*Draft v0.1, 2026-10-27.*
*Rule: nothing goes into the game without a row here.*
*Big files live outside git in `../conquercourse-assets/` with a checksummed manifest (`SHA256SUMS`); small finished files the game loads live in `public/assets/`.*

## Characters (made during the event)
| File | What | Made | How | Cost | Licence and notes |
|---|---|---|---|---|---|
| `public/assets/characters/rookie-a.glb` | Rookie A: orange top, navy trousers, teal headband; rigged on the SOMA 30-joint skeleton | 2026-10-27 | Tripo P2 text-to-model (task `91a9907c`), quad, 5,000 faces, standard texture | 110 Tripo credits | Tripo output; commercial rights depend on the Tripo plan (to confirm) |
| `public/assets/characters/rookie-b.glb` | Rookie B: violet top, navy leggings, orange headband, hair in a bun; rigged the same way | 2026-10-27 | Muse Image reference drawn in Rookie A's style (`/images/edits`), then Tripo P2 image-to-model (task `e698db27`), `texture_alignment: original_image`, autofix off | 110 Tripo credits; one Muse Image call | As above; the Muse Image reference is kept with the sources |
| `public/assets/characters/cast/*.glb` (8 files, 150 to 237 KB each) and `index.json` | Starter cast: Fox, Skater, Toy Robot, Cactus, Banana, Robo Cat, Jelly, Potato Blob; rigged on the Rookie's 30-joint skeleton, 3,000 faces, 256 px texture | 2026-11-01 | Muse Image picture, SAM 3.1 cutout, SAM 3D Objects lift (Modal), baked and rigged by `pipelines/charmaker`, rebuilt by `data/eval/cc-chars-eight/scripts/rebuild.py` | Modal GPU time inside the dev cap | Ours (generated). Meta's terms for generated pictures are not confirmed. Demo only: swap before a sale. Replacement plan: remake with a model whose output terms are clear, same pipeline and file names, so it is a file change. |
| `public/assets/characters/cast/*.webp` (8 files, 1 to 2 KB each) | Picker thumbnails of the starter cast | 2026-11-01 | Rendered from the rebuilt GLBs by `make_cast.py` | none | Ours. Same note as the cast GLBs. |
| `docs/evidence/cc-chars-eight/*.png` | Before and after pictures of the eight (T-pose as made and fitted, run, leap, land and vault sheets) | 2026-11-01 | `data/eval/cc-chars-eight/scripts/check_moves.mjs` in a browser on the Rookie's skeleton | none | Ours. Under 300 KB each. |
| `docs/evidence/cc-chars-facing/*.png` | Side-view before and after pictures of Skater, Banana and Potato Blob running, and Skater standing | 2026-11-01 | `data/eval/cc-chars-facing/scripts/shoot.mjs` in a browser on the Rookie's skeleton | none | Ours. Under 300 KB each. |
| `public/assets/lab/search-trap.course.json` | Lab 1 trap course (also used by Lab 12, reinforcement learning): three gaps where the farthest first jump strands the second | 2026-10-29 | Written by hand from a random search of small chains; the stored plan is the game's own ideal-run search | None | Ours; no third-party material |
| `public/assets/lab/detector-partllm.json` | Lab 10: recorded outputs of a part detector on six labelled objects (24 rows: painted share, precision, recall, answer-key label) | 2026-10-31, copied from `data/eval/partllm/scores.json` and `answer-key.json` (CC-49 run of 2026-10-28) | Ours (numbers and our hand labels); the detector is PartLLM, Apache-2.0, and none of its output meshes are shipped | `scripts/lab-detector-check.mjs` uses it; no tool needed |
| `docs/evidence/lab-hashing-run.png` | screenshot of Lab 11 (hashing) after a run, 1280 px (evidence only; the game does not use it) | 2026-10-31 | `scripts/smoke-lab-hashing.mjs`, headless browser | None | Ours; no third-party material |
| `public/assets/lab/opt-rope.course.json` | Lab 2 rope course: one gap and one rope, two settings (jump press, release time) | 2026-11-01 | Written by hand from the rope parameters of the first course; the stored plan is the game's own ideal-run search | None | Ours; no third-party material |
| `public/assets/lab/opt-rope.table.json` | Lab 2 reference table: the real simulator's result at every cell of the rope map (2847 cells, about 27 KB) | 2026-11-01 | `npx tsx scripts/lab-optimization-scan.ts`, one real run per cell | None | Ours; a test checks live runs against it |
| `public/assets/lab/opt-drone.table.json` | Lab 2 reference table for the drone ferry map (1665 cells, about 17 KB) | 2026-11-01 | `npx tsx scripts/lab-optimization-scan.ts` on `public/assets/demo/drone.course.json` | None | Ours; a test checks live runs against it |
| `docs/evidence/lab-optimization-drone.png`, `docs/evidence/lab-optimization-rope.png` | Evidence screenshots of Lab 2 at 1280 px | 2026-11-01 | Browser smoke run on a remote machine, palette-reduced | None | Ours |
| `docs/evidence/lab-ik-breaking-point.png` | screenshot of Lab 3 (posing a character) with the bar past the arm's reach, 1280 px (evidence only; the game does not use it) | 2026-11-01 | `scripts/lab-ik-check.mjs`, headless browser | None | Ours; no third-party material |
| `docs/evidence/lab-ik-elbow-flip.png` | screenshot of Lab 3 with the bar behind the back and the elbow flipped, 1280 px (evidence only) | 2026-11-01 | `scripts/lab-ik-check.mjs`, headless browser | None | Ours; no third-party material |
| `public/assets/lab/search-trap.course.json` | Lab 1 trap course: three gaps where the farthest first jump strands the second | 2026-10-29 | Written by hand from a random search of small chains; the stored plan is the game's own ideal-run search | None | Ours; no third-party material |
| `tests/fixtures/lab-signal-reference.json` | Lab 8 reference numbers: the Python gate and numpy filters on 33 cases of the shipped clips with seeded noise | 2026-11-01 | `scripts/lab_signal_reference.py` | None | Ours; derived from the shipped CMU and London Parkour clips (credits as in their rows) |
| `docs/evidence/lab-timing-park-run-1280.png` | Lab 7 evidence: a screenshot of the Lab after 400 runs on the Park run at 60 ms of jitter | 2026-11-01 | Our own screenshot of our own page (1280 px) | None | Ours; no third-party material |
| `public/assets/parts/*.course.json` | tiny one-part courses (gap, vault, wall, climb, lache, rope, trampoline, run, step) that the Parts gallery plays | 2026-11-01 | Cut by `scripts/make-parts-courses.ts` from our own `public/assets/demo/training.course.json`, each with a stored ideal plan | None | Ours; no third-party material |
| `public/assets/parts-thumbs/*.webp` | one still per Parts gallery card (480x270) | 2026-11-01 | Our own screenshots of our own page `?mode=parts`, made by `scripts/parts-gallery-smoke.mjs --thumbs` | None | Ours; no third-party material |
| `public/assets/thumbs/parts.webp` | the Parts card picture in the World picker (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=parts` | None | Ours; no third-party material |
| `docs/evidence/parts-gallery/*.png` | Parts gallery evidence at 1280 px | 2026-11-01 | Our own screenshots from `scripts/parts-gallery-smoke.mjs` | None | Ours; no third-party material |
| `public/assets/thumbs/lab-timing.webp` | the Lab 7 card picture in the Courses gallery (640x360) | 2026-11-01 | Cropped from our own screenshot `docs/evidence/lab-timing-park-run-1280.png` | None | Ours; no third-party material |
| `public/assets/thumbs/lab-search.webp` | the Lab 1 card picture in the Courses gallery (640x360) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-search&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` | None | Ours; no third-party material |
| `public/assets/thumbs/dojo-<id>.webp` (13 files, 10 to 17 KB each) | the Dojo card pictures in the Courses gallery (640x360) | 2026-11-01 | Our own screenshots of the first lesson picture on our own Dojo pages, made by `scripts/make-dojo-thumbs.mjs` | None | Ours; no third-party material. The Swing on a bar card shows the same rope picture as Rope swing (the lesson reuses it) |
| `public/assets/thumbs/lab-optimization.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-optimization&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material |
| `public/assets/thumbs/lab-ik.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-ik&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material |
| `public/assets/thumbs/lab-vision.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-vision&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material except that Lab 4 (vision) shows its credited COCO thumbnails, see `public/assets/lab/vision/credits.json` |
| `public/assets/thumbs/lab-camera.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-camera&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material |
| `public/assets/thumbs/lab-integration.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-integration&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material |
| `public/assets/thumbs/lab-signal.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-signal&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material |
| `public/assets/thumbs/lab-gentest.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-gentest&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material |
| `public/assets/thumbs/lab-detector.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-detector&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material |
| `public/assets/thumbs/lab-hashing.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-hashing&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material |
| `public/assets/thumbs/lab-rl.webp` | the Lab card picture in the Courses gallery (640x360, under 80 KB) | 2026-11-01 | Our own screenshot of our own page `?mode=lab-rl&labs=1` at 1280 px, made by `scripts/make-thumbs.ts` (`npm run thumbs`) | None | Ours; no third-party material |
| `public/assets/lab/gentest-proposals.json` | Lab 9 recorded course ideas: 100 replies of Muse Spark Open (95 readable layouts), about 79 KB | 2026-11-01 | Packed by `scripts/lab-gentest-pack.mjs` from `data/eval/cc-122-bulk-courses/results.json` (the CC-122 run); the page replays them and makes no model call | None now; the original 100 calls cost about $1.6 at list price, covered by hackathon credits | Model output of meta-models/muse-spark-open-1026, ours to ship; no third-party material |
| `docs/evidence/lab-gentest-recorded.png`, `docs/evidence/lab-gentest-repairs.png` | Lab 9 evidence: screenshots at 1280 px of a recorded-proposals run and a run with repairs | 2026-11-01 | Playwright (`scripts/lab-gentest-check.mjs`) on the ideal-run search | None | Ours; no third-party material |
| `public/assets/music/course.ogg` | Loop for the course screen: 5 bars at 140 bpm, 8.571 s | 2026-10-29 | Text prompt only to MusicGen medium (Meta AudioCraft weights, loaded through transformers): motivational mid-tempo prompt, round 2 variant b (bright, fast); candidate `course-b_8`, seed in `data/eval/cc-132-music/round2/run.json`; first loop re-cut by hand from 1.386 s to 9.957 s of the 15.4 s candidate to drop the high notes that grow after 10 s, with the tail crossfaded into the pre-roll (`data/eval/cc-184-course-b8/run.json`) | Under $1 of Modal GPU time for all candidates (not itemised) | Generated, no melody input and no recording or film theme; MusicGen weights are CC BY-NC 4.0 (non-commercial), code is MIT; commercial rights to the output are not settled; the music plays by default (owner decision 2026-10-29) and `?music=0` turns it off |
| `public/assets/music/map.ogg` | Loop for the map screen: 6 bars at 100.0 bpm, 14.4 s | 2026-10-29 | Text prompt only to MusicGen medium (Meta AudioCraft weights, loaded through transformers): flowing prompt (round 1); candidate `map_11_v2`, seed in `data/eval/cc-132-music/run.json` or `round2/run.json`; cut to whole bars by `pipelines/cut_loops.py` | Under $1 of Modal GPU time for all candidates (not itemised) | Generated, no melody input and no recording or film theme; MusicGen weights are CC BY-NC 4.0 (non-commercial), code is MIT; commercial rights to the output are not settled; the music plays by default (owner decision 2026-10-29) and `?music=0` turns it off |
| `public/assets/music/editor.ogg` | Loop for the editor screen: 7 bars at 110 bpm, 15.273 s | 2026-10-29 | Text prompt only to MusicGen medium (Meta AudioCraft weights, loaded through transformers): motivational mid-tempo prompt, round 2 variant f (muted guitar pulse, warm bass, swelling pads); candidate `course-f_8`, seed in `data/eval/cc-132-music/round2/run.json`; cut to whole bars by `pipelines/cut_loops.py` | Under $1 of Modal GPU time for all candidates (not itemised) | Generated, no melody input and no recording or film theme; MusicGen weights are CC BY-NC 4.0 (non-commercial), code is MIT; commercial rights to the output are not settled; the music plays by default (owner decision 2026-10-29) and `?music=0` turns it off |
| `public/assets/music/dojo.ogg` | Loop for the Dojo and the university Labs (the only two screens that use it): a light xylophone with long echo over a wide, underwater cave pad, free tempo, 26.94 s | 2026-11-03 | Text prompt only to MusicGen medium (Meta AudioCraft weights, loaded through transformers): `pipelines/music_dojo.py`, candidate `cave-a-xylo-echo`, seed 611, run record in `../conquercourse-assets/eval-full/cc-132-dojo-music2/run.json`; swell tamed with a slow compressor, then a 3 s equal-power crossfade of the tail into the head so it loops, mono 32 kHz, rms 0.05 (half the old level) | About $1 of Modal GPU time for the five options | Generated, no melody input and no recording; replaces the earlier track, which the product owner reported as copyrighted and which is no longer in the repo; MusicGen weights are CC BY-NC 4.0 (non-commercial), code is MIT; commercial rights to the output are not settled, so swap before a sale |
| `public/assets/music/report.ogg` | Loop for the report screen: 7 bars at 110 bpm, 15.273 s | 2026-10-29 | Text prompt only to MusicGen medium (Meta AudioCraft weights, loaded through transformers): motivational mid-tempo prompt, round 2 variant f, seed 7 (brighter); no filter, its energy above 5 kHz is already under 0.1%; candidate `course-f_7`, seed in `data/eval/cc-132-music/round2/run.json`; cut to whole bars by `pipelines/cut_loops.py` | Under $1 of Modal GPU time for all candidates (not itemised) | Generated, no melody input and no recording or film theme; MusicGen weights are CC BY-NC 4.0 (non-commercial), code is MIT; commercial rights to the output are not settled; the music plays by default (owner decision 2026-10-29) and `?music=0` turns it off |
| `public/assets/music/library.ogg` | Loop for the library screen (the community gallery): 7 bars at 110 bpm, 15.273 s | 2026-10-29 | Text prompt only to MusicGen medium (Meta AudioCraft weights, loaded through transformers): the same loop as the report screen, for the community gallery; candidate `course-f_7`, seed in `data/eval/cc-132-music/round2/run.json`; cut to whole bars by `pipelines/cut_loops.py` | Under $1 of Modal GPU time for all candidates (not itemised) | Generated, no melody input and no recording or film theme; MusicGen weights are CC BY-NC 4.0 (non-commercial), code is MIT; commercial rights to the output are not settled; the music plays by default (owner decision 2026-10-29) and `?music=0` turns it off |
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
| `public/assets/experiments/bars/bars_travel.json` | Hand-over-hand travel along overhead rungs (5 s, `supportedBy` "overhead bars"; experiment, not wired into the game) | 2026-11-03 | `scripts/bars-fallback-clips.ts` from `src/motion/bars-pose.ts` (our code, no capture, no model); gate pass and bar check in `data/eval/bar-motion/README.md` | None | Ours (no third-party data). A procedural fallback; the Kimodo and CMU routes did not give a hand-over-hand clip. |
| `public/assets/experiments/bars/bars_idle.json` | Idle hang under the bars (3 s, experiment) | 2026-11-03 | `scripts/bars-fallback-clips.ts` from `src/motion/bars-pose.ts` (our code, no capture, no model); gate pass and bar check in `data/eval/bar-motion/README.md` | None | Ours (no third-party data). A procedural fallback; the Kimodo and CMU routes did not give a hand-over-hand clip. |
| `public/assets/experiments/bars/bars_kip.json` | Kip: legs swing the hanging body front and back (4.5 s, experiment) | 2026-11-03 | `scripts/bars-fallback-clips.ts` from `src/motion/bars-pose.ts` (our code, no capture, no model); gate pass and bar check in `data/eval/bar-motion/README.md` | None | Ours (no third-party data). A procedural fallback; the Kimodo and CMU routes did not give a hand-over-hand clip. |
| `public/assets/motion/kimodo_leap.json` | A leap made by Kimodo from text (4 s); kept, not loaded by the game (the product owner chose to stay with motion capture until a move cannot be fixed by composing clips) | Kimodo-SOMA-RP (`kimodo-soma-rp`, commit `e1c219c`), prompt `leap_a`, seed 10 | NVIDIA Open Model License; NVIDIA claims no ownership of outputs |
| `public/assets/motion/roll.json` | Forward roll out of a drop (1.8 s, 30 fps; played in 0.7 s) | Kimodo-SOMA-RP text prompt, sample 4 of prompt `roll_a` ("A person runs forward, drops into a forward roll on the ground with the head tucked, and springs back up to run."); passed the gate and the roll check (`pipelines/motion_on_demand.py`, `data/eval/motion-roll/`) | Kimodo output: NVIDIA's Open Model License claims no rights in outputs; the Rookie keeps motion capture for its other moves (CMU has no roll) |
| `public/assets/motion/vault.json` | Speed vault over a wall (3.2 s, 29.97 fps; the game plays frames 21 to 69, plant foot to landing, with the hands pinned on the real contact point) | Captured from video 01:20 to 01:24 of "Learn Parkour : Pop Vault" by London Parkour, measured and repaired by the video-to-motion pipeline (`data/eval/motion-vault/`); passed the plausibility gate as a clip held by a wall, and the contact detector finds both hands on the top (frames 30 to 55). Replaces the Kimodo vault clip, which showed no hands on the top of the step; the contact-point pose (`src/motion/vault-pose.ts`) stays as the fallback | Creative Commons Attribution (CC BY), credited in the clip file: "Learn Parkour : Pop Vault — London Parkour" |
| `public/assets/motion/climb.json` | Climb onto a ledge top (2.0 s, 29.97 fps; the game plays frames 36 to 59, hands on the ledge to feet on top, with the hands held on the real edge) | Captured from video 00:35 to 00:37 of the same film, same pipeline and eval folder; passed the plausibility gate as a clip held by a higher ledge, and the contact detector finds the right hand on the ledge (frames 36 to 48) | Creative Commons Attribution (CC BY), credited in the clip file: "Learn Parkour : Pop Vault — London Parkour" |
| `public/assets/motion/hurt.json` | Hard fall onto the front (2.1 s, 30 fps; played at its own speed, then the body lies still and gets up slowly) | CMU trial 90_16, "fall on face" (subject 90); passed the gate and the hurt check (`pipelines/motion_on_demand.py hurt`, `data/eval/motion-hurt/`) | CMU, same credit: "The data used in this project was obtained from mocap.cs.cmu.edu." |
| `public/assets/motion/slide.json` | Slide under a head-high ball (key S or Down, CC-240); a sliding-tackle drop to a low seat with the legs out in front, 1.8 s, 30 fps; the game plays the drop in 0.2 s, holds it low while the slide lasts, and plays the get-up in 0.25 s | Kimodo-SOMA-RP text prompt, sample 4 of prompt `slide_d` ("A soccer player running fast does a sliding tackle: drops onto one hip and slides along the grass with the legs stretched out in front, then gets back up."); 1 of 36 samples passed the gate and the slide check (`pipelines/motion_on_demand.py slide`, `data/eval/motion-slide/`) | Kimodo output: NVIDIA's Open Model License claims no rights in outputs; without the file the slide is drawn as the bone-built crouch |
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
| `public/assets/objects/provenance.json` | one record per object: photo fingerprint and size, box, height, pipeline settings, credit line (ours; no photo inside) | ConquerCourse | same as each photo | `scripts/object-provenance.py` (CC-221) |
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
- No clips have been added yet.

## Map, place and sound sources

### Loaded while the game runs
- **Map tiles and style for `?mode=map`** (not stored)
  - What it does: shows the street map behind the pin
  - Source: [OpenFreeMap](https://openfreemap.org), using the `liberty` style at `https://tiles.openfreemap.org/styles/liberty`, with no key
  - Map data: OpenMapTiles and OpenStreetMap
  - Licence and credit: free to use, with no key and no stated limits; credit “OpenFreeMap © OpenMapTiles Data from OpenStreetMap” in the map's own credit line, plus “© OpenStreetMap contributors”
  - Used by: `src/modes/map.ts`
- **`maplibre-gl`** (npm package)
  - What it does: draws the map
  - Source: [MapLibre GL JS](https://maplibre.org)
  - Licence: BSD-3-Clause; fine for any use
  - Used by: `package.json`
- **Place search for `?mode=map`** (not stored)
  - What it does: turns a place name into latitude and longitude
  - Source: Nominatim at `nominatim.openstreetmap.org`, with no key
  - Use limits: at most one request a second, no autocomplete and no bulk use
  - Naming the app: the browser sends no Referer, so the app name is the only mark
  - Licence: results are © OpenStreetMap contributors, under ODbL
  - Fallback: a short list of famous places is shown if the search fails
  - Policy: https://operations.osmfoundation.org/policies/nominatim/
  - Used by: `src/modes/map.ts`
- **Ground height for `?mode=map`** (not stored)
  - What it does: gives the height of the ground under a pin for “Real hills”
  - Source: AWS Terrain Tiles in Terrarium format, zoom 15, from `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, with no key or account
  - Amount: 7 to 9 map tiles per place
  - Licence and credit: open data from SRTM, ASTER, USGS 3DEP and others; credit as in https://github.com/tilezen/joerd/blob/master/docs/attribution.md, shown in the map mode's footer
  - Used by: `src/world/terrain.ts`
- **Place skin data** (`data/eval/cc-178-places/skin/<place>-osm.json`, 4 files, CC-178)
  - What it holds: land, water, roads, trees and building colour tags around four places (Montmartre, Bryant Park, Retiro, Circular Quay)
  - Source: Overpass API (six public servers, one named, polite user agent), fetched 2026-10-29, no key
  - Licence: © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright); the screenshots under `data/eval/cc-178-places/skin-shots/` are derived from it and carry the same credit
  - Used by: `src/world/skin.ts`, `place-skin.html` (a dev page behind `?skin=`)
- **Eleven new Ready places** (`public/assets/places/*.json`, CC-178)
  - What they hold: the Overpass answer, ground heights and the best lane for Piazza San Marco, Plaza Mayor, Place des Vosges, Trafalgar Square, Covent Garden, Washington Square, Union Square, Old Town Square, Piazza Navona, Nyhavn and Boston Common
  - Source: the Overpass and AWS Terrain Tiles sources above, fetched 2026-10-29
  - Licence: © OpenStreetMap contributors, ODbL 1.0; terrain as above
- **Eighteen new Ready places** (`public/assets/places/*.json` and `tiles/*.svg`, CC-90)
  - What they hold: the Overpass answer, ground heights and the best lane for Jordaan, Stephansplatz, Grand-Place, Krakow Main Square, Castle Hill Budapest, Gamla Stan, Temple Bar, Plaka, Stradun, Galata, Gastown, Zocalo, Caminito, Bukchon, Senate Square, Tallinn Old Town, Bo-Kaap and Bryggen
  - Source: built with `scripts/make-places.ts` from the Overpass and AWS Terrain Tiles sources above, fetched 2026-11-01
  - Licence: (c) OpenStreetMap contributors, ODbL 1.0; terrain as above
  - Only the places named in `index.json` with `listed: true` show in the list; the others stay as files
- **Lane photo counts** (`data/eval/cc-90-photolanes/`)
  - What it holds: counts of photos facing each lane before and after the person filter, no pictures
  - Source: Mapillary Graph API, 2026-11-01, `scripts/photos_lane_audit.py`
  - Licence: counts only
- **Loosened people filter sweep** (`data/eval/cc-90-no-filter/`)
  - What it holds: lane coverage per place at three person-size limits (0.1, 0.2, 0.35) and the before and after table, no pictures
  - Source: Mapillary Graph API, 2026-11-01, `scripts/photos_pool.py` and `scripts/photos_people.py --sweep`
  - Licence: counts only
- **Mapillary credit mark** (drawn in `src/ui/place-photos.ts`)
  - What it is: the text "Mapillary" in a green pill that links to mapillary.com; no logo file is shipped
  - Why text: the official logo's licence is unclear
  - Swap plan: replace with the official logo file once Mapillary's brand terms are confirmed, a change in one function
  - Licence: ours (plain text)
- **Mapillary counts** (`data/eval/cc-178-places/audit-stored.json`)
  - What it holds: only counts of photos near each lane, no pictures and no photo ids
  - Source: Mapillary Graph API, bbox search, fetched 2026-10-29 with the project token (kept outside the repo)
  - Licence: counts only; the pictures themselves stay CC BY-SA 4.0 and are shown with credit as before
- **`/api/places` answers** (not stored)
  - What it does: returns the buildings around a pin
  - Source: six public Overpass servers asked at once; one named, polite user agent
  - Keeping: answers are kept for 30 days in the Cloudflare Cache API
  - Use limits: 20 new places per address in ten minutes; fair use and no bulk downloads
  - Licence: answers are © OpenStreetMap contributors, under ODbL
  - Policy: https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
  - Used by: `functions/api/places.ts`
- **Event sounds** (code only, no file)
  - Sounds: jump, land, vault, grab, let-go, splash and finish
  - What they do: give timing feedback in the Course (CC-53)
  - Source: `src/ui/audio.ts`
  - Made with: WebAudio, using short sine, triangle and square tones and a burst of noise for the splash and landing
  - Licence: our own code, so no licence to track; no recording, sample, Freesound file or other sound library is used

### Stored place data and checks
- **`tests/fixtures/overpass-quay.json`**
  - What it holds: 10 building outlines near Circular Quay, Sydney
  - Source: cut from `data/eval/cc-46-osm-world/circular-quay-sydney/overpass.json`
  - Licence: ODbL 1.0; credit “© OpenStreetMap contributors”
  - Used by: `tests/osm.test.ts` and `scripts/map-check.mjs`
- **San Francisco, Barcelona and Sydney with hills**
  - Files: `data/eval/cc-46-osm-world/{san-francisco-lombard,eixample-barcelona-hills,circular-quay-sydney-hills}/`, plus `public/assets/experiments/osm/san-francisco-lombard.glb` and `public/assets/experiments/osm/san-francisco-lombard.course.json`
  - What they hold: the Overpass answer, ground heights and the best lane for a steep San Francisco block, plus Barcelona and Sydney re-run with hills
  - Source: the Overpass and AWS Terrain Tiles sources above, fetched 2026-10-28
  - Licence: ODbL 1.0, with share alike and credit to “© OpenStreetMap contributors”; the terrain credit above also applies
  - Ownership: the course JSON is ours
  - Made with: `scripts/osm-lane.ts --terrain`
- **`data/eval/cc-51-terrain/`**
  - Files: `elevations.json`, `run.json` and `lanes.json`
  - What they hold: ground height at seven places, checked against Open-Meteo and two known heights
  - Source: [Open-Meteo](https://open-meteo.com), using Copernicus GLO-90 data, fetched 2026-10-28 with no key
  - Licence and use: a one-off check only, so nothing from it ships; Open-Meteo's free API is for non-commercial use and its data is CC BY 4.0, with credit to Open-Meteo
  - Ownership: the numbers and report are ours
  - Made with: `scripts/terrain-check.ts`
- **Ready places**
  - Files: `public/assets/places/<slug>.json` and `public/assets/places/index.json`
  - What they hold: eighteen ready places (six parks added in CC-152: Park Güell, Tuileries, Retiro, Bryant Park, Gas Works Park, Dolores Park), each with trimmed building outlines, a 20 m grid of ground heights and the lane summary the search found
  - Building tags kept: `building`, `height` and `building:levels` only
  - Area and size: 120 to 150 m around a point; about 1.1 MB on disk in total
  - Source: © OpenStreetMap contributors through the Overpass API, fetched 2026-10-28 (the six parks on 2026-10-29) from `z.overpass-api.de`, `overpass-api.de` and `maps.mail.ru`, with no key; Montmartre, Eixample, Circular Quay and Lombard Street reuse the CC-46 answers
  - Ground source: AWS Terrain Tiles in Terrarium format, zoom 15, with no account
  - Licence: ODbL 1.0 for a derived database; keep the credit “© OpenStreetMap contributors”, shown on the map page, and share alike
  - Terrain credit: as in https://github.com/tilezen/joerd/blob/master/docs/attribution.md
  - Ownership: the lane summaries are ours
  - Made with: `scripts/make-places.ts`
- **`data/eval/cc-78-map/overpass/`**
  - Files: `*.json`, `*.png`, `run.json` and `README.md`
  - What they hold: the answers behind the ready places, screenshots and numbers
  - Source: the ready-places sources above
  - Licence: ODbL for the answers; the rest is ours
  - Made with: `scripts/make-places.ts` and `scripts/map-places-check.mjs`

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
- `public/assets/demo/bars.course.json` and `bars.run.json`: our own monkey-bars course and its recorded key list, made by `scripts/make-bars-demo.ts`; no third-party content (CC-133).
- `public/assets/demo/swing-to-bars.course.json` and `swing-to-bars.run.json`: our own pull-up bar then monkey bars course and its recorded key list, made by `scripts/make-swing-to-bars-demo.ts`; no third-party content (CC-133).
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
### Montmartre, Paris
- **`public/assets/places/montmartre-paris/photo-1.jpg`**
  - Photo: the dome of the Sacré-Cœur on the Montmartre hill, with the Paris rooftops beyond
  - Author: Gareth Williams
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Paris_-_c.1987_-_The_Rooftops_of_Paris_from_the_Sacre_Coeur.jpg)
  - Licence: [CC BY 2.0](https://creativecommons.org/licenses/by/2.0)
- **`public/assets/places/montmartre-paris/photo-2.jpg`**
  - Photo: the church of Saint-Vincent-de-Paul among the Paris rooftops, seen from Montmartre
  - Author: iMahesh
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:%C3%89glise_Saint-Vincent-de-Paul_-_Elevated_view_from_Montmartre_with_Paris_rooftops.jpg)
  - Licence: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)
- **`public/assets/places/montmartre-paris/photo-3.jpg`**
  - Photo: the view from the Sacré-Cœur steps over the gardens to the Paris skyline
  - Author: cherisam
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Eternal_skyline-View_of_Paris_from_Basilique_de_Sacre_Coeur_-_panoramio.jpg)
  - Licence: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)
### Eixample, Barcelona
- **`public/assets/places/eixample-barcelona/photo-1.jpg`**
  - Photo: the Eixample and Gràcia districts seen from the Montjuïc hill: blocks as far as you can see
  - Author: Ilkka Simomaa
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Barcelona_Eixample_%26_Gr%C3%A0cia_cityscape_from_Montju%C3%AFc_2026-08-14.jpg)
  - Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)
- **`public/assets/places/eixample-barcelona/photo-2.jpg`**
  - Photo: the Dreta de l’Eixample district of Barcelona, seen from above
  - Author: Matti Blume
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Dreta_de_l_Eixample,_Barcelona_(P1170596).jpg)
  - Licence: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.en)
### Circular Quay, Sydney
- **`public/assets/places/circular-quay-sydney/photo-1.jpg`**
  - Photo: office towers above Circular Quay, seen from the water’s edge
  - Author: Alan and Flora Botting
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Circular_Quay_skyline,_Sydney.jpg)
  - Licence: [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0)
- **`public/assets/places/circular-quay-sydney/photo-2.jpg`**
  - Photo: the Sydney skyline from the harbour
  - Author: zombieite
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Sydney_skyline_from_Sydney_Harbour,_May_2021.jpg)
  - Licence: [CC BY 2.0](https://creativecommons.org/licenses/by/2.0)
- **`public/assets/places/circular-quay-sydney/photo-3.jpg`**
  - Photo: circular Quay’s ferry wharfs 4 and 5 seen from the water
  - Author: Ymblanter
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Sydney_Circular_Quay_Wharfs_4_and_5_seen_from_the_water.jpg)
  - Licence: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)
### Lombard Street, San Francisco
- **`public/assets/places/san-francisco-lombard/photo-1.jpg`**
  - Photo: the crooked block of Lombard Street seen from above
  - Author: Christopher Michel
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Lombard_Street_in_2020_01.jpg)
  - Licence: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)
- **`public/assets/places/san-francisco-lombard/photo-2.jpg`**
  - Photo: looking down Lombard Street from the top of the hill
  - Author: Miscellaneous contributor
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Lombard_Street_from_the_top_of_the_street.jpg)
  - Licence: [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en)
- **`public/assets/places/san-francisco-lombard/photo-3.jpg`**
  - Photo: the crooked section of Lombard Street, looking towards Telegraph Hill
  - Author: Edocarli
  - Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Lombard_Street,_crooked,_looking_towards_Telegraph_Hill,_San_Francisco,_CA_(August_2009).jpg)
  - Licence: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)

## Real-object demo courses (CC-84)
| File | What | Made from | Licence | Made with |
|---|---|---|---|---|
| `public/assets/demo/park-rail-run.course.json` | demo course: three handrails and a skate box in a row | the CC0 objects rail-skate-01, rail-skate-02, railing-iron, box-skate-03 (`public/assets/objects/`) | CC0 (objects), our code | `scripts/make-real-demos.ts` |
| `public/assets/demo/park-run.course.json` | demo course: stairs, skate box, two rails, a bench and a handrail in one line (merges the three park courses, CC-115) | the CC0 objects stairs-park-07, box-skate-03, rail-skate-01, rail-skate-02, bench-concrete, railing-iron (`public/assets/objects/`) | CC0 (objects), our code | `scripts/make-real-demos.ts park-run` |
| `public/assets/demo/cannonballs.course.json` | demo course: the First Course with three timed ball launchers (CC-240); a card on the Courses page | 2026-10-31 | `scripts/make-balls-course.ts` from `src/course/default-course.json` and `BALL_LAUNCHERS` in `src/sim/shots.ts`; the plan inside was found by the simulator | ours | none; no third-party content |
| `public/assets/demo/hero-montmartre-paris.course.json` | the film's hero course (CC-210): the stored Montmartre rooftop lane, then the Training course's rope section, one lifted skate box | 2026-10-30 | `scripts/make-hero-course.ts` from `public/assets/places/montmartre-paris.json` (OpenStreetMap buildings, AWS Terrain Tiles) and `training.course.json`; the box is `box-skate-03.glb` (see its row) | OpenStreetMap contributors (ODbL); terrain tiles as in the places rows | The plan inside was found by the simulator; the box is a CC BY 4.0 photo lift from the Voltaplatz skatepark (credit shown on the end card), not from Montmartre |
| `public/assets/demo/hero-montmartre-paris.backdrop.json` | where the Montmartre buildings and street furniture stand around the hero lane (CC-234): the slice's turn, offset, level and shift | 2026-10-30 | `scripts/make-backdrop-frame.ts`, from the same stored place as the course | OpenStreetMap contributors (ODbL), as the course row | A rigid fit: the gaps squeezed in the course move the fit by 0.12 m at most; the buildings are drawn by `?backdrop=montmartre-paris` and are looks only |
| `data/eval/cc-spectacle/film/beat2-slicer-real.mp4` | 7.2 s of the real slicer page on Montmartre for film beat 2 (CC-209): buildings turn to blocks, three lane dots appear | 2026-10-30 | `scripts/film-ui.mjs` recorded the real map page at 1280 px; ffmpeg cut 11.5-18.7 s and cropped the map (panel removed) | OpenStreetMap contributors (ODbL); OpenFreeMap and OpenMapTiles map style (as shown on screen) | A screen recording of our own page; the map attribution is visible in the page but is cropped here, so the end card credits OpenStreetMap |
| `data/eval/cc-spectacle/film/editor-start-scene.png`, `editor-start-scene-with-box.png`, `editor-start-scene-v7.png` | screenshots of the editor start scene on Montmartre (CC-238) | 2026-10-30 | `scripts/film-editor.mjs` with `HERO=1` (and `BOX=1`), headless browser at 1280 px | OpenStreetMap contributors (ODbL) for the building shapes; the box is CC BY 4.0 (Alexis Jazz, Voltaplatz skatepark) | Our own screens; evidence only, not used in the cut |
| `public/assets/demo/plank-two.course.json`, `coaster-two-hills.course.json` | demo courses: a thick plank then a thin one with a post; a gentle hill then a sharp hilltop (CC-115) | none (our own numbers) | ours | `scripts/make-plank-two.ts`, `scripts/coaster-demos.ts` |
| `public/assets/demo/two-ways.course.json` | demo course with one fork: a high way (two bars) and a low way (drop, jump, climb), each with its own proved line (CC-224) | none (our own numbers) | ours | `scripts/make-two-ways-course.ts`, then `scripts/ways-plan.ts` |
| `public/assets/demo/fork-bench-bulb.course.json` | demo course for demo photo 1: one gate, two lanes over the same picture (bench lane: three benches; bulb lane: climb the pole, swing the bar row), each with its own proved line (CC-133); benches, pole and bulbs are placeholder shapes keyed by object id until real lifts replace them | none (our own numbers) | ours | `node scripts/demo-fork-course.mjs` (takes lifted-object GLB paths) |
| `public/assets/demo/bench-and-stairs.course.json` | demo course: a skate box, a bench and park stairs | the CC0 objects box-skate-03, bench-concrete, stairs-park-07 | CC0 (objects), our code | `scripts/make-real-demos.ts` |
| `public/assets/demo/skate-box-and-rail.course.json` | demo course: stairs, a long box, a handrail and a bench | the CC0 objects stairs-park-07, box-skate-03, rail-skate-01, bench-concrete | CC0 (objects), our code | `scripts/make-real-demos.ts` |
| `data/eval/cc-90-photos/montmartre-paris-sheet.jpg` | contact sheet of street photos near the Montmartre lane (evidence for CC-90; not used by the game) | Mapillary images listed in `montmartre-paris-sheet-picks.json` (creator and id), downloaded 2026-10-29 through the Graph API v4 | CC BY-SA 4.0 (Mapillary), credit to the creators; faces and plates blurred by Mapillary | `scripts/photos_sheet.py` |
| `data/eval/cc-90-photos/eixample-barcelona-sheet.jpg` | contact sheet of street photos near the Eixample lane (evidence for CC-90; not used by the game) | Mapillary images listed in `eixample-barcelona-sheet-picks.json` (creator and id), downloaded 2026-10-29 through the Graph API v4 | CC BY-SA 4.0 (Mapillary), credit to the creators; faces and plates blurred by Mapillary | `scripts/photos_sheet.py` |
| `data/eval/cc-90-photos/edinburgh-old-town-sheet.jpg` | contact sheet of street photos near the Edinburgh Old Town lane (evidence for CC-90; not used by the game) | Mapillary images listed in `edinburgh-old-town-sheet-picks.json` (creator and id), downloaded 2026-10-29 through the Graph API v4 | CC BY-SA 4.0 (Mapillary), credit to the creators; faces and plates blurred by Mapillary | `scripts/photos_sheet.py` |
| `public/assets/thumbs/<course>.webp` (one per course card in the Courses gallery, 640x360, 3 to 25 KB each; 16 courses plus tool cards (stock, generate, editor, coaster-builder, map and the twelve Labs) after CC-246; the course stills are cropped to the runner and the first obstacles) | a still of each course at its first obstacle, shown on the gallery cards | made by `scripts/make-thumbs.ts` from our own courses and the meshes listed in the rows above (CC0 objects, OSM-derived buildings) | the licence of the course shown: ours and CC0 for the demo courses; the place stills are derived from OpenStreetMap (ODbL, credit "© OpenStreetMap contributors") | `npm run thumbs` |
| `public/assets/thumbs/map.webp` (640x360, 27 KB) | the World Slicer card picture in the Courses gallery: 3D buildings of Alfama, Lisbon as red blocks, the camera about 50 m above the street (CC-132) | 2026-11-03 | Our own screenshot of our own page `?mode=map` after Slice on Alfama, panels hidden, camera at zoom 18.6 and tilt 70 degrees at 1280 px | Buildings and map from OpenStreetMap (ODbL); credit: Map data: OpenStreetMap contributors | Ours; shows no people |

## Live street photos (CC-90)
| File | What | Made from | Licence | Made with |
|---|---|---|---|---|
| `public/assets/photos-live/<place>.json` (19 listed places plus eixample-barcelona: shibuya-tokyo, montmartre-paris, piazza-san-marco-venice, valletta-harbour-malta, edinburgh-old-town, dolores-park-san-francisco, caminito-buenos-aires, bukchon-seoul, parc-guell-barcelona, alfama-lisbon, stephansplatz-vienna, galata-istanbul, plaka-athens, bryggen-bergen, gamla-stan-stockholm, speicherstadt-hamburg, temple-bar-dublin, main-square-krakow, castle-hill-budapest) | the allow-list of street photos with no close-up or large person (small far figures pass), one list per place: photo id, creator, position and camera direction only (no picture bytes, no picture addresses) | Mapillary images near the place's lane, found through the Graph API v4 on 2026-10-29 and 2026-11-01, kept unless the person detector found a person taller than 0.2 of the picture height; Mapillary's own blur is the base standard (owner, 2026-11-01); box fetched in 50 m tiles (`scripts/photos_pool.py`) | the pictures stay on Mapillary's servers and are shown by address with the creator's name, "Mapillary" and the licence CC BY-SA 4.0 on screen; the list itself is data we made | `scripts/photos_people.py` (torchvision Faster R-CNN ResNet-50 FPN, COCO weights: code BSD-3-Clause, labels CC BY 4.0) |
| `public/assets/places/slicer-defaults.json` | for each of the 47 ready places, the shrink, cut height, line, lane length, clear time and check version of the line the World Slicer opens on (8 KB) | `scripts/slicer-defaults.ts` replays the real simulator on the line and height; 46 clear, Montmartre has no clean line and stores its closest try | ours | `npx tsx scripts/slicer-defaults.ts` (CC-90); `tests/slicer-default.test.ts` replays a sample |
| `public/assets/photos-live/index.json` | the places that have street photos, with a count (under 1 KB) | made from the allow-lists in the same folder | ours | one-line node script (CC-90); `tests/street-photos.test.ts` keeps it true |
| `data/eval/cc-90-photos/live/<place>-kept-sheet.jpg` | up to eight kept photos at 256 px, to check by eye that no close-up person got through (evidence only; not used by the game) | the same Mapillary images | CC BY-SA 4.0 (Mapillary), credit to the creators; faces and plates blurred by Mapillary | `scripts/photos_people.py` |
| `data/eval/cc-120-safety-real/safe-controls-sheet.jpg` | contact sheet of 10 plainly safe control pictures at 170 px (evidence for CC-120; not used by the game) | our own park photos and app screens from `public/assets/`, 2026-10-31 | ours | `scripts/cc120-safety-synthetic.py` |
| `data/eval/cc-120-safety-real/art-anatomy-sheet.jpg` | contact sheet of 5 classical art pictures and 4 Gray's Anatomy plates at 170 px, the false-positive checks (evidence for CC-120; not used by the game) | Wikimedia Commons, downloaded 2026-10-31; titles, links and licences are in `data/eval/cc-120-safety-real/commons-sources.json` | public domain and CC BY 2.0 (credit to the creators in that file) | `scripts/cc120-safety-sources.py` |
| `docs/evidence/cc-120-block-message.png`, `docs/evidence/cc-120-review-message.png` | screenshots of the real Make your own page showing what the player reads when the safety check refuses (evidence for CC-120; not used by the game) | our own screens on the preview with invented stand-in pictures (a cartoon, a sample ID card) | ours | `scripts/cc120-safety-browser.mjs` |
| `public/assets/pieces/<piece>.webp` and `<piece>-large.webp` (one small, 160x90, and one large, 640x360, per piece of the editor's add browser, about 3 to 25 KB each) | the pictures on the add browser's cards and its featured view | made by `scripts/make-piece-icons.ts` (`npm run piece-icons`) from the editor's own 3D view of each piece; flat drawings for the band, bars, rope, photo and import | ours; the real objects keep their photo credit (CC0 or CC BY 4.0, shown on the card) and the person is the Rookie character |

## Street furniture (CC-187)
| File | What | Made from | Licence | Made with |
|---|---|---|---|---|
| `public/assets/places/furniture/<place>.json` (montmartre-paris, eixample-barcelona, circular-quay-sydney, san-francisco-lombard) | where Mapillary's detectors saw street lights, benches, bins, signs, traffic signals, poles and crosswalk paint: id, class, position (metres east and south of the pin), ground height, last-seen date, and the frame that puts the place's mesh into the game | Mapillary `map_features` (object detections, not photos; no person in the data), fetched 2026-10-30 through `functions/api/features.ts` | CC BY-SA 4.0 (Mapillary), credit "Street objects: Mapillary contributors, CC BY-SA 4.0" shown in the game corner with a link to the licence | `scripts/furniture-frame.ts`, `scripts/furniture-fetch.ts` |
| `data/eval/cc-furniture/frames.json` and `shots/*.png` | the exact move from the real world to the game's frame, and before/after pictures (evidence only; not used by the game) | the stored OSM courses and the files above | ours, with the Mapillary data above | `scripts/furniture-frame.ts`, `scripts/furniture-shots.mjs` |
| The street furniture meshes (lamp, bench, bin, sign, signal, pole, crosswalk paint) | boxes and cylinders drawn by code, no model files | this repo (`src/render/furniture-view.ts`) | ours | code |

## More real objects: photos and objects (photos third-party, downloaded 2026-10-29; objects made during the event, CC-110)
| File | Photo | Creator | Source | Licence |
|---|---|---|---|---|
| `data/eval/cc-110-real-objects/inputs/bollard-iron.jpg` | Bollard On Street Corner | Simon Cobb | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bollard_On_Street_Corner.jpg) | CC0 |
| `data/eval/cc-110-real-objects/inputs/hydrant-red.jpg` | Decorative fire hydrant at Windsor Fire Fighter Memorial, Windsor, Ontario, 2025-05-31 | Crisco 1492 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Decorative_fire_hydrant_at_Windsor_Fire_Fighter_Memorial,_Windsor,_Ontario,_2025-05-31.jpg) | CC BY-SA 4.0: credit shown wherever the photo or an object from it appears; the object made from it is shared under the same licence (ShareAlike) |
| `data/eval/cc-110-real-objects/inputs/barrel-oak.jpg` | Four wet wooden barrels | W.carter | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Four_wet_wooden_barrels.jpg) | CC0 |
| `data/eval/cc-110-real-objects/inputs/planter-concrete.jpg` | Big Concrete Planters (53816879695) | Tony Webster | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Big_Concrete_Planters_(53816879695).jpg) | CC BY 2.0: credit shown wherever the photo or an object from it appears |
| `data/eval/cc-110-real-objects/inputs/gabion-wall.jpg` | Gabion Wall | Encik Tekateki | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Gabion_Wall.jpg) | CC0 |
| `data/eval/cc-110-real-objects/inputs/pipe-ring.jpg` | Concrete pipe stile on Elland Footpath 25 - geograph.org.uk - 4080358 | Humphrey Bolton | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Concrete_pipe_stile_on_Elland_Footpath_25_-_geograph.org.uk_-_4080358.jpg) | CC BY-SA 2.0: credit shown wherever the photo or an object from it appears; the object made from it is shared under the same licence (ShareAlike) |
| `data/eval/cc-110-real-objects/inputs/picnic-table.jpg` | Picnic table curves | Hu Nhu | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Picnic_table_curves.jpg) | CC0 |
| `data/eval/cc-110-real-objects/inputs/bench-concrete-curve.jpg` | Concrete bench, Chester Road, Newquay, Cornwall - May 2023 | Mutney | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Concrete_bench,_Chester_Road,_Newquay,_Cornwall_-_May_2023.jpg) | CC0 |
| `data/eval/cc-110-real-objects/inputs/railing-red.jpg` | Jansbrug - Haarlem - Metal railing - along | AgainErick | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Jansbrug_-_Haarlem_-_Metal_railing_-_along.jpg) | CC BY-SA 4.0: credit shown wherever the photo or an object from it appears; the object made from it is shared under the same licence (ShareAlike) |
| `data/eval/cc-110-real-objects/inputs/fence-split-rail.jpg` | Split rail fence (tried, not shipped: a tangle of rails, the mesh is a heap) | Galen Parks Smith | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Split_rail_fence.jpg) | CC BY-SA 3.0: credit shown wherever the photo or an object from it appears; the object made from it is shared under the same licence (ShareAlike) |
| `data/eval/cc-110-real-objects/inputs/bar-green.jpg` | Outdoor Gym in Berlin-Stralau (Berlin-Friedrichshain) 01 | Singlespeedfahrer | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Outdoor_Gym_in_Berlin-Stralau_(Berlin-Friedrichshain)_01.jpg) | CC0 |
| `data/eval/cc-110-real-objects/inputs/bar-black.jpg` | Bewegungsparcours Schmetterlingswiesen Berlin 2v7 | Singlespeedfahrer | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bewegungsparcours_Schmetterlingswiesen_Berlin_2v7.jpg) | CC0 |
| `data/eval/cc-110-real-objects/inputs/log-driftwood.jpg` | A fallen log of a tree | Awinsongyababa | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:A_fallen_log_of_a_tree.jpg) | CC BY 4.0: credit shown wherever the photo or an object from it appears |
| `data/eval/cc-110-real-objects/inputs/stump-spruce.jpg` | Spruce tree stump in Gullmarsskogen ravine | W.carter | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Spruce_tree_stump_in_Gullmarsskogen_ravine.jpg) | CC0 |

| File | What | Photo and author | Licence | Made with |
|---|---|---|---|---|
| `public/assets/objects/bollard-iron.glb` | bollard, 0.9 m high, 5,820 faces, 273 KB | bollard-iron, Simon Cobb | CC0 | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r1) |
| `public/assets/objects/hydrant-red.glb` | fire hydrant, 0.8 m high, 5,820 faces, 484 KB | Crisco 1492 | CC BY-SA 4.0: credit shown wherever the photo or an object from it appears; the object made from it is shared under the same licence (ShareAlike) | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r1) |
| `public/assets/objects/barrel-oak.glb` | wooden barrel, 0.899 m high, 5,820 faces, 602 KB | barrel-oak, W.carter | CC0 | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r1) |
| `public/assets/objects/picnic-table.glb` | picnic table, 0.75 m high, 5,820 faces, 410 KB | picnic-table, Hu Nhu | CC0 | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r1) |
| `public/assets/objects/pullup-green.glb` | pull-up bar, 2.3 m high, 5,820 faces, 405 KB | bar-green, Singlespeedfahrer | CC0 | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r1) |
| `public/assets/objects/planter-concrete.glb` | planter, 0.45 m high, 5,820 faces, 365 KB | planter-concrete, Tony Webster | CC BY 2.0: credit shown wherever the photo or an object from it appears | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r2) |
| `public/assets/objects/pipe-concrete.glb` | concrete pipe, 0.9 m high, 5,820 faces, 336 KB | pipe-ring, Humphrey Bolton | CC BY-SA 2.0: credit shown wherever the photo or an object from it appears; the object made from it is shared under the same licence (ShareAlike) | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r2) |
| `public/assets/objects/bench-curved.glb` | concrete bench, 0.5 m high, 5,820 faces, 356 KB | bench-concrete-curve, Mutney | CC0 | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r2) |
| `public/assets/objects/railing-red.glb` | metal railing, 0.999 m high, 5,820 faces, 468 KB | railing-red, AgainErick | CC BY-SA 4.0: credit shown wherever the photo or an object from it appears; the object made from it is shared under the same licence (ShareAlike) | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r2) |
| `public/assets/objects/pullup-black.glb` | pull-up bar, 2.3 m high, 5,820 faces, 296 KB | bar-black, Singlespeedfahrer | CC0 | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r2) |
| `public/assets/objects/log-driftwood.glb` | log, 0.798 m high, 5,820 faces, 438 KB | log-driftwood, Awinsongyababa | CC BY 4.0: credit shown wherever the photo or an object from it appears | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r2) |
| `public/assets/objects/stump-spruce.glb` | tree stump, 1.199 m high, 5,820 faces, 495 KB | stump-spruce, W.carter | CC0 | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; no padding; round r2) |
| `public/assets/objects/gabion-wall.glb` | gabion wall, 1.199 m high, 5,820 faces, 354 KB | gabion-wall, Encik Tekateki | CC0 | SAM 3 mask + SAM 3D Objects, baked by `pipelines/photo_to_object.py` (texture 1024; padded 1.5x; round r3) |

- The photos are the Commons copies scaled to 1280 px wide, metadata removed; the privacy check found no person, face or number plate in any.
- The raw lifts and masked photos are kept outside git in `../conquercourse-assets/cc-110-real-objects/` with `SHA256SUMS`.
- The planter is CC BY 2.0 (credit only); the hydrant, the concrete pipe and the canal railing are CC BY-SA, so those three objects carry the same licence.
- The icons in `public/assets/pieces/real-*.webp` are drawn by the editor from the objects above.

## Film media (made during the event, CC-130)
| File | What | Source | Licence | Made with |
|---|---|---|---|---|
| `../conquercourse-assets/music/ruskerdax_-_scaling_up.flac` and `scaling_up.mp3` | music bed for the demo film, 273 s | "Scaling Up" by Ruskerdax, https://opengameart.org/content/scaling-up | CC0 1.0; the author asks for a credit, so the end card thanks Ruskerdax | downloaded by hand; the mp3 is made with ffmpeg; hashes in `../conquercourse-assets/SHA256SUMS.music` |
| `../conquercourse-assets/demo-media/clips/hero.mp4`, `flyover.mp4` | captures of the running game for the proof clip | this repo, `scripts/film-proof.sh` | same as the game assets shown (park01 CC0; box-skate-03 CC BY 4.0 if shown) | stepped-clock capture, frame-blended to 30 fps |
| `public/film/park-run.hero.labels.json`, `park-run.flyover.labels.json` | label anchors for the Park run intro, one file per shot | this repo | ours | written by hand |
| `../conquercourse-assets/demo-media/clips/hook/*.mp4` and `clips/hook916/*.mp4` | takes of the 20 s hook: hero, foot, dash, hand, swing, landing, 1280x720 and 720x1280 at 30 fps | this repo, `scripts/film-hook.sh` (CC-143) | same as the game assets shown (park01 CC0) | stepped-clock capture, every frame drawn and hashed, no blending; the runner now runs on the stepped clock too |
| `../conquercourse-assets/demo-media/music/course.ogg` | music bed of the hook (copy of `public/assets/music/course.ogg`, 100 bpm, measured by `scripts/measure-bpm.py`) | see the course.ogg row above | see the course.ogg row above | cut on the beat in `demo/data/hook/*.json` |
| `public/film/hook-*.labels.json` | label anchors for the hook takes (foot, hand, swing, dash) | this repo | ours | written by hand |

## Edge-touching test photos for pad and retry (own derivatives, made 2026-10-29, CC-170)
- `data/eval/cc-170-pad-retry/inputs/<name>-edge.jpg` (9 files): tight crops of the CC-110 photos bollard-iron, barrel-oak, planter-concrete, pipe-ring, bench-concrete-curve, stump-spruce, bar-green, bar-black and picnic-table, so the object touches the photo edge.
  - Made by `data/eval/cc-170-pad-retry/make_inputs.py`; no new third-party photo was downloaded.
  - Each crop has the licence of its source photo (rows for `data/eval/cc-110-real-objects/inputs/` above); credit and ShareAlike travel with it.
  - They stay in the experiment folder and are not shipped in the game.
- `data/eval/cc-170-pad-retry/inputs/gabion-wall.jpg`: the CC-110 gabion wall as it is (CC0, Encik Tekateki); a real photo that already touches the edge.
- `test-results/cc170-edge-note.png` is a screenshot of the Park with the edge note (ours; photo park01, see its row above).

## Spectacle film and Blender media (CC-209, CC-238)
| File | What | Made on | Made with | Third-party material | Our licence and notes |
|---|---|---|---|---|---|
| `data/eval/cc-spectacle/outputs/*.png` and `inputs/training.glb` | Blender look-test stills and the course exported to glTF (prototype, not shown in the game) | 2026-10-29 | `scripts/export-gltf.ts` and `pipelines/spectacle/render_stills.py` in headless Blender 5.0.1 (`bpy` from PyPI), Cycles on the CPU, on a Vultr VM | None | Blender is GPL; the pictures we render are ours; the Rookie in them is `rookie-a.glb` (see its row); no third-party textures or sky images (the sky is Blender's own physical sky) |
| `public/assets/welcome/{courses,editor,slicer,community}.webp` (400x340 each, about 20 to 60 KB) | the four pictures on the welcome screen tiles, in the game's own look | 2026-10-31 | Rendered by `scripts/welcome-tiles.mjs` (three.js, no paid generation) from our two Rookies, flat-colour boxes, our course thumbnails and two CC0 objects (`bench-concrete`, `hydrant-red`) listed above | None | Ours; the thumbnails and objects keep their own licences from the rows above |
| `public/brand/conquercourse-logo.svg` | ConquerCourse logo for the film start and end cards: a dark rounded panel, an orange stepped course line ending in dots and a pale sun, and the name in one line (redrawn 2026-11-01 to match the owner's pasted style picture) | 2026-11-01 | Drawn by hand as SVG by an AI agent | None | Ours, no outside fonts embedded (system sans-serif) |
| `docs/evidence/cc-143-logo-cards/*.png` (stills); the clips `shot1_v3.mp4` and `shot11_card_v1.mp4` stay in `../conquercourse-assets/film/` | the film's start card (logo and slogan, 4.8 s) and end card (logo, slogan and the Play now pill, 2.4 s) | 2026-11-01 | `scripts/film-d/cards.mjs` (Playwright frames from the time alone, then ffmpeg); sky, blocks, hill and trees are drawn in CSS | None | Ours, no image or font files |
| `data/eval/cc-spectacle/music/film-bed.ogg`, `beats.json` | the film's music bed: `map.ogg` once, then `course-d_8` four times, 67.2 s, with bar markers | 2026-10-30 | Joined with ffmpeg from the project's own MusicGen loops (`public/assets/music/map.ogg`, `../conquercourse-assets/music/course-d_8.ogg`); no new generation | None | Original MusicGen output (see the music rows); free |
| `data/eval/cc-spectacle/music/film-track-full.ogg`, `film-track.run.json` | one long MusicGen try (89.8 s, 100 bpm) for the film | 2026-10-30 | `pipelines/music_film.py` on Modal, `facebook/musicgen-medium`, seed 7; about $1 (Modal pay-as-you-go) | Weights CC BY-NC 4.0, code MIT | Not used: two silent gaps after 23 s; `film-bed.ogg` stays the music |
| `data/eval/cc-spectacle/film/beat1-concept.mp4`, `beat2-concept.mp4`, `beat3-concept.mp4`, `assets/box-skate-03-cutout.png` | animated opening beats: globe to street map, slicing sweep, blocks rise with the photo-lifted box, side view of the hero course | 2026-10-30 | `scripts/film-concept.mjs`: stored Montmartre OSM buildings, `public/assets/park/park03.jpg` and the piece icon of `box-skate-03` (background cut out); concept art, not the app | Map data OpenStreetMap contributors (ODbL); photo and box: Alexis Jazz, Voltaplatz skatepark, CC BY 4.0 (credit shown on screen and on the end card) | Drawn by us from those inputs |
| `data/eval/cc-spectacle/film/*` | film beat stills and clips: street map, slice and blocks (concept stills), the leap clip, the end card | 2026-10-30 | `scripts/osm-concept.mjs`, `scripts/film.mjs`, `scripts/endcard.mjs`; the game on the hero course; buildings from the stored Montmartre file | OpenStreetMap contributors (ODbL) for the map stills | Ours; the runner is `rookie-a.glb` (see its row); the box and objects are CC0 lifts from the Bucharest skatepark photo |
| `../conquercourse-assets/demo-media/music/film-owner-cut.ogg` (sources in `../conquercourse-assets/eval-full/cc-209-demo-film/music/`) | the owner's-cut music: three acts joined on the 100 bpm grid, exactly 84.000 s | 2026-10-31 | `pipelines/music_film2.py` on Modal, `facebook/musicgen-medium`: four single 30 s generations (seeds 11, 22, 33, 44); the three that measured exactly 100.0 bpm were kept, the 133 bpm one dropped, joined with ffmpeg on bar lines; about $1 (Modal pay-as-you-go) | Weights CC BY-NC 4.0, code MIT | Generated, no melody input and no recording or film theme; non-commercial weights, so swap before a sale (see the licence note at the end); `film-bed.ogg` above stays the fallback |
| `../conquercourse-assets/demo-media/clips/demo/*.mp4` | the owner's-cut picture: World Slicer, World Editor and Courses screen recordings, stepped-clock game takes (flyover, dive, the lache in slow motion, coaster, drone, ghost, the two rookies) and the drawn opening beats | 2026-10-31 | `scripts/film-slicer2.mjs`, `scripts/film-editor2.mjs`, `scripts/film-editor3.mjs`, `scripts/film-picker.mjs` and `scripts/film.mjs` (Playwright, software GPU); the plan is in `docs/film-craft.md` | Map data OpenStreetMap contributors (ODbL) in the Slicer and picker shots | Ours; every run is the real game or the real tools, nothing staged; assembled by `demo/` (Remotion) into `test-results/demo-film.mp4` |

## Hard test photos for the upload path (third-party, downloaded 2026-10-30, CC-220)
| File | Photo | Creator | Source | Licence |
|---|---|---|---|---|
| `data/eval/cc-upload-hard-set/inputs/bollard-street.jpg` | Canal Street Bollard Mid City New Orleans, 1280 px thumbnail | Infrogmation of New Orleans | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Canal_Street_Bollard_Mid_City_New_Orleans.jpg) | CC BY-SA 4.0 |
| `data/eval/cc-upload-hard-set/inputs/bollard-row-edge.jpg` | City Road bollards - geograph.org.uk - 1758261, 1280 px thumbnail | Stephen McKay | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:City_Road_bollards_-_geograph.org.uk_-_1758261.jpg) | CC BY-SA 2.0 |
| `data/eval/cc-upload-hard-set/inputs/bike-shelter.jpg` | Bicycle parking rack at Chester station, 1280 px thumbnail | Ben Coleman | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bicycle_parking_rack_at_Chester_station.jpg) | CC0 |
| `data/eval/cc-upload-hard-set/inputs/bike-rack-tangle.jpg` | Bike parking at 19th Street Oakland (3), March 2012, 1280 px thumbnail | Mia5793 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bike_parking_at_19th_Street_Oakland_(3),_March_2012.jpg) | CC0 |
| `data/eval/cc-upload-hard-set/inputs/bin-scooters.jpg` | Large Street Trash Bin of Taipei City 20121229, 1280 px thumbnail | 玄史生 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Large_Street_Trash_Bin_of_Taipei_City_20121229.JPG) | CC0 |
| `data/eval/cc-upload-hard-set/inputs/bin-snow.jpg` | "Welcome to Black Rock" trash bin, Amherst Street, Buffalo, New York - 20220218, 1280 px thumbnail | Andre Carrotflower | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:%22Welcome_to_Black_Rock%22_trash_bin,_Amherst_Street,_Buffalo,_New_York_-_20220218.jpg) | CC BY-SA 4.0 |
| `data/eval/cc-upload-hard-set/inputs/bench-dusk.jpg` | Pomonok Playground td (2019-02-24) 057, 1280 px thumbnail | Tdorante10 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Pomonok_Playground_td_(2019-02-24)_057.jpg) | CC BY-SA 4.0 |
| `data/eval/cc-upload-hard-set/inputs/bench-backlit.jpg` | Leingarten - Großgartach - Eichbott - oberer Eichbott-See - Bank mit Sonnenuntergang (1.2), 1280 px thumbnail | Roman Eisele | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Leingarten_-_Gro%C3%9Fgartach_-_Eichbott_-_oberer_Eichbott-See_-_Bank_mit_Sonnenuntergang_(1.2).jpg) | CC BY-SA 4.0 |
| `data/eval/cc-upload-hard-set/inputs/skate-stairs.jpg` | Ledges, stairs with rail and a bank of the IOR Skatepark in Bucharest (01), 1280 px thumbnail | Neoclassicism Enthusiast | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ledges,_stairs_with_rail_and_a_bank_of_the_IOR_Skatepark_in_Bucharest_(01).jpg) | CC0 |
| `data/eval/cc-upload-hard-set/inputs/calisthenics-berlin.jpg` | Calisthenics Poststadion Berlin 3v5, 1280 px thumbnail | Singlespeedfahrer | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Calisthenics_Poststadion_Berlin_3v5.jpg) | CC0 |
| `data/eval/cc-upload-hard-set/inputs/fitness-fence.jpg` | Booker T. Washington Playground td (2019-07-21) 32 - Outdoor Fitness Equipment, 1280 px thumbnail | Tdorante10 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Booker_T._Washington_Playground_td_(2019-07-21)_32_-_Outdoor_Fitness_Equipment.jpg) | CC BY-SA 4.0 |
| `data/eval/cc-upload-hard-set/inputs/fitness-macombs.jpg` | Macombs Dam Pk td (2019-01-24) 129 - Outdoor Fitness Area, 1280 px thumbnail | Tdorante10 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Macombs_Dam_Pk_td_(2019-01-24)_129_-_Outdoor_Fitness_Area.jpg) | CC BY-SA 4.0 |
| `data/eval/cc-upload-hard-set/inputs/railing-statue.jpg` | Athens Square Park Qns td (2019-08-21) 27, 1280 px thumbnail | Tdorante10 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Athens_Square_Park_Qns_td_(2019-08-21)_27.jpg) | CC BY-SA 4.0 |
| `data/eval/cc-upload-hard-set/inputs/hydrant-cars.jpg` | Suburbia JC walk parking jeh, 1280 px thumbnail | Jim.henderson | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Suburbia_JC_walk_parking_jeh.jpg) | CC0 |
- Chosen because they are cluttered, occluded, at an edge or dark; none shows a person's face (distant people in `railing-statue` are blurred by the privacy step).
- CC BY-SA photos: credit the creator wherever an object made from them is shown.

## Place gallery pictures (CC-207)
- **`public/assets/places/thumbs/<slug>.jpg`** (27 files: 4 from stored photos, 23 picked from Wikimedia Commons in CC-212)
  - What: 320 by 180 crops of the first stored photo of each place, each under 40 KB.
  - Made by `scripts/make-place-thumbs.py`; no new photo was downloaded.
  - Each thumbnail has the licence of its source photo (the rows under "Real photos beside the real worlds" above); the credit is in `public/assets/places/thumbs/index.json` and shows on the card.
  - No people are in them (looked at one by one).
- **`public/assets/places/tiles/<slug>.svg`** (29 files, one per place)
  - What: a plain skyline drawn from the real building heights of the place, for places with no stored photo.
  - Made by `scripts/make-place-tiles.ts` from the stored place files (OpenStreetMap, ODbL 1.0, https://www.openstreetmap.org/copyright).
  - Ours; no third-party picture.

## Place cover photos, the last 20 (CC-90)
- **`public/assets/places/thumbs/<slug>.jpg`** (20 new files; every Ready place now has a cover)
  - What: a 320 by 180 centre crop of one Wikimedia Commons photo per place, each about 16 KB.
  - Picked by `scripts/place_covers.py` (public search API, slow polite client, free licences only: CC0, public domain, CC BY, CC BY-SA) and checked by eye on a contact sheet.
  - No licence or agreement was accepted; no login or cookie was used.
  - The credit (title, author, licence, link) is in `public/assets/places/thumbs/index.json` and shows on the card.
  - Swap before a sale: the CC BY-SA ones may stay only as a demo; the replacement plan is a CC0 or CC BY photo of the same place, or our own photo, as a file change.

## Place cover photos (CC-212)
- **`public/assets/places/thumbs/<slug>.jpg`** (23 new files, one per Ready place that had only a skyline tile)
  - What: a 320 by 180 centre crop of one Wikimedia Commons photo per place, each under 40 KB.
  - Picked by eye from up to 8 free-licence candidates per place; no people, no crowds, no children.
  - Made by `data/eval/cc-212-covers/build-covers.py` from `chosen.json` (same folder).
  - No licence or agreement was accepted; no login or cookie was used (public API only).
  - The credit is in `public/assets/places/thumbs/index.json` and shows on the card.
- **`shibuya-tokyo.jpg`**
  - What: Shibuya skyline from Tokyu Plaza in Omotesando, Harajuku, Tokyo, 2024 May - 2.
  - Author: Ximonic (Simo Räsänen).
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Shibuya_skyline_from_Tokyu_Plaza_in_Omotesando,_Harajuku,_Tokyo,_2024_May_-_2.jpg
- **`ciutadella-barcelona.jpg`**
  - What: Barcelona Parc Ciutadella cascada.
  - Author: Isiwal.
  - Licence: CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0).
  - Source: https://commons.wikimedia.org/wiki/File:Barcelona_Parc_Ciutadella_cascada.jpg
- **`edinburgh-old-town.jpg`**
  - What: Edinburgh Old Town - geograph.org.uk - 7047112.
  - Author: Lauren.
  - Licence: CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0).
  - Source: https://commons.wikimedia.org/wiki/File:Edinburgh_Old_Town_-_geograph.org.uk_-_7047112.jpg
- **`positano-italy.jpg`**
  - What: Positano (Italy) 03.
  - Author: Bernard Gagnon.
  - Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Positano_(Italy)_03.jpg
- **`valletta-harbour-malta.jpg`**
  - What: Grand harbour 2019-04-11-6.
  - Author: Z thomas.
  - Licence: CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0).
  - Source: https://commons.wikimedia.org/wiki/File:Grand_harbour_2019-04-11-6.jpg
- **`speicherstadt-hamburg.jpg`**
  - What: Hamburg, Speicherstadt, Wasserschloss -- 2016 -- 3223-9.
  - Author: Dietmar Rabich.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Hamburg,_Speicherstadt,_Wasserschloss_--_2016_--_3223-9.jpg
- **`alfama-lisbon.jpg`**
  - What: Alfama Rooftops and Tagus River View, Lisbon (54733698959).
  - Author: Dale Cruse.
  - Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Alfama_Rooftops_and_Tagus_River_View,_Lisbon_(54733698959).jpg
- **`parc-guell-barcelona.jpg`**
  - What: Park Güell - 50030738571.
  - Author: Jorge Franganillo.
  - Licence: CC BY 2.0 (https://creativecommons.org/licenses/by/2.0).
  - Source: https://commons.wikimedia.org/wiki/File:Park_G%C3%BCell_-_50030738571.jpg
- **`tuileries-paris.jpg`**
  - What: Pavillon de Flore from the Tuileries Garden, Paris 5 November 2019.
  - Author: Ali Sabbagh.
  - Licence: CC0 (https://creativecommons.org/publicdomain/zero/1.0).
  - Source: https://commons.wikimedia.org/wiki/File:Pavillon_de_Flore_from_the_Tuileries_Garden,_Paris_5_November_2019.jpg
- **`retiro-park-madrid.jpg`**
  - What: Autumn in Retiro Park - Madrid 12.
  - Author: Javier Perez Montes.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Autumn_in_Retiro_Park_-_Madrid_12.jpg
- **`gas-works-park-seattle.jpg`**
  - What: Gas Works Park, Seattle 2.
  - Author: Bernie Ongewe.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Gas_Works_Park,_Seattle_2.jpg
- **`dolores-park-san-francisco.jpg`**
  - What: Mission Dolores Park.
  - Author: Artico2.
  - Licence: CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0).
  - Source: https://commons.wikimedia.org/wiki/File:Mission_Dolores_Park.JPG
- **`piazza-san-marco-venice.jpg`**
  - What: Piazza San Marco from Giudecca Canal.
  - Author: kallerna.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Piazza_San_Marco_from_Giudecca_Canal.jpg
- **`plaza-mayor-madrid.jpg`**
  - What: Plaza Mayor, Madrid, España, 2023-01-03, DD 78.
  - Author: Diego Delso.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Plaza_Mayor,_Madrid,_Espa%C3%B1a,_2023-01-03,_DD_78.jpg
- **`trafalgar-square-london.jpg`**
  - What: TrafalgarSquareEvening.
  - Author: Andreas Tille.
  - Licence: CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0).
  - Source: https://commons.wikimedia.org/wiki/File:TrafalgarSquareEvening.jpg
- **`covent-garden-london.jpg`**
  - What: London, Covent Garden -- 2016 -- 4879.
  - Author: Dietmar Rabich.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:London,_Covent_Garden_--_2016_--_4879.jpg
- **`washington-square-new-york.jpg`**
  - What: Washington Square Park & Newberry Library.
  - Author: TonyTheTiger.
  - Licence: CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0).
  - Source: https://commons.wikimedia.org/wiki/File:Washington_Square_Park_%26_Newberry_Library.JPG
- **`union-square-san-francisco.jpg`**
  - What: San Francisco (CA, USA), Union Square, Dewey Monument -- 2022 -- 2915.
  - Author: Dietmar Rabich.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:San_Francisco_(CA,_USA),_Union_Square,_Dewey_Monument_--_2022_--_2915.jpg
- **`old-town-square-prague.jpg`**
  - What: Prague, Old Town Square, COVID.
  - Author: Tadeáš Gregor.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Prague,_Old_Town_Square,_COVID.jpg
- **`piazza-navona-rome.jpg`**
  - What: PiazzaNavona1.
  - Author: Meshari Alawfi.
  - Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:PiazzaNavona1.jpg
- **`nyhavn-copenhagen.jpg`**
  - What: 2018 - Nyhavn on sunset.
  - Author: Moahim.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:2018_-_Nyhavn_on_sunset.jpg
- **`boston-common-beacon-hill.jpg`**
  - What: Storrow Drive Boston November 2016.
  - Author: King of Hearts.
  - Licence: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:Storrow_Drive_Boston_November_2016.jpg
- **`spanish-steps-rome.jpg`**
  - What: 0 L'église de la Trinità dei Monti à Rome 2.
  - Author: Jean-Pol GRANDMONT.
  - Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0).
  - Source: https://commons.wikimedia.org/wiki/File:0_L%27%C3%A9glise_de_la_Trinit%C3%A0_dei_Monti_%C3%A0_Rome_2.JPG

## Motion from you (CC-222)
- **`../conquercourse-assets/video/hiu_g7ZJgLo.mp4`** (outside git)
  - What: "Learn Parkour : Basic Jump Roll" by London Parkour, 99 s, one adult, a still camera; the test clip for the slice.
  - Source: YouTube `hiu_g7ZJgLo`, downloaded 2026-10-30 with the Creative Commons filter; Creative Commons Attribution (CC BY), credited in the clip file.
  - Used only for 45.5 to 50.5 s.
- **`public/assets/experiments/mymove/roll-lp.json`** and **`roll-lp-whole.json`**
  - What: the joints of that roll (42 and 60 frames, 29.97 fps), not game assets; the first fails the roll check and is never loaded, the second is unchecked and is shown in a test only.
  - Made by `pipelines/my_move.py` on Modal (L4); no frame, face or body shape in the file.
  - Licence: CC BY, "Learn Parkour : Basic Jump Roll, London Parkour".
- **`data/eval/motion-from-you/roll-lp/`** and **`roll-lp-size35/`**
  - What: the run record (gate, move check, timings, cost) and `side-by-side.png`, source frames (faces and people blurred) above and the Rookie below.
  - Same source and licence.

### Candidate clips for "My move" (CC-222, screened 2026-10-30)
- All downloaded with yt-dlp and no cookies, from a YouTube search filtered to Creative Commons, outside git in `../conquercourse-assets/video/mm2/`.
  - Each file's own metadata says "Creative Commons Attribution license (reuse allowed)" (CC BY).
- **`QO3D9Wac8Sw`** "Learn Parkour : Basic Standing Roll" by London Parkour, https://www.youtube.com/watch?v=QO3D9Wac8Sw
  - One adult, still camera, head-on; used only for 39.2 to 43.2 s (a plain low roll, no dive).
  - Output: `public/assets/experiments/mymove/roll-lp-stand.json` (joints only).
- **`Jk4cFkcSiHc`** "Learn Parkour : Basic Crouch Roll" by London Parkour, https://www.youtube.com/watch?v=Jk4cFkcSiHc
  - One adult, still camera, head-on, small in frame; used only for 203.5 to 208.5 s.
  - Output: `public/assets/experiments/mymove/roll-lp-crouch.json` (joints only).
- Screened and rejected, kept only as files outside git: `hIoNstOuurw` (vault roll, person small), `8h6AeYEzPBA` (filmed sideways, cuts), `3KJwvpL668s` (ground work), `w7BhdcqlElM` (cuts, two people), `xtU-Py2iDms` (low shaky camera), `HY7vkvjUY-o` (camera moves, ages unclear), `MvVvdL1MF-g` (children), `8Kg3HmJzwso` (a crowd), `u5plKRYphbk` (a pole, no roll).

- **`pipelines/my_move.py`**, **`scripts/my-move-check.mjs`**: ours; no third-party material.

- Licence note: replace the MusicGen music (`public/assets/music/*.ogg`, model weights CC BY-NC 4.0) before any commercial release.

## Lab 4 Computer vision: labelled street photos (third-party thumbnails, downloaded 2026-10-31)
| File | What | Source | Licence | Swap plan |
|---|---|---|---|---|
| `public/assets/lab/vision/t/<id>.jpg` (32 files, 128 px wide) | thumbnails of street photos from the COCO val2017 set, listed with their Flickr page in `credits.json` | [COCO](https://cocodataset.org) images, Flickr photographers; the creator is named on each linked Flickr page | CC BY 2.0, or "no known copyright restrictions" (COCO licence ids 4 and 7); credit shown under the photos in the Lab | none needed (labs only, behind `?labs=1`); drop a thumbnail by deleting its file and its `credits.json` row |
| `public/assets/lab/vision/scores.txt` | per-photo detector finds plus the hand-drawn person boxes (COCO person labels, CC BY 4.0) for 160 photos; numbers only | ours (`scripts/lab_vision_pick.py`, `scripts/lab_vision_scores.py`, `scripts/lab_vision_ship.py`); Mask R-CNN ResNet-50 FPN COCO weights (code BSD-3-Clause) | ours; labels CC BY 4.0 | rerun the scripts on another labelled set |
| `public/assets/lab/vision/credits.json` | thumbnail credits | ConquerCourse | same as each photo | none |
- Thumbnails were looked through by eye; photos with children were left out of the shipped set.
- The scores cover 160 photos, 32 shown as thumbnails; the rest are counted without a picture.

## Before a sale: what to swap or keep crediting (checked 2026-10-30, CC-220)
- This is the to-do list for a paid release (Steam or other); none of it blocks the hackathon demo.
- Not legal advice: the ShareAlike rows below are the ones to settle with a lawyer or to replace.

| Item | Licence | Why it matters | Swap plan |
|---|---|---|---|
| `public/assets/objects/hydrant-red.glb` | CC BY-SA 4.0 | the 3D object is an adaptation of the photo, so ShareAlike may apply to the file | lift the same kind of object from a CC0 or CC BY photo and replace the file; used only as an editor library piece |
| `public/assets/objects/pipe-concrete.glb` | CC BY-SA 2.0 | same | same |
| `public/assets/objects/railing-red.glb` | CC BY-SA 4.0 | same | same |
| `public/assets/objects/box-skate-03.glb`, `log-driftwood.glb`, `planter-concrete.glb`, `bench-concrete.glb` | CC BY 2.0 or 4.0 | credit is required wherever shown | keep: the credit already shows with the object; check it again in any paid build screen |
| `public/assets/music/*.ogg` | made with MusicGen (weights CC BY-NC 4.0) | non-commercial weights; whether the output may be sold is unsettled | regenerate with a permissive model or buy or commission music; one file swap per track |
| the other 12 shipped objects | CC0 | none | keep |

- The three ShareAlike objects are in the editor's library only; no shipped course needs them, so removing them from `public/assets/objects/index.json` is the cheapest fix.
- Photos used in the Park and the place galleries have their own rows above; check any CC BY-SA row there the same way before a sale.
- `public/assets/places/furniture/*.json` (parked, positions of street furniture from Mapillary map features) is CC BY-SA 4.0 data: do not ship it in a paid build without settling ShareAlike or dropping it.
| `public/assets/lab/timing-default.json` | Lab 7 default result: trap chain, 40 ms, normal, 400 runs, seed 7, with the sigma sweep (about 4 KB) | 2026-11-01 | `npx tsx scripts/labs-default-precompute.ts timing`, same code as the Lab | None | Ours; `tests/lab-populated.test.ts` re-runs it |
| `public/assets/lab/gentest-default.json` | Lab 9 default result: recorded ideas, 2 repairs, 25 proposals, all verdicts (about 24 KB) | 2026-11-01 | `npx tsx scripts/labs-default-precompute.ts gentest` (about two minutes), same code as the Lab | None | Ours; a test re-runs the first proposals |
| `public/assets/lab/rl-default.json` | Lab 12 default result: honest points, alpha 0.2, epsilon 0.2 shrinking, 2000 tries, seed 7 (about 24 KB) | 2026-11-01 | `npx tsx scripts/labs-default-precompute.ts rl`, same code as the Lab | None | Ours; `tests/lab-populated.test.ts` re-runs it |
| `docs/evidence/cc-118-labs-default/*.png`, `timings.json` | One screenshot per Lab opened with no click at 1280 px, and the first-paint times (evidence only) | 2026-11-01 | `scripts/labs-default-smoke.mjs` on a remote machine | None | Ours |
