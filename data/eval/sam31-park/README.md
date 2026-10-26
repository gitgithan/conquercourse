# SAM 3.1 on park photos (CC-24)

*Serves the hero beat: photo of the park → objects → a course (spec §6, risk in §12).*

## Verdict
- **It carries the demo, with conditions.**
- Masks are clean and sit exactly on the object when SAM 3.1 finds it.
  - Park 01 rail, steps and walls; park 06 steps; park 05 bench and stone wall; park 08 bench.
- It does not always find what the first noun phrase names, so the first phrase is not enough.
  - Core five phrases found at least one useful object on 8 of 10 photos.
  - Adding `platform`, `handrail` and `concrete block` rescued a photo (park 03's skate box and ramps; park 06's balustrade) and gave 9 of 10.
  - Nothing sensible on the net-and-sand playground (park 10): expected, there is no bench, wall or rail in it.
- Plan: fan out about 8 phrases per photo (parallel, about 3 s each), merge by overlap, then let the player fix mistakes with the editable boxes.
- Keep the editable-boxes fallback (spec §6): recall varies by phrase and photo, so the live demo should use a pre-checked photo.
- Roles and sizes are not in the output: SAM 3.1 gives outlines only (scale and role come from the next steps in §6).

## What was run
- 10 openly licensed photos (licences in `docs/ASSETS.md`, details in `inputs/sources.json`), 10 noun phrases each, one phrase per request.
- Core five from the spec: `bench`, `wall`, `rail`, `ledge`, `steps`.
- Synonyms added after the first results: `stairs`, `handrail`, `platform`, `concrete block`, `low wall`.
- Path: client → `server/sam-proxy.mjs` (holds the key, checks the phrase, 8 MB cap, localhost only) → `POST /v1/responses`, model `sam-3.1`, `metadata.include_confidence: "true"`, not streamed.
- Request shape that worked: one `message` with the `input_text` phrase first, then the `input_image` data URL.
- Parser: `meta_sam_parser` (PyPI) decodes the base85 masks; the mask sits at the box's top-left plus the `x`,`y` in the mask tag.

## Results (objects found per phrase)
| photo | bench | wall | rail | ledge | steps | stairs | handrail | platform | concrete block | low wall |
|---|---|---|---|---|---|---|---|---|---|---|
| park01 | 0 | 3 | 1 | 0 | 1 | 1 | 1 | 0 | 4 | 2 |
| park02 | 0 | 2 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 2 |
| park03 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 |
| park04 | 1 | 1 | 0 | 2 | 0 | 0 | 0 | 0 | 43 | 1 |
| park05 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| park06 | 0 | 0 | 0 | 1 | 0 | 0 | 4 | 0 | 0 | 0 |
| park07 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| park08 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| park09 | 3 | 13 | 0 | 0 | 0 | 0 | 0 | 0 | 23 | 9 |
| park10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

- Looked at all overlays (`outputs/overlays/`); notes from that look:
  - Park 01 and 02: `wall` also paints the ledge-like concrete bank (a label mismatch, the shape is right).
  - Park 04: `ledge` painted the wall's capstone and `bench` the seat (good); `concrete block` returned 43 pieces (the wall's courses): too many.
  - Park 06: `ledge` painted the landing slab; `steps` and `stairs` found nothing on the balustraded stairs, but `handrail` found both rails.
  - Park 09: `wall` found 13 pieces, `concrete block` the stumps and steps; small pieces could be merged or dropped by size.
  - Not measured: how well a mask's edges match the true edge (only looked at by eye), and repeat-run variation (the docs say results vary slightly).

## Timing and cost
- 100 requests, all HTTP 200; per request through the proxy: median 2.4 s, p90 3.5 s, max 5.8 s (4 at once, 31 s for all 100).
- Price from the docs: $2.50 per 1,000 images; each request billed `images_processed: 1`.
- Spent: 156 images ≈ **$0.39** (100 behind these results, 6 probes, and 50 lost when my parser crashed before saving); from the price list, not an invoice.
- Whether event credits covered it is not visible from the API; no Modal GPU used (0 GPU minutes).

## Files
- `inputs/`: the 10 photos and `sources.json`.
- `outputs/raw/`: each API response (with `_ms` and `_seconds` added), `outputs/results.json`: counts, scores, boxes, mask pixels per request.
- `outputs/overlays/`: each photo with all masks painted, legend top left.
- `run.json`: totals.

## Re-run
- Start the proxy: `set -a; . ~/.config/ninja/meta.env; set +a; node server/sam-proxy.mjs`
- Run: `pipelines/sam31_park.py data/eval/sam31-park` with `meta_sam_parser`, `pillow` and `numpy` installed (saved responses are reused, so a re-run costs nothing).
- Helper that fetched the photos and licences: `tools/fetch_commons.py`.
