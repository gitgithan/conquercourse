# CC-78: dropping a pin

- **So what:** a pin no longer waits on one public map server; twelve places load at once and a dead server gives a plain error with a ready place one click away.
- **Cause and numbers:** `docs/world-slice.md`, section "Dropping a pin (CC-78)".
- **Inputs:** `overpass/*.json` are the building answers behind the ready places (© OpenStreetMap contributors, ODbL), fetched 2026-10-28.
- **Outputs:** `public/assets/places/` (the twelve places and `index.json`), built by `npx tsx scripts/make-places.ts`.
- **Run:** `run.json` and the pictures come from `scripts/map-places-check.mjs` (14 checks plus one that the explain strip is in view).
  - `1-ready-list.png`: the map with the list of ready places.
  - `2-ready-explain.png`: a ready place built in under a second, the steps, and the explain strip; the footprints on the map are painted by what they became.
  - `3-steps-working.png`: a pin far from any ready place, the lane search running in a worker.
  - `4-worker-explain.png`: the same place when the worker is done.
  - `5-error-offers-ready.png`: the site and the servers dead: a plain error and three ready places.
