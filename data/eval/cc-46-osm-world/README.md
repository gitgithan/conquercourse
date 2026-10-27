# CC-46: a place on the map becomes a course (spike)

## So what
- **Feasible, yes:** a latitude and longitude turned into a playable, simulator-cleared course in 10 to 42 s, from open data, no keys, no accounts.
  - All three places gave a lane the ideal-run search clears; each opens with `?course=/assets/experiments/osm/<place>.course.json`.
- **The catch is not the data, it is the heights:** real buildings are 15 to 40 m tall and a runner jumps at most 0.9 m up.
  - A 2 to 8 m shrink (the brief) found no lane in 2 of 3 places; the course only came at a shrink of 0.07 to 0.24 (buildings 0.2 to 8 m).
  - The script now shrinks by 0.6 each try until a lane clears (the tries are in `run.json`).
- **Recommendation:** worth taking forward as "pick a pin, get a course", but as a **maker's draft**, not a finished course: show the three best lanes and let the maker pick, as in the world editor.
- **Next:**
  1. Cap or squash heights instead of shrinking everything (keeps blocks wide enough to land on).
  2. Draw roads and water, and use the ground as a lane, so streets become gaps and plazas become platforms.
  3. Feed the mesh into the world editor as one piece (it is already a GLB).

## Per place (`npx tsx scripts/osm-lane.ts <place> <lat> <lon> 120 auto [--terrain]`)
| Place (why) | Coordinates | Buildings | Real height tag | Shrink used | Lanes | Best lane | `searchIdealRun` |
|---|---|---|---|---|---|---|---|
| Eixample, Barcelona (dense city block, regular blocks, tall) | 41.3917, 2.1649 | 47 | 36 | 0.238 (1 try) | 2 | 33 m, 0 gaps, 1 step, score 3.5 | clears |
| Montmartre steps, Paris (stairs and hillside, 38.5 m of relief, with terrain) | 48.8867, 2.3431 | 42 | 35 | 0.072 (5 tries) | 2 | 18 m, 1 gap, 4 steps, score 7.5 | clears |
| Circular Quay, Sydney (waterfront, harbour gaps) | -33.8610, 151.2111 | 44 | 18 | 0.2 (3 tries) | 3 | 24 m, 2 gaps, 4 steps, score 8 | clears |
- "Real height" is a `height` tag or `building:levels` x 3 m; the rest get 9 m (a guess).
- Screenshots (Course view, ideal bot, SwiftShader): `<place>.png` in this folder.
- Meshes: 56 to 141 KB each under `public/assets/experiments/osm/`; Overpass answers are cached in `<place>/overpass.json` (one query per place).

## What breaks (what we saw)
- **Too tall to jump:** see above; the shrink also shrinks widths, so a 120 m radius becomes 9 to 30 m of course.
- **Boring lanes in tall, regular places:** Barcelona's best lane is nearly flat (score 3.5); the streets between blocks are cut by the scoring, not drawn as ground.
- **No ground between buildings:** only roofs are ground, so streets are water; a gap needing too much speed is skipped.
- **Heights are guesses for many buildings:** Sydney had only 18 of 44 with a height tag.
- **Terrain:** worked (Terrarium z15, a 20 m grid sampled at each building's middle, 38.5 m of relief in Montmartre), but it only lifts each building base; the slope between is not ground, so a stair is not a stair yet. At 3 to 5 m per pixel it cannot see steps.
- **Mesh quirks:** courtyards in multipolygon buildings are ignored; a few walls render black (ring direction on some relation parts).
- **Overpass:** the main server answered 502 or timed out on several first tries; the script retries with backoff over three mirrors (a polite one-query-per-place cache avoids repeat load).
- **Speed:** the search on 150k to 500k points took 10 to 42 s per place at 80 points per m²; the first run at the default density was much slower.

## Sources and credit
- Buildings: © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
- Ground: AWS Terrain Tiles (Terrarium), built from open elevation data (NASADEM, 3DEP, and others; see https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Used for Montmartre only.
- Rows in `docs/ASSETS.md`.
