# cc-chars-facing: which way does each made character face?

## So what
- Three of the eight (Skater, Banana, Potato Blob) came out of the maker facing back against the Rookie's bones, so they ran backwards.
- Cause: the maker's yaw step fits a box, which has no front; the three have a recorded yaw near 180 degrees.
- Fix: the fit measures the shoes at load and turns a back-facing skin around; all eight now face forward or are undecidable (Jelly).

## What was run
- `scripts/measure.ts` measures the shoe score and the foot-bone direction for all eight, as made and after the turn: `facing.json`.
- `scripts/shoot.mjs` renders each character standing (from the left) and running (the game's side camera, 1280 px) in a browser on the VM: `shoot-after.json` has the run direction and the fit's facing report.
- Pictures: `docs/evidence/cc-chars-facing/`; all eight before and after are in `../conquercourse-assets/eval-full/cc-chars-facing/` with `SHA256SUMS`.
- The shipped glb files did not change, so `docs/ASSETS.md` rows and the cc-chars-eight checksums stay as they are.

## Known gaps
- Skater scores -0.13 against a line of -0.1.
- Jelly is unclear and left as made.
- Only the eight were tested.
