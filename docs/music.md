# Music: one loop per screen (CC-132)

Serves the demo mood and play feel; every track is original and made from text only.

## What it is
- Five looping tracks, one per screen: Course, Map (and the Slicer), Editor, Dojo, Report.
- They are made by MusicGen (a Meta AudioCraft model) from a written prompt; no melody, no recording and no film theme goes in.
- It is a lab: `?music=1` turns it on and the browser remembers it; `?music=0` turns it off.
- It starts after the first key press or click, plays quietly (volume 0.2), and M mutes it with the sound effects.
- Moving between screens crossfades over 1.5 s with equal power; the Report track plays when a run ends and the Course track returns on retry.

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
- Raw clips and all candidates (wav and ogg) are in `../conquercourse-assets/music/` with `SHA256SUMS`; only the five chosen ogg files (about 0.6 MB) are in the repo.

## Round 2 (after the product owner listened)
- Feedback: the Course loop was eurobeat and too intense; wanted motivational and driving, but less intense.
- Six new prompts at 100 to 120 bpm: cinematic pulse, uplifting underscore, training montage, soft taiko strings, cinematic electronic, acoustic and electronic mix; two seeds each, 12 clips.
- Measures used to pick the default (nothing was heard):
  - tempo between 100 and 120 bpm;
  - energy above 5 kHz under 1% (no harsh synth lead);
  - spectral centroid under 3 kHz (warm);
  - onsets a second near 7 (the old Course loop had 11.4);
  - the lead-in match error, lowest first.
- Default: `course-f_8` (muted guitar pulse, warm bass, soft claps, swelling pads), 110 bpm, centroid 939 Hz, 0.006% of the energy above 5 kHz, 7.3 onsets a second.
- Other candidates that passed the same measures, for the product owner to hear: `course-d_8`, `course-e_7`, `course-a_8`, `course-f_7`.
- All 12 are in the assets folder on VM3 as `course-<a to f>_<7 or 8>.ogg`; to swap one, copy it to `public/assets/music/course.ogg` and update `loops.json`.

## Picks now
- Course: `course-f_8`.
- Map: `map_11` (cut again with the new start rule, so the wrap is smooth).
- Editor: `editor_33` (cut again the same way).
- Dojo: `dojo_44`, unchanged.
- Report: `report_44` with the highs reduced.
  - Filter: ffmpeg `highshelf=f=4500:g=-10` on the raw clip, before the cut, so the seam is made from the filtered wave.
  - Share of energy above 5 kHz: 0.618% before, 0.031% after (about 13 dB less).
  - Spectral centroid: 3271 Hz before, 1771 Hz after.

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
