# Crop finder: can the Segment Objects finder find the monkey bars with input tricks? (CC-133)

## So what
- Yes, partly, with no hand-drawn box.
  - **The loops across the top are found**: a crop of the upper half of the photo, three extra phrases ("overhead bars", "metal bars", "bar grid") and a shape check (wide, thin, horizontal) give an outline at rank 2 of 12.
  - The outline is labelled "overhead bars" with score 0.57; its box is IoU 0.40 with the product owner's red box (the red boxes are loose by-eye boxes, so about 0.4 to 0.6 is the realistic ceiling).
  - **The left grid is only half found**: the same recipe at a score floor of 0.10 to 0.20 puts a left-grid outline at rank 12 of 12 (IoU 0.57, score about 0.11).
  - At the normal floor of 0.35 the left grid is **not found** (best IoU 0.16).
- The two tricks that matter are the **shape check** and the **new phrases**; **upscaling and tiles do not help** and cost 2x to 7x more.
  - The shape check on its own (full photo, floor 0.35) already lifts the loops to rank 7 (IoU 0.41); it drops tall poles, which crowd the list of 12.
  - The cropping helps because the loops then rank near the top; it does not make the model see anything new.
- The raw candidate list is a trap: at a floor of 0.10 the full photo gives 185 to 424 boxes, and the best of them matches both red boxes (IoU 0.43 and 0.64).
  - That is "best of many", not a product result: with the cap of 12, poles fill the list and neither bar pattern appears (IoU 0.02 and 0.05).
  - Only the rows marked "top 12" below say what a player would see.
- Recommendation for the product (a decision for the product owner):
  - **Add the three bar phrases and the shape check to the finder now**: free, no extra pass, one more phrase per pass costs about 0.1 s on an L4.
  - **Add a second finder pass over the upper half** (1 extra image, 2 to 4 s, about $0.001 on an L4) as an option behind a feature switch; it found the loops on this photo and the left grid only at the very bottom of the list.
  - Do **not** add 2x upscaling or nine tiles: no gain here, 22 s to 48 s per photo.
  - The "upper half" rule is a guess that fits this photo (bars against sky); it is **one photo, so not proven**.
    - Run it on the other park photos before the switch goes on for everyone.
  - Still not found: the left grid at a normal score; the lower bars and the right-hand bars were not scored (no red box); a clean per-bar mask (boxes only here).
- Classic computer vision (Canny + Hough long horizontal lines) **does not work as a proposal**: it returns one box covering the whole upper half (trees and the building make the same lines), IoU 0.11 and 0.06.

## What was run
- Photo: photo 2 of [demo-lifts](../demo-lifts/README.md) (1280 x 960, Rataje workout park), the privacy-blurred copy the finder sees (privacy found no people, faces or plates on it).
- Red boxes and overlap measures: the same as [finder_vs_red_boxes.py](../demo-lifts/scripts/finder_vs_red_boxes.py) (boxes only, approximate, a few pixels either way).
  - Loops: x 570 to 1039, y 264 to 375.
  - Left grid: x 57 to 406, y 345 to 425.
- One Modal run (throw-away app `cc-crop-finder-lab`, same image and weights as the deployed finder, L4): 17 views x 25 phrases at a floor of 0.10, boxes mapped back to full-photo pixels.
  - Views: full photo, 2x full photo, upper half (1x, 2x), loops region and left region (1x, 2x), nine tiles of 640 x 480 with stride 320 x 240 shown at 2x.
  - The region crops were chosen by me knowing where the bars are, so they are an **oracle**; only "upper half" and the tiles are blind.
  - Phrases: the 17 of the finder plus "overhead ladder", "horizontal ladder", "bar grid", "metal bars", "climbing frame", "overhead bars", "ladder", "gymnastic bars" ("pull-up bar" and "monkey bars" were already in).
  - Cost: 1 run, about 176 s from start to finish including a cold start and image load; at $0.80 an hour for an L4 that is **about $0.04** (an A10G fallback would be about $0.05).
  - The first launch failed at startup (a missing file in the image, no GPU time billed).
- Classic CV: CPU only, 1.0 s, no cost.
- Scoring was done offline on the saved candidates ([score_variants.py](scripts/score_variants.py)), so no number below was tuned by re-running the model.
  - "Top 12": best score first, a box 60% the same as a kept box dropped, at most 12; this mirrors `pick()` using boxes instead of masks (the masks were not kept).
  - "Hit": IoU of 0.3 or more with the red box; the number after @ is the rank.

## Results (bar-labelled outlines only, top 12 of the list a player would see)
| Variant | GPU seconds | Loops IoU @ rank | Left grid IoU @ rank |
|---|---|---|---|
| V0 today: full photo, 17 phrases, floor 0.35 | 3.2 | none (0.00) | none (0.11) |
| V3 + 8 new phrases, floor 0.35 | 3.2 | none (0.02) | none (0.05) |
| V3b + 8 new phrases, floor 0.10, no shape check | 3.2 | none (0.02) | none (0.05) |
| V0c old phrases, floor 0.10, shape check | 3.2 | 0.41 @ 12 | none (0.15) |
| V4e new phrases, floor 0.35, shape check | 3.2 | 0.41 @ 7 | none (0.11) |
| V1 upper-half crop, old phrases, floor 0.35 | 2.2 | none (0.20) | none (0.11) |
| V1c loops + left region crops (oracle), old phrases | 3.3 | 0.40 @ 3 | none (0.11) |
| V2 full photo at 2x | 8.3 | none (0.00) | none (0.12) |
| V2b nine 2x tiles, old phrases | 22.5 | 0.34 @ 7 | none (0.07) |
| V4c upper-half crop, new phrases, floor 0.35, shape check | 2.2 | **0.40 @ 2** | none (0.16) |
| V4b same, upper half at 2x | 4.4 | 0.40 @ 2 | none (0.16) |
| V4d same, 2x, floor 0.20 | 4.4 | 0.40 @ 2 | 0.57 @ 12 |
| **V4 same, 2x, floor 0.10** | 4.4 | **0.40 @ 2** | **0.57 @ 12** |
| V5 region crops 2x (oracle), floor 0.10, shape check | 4.5 | 0.41 @ 2 | none (0.15) |
| V6b everything (17 views), floor 0.10, shape check | 48.4 | 0.38 @ 2 | none (0.13) |

- GPU seconds are the model time on the L4 for all 25 phrases; a variant with only the old 17 phrases would be about a third less.
- Dollars per photo: 3 to 5 s is about $0.001 on an L4; 48 s is about $0.011; a cold start adds about 14 s (about $0.003) when no container is warm.
- The full table, including the "any phrase" reading and the raw best-of-all-boxes numbers, is in [scores.json](scores.json).
- Picture: [evidence_v4_top12.jpg](evidence_v4_top12.jpg) shows photo 2 with the red boxes (red) and the 12 outlines of V4 (cyan).
  - The loops outline is number 2; the left grid shows as pieces (numbers 4, 9, 10, 11, 12) rather than one box.
  - Numbers 3, 5, 6, 7 and 8 sit on the right-hand bars, which the product owner did not mark; they look like real bars, so the "false hits" are not all false (not scored).

## Where the scores come from
- In the full-photo list at floor 0.10 the loops show up as "overhead bars" 0.355, "metal bars" 0.26 to 0.28 and "pull-up bar" 0.22; the finder's floor of 0.35 sits right at the edge, which is why "monkey bars" and the old phrases missed.
- In the upper-half crop at 2x the same loops score 0.57; the model is more sure when the bars fill more of the picture.
- The left grid is a dense mesh against a white building with branches in front; it never scores above about 0.29 as one object.

## Not done and risks
- One photo, two boxes: no claim for other parks.
- Boxes only: no per-bar mask quality was measured; the lift of the loops would still need the mask.
- Exemplar prompts, depth, rectification and point prompts (options 4, 5, 7 to 9 of the model limits page) were not tried.
- The red boxes are by-eye, so IoU 0.4 may be a good match; a bar outline that is a bit narrower than the red box loses IoU by area alone.

## Files
- Scripts: [finder_lab.py](scripts/finder_lab.py) (Modal), [score_variants.py](scripts/score_variants.py), [classic_cv.py](scripts/classic_cv.py), [make_evidence.py](scripts/make_evidence.py).
- Outputs: [scores.json](scores.json), [classic_cv.json](classic_cv.json), [run.json](run.json).
- Raw lab output (4953 candidates, 17 views) and the classic CV picture: `../conquercourse-assets/eval-full/crop-finder/` (not in git).

## What went into the live finder (CC-133, 2026-11-03)

- Added: the phrases "overhead bars", "metal bars", "bar grid", and the shape check on those three phrases only (width at least 120 px, wide:high at least 2.5, height at most 160 px).
  - Code: `pipelines/ccpipe/suggest.py` (`bar_shaped`, `pick`); test: `pipelines/tests/test_suggest.py`.
- Not added: the upper-half second pass, upscaling and tiles (owner's call: more cost and time for the same finder).
- Why this is safe: it only adds three phrases and drops three-phrase outlines that are not bar-shaped; other phrases behave as before.
