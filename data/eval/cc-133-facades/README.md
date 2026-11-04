# CC-133 facades: photo walls for ready places

- Two places now show a real photo wall in the 3D look page: Montmartre (church portal) and Gamla Stan (Tessin Palace).
- Photos come from Wikimedia Commons (CC BY 4.0 and CC BY-SA 3.0); no person is in either picture.
- Each photo was straightened with `scripts/rectify-facade.ts` from four corners (see `run.json`).
- The building name was added as a `name` tag to the stored answer (OpenStreetMap data, ODbL).
- Places that got no photo, with reasons, are in `run.json` under `skipped`.
- Evidence pictures: `docs/evidence/cc-133-facades/`.
