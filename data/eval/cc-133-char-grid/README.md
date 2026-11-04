# cc-133-char-grid: the character-fitting grid for a social post

## So what
- One clip, nine cells, shows what the facing fix did for the three made characters that ran backwards: Banana, Skater and Potato Blob.
- Left column: as made, before the fix.
  - Middle: after the fix, running right.
  - Right: after the fix, running left.
- All nine cells are the real Course (`run.course.json`), filmed on the stepped clock, so the speed is the game's own and not slow motion.
- The difference is real but small to the eye: the clearest is the Banana (shoes swung away from the legs as made); Skater and Potato Blob differ in the turn of the feet, knees and face more than in the outline.
- Do not read it as a grade of any technique: the keys are held, nothing is scored.

## What was run
- `scripts/film-char-facing.mjs` (in the repo's `scripts/`): one take, one character, one held key, on the stepped clock (`scripts/film-lib.mjs`), 1280 by 720, 30 pictures a second.
- The left runs first run right for 5 s (not kept) and then hold Left, because the Course starts at its left edge with lava beyond it; the pictures are taken once the turn has settled.
- Camera: the wheel zooms the Course camera to its closest normal view; the first 2.5 s of each run (1.2 s for a left run) are not kept so the run and camera are steady.
- Machines: two Vultr VMs (4 vCPU, 8 GB each, Singapore), one browser at a time each, headless Chromium on SwiftShader; about 8 to 10 minutes a take.
- `scripts/compose.sh FRAMES_DIR OUT.mp4`: crops 400 by 300 around the runner, scales to 480 by 360, keeps 75 pictures (2.5 s), tiles with ffmpeg `xstack`, adds the row and column labels.

## The "as made" look
- The take uses a film-only, uncommitted one-line change in `src/characters/fit.ts` (read from `?nofacing=1`) that skips the turn in `faceForward`, so the character is drawn as the maker produced it.
- The line returns the measured report before the `'back'` turn: `if (new URLSearchParams(location.search).get('nofacing') === '1') return m;`
- It is not part of the game: the shipped fit always turns a back-facing skin around.
- Without that line, the "as made" column would show the fixed look.

## Files
- Big files are outside git in `../conquercourse-assets/cc-133-char-grid/` with `SHA256SUMS`: the grid mp4, the nine take folders (pictures) and the nine cell clips.
- Tracked here: `run.json`, `scripts/compose.sh`.
- Not tracked (owner, 2026-11-04): the clips, the poster and the post text; they are in `../conquercourse-assets/social/char-grid/` and `../conquercourse-assets/cc-133-char-grid/`.

## Known gaps
- The cells are a short window (2.5 s) and the characters are small in a wide Course view; the crop is a 1.2 times enlargement, so it is soft.
- Skater's difference is subtle in the Course; the clearer view is the standing picture in `docs/evidence/cc-chars-facing/`.
- Only the three characters that were wrong are shown, one run each way; no other camera angle.
