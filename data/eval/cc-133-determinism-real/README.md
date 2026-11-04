# Same run, any machine: the game's golden traces on real engines (CC-133)

## So what

- The game's own physics is bit-exact between Node 22, Node 24 and the laptop, so a stored run replays the same there.
- Chromium, Firefox and WebKit each replay 40 of 54 runs exactly and disagree on 14, so a replay checker must not assume one hash fits every browser.
- The cause is the browser's Math functions (sin, cos, exp and others) rounding the last digit differently, not a bug in our code.
- Frame counts and outcomes stayed the same everywhere; only the hashes drift, first at a late frame (for example frame 690 on the swing course).
- No ARM machine was available, so ARM is untested.

## Method

- `engine.ts` replays each demo course with the real simulator: the plan, and a seeded key mash (`mash1`).
- Every frame gets an FNV-1a hash and the whole trace a SHA-256, with the same recipe as `tests/golden/sim-trace.json`.
- `build.mjs` bundles it to one script (`dist/`, not tracked) that runs unchanged in Node and in browser pages.
- `modal_run.py` runs it on Modal CPU containers (x86-64): Node 24.20.0, Node 22.23.0, and Playwright 1.64.1 with Chromium 156.0.8078.4, Firefox 157.0 and WebKit 27.2.
- `compare.mjs` compares each machine with Modal Node 24, frame by frame, and writes `run.json` and `public/assets/lab/determinism-real.json`.
- A probe hashes 20,000 outputs of each Math function, to name which functions round differently.

## Results

| Machine | Matches | Differs in Math |
| --- | --- | --- |
| Laptop Node 24 (x86-64) | 54 of 54 | none |
| Modal Node 24 (reference) | 54 of 54 | none |
| Modal Node 22 | 54 of 54 | pow only (not used by the game runs) |
| Modal Chromium | 40 of 54 | sin, cos, tan, exp, log, atan, atan2, asin, acos, tanh, cbrt |
| Modal Firefox | 40 of 54 | sin, cos, log, asin, acos, hypot |
| Modal WebKit | 40 of 54 | sin, cos, tan, exp, log, atan, atan2, asin, acos, hypot, tanh, cbrt |

- The 14 differing runs are on training, lache, launch, launch-bar, launch-bar-hard, lache-wide, cannonballs, drone and bars-lift.
- Chromium and WebKit agree with each other on 50 of 54 runs; Firefox differs from both.
- Per-run details (frames, first differing frame, hash) are in `run.json`.

## Limits

- No ARM: Modal offers x86-64 only, and no Apple machine or ARM VM was used.
- The container hides the CPU model, so only the architecture is recorded.
- WebKit is Playwright's Linux build, not Safari on a Mac.
- Only the plan and `mash1` runs were checked, on the demo courses.
- Browsers ran headless, so no real GPU was involved.

## Cost

- Estimate: two short Modal CPU runs (2 cores, a few minutes each) and one image build, about a few cents.
- Which credits paid is not verified; Modal showed no charge screen to us.

## Raw output

- Raw per-machine output is in `../conquercourse-assets/eval-full/cc-133-determinism-real/raw/`, outside git.
- See also `docs/lessons-cross-hardware-testing.md` and `data/eval/trace-machines/README.md`.
