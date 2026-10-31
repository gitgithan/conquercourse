# Lab 4: Computer vision

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
