# CC-90 nearby photos: coverage along three real-place lanes

- **Script:** `scripts/photos_coverage.py data/eval/cc-90-photos montmartre-paris eixample-barcelona edinburgh-old-town` (token read from `~/.config/ninja/mapillary.env`, never printed or saved).
- **Sheets:** `scripts/photos_sheet.py` builds `<slug>-sheet.jpg` from `<slug>-sheet-picks.json`.
- **Outputs**
  - `run.json`: the numbers per place (Mapillary and Commons).
  - `<slug>-mapillary-points.json`: id, position (metres east and south of the pin), heading, panorama flag, year; no links, no user names.
  - `<slug>-commons-points.json`: page id, title, latitude, longitude.
  - `<slug>-sheet.jpg` (about 60 KB each): twelve thumbnails of photos within 60 m of the lane that face it (six for Montmartre, see below).
- **Montmartre sheet:** only the six pictures without people close up are kept; the other six showed a crowd including a small child, so they are not stored.
- **Credits for the sheets:** Mapillary photos, CC BY-SA 4.0, by the creators and ids listed in `<slug>-sheet-picks.json` (image id and creator name); source https://www.mapillary.com.
- **Findings:** `docs/world-slice.md`, section "Live nearby photos".
