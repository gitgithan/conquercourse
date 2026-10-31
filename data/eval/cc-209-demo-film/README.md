# CC-209: the owner's cut of the demo film

## So what
- The product owner's script (Earth to street map, World Slicer, World Editor, the Training course, the lache cliffhanger, fast beats, the two rookies, PLAY NOW) filmed with footage we can really capture.
- No Google Earth footage (licence, and the honesty rules): a drawn globe plus the game's own OpenStreetMap data opens the film instead.
- Music is generated for the film at a measured 100.0 bpm, so every cut lands on a bar line (2.4 s bars, 84.000 s total).

## What was made
- The shot list and craft check live in `docs/film-craft.md` ("The owner's cut").
- Screen recordings: `scripts/film-slicer2.mjs` (World Slicer: radius, slice, deselect, cut to a green height, tilt), `scripts/film-editor2.mjs` (World Editor on Montmartre: Fit, add Bar and Block, move a piece in the Top plan), `scripts/film-editor3.mjs` (the Design partner repairs the broken ready-made course), `scripts/film-picker.mjs` (Courses picker into the Training course).
- Game takes: `scripts/film.mjs` stepped-clock captures (flyover, the new `dive` camera in `src/film/camera.ts`, the lache from a 22 s skip with a slow-motion ramp, coaster, drone, ghost, both rookies).
- Assembly: the Remotion composition `DemoFilm` in `demo/` (data `demo/data/demo/demo-film.json`), rendered by `npm run render:demo` to `test-results/demo-film.mp4`; clips and music are served from `../conquercourse-assets/demo-media/`.

## Music
- `pipelines/music_film2.py` ran four single 30 s generations of `facebook/musicgen-medium` on Modal (seeds 11, 22, 33, 44; about $1); single takes only, because the CC-209 long track (`data/eval/cc-spectacle/music/film-track-full.ogg`) failed with silent gaps from continuations.
- Measured with `scripts/measure-bpm.py`: act1-wonder 100.0 bpm, act2-pulse 100.0, act3-drive-a 100.0, act3-drive-b 133.2 (dropped).
- The mix (`film-owner-cut.ogg`, 84.000 s) joins the three 100 bpm clips on bar lines; act 3 loops act3-drive-a once to fill its bars.
- `run.json` in this folder is the generation record; raw audio stays in `../conquercourse-assets/eval-full/cc-209-demo-film/music/` and the mix in `../conquercourse-assets/demo-media/music/`.

## Recording marks (seconds from each take's start; the film picks windows from these)
- Slicer (`films/ui-slicer2.mp4`): radius 170 at 16.094, slice clicked 18.216, flight done 24.394, deselected 41 to 38 buildings at 34.59, cut moved 215.76, tilted 219.805.
- Editor (`films/ui-editor2.mp4`): Fit 8.115, Bar added 16.224, Block added 22.473, piece moved in the Top plan 27.882.
- Design partner (`films/ui-editor3.mp4`): broken course chosen 6.26, Fix it clicked 14.713, answered (fixed=1) 30.638, applied 32.451.
- Picker (`films/ui-picker.mp4`): gallery shown 55.575, Training course chosen 60.039, course open 68.859.
- Game takes: every stepped-clock take had 0 exact duplicate frames (flyover 240, dive 360, lache 216, coaster 120, drone 240, ghost 180, rookies 270 each).
- Lache timing, measured by a probe take (`films/probe-lache.log`, `--skip 23 --log-runner`): jump at 23.23 s, grab at 23.92 s, let go at 24.76 s, landing at 25.55 s; the film take (`--skip 22 --ramp 1.0,5.6,0.25`) puts the grab at output 4.33 s and the dim is fully dark at 3.96 s, so the grab is never shown.

## Known gaps
- The Design partner beat is a second editor scene (the broken ready-made course), not the Montmartre scene of the adds and move: on the Montmartre scene Fix it only answers "It already works", and a preset cannot replace a hero start scene (its URL rebuilds it on reload).
- The World Slicer panel shows "Radius: 120 m" in the take although the slider was dragged to 170 before slicing (the label said 170 when checked; something re-renders it back); the slice itself was filmed as it really happened.
- Two scenes in the editor shots are pale (flat light and fog in the tool's 3D view); that is how the real tool looks.

## Evidence
- `films/` in the worktree holds the takes and stills while editing; two stills are kept with this README (`evidence-lache-dim.png`, `evidence-partner-proposal.png`).
- The finished film is `test-results/demo-film.mp4` (copied out before any browser run, which wipes `test-results/`).
