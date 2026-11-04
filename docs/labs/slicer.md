# Lab 18: World Slicer: map to lane

*Map to lane, the pipeline from a pin on a real map to a lane the simulator proves (see [the series map](pipelines.md)).*
*Before it: the recorded map of a ready place; after it: the World Editor and the Course (the lane is handed over as a course).*
*The whole recipe is in [world-slice](../world-slice.md); the lessons behind the challenges are in [lessons](../lessons.md).*

## When you open it
- Live: it opens on Eixample, Barcelona, at the stored default (the line and cut height the game opens on), with the simulator already run.
- A small label says "Showing our setting, already run"; change a control to try your own.

## The question
- A pin on a map is only a spot.
- What turns it into a lane a runner can clear, and what makes it fail?
- Open it at `?mode=lab-slicer&labs=1`.

## What runs
- The game's own Slicer code, on recorded OpenStreetMap data of five ready places (`public/assets/places/*.json`):
  - `stateAt`, `customOf` and `replayDefault` from `src/slice/slicer-default.ts` (the buildings, the roofs, the player's line).
  - `customLane` and `worldOf` from `src/slice/slicer-core.ts` (the lane read from the picked buildings, and the simulator's verdict).
  - `laneProfile` from `src/slice/world.ts`, `laneFacts`, `looksCrossable` and `whyNot` from `src/slice/why.ts`.
  - `laneToCourse` from `src/slice/slice.ts`, then `searchIdealRun` and `playPlan` from `src/sim/ideal.ts` for the run that is drawn.
- Lab code only: `src/labs/slicer/slicer-lab-core.ts` (which buildings the circle and the tag switch leave out, the what-if limits, the challenges).
- Everything runs in the page.
  - Nothing is fetched from the internet, no street photo is shown or stored, and no paid call is made.

## The six steps
- **1.
  - Pin and circle:** the pin and the radius pick which recorded buildings are read.
- **2.
  - Elements found:** each building has a height tag or the game's guess of 9 m (height, else levels times 3 m, else 9 m).
- **3.
  - Cut:** a horizontal cut at one height; roofs at or above it are the floor plans the lane can stand on.
- **4.
  - Lane:** a 2 m wide line across the cut roofs; the same line the player can drag in the game.
- **5.
  - Rules:** the side view of the roofs under the line, with the widest gap, the tallest step and the longest fall against what a runner can do.
- **6.
  - Simulator:** the ideal-run search tries the lane; the run is drawn and can be stepped.

## The four challenges
- **The cut is too high (Alfama):** no roof is left at 26 m; the stored cut is 18 m.
- **Say why it fails (Montmartre):** at 42 m a step about 7 m tall blocks the lane; the answer comes from `whyNot`.
- **The circle is too small (Eixample):** one building inside 30 m; 70 m is enough for a lane.
- **Only the buildings we are sure of (Alfama):** 64 of 278 have a height tag; without the guessed ones there is no lane.
- Each has a Check that runs the real code, and a "Show what we did" that says what the game does.

## How it was designed
- **The one question:** what makes a pin on a map a lane that clears, and what makes it fail?
- **The choices and why those:**
  - The pictures come first: the map with the pin, circle, buildings and lane, then the side view and the run, because the pipeline is a chain of pictures.
  - The knobs are the ones the Slicer has (the pin, the cut height, the shrink, the line) plus the two switches the lessons name (the tag switch and the hills), because each one was a real cause of "no path".
  - The quick look has what-if limits because the game's own quick look disagrees with the simulator on Eixample (a 13.8 m gap), and the Lab should show that the simulator has the last word.
  - The challenges come from [lessons](../lessons.md): a cut too high, a lane with no step it can climb, too few buildings, and a guessed height.
- **Which real game code runs:** the list above; the verdict of the opening state is tested to equal `replayDefault`.
- **Which data is precomputed:** none; the recorded places and `slicer-defaults.json` are shipped game files, fetched on open.
- **Photos and people:** the Lab shows no street photo.
  - In the game, photos come live from Mapillary under its terms and are never stored; people are blurred and faces and plates masked before any model sees a photo (see Lab 14 and Lab 4).

## How we prove the lesson is right
- `tests/lab-slicer.test.ts` pins:
  - the recorded places are OpenStreetMap buildings, with 278 buildings and 64 height tags in Alfama.
  - the opening state of four places equals the game's replay of the stored default, and the farthest building is inside the opening circle.
  - the counts of left-out buildings add up; a smaller circle, a tag switch and a higher cut each change them.
  - the rules table equals `laneFacts`, and its quick look equals `looksCrossable` at the game's limits.
  - Eixample has a 13.8 m gap that the quick look refuses and the simulator clears.
  - each challenge starts failing and has a passing setting; the wrong reasons fail in the "say why" challenge.
  - a proved lane has a recorded run that reaches the finish.
- What would make the Lab's claim false: a challenge that passes at its start, or a page verdict that differs from `replayDefault`.
- Browser check: `scripts/lab-slicer-check.mjs` opens the page at 1280 px and fails on a page error or an empty output.
- Picture: [the Lab at 1280 px](../evidence/cc-133-pipeline-labs/lab-slicer.png).

## What we saw
- Eixample opens on a lane with a gap the quick look refuses; the simulator clears it, and so the quick look is only a first look.
- A cut that is too high leaves no roof; a cut that is too low leaves walls too tall to climb; the good cuts sit between.
- A circle that holds too few buildings gives a lane too short to run along.
- Only counting the buildings we are sure of leaves most places with no lane.

## Limits
- The data is recorded buildings only; paths, steps, rails and benches are not in the recorded files, so the tags that count are the height tag and nothing else.
- The pin moves the circle; the recorded area, the hills grid and the stored defaults stay centred on the first pin.
- The what-if limits change only the quick look; the simulator's limits are the game's.
- The Lab shows five places out of 47, and the quick page check runs the search in the page, which takes up to a few seconds.
- The "Photos at the lane" step is a note, not a worked example.
- The challenge answers are found with the real search, but other settings may pass too.

## How to make the lesson better
1. Add the heights strip: one small picture per cut height saying which ones give a lane.
2. Add paths, steps and rails from OpenStreetMap to the recorded files, and a switch for each.
3. Show the three best lanes the search finds and let the student pick one.
4. Show one live Mapillary photo at the lane's end under its terms, with the blur as it is in the game.
5. Hand the lane to the World Editor from the Lab.
