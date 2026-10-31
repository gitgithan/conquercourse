# Muse Image characters: how well does a text prompt become a playable character?

## So what
- Muse Image makes a clean full-body picture every time, even for strange figures (8 of 8, $0.01 each).
- A picture becomes a rigged, playable character with our own tools for about $0.05 and 2 to 4 minutes (route A).
- All 8 characters, including a banana, a jelly and a potato blob, ran, leapt and landed in the real viewer with no crash and no explosion.
- Each file is about 207 KB to 400 KB, so one character a day per player is cheap to store.
- Recommendation: ship route A behind a feature switch, with a 3,000-face build as the default size.
- Details and the design are in `docs/community-characters.md`.

## Routes tried
- A: Muse Image, then SAM 3.1 cut-out, then our lift on Modal, then bake and rig to Rookie A's 34 bones.
  - Worked 8 of 8.
- B: Muse Image, then SAM 3D Body shape numbers.
  - Worked on the human picture only (hoodie); the other runs were still going when this was written and are recorded as not completed.
- C: Rookie A's body with a new head from route A. Worked 4 of 4, but reads as a Rookie in a mask (scores 3 to 4).
- D: Tripo from the picture.
  - Not run: the balance is 60 credits, one character needs about 110.
- E: Meta 3D AssetGen 2.0 and Meta 3D Gen.
  - Not reachable: no public API or weights found.

## Numbers
- Files: `results/*.json` hold every run (times, costs, sizes, stretch).
- Edge stretch (worst / mean) in the real viewer: Rookie A 9.35 / 1.006; our eight 5.3 to 25.6 worst, 1.03 to 1.24 mean.
- The potato blob is the roughest (25.6 / 1.236); it lost its thin arms in the cut-out.
- By-eye look and fun, 1 to 5: fox 4, hoodie 5, robot 4, cactus 4, banana 5, robocat 4, jelly 4, blob 3.

## Failures
- Modal lifts dropped the connection on robocat (3 tries) and jelly (1 try); a smaller scale or another seed passed.
- The first route B run used a wrong app name; fixed and rerun.

## Not tested
- Route D and route E.
- The Latest creations panel and `GET /api/character` (designed, not built).
- Full-course frame rate with a custom character.
- Prompt moderation, and the licence terms for generated pictures.

## Evidence and raw files
- Picture: `evidence-eight-characters.jpg` (row 1 Muse pictures, row 2 leap, row 3 run).
- Scripts: `scripts/`; prompts: `inputs/prompts.json`.
- Raw pictures, meshes and GLBs are in `../conquercourse-assets/eval-full/cc-char-muse/` with `SHA256SUMS`.
