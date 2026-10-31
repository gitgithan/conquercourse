# Lab 4: Computer vision

## When you open it
- Live: it opens on the mask threshold the game uses; the photo table and the kept-versus-missed numbers are already filled.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## The question
- How many street photos can the game keep without leaving a person visible in one?
- The game finds people with a detector, blurs them, and drops a photo when too much of it is blurred.
- The player moves the thresholds and reads the trade-off.
- Open it at `?mode=lab-vision&labs=1`.

## The controls
- Score cut: finds scored under it are ignored (0.05 to 0.95).
- Smallest person to mask: finds with a smaller box (share of the photo) are not masked (any size to 5 percent).
- Most of a photo that may be masked: more than this drops the photo (0 to 50 percent).
- A person box over 25 percent of the photo always drops it (fixed, as in `scripts/photos_mask.py`).
- A switch picks which control the curve is drawn along; the other two stay where they are.

## What each output means
- Photos kept: photos the rule keeps, out of 160.
- People missed: hand-drawn people in kept photos whose detector find is ignored (or was never found), so they stay visible.
- Masks on nobody: masks in kept photos that match no hand-drawn person (extra overlapping masks and tiny people nobody outlined count here).
- The curve: photos kept (across) against people missed (up); the best corner is bottom right.
- Mark a setting to leave a numbered dot, so settings can be compared.
- The maths box shows recall, precision and a free-response ROC point (masks on nobody per kept photo, recall) for the setting now.

## What we chose and why
- Score cut 0.3, any person size, 15 percent masked, 25 percent biggest box (shown last, on the page, with live numbers).
- A person left visible costs more than a photo lost, so the game would sooner drop a photo than keep one with a visible person.
- The game also runs a second, different detector over every kept photo and drops it if that finds an uncovered person; the Lab does not model that.

## The data
- 160 street photos from COCO val2017 (CC BY 2.0 or no known copyright restrictions; no crowd labels; a street object labelled), 379 hand-drawn people at least 0.05 percent of the photo.
- Detector: the game's Mask R-CNN (`scripts/photos_mask.py`, photo plus mirror image), score floor 0.05, run offline on VM2 by `scripts/lab_vision_scores.py`.
- The page loads `public/assets/lab/vision/scores.txt` (about 45 KB) and 32 thumbnails (about 75 KB).
- `src/labs/vision/rule.ts` is the rule; `scripts/lab_vision_rule.py` is the same rule in Python; `tests/lab-vision.test.ts` demands equal counts on 60 settings.

## What is not tested
- The table adds the mask shares of the finds; the real code masks the union, so overlapping people count twice here.
- On the game's setting the real union keeps 131 photos and the table keeps 125 (6 photos differ).
- The second-detector check of `scripts/photos_safe.py` is not in the Lab.
- COCO photos are not the Mapillary street photos the game uses; the hand-drawn people are what makes the set labelled.
- Hand-drawn boxes are not perfect, and people smaller than 0.05 percent of a photo are not counted.


## How it was designed
- **The one question:** how many street photos can the game keep without leaving a person visible in one?
- **The choices and why those:**
  - Three controls that the game's own rule has (score cut, smallest person, most of a photo masked), so the player moves the real levers.
  - A curve drawn along one control at a time, so the trade-off between photos kept and people missed is a line and not a guess.
  - Hand-drawn people as the answer key, because a detector cannot be judged by itself.
- **Which real game code runs:** the rule is a port of the photo masking rule in `scripts/photos_mask.py`, written as `src/labs/vision/rule.ts`.
  - The game's detector (Mask R-CNN) was run once, offline, by `scripts/lab_vision_scores.py`; the page never runs a detector.
- **Which data is precomputed:** `public/assets/lab/vision/scores.txt` (the detector's finds for 160 photos) and 32 thumbnails with `credits.json`, all within 300 KB.
- **Order of the screen and why compare comes last:** goal, controls, the three counts, the curve, the maths on request, and "what we chose" last with live numbers, so the player has traded photos for people before reading the game's choice.
- **Scope:** the Lab judges a detector rule on COCO photos; it does not judge any person.

## How we prove the lesson is right
- `tests/lab-vision.test.ts` (9 tests):
  - A photo with no find is kept and one with too much masked is dropped.
  - A person box over a quarter of the photo drops it whatever the mask share.
  - Finds under the score cut or under the smallest size are ignored, which leaves those people missed.
  - A mask on nobody counts as a false mask, and a person nobody found counts as missed.
  - Moving the score cut up never masks more: photos kept rise and people missed never fall.
  - The labelled set is big enough to draw a curve.
  - The files stay within 300 KB, and every thumbnail has a credit row and a table row.
  - The same setting gives the same counts twice.
  - The Python rule (`scripts/lab_vision_rule.py`) gives equal counts to the TypeScript rule on 60 settings (run when `python3` is present).
- Evidence: `docs/evidence/lab-vision-sweep.jpg`; the check script is `scripts/lab-vision-check.mjs`.
- What would make the Lab's claim false:
  - A setting where the Lab says a person is covered and the game's code leaves them visible.

## Limits
- **Overlapping people count twice:** the table adds the mask shares of the finds, while the game masks their union; on the game's setting the real union keeps 131 photos and the table 125.
- **No second detector:** the game's second check (`scripts/photos_safe.py`) is not in the Lab.
- **COCO photos are not Mapillary street photos** (the photos the game uses), so the numbers do not carry over exactly.
- **Hand-drawn boxes are not perfect,** and people under 0.05 percent of a photo are not counted.
- **The 131 against 125 sentence** and the "game's setting" values are not pinned by a test.
- Desktop keyboard and mouse at 1280 px only.

## How to make the lesson better
1. Mask the union of boxes in the Lab, so the 131 against 125 gap closes, and pin it in a test.
2. Add the second detector and show the photos it saves.
3. Use a sample of the game's own street photos with hand-drawn people.
4. Add a test that reads the game's setting from `scripts/photos_mask.py` and compares it with the Lab's default.
5. Read the goal text with a young reader and fix the words.
