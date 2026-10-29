# Music: one loop per screen (CC-132)

Serves the demo mood and play feel; every track is original and made from text only.

## What it is
- Six looping tracks for six screens: Course, Map (and the Slicer), Editor, Dojo, Report, and the library (the community gallery).
- They are made by MusicGen (a Meta AudioCraft model) from a written prompt; no melody, no recording and no film theme goes in.
- It is on by default (owner, 2026-10-29); `?music=0` turns it off and the browser remembers; `?music=1` turns it on again.
- Automated browsers stay silent unless the address has `?music=1`, so tests make no sound.
- It tries to start at load with a 2 s fade-in at volume 0.3.
  - If the browser refuses (no click, tap or key press yet), a small chip says "Music is on, click anywhere to hear it".
  - The first pointerdown, keydown or touchstart starts it and removes the chip; a mouse move does not count.
- It pauses while the tab is hidden.
- A round speaker button sits at the bottom left of every screen: waves when on, a slash through it when muted, tooltip "Music on/off (M)", pulses a few times the first time it ever plays in a browser.
- M and the button mute it with the sound effects; the mute is remembered in `localStorage`.
- Moving between screens crossfades over 1.5 s with equal power; the Report track plays when a run ends and the Course track returns on retry.
- The library track plays on `?mode=gallery`.

## How the loops were made
- Prompts and seeds are in `data/eval/cc-132-music/run.json` (round 1) and `data/eval/cc-132-music/round2/run.json` (round 2).
- Model: `facebook/musicgen-medium` on a Modal GPU through transformers.
  - AudioCraft's own pip package failed to build on its `av` dependency.
  - The weights are the same, so the model is the same.
- `pipelines/cut_loops.py` does the cut:
  - it finds the tempo and keeps a whole number of 4-beat bars near 15 s;
  - it picks the start whose lead-in best matches the end, and among near-equal starts the one where the wave steps least at the wrap;
  - it fades the tail into the lead-in, so the wrap continues;
  - it sets every loop to the same loudness (rms 0.1).
- Raw clips and all candidates (wav and ogg) are in `../conquercourse-assets/music/` with `SHA256SUMS`; only the six chosen ogg files (about 0.7 MB) are in the repo.

## Round 2 (after the product owner listened)
- Feedback: the Course loop was eurobeat and too intense; wanted motivational and driving, but less intense.
- Six new prompts at 100 to 120 bpm: cinematic pulse, uplifting underscore, training montage, soft taiko strings, cinematic electronic, acoustic and electronic mix; two seeds each, 12 clips.
- Measures used to pick the default (nothing was heard):
  - tempo between 100 and 120 bpm;
  - energy above 5 kHz under 1% (no harsh synth lead);
  - spectral centroid under 3 kHz (warm);
  - onsets a second near 7 (the old Course loop had 11.4);
  - the lead-in match error, lowest first.
- Default at the time: `course-f_8`; the product owner then chose by ear (see Picks now).
- Other candidates that passed the same measures, for the product owner to hear: `course-d_8`, `course-e_7`, `course-a_8`, `course-f_7`.
- All 12 are in the assets folder on VM3 as `course-<a to f>_<7 or 8>.ogg`; to swap one, copy it to `public/assets/music/course.ogg` and update `loops.json`.

## Picks now (the product owner listened to the round-2 candidates)
- Course run: `course-d_8` (soft taiko and low strings, rising, high notes; constant background).
  - The product owner liked it for its high notes but did not name a screen; the Course is our reading of where a constant, epic background fits.
- Editor: `course-f_8` (gentle progression, good for long sessions).
- Report and library (the community gallery, `?mode=gallery`): `course-f_7` (bright, lively).
  - It is the same file under two names, `report.ogg` and `library.ogg`.
  - Its energy above 5 kHz is already 0.059%, under the 0.1% limit, so no filter is applied (the high-shelf of round 2 is not used).
- Map: `map_11`, unchanged.
- Dojo: `dojo_44`, unchanged.

## Wrap jump of each pick
- The jump between the last and the first sample, as a multiple of an ordinary step of the wave; the test allows under 4.
- Course 0.010, Map 0.000, Editor 0.034, Dojo 0.576, Report 0.000, library 0.000.
- Energy above 5 kHz: Course 0.14%, Map 0.89%, Editor 0.006%, Report and library 0.059%; the Dojo loop was made before this was measured.

## What was measured (no listening was possible)
- Wrap jump: the gap between the last and the first sample against the median step of the wave; every chosen loop is under 0.6 (the test allows under 4).
- Length: whole bars at the measured tempo, within 0.05 s.
- Tempo: the measured tempo; the Editor and Report loops measure about 160 and 147 bpm although the prompts asked for 80 and 110, so the bar length follows the measured tempo.
- Brightness: the share of energy above 5 kHz and the spectral centroid, per candidate in the `loops*.json` files.
- Not measured: whether any of it sounds good; the product owner decides by ear.

## Licence
- MusicGen code is MIT; the weights are CC BY-NC 4.0 (non-commercial use only).
- The hackathon entry is non-commercial; before any commercial release the loops must be remade with another model or by a composer.
- Each track has a row in `docs/ASSETS.md`.

## Check
- `tests/music.test.ts` covers the switch, the screens, the crossfade law and the measured loops.
- `scripts/music-check.mjs` loads the page and confirms the right loop is fetched after a key press, and none without the flag.

## Which loop each route plays (checked in a browser by `scripts/music-check.mjs`)
- The check looks like a player (no flag), and fails if a screen fetches no loop, the wrong one, or more than one.

| Route | Loop |
|---|---|
| Course (`/`, `?generate=`, `?course=`, `?mode=rookie`, `?mode=park`, `?mode=diagrams`) | `course.ogg` |
| Report page (a run ends) | `report.ogg` |
| Retry (back to the run) | `course.ogg` |
| `?mode=dojo`, `?mode=lab-search` | `dojo.ogg` |
| `?mode=editor`, `?mode=coaster` | `editor.ogg` |
| `?mode=map`, the Slicer (part of the map) | `map.ogg` |
| `?mode=gallery` (the community gallery, our photo library) | `library.ogg` |
| `?demo=...` films | no music (they never start it) |
- Autoplay: headless Chromium lets sound start at load, so the check also simulates a refusing browser and checks the chip, that a mouse move does nothing, and that the first click starts it.
