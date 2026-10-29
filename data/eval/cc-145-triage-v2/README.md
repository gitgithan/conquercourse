# Photo triage v2 (CC-145): cheap mask checks and narrow model questions before the 3D lift

## So what
- No check is good enough to block a photo; the best use is a hint to the person and an automatic fix.
- The one finding that changes the game: a mask that runs into the photo edge predicts "pad the photo and lift again".
  - It caught the gabion wall and the second mural, the two photos whose lift only worked after the photo was padded 1.5 times.
  - It also flagged the first mural, which lifted fine; so the action is "pad and retry", never "reject".
  - It costs nothing and needs no model: it is the share of each photo edge the mask touches.
- Judging the cut-out with a model (Muse Spark Open or Muse Wonder) blocks too much: it said "block" on 14 of 23 photos, and 5 of those lifted well.
- The narrow question "is the whole object in frame?" is answered well (22 of 23 agree with the mask-edge check), but it adds nothing over the free check.
- Muse Wonder is no more accurate than Muse Spark Open here, and costs 2 to 3 times as much per photo.
- A lift costs about 1 cent, so a gate saves almost no money; what it can save is the player's wait and the daily lift budget (CC-108), which only matters once many photos arrive.
- Recommendation:
  - Step 1: ship the free mask-edge check as "pad the photo and retry", behind the switch of the photo tool.
  - Step 2: show a plain-words warning when the mask is a very thin strip or in several pieces, and let the person go on.
  - Step 3: keep "lift it and look" as the gate; it has caught every bad object so far and costs 1 cent.
- Fallback and its quality: today's lift plus a look at the sheet; right on all 23 rows by definition, at 1 cent and about a minute per photo.
- Not a banned category: nothing here grades a person's technique; it only checks a photo of an object.

## How well each check did (23 photos: 14 from CC-110 and 9 from CC-38)
- Truth is what the lift gave: 14 good, 5 partly, 4 no (fence, shadow strip, steps, and the mural that came out as a table).
- "Good rejected" means a photo that lifted well but the check would have stopped.
- "Bad missed" means the check let through a photo whose lift came out partly or no.
- Doing nothing (accept every photo) is right on 14 of 23 for the loose target and on 19 of 23 for the strict one; a check must beat that.

| Check | Cost per photo | Good rejected (of 14) | Bad missed (of 9, loose) | Bad missed (of 4, strict) |
|---|---|---|---|---|
| v1: Muse Spark Open on the raw photo (CC-123, 14 photos only) | $0.007 | 5 of 10 | 1 of 4 | 0 of 1 |
| A, hand rule on mask numbers (tuned on these rows, so optimistic) | 0 | 1 | 1 | 0 |
| A, best single numbers, leave-one-out | 0 | 0 to 4 | 1 to 6 | 3 of 4 |
| B, Muse Spark Open on the cut-out: "block" | $0.0045 | 5 | 0 | 0 |
| B, Muse Wonder on the cut-out: "block" | $0.0091 | 5 | 2 | 1 |
| C, Muse Spark Open "whole object in frame?" is "no" | $0.0033 | 2 | 7 | 3 |
| C, Muse Wonder "whole object in frame?" is "no" | $0.0094 | 2 | 5 | 2 |
| A or C (Spark) | $0.0033 | 2 | 1 | 0 |
| A and B (Spark) | $0.0045 | 1 | 1 | 0 |

- Per-photo answers: [outputs/per_photo.md](outputs/per_photo.md); all counts and the lists of photos: [outputs/combined_scores.json](outputs/combined_scores.json).
- The hand rule is "thin strip (width at least 5 times height), or 3 or more pieces, or the mask touches 15 percent of an edge".
  - It was written after reading the table, on the same rows, so it is a promise to test again, not a result.
- Leave-one-out per number is in [outputs/method_a_scores.json](outputs/method_a_scores.json); the best single numbers are the bounding-box aspect (strict) and the mean width share (loose).
  - On the strict target the best leave-one-out number is right on 20 of 23, against 19 of 23 for doing nothing; that is not a real gain with only 4 bad photos.

## What each method was
- Method A (free): numbers from the SAM 3 mask of each photo (area, fill, border contact per side, pieces, holes, solidity, thinness, edge sharpness); [scripts/triage_v2.py](../../../scripts/triage_v2.py) `features` and `score`.
- Method B: Muse Spark Open (Baseten, temperature 0) sees only the cut-out on a flat grey background and answers ok, review or block with one reason.
- Method C: Muse Spark Open sees the photo with the mask outlined in magenta and answers yes, no or unsure to "is the whole object inside the photo?".
- Method D: the same two questions to Muse Wonder (`muse-wonder-1.0`, Meta Model API, reasoning effort low).
  - Muse Wonder takes images (checked first with two calls); it returns text only.
- Images shown to the models are saved in `inputs/plain/` and `inputs/outline/`; raw replies in `outputs/<model>-<kind>/<photo>.json`.

## What the answers show
- B is too harsh: "block" on the green bar, the planter, the gabion wall, the first mural and the thin handrail (park01), all of which lifted well.
  - It misses nothing, because it blocks nearly everything that looks thin or odd.
  - The photos it let through are the ones a person would also call easy.
- C is a good reader of the photo edge, and that is all it is: 22 of 23 match the mask-edge truth for both models.
  - That truth comes from the mask itself, so the agreement is between two readings of the same edge; a person did not check it.
  - Steps (park07) and the shadow strip (park06) are not cut off, so C cannot see them; only the shape (aspect) did.
- Steps lift flat whatever the photo is like; nothing here sees that from a mask, and it is the known limit from CC-38.
- The two photos fixed by padding (gabion wall, second mural) are the evidence for the "pad and retry" action; that is 2 photos, so it is a lead, not a proof.

## Cost
- Muse Spark Open on Baseten: $0.178 for 46 calls (Baseten credits).
- Muse Wonder on the Meta Model API: $0.424 for 46 calls (Meta credit, $4 in and $20 out per 1M tokens).
- Masks: reused from CC-110 and CC-38, so no SAM 3 run and no Modal cost.
- Whole experiment: about $0.60, under the $3 cap stated before the run.

## Known gaps
- 23 photos with 4 "no" is too small to tune a gate; every number above can move by several photos.
- All photos were picked by hand and have a hand-drawn box; random community photos will be worse.
- Mural02 is ambiguous (a table by default, "partly" after padding); it is counted as "no" and listed in the table.
- The masks came from a person's box; a gate in the live tool sees the mask the same way, but the box would come from the player.

## Ranked next steps
- Step 1: build "pad and retry" in the photo tool from the border-contact number, and measure it on 10 new photos that touch the edge.
- Step 2: collect 30 or more new photos with their lift outcomes (the community queue, CC-108) and test the hand rule on them before anyone relies on it.
- Step 3: if the lift budget ever binds, put a plain-words warning in front of "thin strip" and "many pieces" masks.
- Step 4: leave models out of the gate; ask Muse Spark Open only for the one idea shown to the person (CC-121 move tips).

## Where things are
- `scripts/triage_v2.py`: `features`, `score`, `ask <spark|wonder> <plain|outline>`, `models`, `table`.
- `outputs/features.json`, `method_a_scores.json`, `model_scores.json`, `combined_scores.json`, `per_photo.md`.
- `run.json`: model ids, dates, tokens and cost.
- Photos and masks are read from `data/eval/cc-110-real-objects/` and `data/eval/cc-38-photo-to-3d/`; nothing is copied.
