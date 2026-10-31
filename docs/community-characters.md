# Community characters: how a player makes one, how the game keeps them (CC-108)

*Product owner, 2026-10-31: "See how effective Muse Image is at creating characters. A latest creations panel, split into objects and characters, and anyone can pick a latest character. Will the file size be too big, will there be an explosion of characters? Spend Meta credits where we can. How will strange figures be rigged? Looking right does not matter, silly and broken is fun and sharable. Limit each user to one character a day."*

## So what for the game
- Muse Image is very good at the first step: 8 of 8 pictures came out as a clean, full-body, T-pose character on a plain background, including the three strange ones.
- A picture is not a playable character, so the best route is Muse Image, then SAM 3.1 to cut the figure out, then SAM 3D Objects to lift it to a mesh, then our own rigger onto the Rookie's 34 bones.
- That route (A) gave 8 of 8 characters that run, leap and land with our real motion clips and nothing exploded; a banana, a cactus, a robot cat with four arms and a jellyfish all play.
- It costs about 5 cents and about 3 minutes per character (a Tripo character is about 110 credits, about $1.10, so route A is about 20 times cheaper), and every step except our rigger is a Meta model.
- One character is about 210 KB at 3,000 faces and a 256 px texture (about 380 KB at 6,000 faces), so a "Latest creations" panel is cheap if the game fetches a character only when a player picks it.
- Recommendation: build route A behind a feature switch, one character per player per day, a panel showing the newest 24 of each kind, characters that nobody picks expire after 14 days.
- Fallback if the lift is down or fails twice: route C (a head, hat or hands part on the standard Rookie body), which is a few tens of KB and cannot break the motion.
- Next step: the ranked list at the end.

## What we tested (data in `data/eval/cc-char-muse/`)
- Same 8 prompts for every route: 4 ordinary (a fox, a kid in a hoodie, a robot, a cactus) and 4 strange (a banana, a four-armed robot cat, a jellyfish with a purple bell, a potato blob with noodle arms).
- Every character was posed in the real game viewer on three clips (run, leap, land; nine poses each) and judged from the contact sheets.
- The evidence picture is `data/eval/cc-char-muse/evidence-eight-characters.jpg`: the Muse Image picture on top, then the leap, then a run step.

| Route | What it is | Result on the 8 prompts | Wall time per character | Cost per character | File size | By-eye look and fun (1 to 5) |
|---|---|---|---|---|---|---|
| **A** | Muse Image, SAM 3.1 cut-out, SAM 3D Objects mesh, our auto-rig on the 34 bones | 8 of 8 move on all three clips; 2 of the 8 lifts needed a retry (see failures) | about 2.5 to 3.5 min cold, about 1 min with a warm GPU | about $0.05 cold, about $0.02 warm | 360 to 400 KB at 6,000 faces; about 207 KB at 3,000 faces and 256 px | fox 4, kid 5, robot 4, cactus 4, banana 5, robot cat 4, jellyfish 4, potato blob 3 |
| **B** | Muse Image, SAM 3D Body (the CC-41 shape method) | 1 of 1 human picture (hoodie: 1.64 m, one person, one face); others not completed | about 800 s cold on L4, under $0.10 each | 45 shape numbers, about 3 KB | none: it returns body-shape numbers only, no colours or clothes | not a look; the body keeps the Rookie's look |
| **C** | Rookie A body plus a head part cut from a route-A lift, bolted to the Head bone | 4 of 4 tried move perfectly (the body is the Rookie's own) | same as A (the part comes from the same lift) | same as A | the part alone is about 31 to 48 KB; the recipe is about 150 bytes | fox head 4, robot head 3, cactus head 3, banana head 3 (only the head changes, so it reads as a Rookie in a mask) |
| **D** | Tripo text or image to model, then Blender rig | not run: the Tripo balance is 60 credits and a character takes about 110 | from the Rookie builds: minutes of Tripo plus a supervised rig (the front check misjudged both Rookies) | about 110 credits, about $1.10 at the published $0.01 a credit | Rookie A is 954 KB | the two Rookies (not scored) |
| **E** | Meta 3D AssetGen 2.0 or 3D Gen | not reachable (see "Route E") | not tested | not tested | not tested | not tested |

### Route A in detail (per character, 8 characters)
- Muse Image: 11 to 25 s and $0.01 a picture (the call returns a 1280 x 1920 PNG); 8 of 8 usable at the first try.
- SAM 3.1 cut-out: 12 to 17 s and about $0.0025 a call; 7 of 8 masks were good, the potato blob scored 0.53 and missed the noodle arms (it still played).
- SAM 3D Objects lift on Modal: 9 to 18 s of GPU after a 45 to 54 s model load; about $0.03 to $0.04 cold, $0.005 to $0.01 warm (L40S at $1.95 an hour).
- Our bake and rig on a laptop CPU: 4 to 11 s; no Blender is needed (the weights come from each vertex's nearest bones, the same fallback the Rookie rig used).
- Motion check: edge stretch against the bind pose, worst over nine poses, with the two Tripo Rookies as the baseline (9.4 and 5.6).
  - Mean stretch is 1.03 to 1.10 for seven characters and 1.24 for the potato blob; the Rookies sit at 1.006.
  - The worst single edges stretch 6 to 26 times where the limbs of a figure meet (a tail, a crotch, an armpit); none broke a triangle apart or crashed the viewer.

### Failures to plan for
- The SAM 3D Objects call lost its connection for the robot cat (3 tries) and the jellyfish (1 try) at full picture size.
- The robot cat passed when the picture and mask were shrunk to 60 percent first, the jellyfish passed with another seed.
- Rule: retry once with a new seed, then once at 60 percent size, then tell the player and give the day's slot back.
- The cut-out can miss thin limbs (the potato's noodle arms); the character is still playable, so this is a looks problem and not a block.

### Route B in detail
- SAM 3D Body needs one person and one face, and it returns 45 shape numbers and a height, never a mesh or colours (CC-41 uses it to reshape the Rookie).
- It is humanoid only by design, so a banana, a jellyfish or a four-armed cat cannot use it; the hoodie picture gave shape numbers; the non-human pictures had not finished when this was written, so they count as not completed.
- Verdict: good for "make the Rookie my size", wrong for a community character maker.

### Route E in detail (stated plainly, nothing guessed)
- Meta 3D AssetGen 2.0 is described by Meta as used internally and rolling out to Horizon creators later; we found no public API or weights ([Meta's announcement](https://developers.meta.com/horizon/blog/AssetGen2)).
- Meta 3D Gen was published as a research paper and project page in July 2024 ([paper](https://ai.meta.com/research/publications/meta-3d-gen/)); we found no released weights.
- The Meta Model API model list on 2026-10-31 holds Muse Spark, Muse Image, Muse Wonder, Muse Voice, and SAM 3.1: no 3D model.
- So route E is not available to us; if Meta opens it, it replaces the SAM 3D Objects step and nothing else changes.

## How strange figures move on our rig
- Looking right does not matter; the clips need only the Rookie's 34 bones, so every character is fitted into the Rookie's box (same height, same arm span within 0.6 to 1.6 times) and each vertex follows its 4 nearest bones.
- That works for anything with a head, two arms and two legs in roughly a T-pose, which is what the picture prompt asks for.
- A banana gets legs where the legs are, a jellyfish moves its tentacles with the arms and legs, a potato rolls and flaps; silly and slightly broken is the point.
- Extra limbs (the robot cat's four arms) follow the nearest bone, so the second pair rides with the first; it looks like a clinging passenger and is funny.
- A figure with no T-pose (a snake, a dog on four legs) would fit badly; the picture prompt fixes the pose, and a failed fit shows in the preview before the player publishes.
- Nothing about the rig depends on a person; the motion clips stay the ones we already check (plausibility gate), and a character only changes the skin.

## The size and "explosion" design
- **Hard limits, checked on the server:** GLB at most 450 KB, at most 7,000 vertices, one 512 px or smaller texture, exactly the 34 bone names, skin indices under 34, no animations, no extra nodes.
- **Default build:** 3,000 faces and a 256 px JPEG, about 210 KB (measured 207 KB for two characters; they look almost the same as the 6,000-face ones).
- **Smaller still, later:** the file is mostly vertex data, so meshopt or Draco compression could reach about 100 KB; not built.
- **Thumbnails:** a 96 px WebP, at most 8 KB, stored with the row; the panel loads 24 per kind, about 200 KB each time.
- **Fetch on pick only:** the panel never loads a GLB; the GLB downloads when a player presses "Play as", is cached by the browser (its id is its content hash, so the cache never goes stale), and the choice is remembered on the device.
- **Per-player limit:** one new character a day per player, tied to a one-way code that never holds an address; how a player is told apart is kept out of the repo (see `docs/object-catalogue.md` and the private notes).
- **Whole-game limit:** a daily total for all players, the same style as the object budget in `docs/object-catalogue.md` (100 a day to start).
- **Duplicates:** the prompt text and the picture hash are stored; an identical prompt returns the existing character instead of a new one.
- **The panel is a window, not an archive:** it shows the newest 24 per kind; older ones leave the panel.
- **Expiry:** a character picked by nobody for 14 days is deleted; a character picked 10 or more times in a week is kept as a "Keeper" and listed on its own tab.
- **Worst case, worked out:** 100 characters a day at 400 KB is 40 MB a day; with 14-day expiry the store holds at most about 560 MB, under both the D1 and the R2 free tiers (to confirm against Cloudflare's current limits before launch).
- **Where to keep the files:** start in D1 as base64 text next to the thumbnail, the same way community photos are stored today (a row of about 560 KB should fit D1's 2 MB row limit, to confirm); move the GLBs to R2 if the count passes about 500 or the reads get heavy.

## The "Latest creations" panel
- **Where:** the Community area, Explore tab, below the course cards; two sub-tabs, **Latest objects** and **Latest characters**.
- **Card:** thumbnail, a short name taken from the prompt, how many players use it, one button: "Use" for an object (puts it in the World Editor tray) and "Play as" for a character.
- **Pick:** the picked character is the one the Course, the Dojo and the ghost show; "Back to the Rookie" is always one click away.
- **Making one (feature switch `?chars=1`):** Describe, Picture (Muse Image draws it; up to 3 tries a day for pictures), Check (Muse Spark Open reads the text and the picture), Build (about 3 minutes with a progress bar), Preview (it runs the three clips), Publish.
- **Preview before publish:** the player sees the character run and leap; if it fails the fit the slot is given back.
- **Plain rules shown on the page:** no real people, no children, no weapons; anything the check marks "review" waits for the product owner, the same queue as photos (CC-112).

## How the chosen character plugs into the game
- `loadRookie(id, names, parents, base, url)` already takes a `url` for a body built on the 34 bones (CC-41), so the loader needs no change.
- A new `GET /api/character?id=` returns the stored GLB bytes with `cache-control: public, max-age=31536000, immutable`; the page passes a blob URL to `loadRookie`.
- If the file fails to load or lacks a bone, the game falls back to Rookie A and says so in one plain line.
- A trial switch already exists for testing: `?demo=rookie&pose=1&body=<glb url>` shows any GLB in Rookie A's place, with a `__skinStretch()` check (this is what `05_pose_check.mjs` drives).

## Spending Meta credits on purpose
- Every step except our rigger is a Meta model, in this order: Muse Spark Open (the prompt check), Muse Image (the picture), SAM 3.1 (the cut-out), SAM 3D Objects (the mesh, open weights on Modal).
- Meta API credits are only about 1.25 cents of a character ($0.01 picture plus $0.0025 cut-out); the rest is Modal GPU time.
- To use more Meta credits on purpose: let a player try up to 3 pictures (3 Muse Image calls), and offer "make it silly" and "change the colours" through `/images/edits` on the approved picture (1 call each).
- At 100 characters a day with 3 pictures each, Meta spend is about $3.25 a day; this is a choice for the product owner, not a need.

## What was not tested
- Route D (Tripo): not run, because the Tripo balance (60 credits) is below the 110 one character needs; a top-up of at least 160 credits (about $1.60 at $0.01 a credit) would pay for two runs, and Meta and Modal credits do not cover Tripo.
- Route E: not reachable.
- The panel, the API, the 14-day expiry and the server checks are designed here and not built.
- Compressed GLBs (meshopt, Draco) and WebP textures in a GLB: not built.
- Only the Chrome software renderer was used; frame rate with a custom character in a full course run was not measured.
- Safety checks (the Muse Spark Open prompt check on these 8 prompts) were not run; none of the prompts names a real person, a child or a weapon.
- The licence of pictures made by Muse Image and of SAM 3D outputs is as the Meta Model API and the open-weights terms say today; confirm before a public launch.

## Ranked next steps
1. Build `POST /api/character` and `GET /api/character` with the size checks, one character a day, and the D1 table (one issue, about half a day), behind `?chars=1`.
2. Build the Latest creations panel with the two sub-tabs and "Play as" (half a day).
3. Move the lift and rig behind one Modal function so the browser sends a picture and gets a GLB (half a day); keep the retry rule above.
4. Add the Muse Spark Open check on the text and the picture, and the "review" queue.
5. Try meshopt compression to reach about 100 KB.
6. Offer route C parts (hats, heads, hands) as a second, smaller maker, so a player can dress the Rookie without the lift.
