# Street furniture from Mapillary map features (CC-187)

## So what
- The four real-place courses now have the real street around them: lamps, benches, bins, signs, signals, poles, crosswalk paint.
- It shows with `?furniture=1`; it is off by default until the product owner has seen it.
- It is only decoration: not in the physics, the course files are unchanged, so the lane stays proven.
- Mapillary's object detections hold no people and no photos, so there is nothing to blur.
- A credit line (Mapillary contributors, CC BY-SA 4.0, link to the licence) shows bottom left whenever furniture is on.
- Recommendation: look at the Eixample and Lombard pictures first (most objects), then decide to turn the switch on by default.
- Next step: the Ready places from the CC-178 audit have place JSON lanes but no stored course; when they get one, run `scripts/furniture-fetch.ts` for them.

## What Mapillary returns
- One request per place: the `map_features` endpoint, a box of about 200 to 270 m around the pin.
- Each feature has an id, a class (`object_value`), a point and the last-seen date.
- Classes we use: street-light, bench, trash-can, traffic-sign--front, traffic-light--*, utility-pole and support--pole, crosswalk-zebra paint.
- There is no bollard class in the answer, so no bollards are drawn.
- Counts the server kept (all objects in the box) and the ones inside the building area (placed):

| Place | Answer | Placed | What |
|---|---|---|---|
| Montmartre | 67 | 24 | 21 lights, 1 crosswalk, 1 bench, 1 bin |
| Eixample | 748 | 412 | 183 lights, 61 signals, 99 signs, 48 bins, 17 benches, 4 crosswalks |
| Circular Quay | 731 | 194 | 36 lights, 32 signs, 25 bins, 24 benches, 72 poles, 5 crosswalks |
| Lombard | 782 | 356 | 39 lights, 198 signs, 39 bins, 55 poles, 19 crosswalks, 3 signals, 3 benches |

## What is placed, and how
- Each point moves from metres east and south of the pin into the game's frame with the same steps that placed the mesh (shrink, centre, drop, one scene item).
- Check: that frame reproduces the stored mesh footprint within 0 to 2.4 cm (`frames.json`).
- The lane line in the place JSON (CC-178) does not match these older courses, so the stored scene item was used.
- Light poles with a yellow head, benches, bins, sign poles with plates, signals and poles are instanced boxes and cylinders.
- Zebra paint is drawn where Mapillary saw a crosswalk.
- The six-stripe crossing at the start line is a design touch, not a detection.
- Real size would be a few centimetres in worlds shrunk to 0.07 to 0.24, so things are drawn at 0.5 of the (already over-sized) parts or more (CC-213: the first 0.4 was too small to see from the default camera; parts are now over-sized and lightly glowing).
- Off-run rule: anything inside the 2.6 m lane band at the runner's height moves to 1.7 m from the run line (about 5, 21, 7 and 15 objects for the four places, estimated on a flat top; the game uses the real lane top).
- No swing or rope is used: the lights are poles only.

## Pictures
- `shots/<place>-<side|angle>-<off|on>.png`: same frames, stepped clock, 1280 px, with and without the switch.
- No page errors in any run (the 404 for the score endpoint is the dev server having no function).
- `shots.json` lists the runs for Eixample, Quay and Lombard; Montmartre's run was logged on the first pass (24 placed, 0 errors).

## Not verified
- Not a lane re-proof: furniture never touches physics, but the full test suite was not run (only the furniture and live-photo tests, 35 passed, and the type check).
- Positions are as good as Mapillary's detections (a few metres); some objects float or sit inside shrunk buildings.
- The credit text was seen in screenshots; the licence link target was not clicked.
- The live `/api/features` was exercised in tests with an injected fetcher, and the files by the fetch script; the deployed function is not deployed.
- Mapillary token handling: kept server-side and in a private env file, never printed.

## How to see it (CC-213)
- Furniture only exists on the four stored real-place courses; slices made in the map or editor have no street objects yet.
- Open one of these (desktop, 1280 px), the default camera is the side view from about 25 m:
  - Montmartre: `http://localhost:5173/?course=/assets/experiments/osm/montmartre-paris.course.json&furniture=1`
  - Eixample: `http://localhost:5173/?course=/assets/experiments/osm/eixample-barcelona.course.json&furniture=1`
  - Circular Quay: `http://localhost:5173/?course=/assets/experiments/osm/circular-quay-sydney.course.json&furniture=1`
  - Lombard Street: `http://localhost:5173/?course=/assets/experiments/osm/san-francisco-lombard.course.json&furniture=1`
- Add `&cam=first` for the runner's eyes, a street-level view; `C` cycles cameras; `&photos=0` hides the photo strip.
- The bottom-left credit line shows when furniture is on; `html[data-furniture]` holds the count placed.
- Why the owner did not see them before: they were drawn at 0.4 of real size in a world shrunk to 0.07 to 0.24, so a lamp was under 1 m tall; now parts are over-sized (lamps about 4 m, yellow heads, lightly glowing) and the floor is 0.5.
- Pictures from the default camera, on and off: `data/eval/cc-213-furniture-visible/`.
