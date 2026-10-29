# Music: one loop per screen (CC-132)

Serves the demo mood and play feel; every track is original and made from text only.

## What it is
- Five looping tracks, one per screen: Course, Map (and the Slicer), Editor, Dojo, Report.
- They are made by MusicGen (Meta AudioCraft weights) from a written prompt; no melody, no recording and no film theme goes in.
- It is a lab: `?music=1` turns it on and the browser remembers it; `?music=0` turns it off.
- It starts after the first key press or click, plays quietly (volume 0.2), and M mutes it with the sound effects.
- Moving between screens crossfades over 1.5 s with equal power; the Report fades in when a run ends and the Course returns on retry.

## How the loops were made
- Prompts and seeds are in `data/eval/cc-132-music/run.json`; four seeds per screen, 20 clips of 30 s.
- Model: `facebook/musicgen-medium` on a Modal GPU through transformers (the `audiocraft` pip build failed on its `av` dependency; the weights are the same).
- `pipelines/cut_loops.py` finds the tempo, keeps a whole number of 4-beat bars near 15 s, picks the start whose lead-in best matches the end, and fades the tail into that lead-in so the wrap continues.
- Every loop is set to the same loudness (rms 0.1).
- Raw clips and all 20 candidates (wav and ogg) are in `../conquercourse-assets/music/` with `SHA256SUMS`; only the five chosen ogg files (about 0.6 MB) are in the repo.

## What was measured (no listening was possible)
- Wrap jump: the gap between the last and the first sample, compared with the median step of the wave; the five chosen loops are all under 2.1 (the test allows under 4).
- Length: whole bars at the measured tempo, within 0.05 s.
- Tempo: the measured tempo against the one asked for in the prompt; the chosen loops are within 3% of it.
- Character numbers per candidate (centroid, onsets a second) are in `data/eval/cc-132-music/loops.json`.
- Not measured: whether any of it sounds good; the product owner decides by ear.

## Choice rule and the picks
- Rule: the wrap jump under 2.1, the tempo near the asked one, then the character the screen needs (busiest for the Course, warmest for the Map, calmest for the Dojo).
- Picks: course seed 44, map seed 33, editor seed 11, dojo seed 44, report seed 22.
- The other candidates per screen are in the assets folder; to swap one, copy its ogg to `public/assets/music/<screen>.ogg` and update `loops.json`.

## Licence
- MusicGen code is MIT; the weights are CC BY-NC 4.0 (non-commercial use only).
- The hackathon entry is non-commercial; before any commercial release the loops must be remade with another model or by a composer.
- Each track has a row in `docs/ASSETS.md`.

## Check
- `tests/music.test.ts` covers the switch, the screens, the crossfade law and the measured loops.
- `scripts/music-check.mjs` loads the page and confirms the right loop is fetched after a key press, and none without the flag.
