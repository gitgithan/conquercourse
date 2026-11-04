# CC-133 photo dots: what the Mapillary Graph API really returns

- Checked live on 2026-11-04 with a real request (token from the private env file, never printed).
- Single photo `GET /{id}?fields=...` and search `GET /images?bbox=...&fields=...` both work.
- The owner's guess was right: the position is `geometry`, with a corrected `computed_geometry` beside it.
  - Both are GeoJSON points, `{"type":"Point","coordinates":[lon,lat]}` (longitude first).
  - Example (Edinburgh, photo 145481884262053): `geometry` -3.189339, 55.948693 and `computed_geometry` -3.189327, 55.948703.
  - The allow-lists already hold the corrected one (55.948703, -3.189327).
- The compass has the same pair: `compass_angle` (camera, 14.9 here) and `computed_compass_angle` (corrected, 343.8 here).
  - The two can differ a lot (a phone compass drifts), so the corrected one is used first.
- `license` is NOT a field (the API answers "nonexisting field"); the licence is CC BY-SA 4.0 for Mapillary street photos, shown beside each photo.
- `functions/api/photos.ts` now also asks for `geometry,computed_geometry` and returns `lat` and `lon` (the corrected one first, the camera one as fallback, null when neither is valid).

## What the dots use
- Dots come from the per-place allow-lists in `public/assets/photos-live/` only (each photo was checked for close-up or large people, limit 0.2 of the picture height).
- A live search over a map view would show photos that were never checked for people, so it is not used for the dots.
- Result: dots appear at the 21 places that have a list; elsewhere there are none until a list is made with `scripts/photos_people.py`.

## Check
- `scripts/photo-dots-check.mjs` (1280 px): dots drawn, photo opens with credit and licence, no pin dropped by the click, dots hide when zoomed out, switch off with `?photodots=0`.
- Evidence pictures: `docs/evidence/cc-133-photo-dots/`.

## Run note (2026-11-04)
- The browser check ran on the laptop (no VM was reachable from this agent); all six checks passed at 1280 px.
- The picture in the screenshot is a plain stand-in served for a fake address, because the live picture needs the private token; the live path (`/api/photos` then Mapillary's own address) is the same code the street panel already uses.
- Evidence: `docs/evidence/cc-133-photo-dots/1-dots-and-cones.png`, `2-photo-opened.png`.
