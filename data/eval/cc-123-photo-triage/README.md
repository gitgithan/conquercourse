# Photo triage with Muse Spark Open (CC-123)

## So what
- Not useful as a gate: it agreed with what really happened on 3 of 14 photos.
- It rejected or downgraded 9 of the 10 photos that lifted well, because it judges the photo; our hand-drawn box and SAM 3 cope with crops, clutter and angles.
- It did name real flaws (a cropped railing, a fence that runs out of frame, a table seen end-on), so its notes are a fair reading of the photo, not a forecast of the lift.
- Recommendation: keep the check out of the photo-to-object tool; use it only as a hint to the person ("the whole object is not in the photo").
- Fallback and its quality: today's gate is the lift itself plus a look at the result, which has caught every bad object so far.
- Ranked next steps:
  - 1. Ask the model to judge the cut-out mask, not the raw photo (the mask is what the lift sees).
  - 2. Ask only the narrow question "is the whole object in frame?", which the model answers well.
  - 3. Do nothing; the lift costs about 1 cent per photo, so a bad photo is cheap to try.

## What was run
- Inputs: the 14 photos of CC-110 (`../cc-110-real-objects/inputs/`).
- Model: Muse Spark Open on Baseten, temperature 0, one call per photo, 47,231 tokens in all (about $0.1).
- Truth: 10 shipped as good, 3 partly (picnic table, canal railing, driftwood log), 1 not shipped (split-rail fence); the README of CC-110 has the details.
- Outputs: `outputs/<photo>.json` (raw replies), `results.json`, `run.json`.

## Result
- Agreement: 3 of 14 (the hydrant, the picnic table, the split-rail fence).
- The failed fence was caught (verdict poor).
- False alarms: barrel, planter, gabion wall, pipe ring and spruce stump rated poor, and all lifted well.
- The partly railing was rated poor and the partly log poor, which is the harsh side of the truth.
