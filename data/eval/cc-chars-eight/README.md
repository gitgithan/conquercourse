# cc-chars-eight: do the eight made characters move, and does the fit work?

## So what
- All eight characters load on the Rookie skeleton and play run, leap, land and the vault clip with no errors.
- Reach never depended on the mesh; the skin hand stopping short of the bar was the only problem.
- The load-time fit closes the hand gap to 0 for seven of eight; the Potato Blob has almost no arms and stays 0.16 short.
- All eight are in the Characters picker; `?cast=0` hides them.

## What was run
- `scripts/rebuild.py` re-bakes the raw meshes at 3,000 faces and 256 px with a uniform height fit.
- `scripts/make_cast.py` packs the GLBs and thumbnails into `public/assets/characters/cast/`.
- `scripts/check_moves.mjs` loads each one in a browser (T-pose as made and fitted, run, leap, land, vault).
- Results: `check_moves.json`, `run.json`; pictures in `docs/evidence/cc-chars-eight/`.

## Known gaps
- The script's own pass flag is too strict (edge stretch of any one triangle); judge by errors, mean edge stretch and the pictures.
- The bone-drift number is the same 0.244 m for every run, even as made, so it is a demo offset and not a result.
- Banana (torso) and Potato Blob (arms) are clamped.
- Raw meshes and full outputs are in `../conquercourse-assets/eval-full/cc-chars-eight/`.
