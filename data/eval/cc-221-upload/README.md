# CC-221: the player upload path (editor, browser check with stubbed server answers)

## What this shows
- The dialog, the failure and retry, the placed object with its credit line, at 1280 px.
- Made by `scripts/upload-object-check.mjs` (8 of 8 checks pass).

## Files
- `1-dialog.png`: photo chosen, box drawn, label typed.
- `3-done.png`: the finished message, with the pad note and the blur note.
- `4-placed-credit.png`: the placed piece; "From your own photo" under its name.
- `5-library-credit.png`: a library piece; "Photo by <author>, <licence>" under its name.

## Known gap
- The server answers are stubbed here; the live Modal run is described in `docs/pipelines.md`, section 12.

## Live check on the preview (2026-10-30)
- Preview alias `preview-upload.conquercourse.pages.dev` (branch `preview-upload`; production branch is `main`, not touched).
- `/api/object-lift` with a real photo (bench-dusk, 0.85 m): submit, status, done in 94 s cold.
  - Moderation answered `skipped`: the preview has no `BASETEN_API_KEY`, so the real moderation call is still untested.
- Browser on VM2 (`scripts/upload-object-live.mjs`, 1280 px): photo, box, label, height, Make, "Done in 16 s. It is in your editor.", placed.
  - The credit line under the piece reads "From your own photo".
- A bug found by the live check: the route refused the real Modal host (`x--y.us-east.modal.run`) with 503; fixed and tested.
- Screenshots: `live-preview/1-dialog.png`, `2-done.png`, `3-placed-credit.png`.
