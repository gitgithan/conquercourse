# Copyright audit (2026-11-03)
- Scope: every shipped file under `public/` (379 media files checked against `docs/ASSETS.md`), the film and demo media, and the models we call.
- Method: each file or folder must have a row in `docs/ASSETS.md`; rows were read for the licence and the swap plan.
- Result: every shipped media file has a row; the items below need action or a decision before a sale or a public release.

## Must fix now
- `public/assets/music/dojo.ogg` (Dojo and Labs loop):
  - The product owner says it is a copyrighted piece (La valse d'Amélie by Yann Tiersen); the ledger had named a different source.
  - Action: replace it with a generated option (five candidates made 2026-11-03, `pipelines/music_dojo.py`), then fix its row.
  - Until swapped, do not make the repo public with this file in it.

## Demo only: licence not settled (each row names a swap plan)
- MusicGen music (`course`, `map`, `editor`, `report`, `library` loops, the film music):
  - The weights are CC BY-NC 4.0 (non-commercial); the code is MIT; Meta has not said the output is free for commercial use.
  - Fine for a hackathon demo; swap before any sale.
- Starter cast characters (`public/assets/characters/cast/*.glb`):
  - Made with Muse Image, SAM 3.1 and SAM 3D Objects; Meta's terms for generated pictures are not confirmed.
- Tripo meshes (the two Rookies):
  - Made once with a closed service; commercial rights to confirm.

## Share-alike (CC BY-SA): credit and same licence
- Some place cover photos, three editor objects (hydrant, concrete pipe, canal railing) and the Wikibooks and Wikipedia coaching text.
- Credits are in the ledger and shown where used.
- Anything adapted from them (overlays, objects) carries CC BY-SA too, so they are a demo item for a sale; the plan is a CC0 or CC BY photo of the same place, or our own.
- The five CC BY-SA park photos in `data/eval/sam31-park/` stay out of the shipped game.

## Third-party services with their own terms
- Mapillary street photos: shown live under Mapillary's terms, never stored or un-blurred; its logo is not shipped (licence unclear).
- Open-Meteo: free API for non-commercial use; nothing from it ships.
- YouTube clips marked Creative Commons (CC BY): the uploader's claim is trusted; credit is kept in the clip files; they are not in `public/`.

## Not usable in a public repo (and not used)
- AMASS, HumanML3D, Motion-X, GRAB, BEHAVE, PROX, Nymeria, LAFAN1, AIST++, Ego-Exo4D, BONES-SEED.

## Open questions for the product owner
- Which licence the code carries (see the README).
- Whether to keep the demo-only items in the public repo or move them to `../conquercourse-assets/` before judging.
