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
## Derived from the footage (made during the event, CC-26)
- **What:** `data/eval/cc-26-pexels-motion/<clip>/`: measured 30-joint `motion.json`, contacts, gate report, privacy receipt, and a contact sheet (people blurred, faces pixelated) for each of the four clips above.
- **Made by:** SAM 3, SAM 3D Body, MoGe 2 and SOMA-X on Modal (2026-10-26), with code written in this repo (`pipelines/video_to_motion/`).
- **Licence:** derived from Pexels-licensed videos; the creators stay credited in the footage table; none of these motions is shown in the game before it passes the plausibility check (two of four fail).
- **Kept outside git:** frames, masked frames, MHR parameters (`../conquercourse-assets/work/`).

## Motion data (third-party)
- **CMU Graphics Lab Motion Capture Database:** free to use, credit requested ("The data used in this project was obtained from mocap.cs.cmu.edu"); re-imported here with new code.
- **Candidates checked as publishable:** 100STYLE (CC BY 4.0), HDM05 (CC BY-SA 3.0, derived files must stay CC BY-SA), Kimodo's own generated output (NVIDIA claims no rights in outputs).
- **Not usable in a public repo:** AMASS, HumanML3D, Motion-X, GRAB, BEHAVE, PROX, Nymeria, LAFAN1, AIST++, Ego-Exo4D (non-commercial or no sharing); BONES-SEED (bans public repos).

## Text
- `docs/sayings.md`: written for this project on 2026-10-27.
- Coaching texts used to make contact targets: Wikibooks "Parkour/Basic Moves/Tic Tac" and Wikipedia "Vault (urban movement)", both CC BY-SA 4.0 (credited wherever used).

## The product owner's own clips (to come)
- Filmed by the product owner, an adult, about themselves, with no bystanders; their written consent is recorded here when added.
