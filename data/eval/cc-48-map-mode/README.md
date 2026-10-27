# CC-48: map mode

## So what
- **Works end to end:** `?mode=map` shows a real map, a click drops a pin, "Build this place" turns the buildings around it into one piece, and the world editor opens with that piece, ready for "Find the best lane for me".
- **One catch:** at the default shrink (0.2) the lane is not always clearable; the editor's own verdict says so (see `3-editor.png`), and the maker moves the shrink slider or picks another place.
  - The spike's idea of trying shrinks until a lane clears is not in the map yet; it is the next step.
- **Next:**
  1. Run the lane search in the map after Build and offer the shrink that clears.
  2. Roads and water as gaps, ground height (CC-46 next steps).

## What was checked (`PORT=5231 node scripts/map-check.mjs`, SwiftShader; result in `run.json`)
- The map canvas and style load (OpenFreeMap tiles drawn) and the credit line shows "© OpenStreetMap contributors | OpenFreeMap".
- A click on the map drops a pin and enables "Build this place".
- Build fetches Overpass (the script waits 150 s, then falls back to the saved answer in `tests/fixtures/overpass-quay.json`; `run.json` says which was used).
- The editor opens at `?mode=editor` with exactly one piece, the key `cc.map.piece` is removed, and the piece is not saved to `localStorage`.
- `1-map.png`: the map. `2-pin.png`: pin dropped (Circular Quay). `3-editor.png`: the place in the editor.

## Notes
- Vite's dev server cannot find MapLibre's worker by itself; the worker file is passed with `setWorkerUrl` and Vite's `?url`.
- The search was only tried by the page code path; the check does not call Nominatim (one call per search, no automated runs against their server).
- The map has no keys; Nominatim and Overpass are public servers, used politely (one call per search, one query per place, cached).
