# Atlas: one learning experience, taught by slicing the world

*Related: [world slice](world-slice.md), [sayings](sayings.md), [spec](spec/SPEC.md). Issue: CC-72.*

## The idea in one minute
- **So what:** the game already cuts a slice out of the world to make every course, so the same cut can be the way a player looks at any place, and learns from it.
- **A horizontal cut** of a hill is a contour line; a horizontal cut of a building is its floor plan.
- **A vertical cut** of a hill is its height profile; a vertical cut of a building or a bridge is a section or an elevation.
- **Our lane is a vertical cut:** the 2 m strip the runner runs along (`src/slice/slice.ts`, the editor's side view).
- **One tool shows all of it:** the Slicer.
- **Learning stops being a button per obstacle.** It becomes what happens when you explore a place, run it, and notice something.
- **Rule for the whole thing:** the game never lectures.
  - It shows, the player finds, and a line goes into the Notebook.

## The loop
1. **Place:** pin a real place on the world map (`?mode=map`), or pick a demo course.
2. **Slice:** drag the cut height.
  - Contours, floor plans and the lane change as you drag.
3. **Build:** shrink it, shape it in the editor, add contraptions (stacks, coaster, trebuchet, band, recoil).
4. **Run:** play the lane.
  - The simulator proves it can be cleared.
5. **Discover:** the ideal run shows things the player did not expect (a shortcut, a roll that saves a fall).
6. **Notebook:** a line is added for what the player has just experienced, in the game's own words.

## The tools the player gets
- **The Slicer** (first build, CC-72 child): a "Cut height" slider on the map.
  - Shows the cut plane, the contour line at that height, the building floor plans at that height, and the lane the Course would use there, with one line of text ("Cut at 12 m: the lane is 51 m long, clearable").
- **The Contour ladder:** one button shows contour lines every few metres.
  - Lines close together mean steep, lines far apart mean flat.
- **The Profile:** the side view of the lane (the editor's side view and the elevation line under a replay).
  - It is the vertical cut.
- **The Plan:** the top view of a building or an object, from the horizontal cut.
  - For a cup stack or a bridge it shows what holds it up.
- **The Energy trace:** a small line under a replay: height, speed and the energy bar over time.
  - Shows where the coaster's speed came from and where the swing gained or lost it.
- **The Notebook:** a page of earned sayings and finds.
  - It is passive: no questions, no scores, no chat.

## What each subject looks like in play, and where it already lives

| Subject | What the player does | Where it already lives |
|---|---|---|
| **Geography: contours and slopes** | Drags the cut height, sees contour lines bunch up on the steep side of a hill | Map mode (`?mode=map`) and real ground heights from terrain tiles (CC-51, Montmartre reads 129.8 m against the known 130 m) |
| **Geography: elevation profile** | Sees the hill as a line under the lane; sees why a steep place gives a short lane | The lane search (`bestSlices`), the hill results in `docs/world-slice.md` |
| **Architecture: floor plans** | Sees a building as a shape at the cut height; sees the plan change from floor to roof | Building outlines from OpenStreetMap (`src/world/osm.ts`) |
| **Architecture: sections and elevations** | Sees the lane as the cut through the world | The editor's side view and the lane builder |
| **Architecture: stability** | Builds a cup pyramid and a tall column; finds the pyramid holds and the column does not | Cup stacks (CC-60); a tipping check is the next step |
| **Architecture: beams and bridges** | Crosses a plank that sags before it breaks | Planned: plank-bridge lesson, same proof pattern as the other moves |
| **Architecture: scale** | Learns why a real cup is 9 cm and a runner-sized one is bigger, why a place is shrunk to be a course | Cups at scale, shrink factors in map mode |
| **Physics: energy** | Finds a coaster climbs no higher than where it started | Coaster (CC-61) |
| **Physics: stored energy** | Stretches a band farther and is thrown faster | Elastic band (CC-65, in progress) |
| **Physics: momentum** | Fires a heavy ball back slowly and is thrown forward fast | Recoil (CC-66, in progress) |
| **Physics: turning moments** | Balances a trebuchet arm; finds a heavy weight close in equals a light one far out | Trebuchet (CC-62) |
| **Maths: launch angle and the parabola** | Finds 45 degrees goes farthest on level ground | Trebuchet, rope release, bar release, jumps |
| **Maths: slopes** | Reads a slope from how close the contour lines are | The Slicer |
| **Body: grip and energy** | Finds a swing is limited by what the hands can hold (5.5 body weights); finds a roll saves a fall of 9.8 m that straight legs cannot | Swing grip (CC-58), roll and drops (CC-56), energy bar |

## What unlocks what
- **Rule:** a Notebook entry unlocks when the player has done or seen the thing, never from a menu.
- **The game already counts these events** (clears, rolls, releases, stalls), so most unlocks are a few lines of code reading them.
- **Examples**

| The player has... | The Notebook gains |
|---|---|
| cleared a hill lane in map mode | "Lines close together mean steep." |
| dragged the cut height across three different levels | "A building has a different shape at every height." |
| skipped a bar with a hard pump (CC-67) | the swing saying, plus the find "You skipped the second bar" |
| rolled out of a 5 m drop | "Turn your fall into a roll and the ground forgives you." |
| seen the ideal run take a shortcut (CC-71) | "The simulator found a way you did not plan." |
| watched a coaster stall on a low first hill | "A coaster has no engine: it climbs no higher than where it started." |
| balanced a trebuchet arm | the turning-moments saying |

## How the Dojo fits
- **The Dojo button stays.** Players who want to experiment on purpose still can.
- **Every Dojo lesson becomes a Notebook entry** (rope, bars, coaster, balance the arm, and the rest).
  - The entry opens the lesson when the player has already felt the phenomenon on the Course.
- **The sayings page is the Notebook's spine.** `docs/sayings.md` already says collected sayings fill the "trophy cabinet"; the Notebook is that cabinet with finds added.
- **Formulas stay where they are:** only the last, earned step of a Dojo lesson, never on the Course, never in the Slicer, never in the Notebook.

## A five-minute walk-through: Montmartre
- **Numbers below are from the real run** (saved answers, shrink 0.1, `data/eval/cc-72-atlas/run.json`).
1. **Fly in.** The map starts high over Paris, the circle of the course lights up, the buildings rise out of the map, and the camera tilts down to the street (see "The map flight").
2. **Pin it.** Search "Montmartre steps, Paris" and drop the pin.
  - The height maps say the place is 39 m from the lowest street to the top.
3. **Press "Slice this place".** The buildings stand as blocks, and the ground is tinted by slope: green is flat, red is steep.
4. **Cut at 5 m.** A thin plane sits low.
  - The orange ground line is short, hugging the lowest corner.
  - All 41 buildings are cut, so the floor plan is the whole neighbourhood.
  - The lane here is 20 m but the simulator cannot clear it.
5. **Cut at 20 m.** The orange line is now a long loop around the hill.
  - It is the same 41 buildings, because Paris buildings are tall, so the floor plan has barely changed.
  - The ground has changed a lot.
6. **Cut at 35 m.** Only 35 roofs reach this high, and 6 buildings are wholly below the plane.
  - The orange line is a small loop around the hilltop.
  - The readout says "the lane is 24 m long in the game, clearable". The player has just learned where the clearable lane is: up on the roofs.
7. **Press "Contour ladder".** Seven lines appear, one every 5 m.
  - Lines close together mean steep, so a 13-year-old can say where the steps are without being told.
8. **Build it.** The lane at 35 m becomes a course, and the player runs it.
  - After the run the ideal run can show a shortcut, and three lines go into the Notebook: one about contours, one about the lane, one find.

## The map flight (CC-79)
- **So what:** the first ten seconds should feel like a real place turning into a game, not like loading a form.
- **It is a flight of four steps.
  - Steps 1 to 3 take 5.5 seconds and can be skipped with a Skip button or Esc.** If the player's device asks for reduced motion, the flight jumps straight to the end of step 3.
- **Where it lives:** the same map screen as the Slicer (the cut height slider and the flight share the map).
  - Steps 1 to 3 are MapLibre pitch, bearing and 3D building extrusion.
  - Step 4 hands the camera to our three.js view.

| Step | Seconds | What the player sees | Camera | How it is built |
|---|---|---|---|---|
| 1. Bird's eye | 0 to 1.5 | The real map from straight above. A bright circle on the map shows the area the course will be built from. A caption: "This circle is 240 m across." | Pitch 0, zoom about 14 (the circle is a small part of the screen) | `map.easeTo` to the pin; a circle layer |
| 2. Painted in | 1.5 to 3.5 | Inside the circle the map is "painted": the ground tint by slope fades in, building outlines appear flat and then rise out of the map, one wave from the middle outward. Outside the circle stays plain. | Pitch 0 to 25, zoom to fit the circle | `fill-extrusion-height` animated with a "rise" factor from 0 to 1; slope tint fades in |
| 3. Tilt down | 3.5 to 5.5 | The camera swings down toward the street until the buildings tower over it. The place feels like a real 3D place. | Pitch 25 to 78, bearing turns about 30 degrees, zoom in about 2 steps | `map.easeTo` with an arc |
| 4. Hand-over | when the player presses Build (a 0.4 s fade) | The map fades into the editor's 3D view, with the same heading and tilt and the picked buildings as separate pieces. | Our three.js camera starts where MapLibre's ended (heading, tilt, distance) | Pieces and camera saved in `sessionStorage`, then the editor opens |

- **What is clickable once the flight ends:**
  - **Buildings are the pieces.** The map data is already cut into one shape per building, so there is nothing to draw.
    - Click one to include it or leave it out.
    - Left-out buildings fade to grey.
  - **Drag a box** (hold Shift and drag, or switch on "Box" mode) to pick every building inside it.
    - Hold Alt to take buildings out of the picked set.
  - **"Pick all" and "Clear"** buttons.
  - **Picked pieces are highlighted** with an orange outline, and the lane and the Slicer use only the picked set.
  - **Next, in order:** steps, rails, low walls, water, paths, playground equipment and trees, as extra layers of the same map data.
    - Each is a piece type with its own colour in the legend.
    - This needs a bigger map query and a mesh per type, so it is not in the first build.
- **How scale is shown, in plain words:** the circle's size is the scale.
  - The player drags the circle bigger or smaller (or zooms).
  - A caption says it in plain words: "This circle is 240 m across. In the game it is 24 m long: 1 m in the game is 10 m in the real place. The 30 m tall block becomes a 3 m step you can vault."
  - There is no formula and no "shrink factor": the player reads one sentence about their own place.
- **Handing pieces to the editor:** each picked building goes in as its own piece with its position, so the player can move, turn and delete them.
  - Today the pin gives one big mesh with no choice.
- **Known gap:** no satellite pictures (the licence does not let us ship them), so "painted" means the vector map style.

## What stays out
- **No chat tutor.** The design partner is a co-designer of layouts only.
- **No grading or coaching of technique.** The Notebook never says how well the player did, only what they found.
- **No formulas on screen** except the last earned step of a Dojo lesson, and never on the Course.
- **Earth gravity only.** No Moon or low-gravity scenarios.
- **No robotics framing.**
- **No footage of minors.**
- **No accounts or scores.** Entries are kept in the player's own browser.

## The three cheapest builds before 2026-11-04
1. **The Slicer** (this issue's first child, built now): the cut slider on the map with contours, floor plans, slope tint and the lane readout.
2. **The Notebook:** one page that reads the sayings table and the events the game already emits, unlocks entries, and links each to its Dojo lesson.
  - Stored in the browser.
3. **The Energy trace:** a small chart under the replay of a clear or a fall, built from the simulator's own numbers.

## Gaps and honest limits
- **The cut is the game's version of the place,** not the real one: buildings are straight prisms, shrunk, and the walls run down to the lowest ground.
- **Floor plans are footprints,** since the map data has no rooms.
- **Terrain is coarse:** about 4.8 m per pixel, sampled every 20 m, so small steps still come from the buildings.
- **No teacher or class features**, and no formal assessment.

## The skyline puzzle (CC-83, designed here, not built yet)
- **So what:** once a place is in 3D, choosing the route through it is a puzzle the simulator already knows the answer to.
- **Why it fits:** our lane is a vertical slice through the world, with three numbers: an angle, a sideways step (offset) and a height level (`src/slice/slice.ts`).
  - Choosing the cut is choosing the route.
  - The Slicer's cut height is the "level" of this puzzle.
- **What the player does:**
  1. Orbit the 3D skyline freely, so the world can be turned sideways.
  2. Drag a line across the roofs (start, end, and bend points if wanted) and pick a roof level with the cut-height slider.
  3. The lane is the vertical slice through that line, built by the same lane builder.
  4. The simulator says at once whether it can be cleared and gives the ideal-run time.
  5. A button snaps the view along the chosen line, which is the side view the runner will see.
- **The answer shown afterwards:** a "best route" search tries many lines and levels, runs the ideal run on each, and keeps the fastest one that clears.
  - It is drawn as a ghost line next to the player's own, and said as a fact: "The simulator found a route 3.2 s faster that starts on the green roof."
  - It never grades the player's technique.
    - It only says what the simulator found.
  - The search is the same family as the shortcut search (CC-71), and runs in the worker pool with a step budget (CC-69).
- **Where it sits in the Atlas loop:** place, flight, pick buildings, choose the cut (the puzzle), run, then the ghost route, then a Notebook entry ("A route exists that you did not see").
- **Ready places:** each of the ten ready places (CC-78) keeps a stored best route as the reference, so the ghost line appears at once.
- **Parkour parks (CC-133):** the Ready places list also has a group of real parkour parks, under one heading per region and sorted by country.
  - Each is tied to a real OpenStreetMap element (id and mapped area in `data/eval/cc-133-parkour-places/README.md`).
  - A park whose mapped shape is under 1500 m2 is flagged as small on the map, not hidden.
  - A park where the simulator finds no lane is still listed, with a "no lane found yet" badge.
  - Five of the twelve are mapped only as the bigger place around them (campus, park), and the card says so.
- **Honest limit:** the runner moves along one line (the simulator is 2D along that line), so moves across the street, or a lane that bends, are not modelled.
  - A bent line is flattened into one run along its length.
- **Depends on:** places that load (CC-78), the flight and picking (CC-79, built), the shortcut search (CC-71), and the worker pool (CC-69).

## What the first build does (CC-79)
- **Flight:** press "Slice this place" and the map flies in (steps 1 to 3).
  - `?flight=0` or a reduced-motion setting skips it; `?flightat=2.5` freezes it at a second, for pictures.
- **Picking:** click a building to leave it out or put it back.
  - Hold Shift and drag a box to pick, hold Alt as well to take out. "Pick all" and "Clear" are buttons.
  - Left-out buildings are faded and dashed.
- **The lane and the Slicer use only the picked buildings.**
- **Build the picked buildings:** each picked building arrives in the editor as its own piece, where it stood, with the camera heading and tilt the player ended on.
- **Scale:** the caption under the Slicer says it in one sentence, and follows the radius and shrink sliders.
- **Not yet:** other map features (steps, rails, walls, water, paths, trees, playgrounds).
  - The map query only asks for buildings today.
- **Pictures:** `data/eval/cc-79-flight/`.
