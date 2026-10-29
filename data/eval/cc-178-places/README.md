# CC-178: the Ready places, where they come from, and why some have no path

## So what
- **The list was a hand-picked starter set, not a measured one.**
  - The 18 places were chosen by the project (assistant sessions, CC-78 and CC-152), by "famous and photogenic", not by data.
  - Every one of them had a clearable lane, because the builder keeps only a lane the simulator clears.
- **"Ready" means two things: the buildings are stored, and one lane is proven.**
  - It does not mean the place has good photos or many buildings.
- **Photos are plentiful in the raw data, but only 3 places had a person-free photo list in the game.**
  - That is why the owner saw "no photos".
  - Raw Mapillary counts near the lane are between 4 and 973 for the 28 places measured (Lombard's search was too dense to answer).
- **Change shipped: the default list now shows only places with a path AND at least 30 street photos facing the lane.**
  - 26 of 29 places pass, so no more famous places were needed beyond the 11 added and tested here.
  - `?places=all` shows every place, as before.
  - Hidden: Circular Quay (4 photos facing the lane), Bryant Park (18), Place des Vosges (10).
- **The owner's intuition is half right, and the sweep shows why it fails.**
  - A lower cut does not make smaller gaps; it keeps more of the city, including the streets between buildings.
  - Across 6 places: cuts of 1 to 6 m cleared a lane in 15 of 90 tries, 10 m in 14 of 30, 20 to 40 m in 45 of 60.
  - Shrinking the model (a smaller x number) is what rescues the low cuts: at x0.07 a 1 m cut clears in 2 of 6 places (Gas Works Park, Circular Quay).
- **3D looks: nothing from Amazon, Google or Meta is used.**
  - The map and editor extrude OpenStreetMap footprints; there is no tile download to switch on.
- **Cheap skins work:** tag colours, ground colours, trees and a window pattern, no photos, no cost; screenshots are in `skin-shots/`.

## 1. Where the 18 places come from
- A hand-written list in `scripts/make-places.ts`.
  - CC-78 gave 12 places (Montmartre, Eixample, Circular Quay, Lombard Street, Shibuya, Ciutadella, Edinburgh, Positano, Valletta, Speicherstadt, Alfama, Spanish Steps).
  - CC-152 added 6 parks (Parc Guell, Tuileries, Retiro, Bryant Park, Gas Works Park, Dolores Park).
  - The choice was by the project, to give hills, stairs, canals, parks and variety; no scoring or data picked them.
- The data for each comes from:
  - OpenStreetMap buildings, through the Overpass API (six public servers asked at once; only building, height and levels tags kept).
  - Ground heights from AWS Terrain Tiles (Terrarium, zoom 15).
  - Mapillary is not used to choose or build a place; it only supplies street photos afterwards.

## 2. What "ready" means and how the path is found
- Code: `laneForPlace` in `src/world/place-lane.ts`.
- The builder tries a shrink ladder: start at `min(1, max(0.02, 5 / median building height))`, then five steps each 0.6 times the last.
- For each shrink it builds the mesh (building height capped at 8 game metres), samples the surface, and cuts at the default heights: lowest ground, +0.5, +1, +3 and +6 game metres.
- It tries 18 directions (10 degree steps) and up to 14 sideways offsets, and drops lanes with a wall above the climb limit (2.8 m) or a gap needing more than 8.5 m/s.
- It then runs the real simulator proof on up to 12 candidates; the first shrink that gives a lane the runner clears wins.
- "Path" therefore means: the simulator ran a runner along that lane and it reached the end.
- All 18 stored lanes were found at the top cut (6 game metres), so they are rooftop runs.
- The audit column "cut / shrink" below is that stored setting.

## 3. The table (28 measured, Lombard has stored photos instead)
Columns: buildings in the OSM answer, how many have a real height tag, lane length in game metres, Mapillary photos within 60 m of the lane, photos within 60 m whose camera faces the lane, path found, cut and shrink used, default list.

| Place | Buildings | With height tag | Lane (m) | Photos within 60 m | Facing lane | Path | Cut / shrink | Default list |
|---|---|---|---|---|---|---|---|---|
| Montmartre steps, Paris | 42 | 35 | 21.3 | 301 | 109 | yes | 6 m / x0.12 | listed |
| Eixample, Barcelona | 47 | 36 | 37.5 | 214 | 116 | yes | 6 m / x0.238 | listed |
| Circular Quay, Sydney | 44 | 18 | 37.9 | 97 | 4 | yes | 6 m / x0.333 | hidden |
| Lombard Street, San Francisco | 95 | 75 | 22.9 | n/a | n/a (stored photos) | yes | 6 m / x0.273 | listed |
| Shibuya, Tokyo | 69 | 60 | 14.7 | 1168 | 443 | yes | 6 m / x0.283 | listed |
| Ciutadella Park, Barcelona | 6 | 0 | 41.9 | 362 | 169 | yes | 6 m / x0.556 | listed |
| Old Town, Edinburgh | 77 | 15 | 33.4 | 645 | 204 | yes | 6 m / x0.2 | listed |
| Positano, Italy | 86 | 0 | 36 | 632 | 214 | yes | 6 m / x0.12 | listed |
| Grand Harbour, Valletta | 18 | 1 | 23.8 | 143 | 47 | yes | 6 m / x0.556 | listed |
| Speicherstadt, Hamburg | 21 | 14 | 103.3 | 645 | 59 | yes | 6 m / x0.417 | listed |
| Alfama, Lisbon | 278 | 64 | 26.2 | 865 | 298 | yes | 6 m / x0.333 | listed |
| Spanish Steps, Rome | 35 | 0 | 69.8 | 535 | 82 | yes | 6 m / x0.556 | listed |
| Park Güell, Barcelona | 14 | 10 | 22.1 | 442 | 118 | yes | 6 m / x0.2 | listed |
| Tuileries Garden, Paris | 5 | 3 | 62.4 | 118 | 39 | yes | 6 m / x0.36 | listed |
| Retiro Park, Madrid | 9 | 4 | 22.8 | 166 | 46 | yes | 6 m / x0.556 | listed |
| Bryant Park, New York | 21 | 8 | 27 | 134 | 18 | yes | 6 m / x0.556 | hidden |
| Gas Works Park, Seattle | 27 | 0 | 96.9 | 150 | 46 | yes | 6 m / x0.556 | listed |
| Dolores Park, San Francisco | 40 | 35 | 38.2 | 446 | 181 | yes | 6 m / x0.455 | listed |
| Piazza San Marco, Venice (new) | 35 | 15 | 68.1 | 691 | 101 | yes | 6 m / x0.333 | listed |
| Plaza Mayor, Madrid (new) | 118 | 64 | 84.1 | 180 | 58 | yes | 6 m / x0.417 | listed |
| Place des Vosges, Paris (new) | 77 | 50 | 41.2 | 20 | 10 | yes | 6 m / x0.556 | hidden |
| Trafalgar Square, London (new) | 16 | 12 | 9 | 471 | 229 | yes | 6 m / x0.556 | listed |
| Covent Garden, London (new) | 65 | 44 | 47.1 | 927 | 270 | yes | 6 m / x0.417 | listed |
| Washington Square, New York (new) | 16 | 16 | 49.1 | 1699 | 665 | yes | 6 m / x0.244 | listed |
| Union Square, San Francisco (new) | 44 | 32 | 17.1 | 2170 | 973 | yes | 3 m / x0.333 | listed |
| Old Town Square, Prague (new) | 56 | 49 | 37.4 | 233 | 90 | yes | 6 m / x0.417 | listed |
| Piazza Navona, Rome (new) | 47 | 6 | 13.2 | 415 | 139 | yes | 6 m / x0.556 | listed |
| Nyhavn, Copenhagen (new) | 123 | 11 | 66.2 | 651 | 257 | yes | 6 m / x0.556 | listed |
| Beacon Hill, Boston (new) | 41 | 40 | 55.6 | 547 | 107 | yes | 6 m / x0.263 | listed |

- Sparse places (under 15 buildings): Ciutadella 6, Tuileries 5, Retiro 9, Parc Guell 14.
  - They still have a path, because a park lane runs over ground and a few roofs.
- Places with no height tags at all: Ciutadella, Gas Works Park (the builder guesses a height).
- Run on a Vultr VM with `scripts/places-audit.ts --stored` (it uses the lane saved in each place file); the path column is the stored proof, not a fresh search.
- Data: `data/eval/cc-178-places/audit-stored.json`.

## 4. Do lower cuts help? (the owner's question)
- Method: `scripts/places-sweep.ts`, 6 places, cut 1, 3, 6, 10, 20, 40 real metres, shrink x1, x0.333, x0.2, x0.12, x0.07.
- Each cell asks the real slicer for the best lane, then runs the simulator proof (up to 4 candidates).
- Data: `sweep-<place>.json` in this folder.

**bryant-park-new-york** (21 buildings). Rows: shrink. Columns: cut in real metres. YES = the simulator clears a lane; - = no lane cleared.

| shrink | 1 m | 3 m | 6 m | 10 m | 20 m | 40 m |
|---|---|---|---|---|---|---|
| x1 | - | - | - | YES | - | - |
| x0.333 | - | - | - | YES | YES | YES |
| x0.2 | - | - | YES | YES | YES | YES |
| x0.12 | YES | YES | YES | YES | YES | YES |
| x0.07 | - | - | - | - | - | - |

**circular-quay-sydney** (44 buildings). Rows: shrink. Columns: cut in real metres. YES = the simulator clears a lane; - = no lane cleared.

| shrink | 1 m | 3 m | 6 m | 10 m | 20 m | 40 m |
|---|---|---|---|---|---|---|
| x1 | - | - | - | - | YES | YES |
| x0.333 | - | - | - | - | YES | YES |
| x0.2 | - | - | - | YES | YES | - |
| x0.12 | - | YES | YES | YES | YES | YES |
| x0.07 | YES | - | - | YES | YES | YES |

**edinburgh-old-town** (77 buildings). Rows: shrink. Columns: cut in real metres. YES = the simulator clears a lane; - = no lane cleared.

| shrink | 1 m | 3 m | 6 m | 10 m | 20 m | 40 m |
|---|---|---|---|---|---|---|
| x1 | - | - | - | - | YES | - |
| x0.333 | - | - | - | - | - | YES |
| x0.2 | - | - | - | - | YES | YES |
| x0.12 | - | - | - | - | YES | YES |
| x0.07 | - | YES | YES | YES | YES | YES |

**eixample-barcelona** (47 buildings). Rows: shrink. Columns: cut in real metres. YES = the simulator clears a lane; - = no lane cleared.

| shrink | 1 m | 3 m | 6 m | 10 m | 20 m | 40 m |
|---|---|---|---|---|---|---|
| x1 | - | - | - | YES | YES | - |
| x0.333 | - | - | - | - | YES | YES |
| x0.2 | - | - | - | - | YES | YES |
| x0.12 | - | - | YES | YES | YES | YES |
| x0.07 | - | - | - | - | YES | YES |

**gas-works-park-seattle** (27 buildings). Rows: shrink. Columns: cut in real metres. YES = the simulator clears a lane; - = no lane cleared.

| shrink | 1 m | 3 m | 6 m | 10 m | 20 m | 40 m |
|---|---|---|---|---|---|---|
| x1 | - | - | - | - | YES | - |
| x0.333 | - | - | - | YES | YES | - |
| x0.2 | - | - | YES | YES | YES | YES |
| x0.12 | - | - | YES | YES | YES | YES |
| x0.07 | YES | YES | YES | YES | YES | YES |

**montmartre-paris** (42 buildings). Rows: shrink. Columns: cut in real metres. YES = the simulator clears a lane; - = no lane cleared.

| shrink | 1 m | 3 m | 6 m | 10 m | 20 m | 40 m |
|---|---|---|---|---|---|---|
| x1 | - | - | - | - | - | YES |
| x0.333 | - | - | - | - | - | YES |
| x0.2 | - | - | - | - | - | YES |
| x0.12 | - | - | - | - | - | YES |
| x0.07 | - | - | - | - | - | YES |

- **Reading it:**
  - Totals: cuts of 1 to 6 m cleared 15 of 90, 10 m cleared 14 of 30, 20 to 40 m cleared 45 of 60.
  - Of the 75 low-cut failures, 72 were a gap in the lane, not a wall; the gap is a street between buildings.
- **Why the intuition fails:** the cut says what is kept, not how far apart it is.
  - A low cut keeps the whole city, so the lane sees every street as a trench.
  - A high cut slices the city flat and leaves the roof tops, and a rooftop lane at one height has fewer drops.
  - The slider is in real metres, but the game works in shrunk metres, so one number means very different courses at x1 and x0.07.
- **Where the intuition is right:** when the model is shrunk hard (x0.12 or x0.07), low cuts do clear, because every gap is shrunk too.
  - Gas Works Park clears at every cut at x0.07; Bryant Park at every cut at x0.12.
- **Not tested:** the cause above is read from the code and the failure labels, not isolated by changing one thing; the sweep did not vary the sideways search; Montmartre clears only at 40 m.
- **What the slicing agent should do:** when a cut has no path, say so and offer a higher cut or a smaller shrink, never "lower it".

## 5. Where the 3D building looks come from
- **What the repo does now:**
  - Map mode: MapLibre GL with OpenFreeMap vector tiles (OpenStreetMap, no key); the style's own buildings are hidden and the game draws its own extruded footprints, coloured by role.
  - Editor 3D (`src/slice/view3d.ts`, three.js): the same footprints extruded to grey boxes.
  - Ground height: AWS Terrain Tiles.
  - No Amazon, Google or Meta 3D tiles are used.
- **What exists, from general knowledge (not tested here; check the terms before use):**

| Source | What it is | Licence | Cost |
|---|---|---|---|
| OSM footprints plus height tags (what we use) | outlines and heights, we extrude | ODbL, credit OpenStreetMap | free, polite use of Overpass |
| Overture Maps buildings | open building outlines (with OSM, Microsoft, Google footprints merged), GeoParquet on AWS S3 and Azure | mostly ODbL or CDLA, per source | free to download, you pay your own data transfer if outside the bucket's free tier |
| Microsoft and Google Open Buildings footprints | outlines, some heights | ODbL or CC BY 4.0 per dataset | free |
| Cesium OSM Buildings | OSM buildings as 3D Tiles, hosted | via a Cesium ion token, free tier with limits | free tier, paid above it |
| Google Photorealistic 3D Tiles | photo-scanned city meshes | Google Maps Platform terms, no saving or editing the data, attribution required | billed per request after a free allowance |
| Meta | no building tile set offered for download; Meta's Mapillary gives photos, not meshes | n/a | n/a |

- **"Is it ready to download tiles from Amazon or Meta?"** No.
  - Amazon hosts open data (Terrain Tiles and Overture on S3), not a ready 3D city.
  - Meta has no tile product for buildings.
  - Google's tiles are the only photo-real option, are billed, and their licence bars the "keep and edit" use the editor needs, so we should not plan on them.
- **Cost of any paid step:** none was taken; no account was created.

## 6. How Mapillary is used, and what else it offers
- **Used now:** a bbox image search (`graph.mapillary.com/images`) with the project token, in two places.
  - `functions/api/photos.ts` (server side) looks up photo ids and returns fresh picture addresses.
  - `src/world/live-photos.ts` shows only photos on a per-place person-free list made offline by `scripts/photos_people.py`.
  - CC-90 puts up to 3 street photos beside the lane, with credits.
  - Licence CC BY-SA 4.0, credit shown with each photo.
- **Also on offer:** `map_features` (detected objects with positions: street lights, crosswalks, signs, manholes), sequences, panoramas, and image-to-3D from many photos of one object.
  - Quick test, one Montmartre block: 57 map features found (25 street lights, 10 shop signs, 4 no-parking signs, 2 zebra crossings), and 446 photos, 66 of them panoramas.
- **Worth a one-hour demo:** place real street furniture along the lane from `map_features`.
  - Street lights as poles to swing on, crosswalks as the start line, so the course grows from what really stands there.
  - It is real-world data, needs no photo of a person, and fits "real parks and real moves become the course".
- **Gap to fix:** only 3 places had a person-free allow-list; the audit run now makes lists for the listed places (see the log in this folder).

## 7. Visual worlds: cheap skins
- Options, ranked by cost then wow:

| Rank | Option | Compute cost | Wow | Risk |
|---|---|---|---|---|
| 1 | Colours from OSM tags (building colour, material, roof) | near zero | medium | none |
| 2 | Ground colours (grass, water, paving, sand) and road ribbons from OSM | near zero | high | none |
| 3 | Instanced trees (trunk plus crown) from OSM tree points, rows and woods | low (one draw per kind) | high | wood trees are scattered by chance, not real positions |
| 4 | A window pattern on walls (drawn in code) | low | medium | none |
| 5 | Mapillary photos as wall textures | high, plus matching camera poses | very high | privacy, and licence needs credit per wall |
| 6 | Satellite or OSM raster tiles on the ground | low | medium | tile terms limit heavy use |
| 7 | Google Photorealistic 3D Tiles | high | highest | billing and licence, see 5 |

- Prototype: `src/world/skin.ts` (pure rules plus a three.js builder), page `place-skin.html`, switch `?skin=none|tags|full` (default none, so nothing changes for players).
  - It does not touch `view3d.ts` or `map.ts`; they can call `buildSkin(osm, {skin, k, seed})` when their owners want it.
- Before and after, four places (1280 px desktop, software GL on a VM): `skin-shots/<place>-none.png`, `-tags.png`, `-full.png`.
  - Places: Montmartre, Bryant Park, Retiro, Circular Quay.
  - Counts per place are printed in each picture's footer.
- Data for the skin: `skin/<place>-osm.json` (Overpass, ODbL, row in `docs/ASSETS.md`).
- Not verified: how it looks inside the editor view, and the frame rate on a real GPU.

## Files and how to re-run
- `scripts/places-audit.ts`, `scripts/places-sweep.ts`, `scripts/places-list.ts`, `scripts/skin-fetch.ts`, `scripts/skin-shots.mjs`.
- `run.json` in this folder lists inputs and outputs.
