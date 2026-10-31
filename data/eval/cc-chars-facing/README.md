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

## Round two: the real Course (2026-11-01)
- The first round looked at a side-view demo that assumed the run goes along +x; players see the Course.
- `scripts/probe-course.mjs` holds Right then Left in the real Course (`?probe=1`) for the Rookie and all eight: `course-probe.json`.
- Result: every character moves, and is turned by the renderer, the way the key says (+1 right, -1 left); nothing was flipped by the fix.
- The skin-against-bones check is only readable standing; mid-stride it is not (see `docs/character-facing-bug.md`).
- `tests/character-facing-course.test.ts` reads the table; pictures: `docs/evidence/cc-chars-facing2/`.
- `scripts/gallery-girl.mjs` makes the Parts gallery before and after pictures (`docs/evidence/cc-gallery-girl/`).
- The make-time check in the maker was not added: the maker has no skeleton, so it cannot tell front from back.
