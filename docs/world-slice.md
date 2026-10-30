# The world slice: real 3D objects on the obstacle course

*Draft v0.1, 2026-10-27, from the product owner's brief: boxes are boring; make the obstacles look like the real thing, with curves; a fixed set of primitives needs a fixed set of moves; start the water at any level, "like lifting our world up to a higher slice of the 3D scan".*
*Related: [primitives](primitives.md), [pipelines](pipelines.md) (pipeline 7), CC-38 (the 3D lift), CC-39 (placing it).*

## So what
- **The idea:** the game runs on a flat slice of the real object, and the 3D object is only what you see.
  - The simulator stays two-dimensional (along the run, and up), which keeps its exact, testable physics.
  - A real object becomes a **profile**: the outline of its top surface along the run.
  - The profile is what the runner stands on and is blocked by; the 3D mesh is drawn on top of it.
- **Why they cannot disagree:** the profile is measured from the same mesh that is drawn, so nothing floats and nothing sinks.
- **Where it stands today:** curved tops work in the simulator, the renderer and the body push-out (this change); photo skins work; the 3D lift (CC-38) and the slice maker are next.

## The slice
1. **Orient and size the object:** upright, its long side along the run, scaled to its real height (typed by the maker, else a typical size for its label).
2. **Choose the slice level (lift the world):** pick a height `h0` in the object; everything below it is water, everything above is course.
   - The lane has no height cap any more (CC-56): a step above one jump is simply not a course, and ground below `h0` counts down to the drop a roll survives (7.8 m).
   - A big object (a building, a statue) is not squeezed: the maker slides `h0` up or down to the layer they want to run on, so one scan gives many courses.
3. **Cut a lane:** keep only the part of the object within the lane (2 m across the screen, the same thickness the blocks have).
4. **Take the profile:** for each position along the run, the highest surface inside the lane and inside the band; thin it to at most 24 points; steeper than 45° counts as a face, not a slope.
5. **Name the primitive** (below) and write its numbers into the course; keep the mesh as its skin.

## Choosing the lane: turn the rod
*Idea from the product owner: put a vertical rod through the middle of the scene and turn the scene about it; each turn shows a different 2 m lane, and one of them has the interesting shapes.*
- **Three free choices:** the turn about the rod (every 10 degrees over half a turn; the other half is the same lane run backwards), the sideways step across the scene (about every metre), and the level (where the water starts).
- **Scoring (`src/slice/slice.ts`):** a lane is worth more for each kind of shape it holds, with about equal weight: real gaps, steps, curved stretches and tall faces.
  - It is worth less if it is too short or too long, or has a face a jump cannot make (more than 0.9 m up).
  - A crack narrower than 1.2 m is bridged, because nobody jumps a crack.
- **The simulator has the last word:** the best lanes are kept only if the ideal-run search proves the lane can be cleared; three near-copies of the same lane are not offered.
- **Tried by a script:** `npx tsx scripts/slice-glb.ts scene.glb` prints the best three lanes, sketches each, and writes a course for each.
  - On a synthetic scene (a bench, a dome, a block along one line and a lone tower off to the side) the search turns to the line through the objects and ignores the tower; this is a test.
- **Where AI comes in (not built):**
  1. The scoring above is a plain rule, fast and testable.
  2. The top three lanes can be shown as thumbnails to the maker, who picks one (the Park would get a "turn the rod" slider with a live side sketch).
  3. A vision model could re-rank those three by looking at their sketches and the photo ("which lane would be most fun and still look like the real place?"); worth trying only after the rule-based pick is seen to fail.

## The fixed moves
The set of obstacle shapes is fixed, and each shape offers a fixed set of moves. A new object is not a new rule; it is one of these shapes, drawn differently.

| Shape (primitive) | What the profile looks like | The moves it offers | Built? |
|---|---|---|---|
| `platform` | flat top | run, jump from it, land on it | yes |
| `mound` (curved platform) | a gentle curved top, no face steeper than 45° | run over it, jump off its crest, land on its slope | yes (this change) |
| `gap` | no surface for a stretch | leap | yes |
| `wall` | a vertical face with a top edge | run up the curve, grab the ledge, mantle | yes (the Warped Wall) |
| `ramp` | a long smooth rise | run up it, launch from its top | partly (the Warped Wall's arc) |
| `spring` | a soft top | bounce, press for extra height | yes (the trampoline) |
| `ropeAnchor` | a point high up | catch, swing, let go | yes |
| `bar` | a thin horizontal rod above the ground | hang, swing, shimmy, drop | proposed, not built |
| `movingHazard`, `water` | moving or empty | time it; failure is cheap | water yes |

- **Railing** = `bar` when it is thin and high, `platform` when you can stand on its top rail.
- **A painted wall** = `wall` (or a low `platform`) with the mural as its skin.
- **A curved low wall or dome** = `mound`.

## Looking real
- The mesh is placed so its top surface is the profile; the runner's feet and hands meet the surface the player sees.
- The body is kept out of the surface with the same push-out the wall uses (`src/course/collide.ts`), now following the curve.
- Flat photo skins are the fallback for any obstacle without a lifted mesh.

## What is built, what is next
- **Built:** a platform may have a `profile` (heights along the run); the runner follows it, is stopped by anything steeper than 45°, lands on it exactly; the Course draws it as a curved block; the Park has a `mound` kind; tests cover all of it.
- **Next, in order:**
  1. The slice maker: mesh in, profile out, with the level slider (script first, then in the Park).
  2. Draw the real mesh on its profile (CC-38 gives the meshes).
  3. The `bar` primitive and its moves (hang, swing, shimmy).
  4. Classify automatically from the profile (flat, curved, face, thin rod).
- **Honest limits:** one lane per course (no tunnels or overhangs); a lane of 2 m; thin or lacy objects (railings seen from the side) come out as a rod, not a surface, but turning the rod shows a railing from the end, where it is a wide, solid shape.
- **Not yet checked:** lanes from a real scan (the meshes from CC-38 are not in yet); a lane's look when drawn with its real mesh.

## The product: from photos to a world you can edit (CC-40)
- **What a user gives us:** photos of their surroundings, drone footage, a scan, or a toy model on a desk.
  - A **.glb** file is only the format the reconstruction step writes (SAM 3D Objects, photogrammetry apps); users never see it.
  - The slice search also works on plain point clouds (a mesh without triangles is its own points).
- **Scale is a number, not a fact:** every piece has a scale (metres per unit of its own mesh).
  - A drone scan of a whole park is shrunk until it is a course; a 3 cm toy brick is enlarged ×15 until it is a half-metre block.
  - "Real height" is the one way to say it: type how tall the thing is, and the piece takes that size.
- **Edit it like an image:** move, turn, scale, lift, copy and paste, and crop (a box cuts every triangle at the box's sides and keeps the inside where it was).
- **Then choose the lane:** by hand (turn about the rod, sideways, level) or "Find the best lane", seen from the side as it is edited, and played with one button.
- **Layout:** one screen, never a vertical scroll: the plan takes two thirds of the left side and the lane's side view the bottom third, with the piece and lane panels on the right; both pictures resize with the window (checked at 1280×720, 1024×640 and 1440×900 by `scripts/editor-check.mjs`).
- **Built (the World editor, `?mode=editor`):** a plan view with seven library pieces and .glb import; all of the above; a side view of the lane; the simulator's verdict; Play.
- **Not built yet:** a 3D view of the world; photos and drone footage going in directly (they go through the reconstruction pipeline first: CC-38); undo; snapping; saving imported pieces between visits; sharing a built world with the community.

## Try it yourself
- **The editor:** with `npm run dev` running, open `http://localhost:5173/?mode=editor` (also linked from the Park and the gallery).
  - Add "Toy brick": it arrives enlarged ×15; type 0.5 in "Real height" and it is a half-metre block.
  - "Copy and paste" it, drag the copy along the orange band, "Find the best lane for me", then "Play this lane".
  - Check it: `node scripts/editor-check.mjs`.
- **Tests:** `npx vitest run tests/slice.test.ts tests/terrain-profile.test.ts` (the slice search, the .glb reader, curved ground).
- **See lanes cut from a scene:** `npx tsx scripts/demo-scene.ts` writes `public/assets/demo/demo-scene.glb` (a bench, a dome, a low wall, a rounded block and a lone tower) and the best lanes as courses; then, with `npm run dev` running, open `http://localhost:5173/?course=/assets/demo/lane-1.course.json` (and `lane-2`).
- **Your own scene:** `npx tsx scripts/slice-glb.ts yourscene.glb` prints the best three lanes and writes a sketch and a course for each into `test-results/slices/`.
- **Curves by hand:** in the Park (`?mode=park`) draw a box, set "This is a" to `mound`, make the course and run it.

## Running and jumping on curved ground (fixed 2026-10-27)
- **What the product owner saw:** hard to jump on domes; past the middle the runner slid off in the air; before the middle a jump jerked the runner backwards.
- **Cause 1, "slid off airborne":** the runner was treated as leaving the ground at any drop in the ground, however small, so from the crest on it was airborne and Space did nothing (a jump needs the feet on the ground).
- **Cause 2, "jerked backwards":** a jump from the rising side flew into ground that was higher than the feet, which the simulator took for the side of a block, and it moved the runner to the platform's left edge with no speed.
- **Not the cause:** the animation.
  - The character's legs are only drawn from the simulator's position; they cannot push the runner.
- **Fix:** on a curved top the feet stay on the ground down any slope gentler than 45°, and a curved top has no side to hit in the air (rising ground is met by landing).
  - A real drop, such as the edge of a platform, still lets go.
  - Three tests fail on the old code and pass on the new.
- **Side effect found and fixed:** with domes now passable, many trial runs of the ideal-run search ended pressed against something and stood still until the 80 s limit, which made the slice search and the editor's check about 10 times slower; a run now stops after 1.5 s of standing still (same result, about the old speed).

## Photo objects in the editor (CC-38 meets CC-40)
- **The "From real photos" row** in the editor lists the objects lifted by SAM 3D Objects (`public/assets/objects/index.json`): a skate rail, a skate box, a concrete bench and an iron railing, each at its real size (the railing is 2.52 m long and 1 m high).
- **They are pieces like any other:** move, turn, scale, lift, copy, crop; the lane is cut from their real shape.
- **Fix found on the way:** "Find the best lane" measured the sideways step from the middle of the scene, but the editor draws the lane from the origin, so a lane it found could differ from the lane it showed.
  - The search now takes the editor's rod as its centre (test added).

## Drum lane and size references (2026-10-28)
- **Drum lane (`src/sim/drums.ts`, `src/ui/drum-lane.ts`):**
  - plays the ideal run once and records where it presses Space (jump, rope let-go, trampoline press);
  - shows those places as taiko drums that slide toward a hit line as the runner closes in;
  - on by default for every course that has a planned route (built, generated or the stock course), G toggles it (`?drums=1` forces it on); a coaster has none;
  - shows the line only; it never scores the player's own presses.
- **Editor objects:** every object we have is placed from the editor: the photo objects (including park02 rail and park07 stairs, test-only), plus size references (a 1.75 m person from the Rookie model, and the demo scene).
- **Not in the editor:** the two mural walls (the artist's rights) and the park06 slab (33 m, wrong size).

## The editor is 3D (2026-10-28)
- **3D view (`src/slice/view3d.ts`):** the main picture is now a rotatable 3D scene (drag empty space to turn, right-drag to pan, wheel to zoom); pieces are drawn as the real baked objects with their photo textures, on a paved ground, with the lane as a gold strip and the rod as a post; water shows when the level is above 0.
- **Moving things:** drag a piece along the ground; "Top plan" switches to the flat plan, which is still the way to crop.
- **No blocks by default:** the first world is a concrete bench, the long low box and the rail from real photos; the basic shapes are still in the "Basic shapes" row.
- **A cropped piece** falls back to plain geometry (its texture does not survive a crop yet).

## Play draws the real objects; helpers in the editor (2026-10-28)
- **Play view:** a lane from the editor carries `scene` (each piece placed in the game's frame: along the run, height above the level, across the lane, turn and scale) and `uMap` (where each run of ground landed once gaps were squeezed).
  - The game draws the real objects (their own meshes and photo textures) instead of blocks; only the start and finish decks stay as ground.
  - Collision is still the lane's profile, so what you see and what you stand on come from the same mesh.
  - A piece uses the run nearest its middle, so an object with a gap inside it is shifted as one piece.
- **What to shift (`src/slice/advice.ts`):** when the lane cannot be cleared, the editor lists fixes the simulator has proved (slide, resize, lower, turn the lane, sideways, level), each with a "Do it" button; if no single small shift works it says so.
- **Design partner (`src/slice/designer.ts`, `functions/api/designer.ts`):** Muse Spark Open sees the world, the verdict and the proved fixes, answers in a few sentences and offers edits you accept with one click; it is off when no key is set.
- **Repair:** a `node_modules` symlink was committed by mistake in `b79be31` and removed in `3b5808a`; `node_modules` is ignored now.

## Debug view, Fix it, and the helper window (2026-10-28)
- **Debug view (B, or the "Debug (B)" button; `?debug=1`):** draws what the simulator really uses, like a fighting game's hitboxes:
  - yellow is the collision outline of the ground and the wall;
  - blue is the runner's body box and feet point;
  - green or red is where a jump right now goes, run on the simulator's own physics (`src/sim/predict.ts`), with the reason in words ("lands 0.3 m from the edge", "falls 1.2 m before the next ground", "the step ahead is 1.4 m high").
- **Keys:** the drum lane moved to G, because D is also a run key.
- **Fix it (`src/slice/fixit.ts`):** one click changes the layout into one the simulator clears: the smallest proved fix again and again, shrinking a step no jump can climb, and as a last resort the best lane through the pieces.
  - The result and the steps taken are written in the helper window.
- **Helper window:** it floats over the 3D view (open or close it with the "Design partner" button), with a larger text box, and nothing covers it.

## Holds and the lache pair (CC-44, 2026-10-28)
- **Holds (`src/sim/holds.ts`):** bars hanging in the air, seen from the side (`course.holds`: x along the run, y high; no frame needed).
  - Grab: airborne, the hold key (E) held, and the hands (2.1 m over the feet) within 0.6 m of a bar; the arms keep 70 % of the speed along the swing.
  - Hang: a pendulum about the bar, effective length 2/3 of the hands-to-feet length (RK4 at the fixed step); the small-swing period is 2π√(L/g).
  - Pump: the arrow keys drive the swing (1.5 rad/s²); pressing the way the body moves adds energy, pressing against it takes energy out; a swing nobody pumps slowly dies.
  - Let go: both hands off; the body flies on with its own velocity; no re-grab for 0.2 s.
- **Proof:** the ideal-run search tunes the take-off press and how long to hang on each bar; a lache pair over an 8 m gap is cleared with about 3 s of pumping on the first bar, a plain jump splashes, and a gap of 14 m or bars out of reach are not cleared.
- **Not yet:** vault, the editor's Overhead row and side-view dragging, the front-view window, and the bar drawn in the game.

## The vault and energy (CC-44)
- **Vault (V):** with speed (3 m/s or more) and an obstacle whose front face is within 0.9 m ahead and whose top is 0.35 to 1.3 m above the feet, a hand goes on top and the body goes over without a long arc; it keeps 92 % of the speed.
- **Why it is worth it:** on a course with `jumpKeep` below 1 (a jump loses speed at take-off) a vault gets to the same point sooner; both spend energy (`src/sim/energy.ts`: a vault costs less than half a jump).
- **Proof:** the ideal-run search now also looks at steps (0.3 to 1.3 m, touching the ground before them), tries a vault and a jump at each press, and keeps the one that gets farthest (a vault wins a tie).
- **Stock course:** unchanged (`jumpKeep` is 1 there, and its plan is the same as before).

## The lache demo in the game (CC-44)
- **Open it:** `/?course=/assets/demo/lache.course.json` (a run, a vault over a 1 m box, then two bars over 9 m of water); add `&bot=ideal` to watch the proven line.
- **Keys on a custom course:** E in the air grabs a bar, the arrows pump the swing, letting go of both flies on, V vaults; the controls card lists them.
- **Drums:** the lane shows vault, grab (E) and release presses.
- **Why the search got bigger:** tuning one bar at a time missed lines that clear (the swing and the next catch depend on each other), so a joint search over the take-off and the first two hang times is used; it also guards against states that go to NaN.
- **Limits of the swing:** the arms keep 35 % of the speed on a catch, and the swing stops 100° from straight down (no flips).

## Bars in the editor (CC-44)
- **Overhead row:** "Bar" and "Lache pair" add bars hanging in the air; a bar is a piece with `src` "hold:bar" (not ground: the slice ignores it, `src/slice/holds-world.ts`).
- **Side view is where bars are dragged:** along the run and up or down (5 cm steps, 0.35 to 4.3 m); the green and gold dashed lines show what hands reach standing (2.7 m) and with a jump (3.7 m), the simulator's own numbers.
- **Lanes with bars keep their real gaps** (up to 14 m) and their jumps cost speed (`jumpKeep` 0.88), so a vault and a swing are worth learning; the ideal-run proof includes the bars.
- **Undo and redo:** Ctrl+Z and Ctrl+Y or the buttons (80 steps).
- **Test from the selected piece:** starts the runner about 8 m before the selected piece, on the nearest ground.
- **Not yet for bars:** Fix it and the shift advice (they say so), the front-view window.

## Front view window (CC-44)
- **What:** a small second camera drawn in a corner window (bottom right) shows the runner from the front while hanging from a bar, so the hands on the bar and the swing can be read next to the side view; F shows it at any time (`?front=1` too).
- **How:** the same scene is drawn twice in one canvas (a scissored second viewport; the WebGPU viewport counts from the top).

## Fix it and the design partner know about bars (CC-44)
- **Fix it with bars (`src/slice/fixbars.ts`):** tries small moves of the bars (up or down, along the run, both together), skips any that leave no bar a jump can reach, and keeps the smallest one the ideal-run search proves; it stops after 6 s and says so.
- **Design partner:** the world description now lists the bars (where along the run, how high) and the prompt explains the reach numbers, the swing, the vault and the cost of a jump.

## Swing aids: push and let-go cues (CC-44)
- **On a bar:** the hint says which arrow to push (the way the body is swinging) and, from a look ahead run on the simulator's own physics (`predictRelease`), "LET GO NOW" when letting go reaches the next bar or the far ground, or why to keep swinging ("you would land back on the near side", "you fall in the water").
- **Debug view:** while hanging it draws the path of letting go now instead of a jump.
- **Debug card (CC-98):** one card at the top left, shown instead of the controls card while Debug is on.
- A readout of short label and value rows, then four folded sections (Shapes, Predictions, Contacts and windows, Machines).
- Each overlay has a swatch and a switch, remembered per browser.
- Longer explanations sit in tooltips and in a closed "What is this?" row.
- Esc or B closes it, and Copy state copies the readout as text.
- `scripts/debug-panel-check.mjs` fails on overlap, off-screen cards, clipped text and lines over 8 words.

## Demo menu (CC-44)
- **A menu at the right of the Course** ("Open another course") lists every course we have made: the stock course, the lache demo, two lanes from the demo scene, three places from the map spike (Barcelona, Montmartre, Sydney) and a link to the editor; `scripts/demos-check.mjs` opens each one.
## Map mode: pick a place, get a piece (CC-48)
- **What:** `?mode=map` shows a world map; search for a place or click to drop a pin, then "Build this place".
  - The buildings around the pin become one piece in the world editor (`?mode=editor`), ready for "Find the best lane for me".
- **Parts:**
  - `src/world/osm.ts`: pure; an Overpass answer becomes extruded buildings (height tag, else levels x 3 m, else 9 m), shrunk, capped at 8 m after the shrink, centred on the pin, standing on y = 0.
  - `src/modes/map.ts`: the map (MapLibre GL, OpenFreeMap tiles), the search (Nominatim, one call per press of Search, a short list of famous places if it fails), the sliders, Overpass (three mirrors, retried, one query per place and radius, cached in `sessionStorage`).
  - The hand-over: `sessionStorage['cc.map.piece']` holds `{name, positions, indices}`; the editor reads it once at start, removes it, and shows the place as the whole world.
  - A map piece (`src` `map:<name>`) is never saved to the editor's `localStorage`.
- **Sliders:** radius 80 to 250 m (default 120); shrink 0.02 to 1 (default 0.2, the middle of what cleared in the spike: 0.07 to 0.24).
- **Credit:** the map shows "© OpenStreetMap contributors" and "OpenFreeMap"; terms in `docs/ASSETS.md`.
- **Checked by:** `tests/osm.test.ts` (saved Overpass answer, no network) and `scripts/map-check.mjs` (screenshots in `data/eval/cc-48-map-mode/`).
- **Not done:** ground height, roads and water (CC-46 next steps); courtyards; a place with no buildings says so and stays on the map.
## Course generator v1 (CC-47)
- **What it does:** `generateCourse(seed, { moves, length, difficulty })` in `src/slice/generator.ts` turns a number into a course of proved moves.
- **Moves that work:**
  - gap jump (2.5 to 5.2 m of water);
  - step up (0.4 to 1.3 m, a vault or a jump, whichever the proof finds faster);
  - lache pair (bars at 2.8 to 3.0 m, spacing 2.2 to 3.5 m, a gap of 6.5 to 7.8 m);
  - warped wall (3.4 to 4.3 m; the deck stays up after it, because the wall only starts from ground level).
- **Move that works but is only used when asked for:** the rope (gap of 6, 8 or 9.5 m); its proof takes about 9 s.
- **Move not built:** the trampoline.
- **Ramp:** the first move is at 10 % of its size range, the last at `difficulty` (default 0.7); a move is never easier than the one before.
- **Order:** the same seed gives the same course; no move twice in a row; at most one wall, one lache and one rope.
- **Proof:**
  - each move is proved alone with `searchIdealRun` (cached), then the proved presses are laid along the whole course and played once;
  - if the whole course fails, every move shrinks a little, and then moves are dropped from the end, so the course returned is always cleared;
  - 36 m of flat deck sits before each move, so the runner is at full speed (the speed climbs towards 9 m/s and is within 0.03 m/s of it at 36 m).
- **HUD strip and checkpoints:** one zone and one checkpoint per move; `jumpKeep` is 0.88 when the course has bars or steps.
- **Timing:** about 1.5 to 2.5 s for a default course with a cold cache; the first lache costs about 1.5 s of that; a rope costs about 9 s.
- **Try it:** `npx tsx scripts/generate-course.ts 2 out.json` (flags `--moves=gap,step --length=5 --difficulty=0.9`).
  - A sample, `public/assets/demo/generated-1.course.json` (seed 2: step, gap, lache, wall), opens at `/?course=/assets/demo/generated-1.course.json`.
  - The test (`tests/generator.test.ts`) proves it with the full search, which takes about 40 s.
- **Not yet:** the trampoline; a rope without the 9 s proof; several walls (the course has one wall).

## Make me a course (CC-47)
- **`/?generate=7`** builds the course for seed 7 (a seed always gives the same one) and the Course menu has "Make me a new course (random)".
- **The proved line travels with the course** (`course.plan`), so the drum lane and `&bot=ideal` need no search (a whole-course proof with a lache took about 38 s).
- **Checked in the browser:** the bot clears seed 2 (step, gap, lache pair, warped wall) end to end (`QUERY='?generate=2' node scripts/lache-check.mjs`).

## The swing lesson in the Dojo (CC-44)
- **New tab "Swing on a bar"** (`/?mode=dojo&ex=bars`; the Course's Dojo button opens it from the lache zone): the answer is the time of one swing, which follows the square root of the swinging length (so the formula page has live sliders); two more sliders (push with or against the swing, how long) show the swing growing or fading, and the saying "Push with the swing and it grows; push against it and it fades." is earned there.
- **Picture:** it borrows the rope's diagram until it has its own.
- **Check:** `scripts/dojo-bars.mjs`.

## The real keyboard path (CC-44)
- **Checked with real key presses** (`scripts/keys-check.ts`, the game at 0.15 speed): V vaults the box, Space jumps, E grabs the first bar, the arrows pump, letting go and E again grab the second bar.
- **What the check found and fixed:** a V pressed even slightly late hit the box (the window was 0.9 m, about 0.1 s), so a V pressed up to 0.2 s early now counts, the reach is 1.2 m, and the ideal press is the centre of the window; bars grab within 0.6 m.
- **Not a pass/fail test:** its let-go timing is crude, so it ends in a splash; the proved line is checked by the bot (`scripts/lache-check.mjs`).

## Mesh census (CC-50)
- **So what:** an object with a wrong size or holes can make a jump "work" on something that is not there, because collision comes from the same mesh as the picture.
- **What it checks:** size in metres, open edges (holes), flipped edges, edges shared by three triangles, empty triangles and loose points (`src/slice/census.ts`, `npx tsx scripts/mesh-census.ts`).
- **When it refuses:** a side longer than 12 m or shorter than 5 cm (scale bug), or more than 1% of triangles affected by one of the defects.
- **Our six objects:** all pass.
  - rail-skate-01 has 19 open edges and 8 empty triangles (about 0.3% of the mesh), the most of the six.
  - railing-iron has 5 edges shared by three triangles.
  - The others are clean or nearly clean.
- **Tests:** `tests/census.test.ts` breaks a cube on purpose (scale x100 and x0.001, a hole, a flipped face) and every object in the library must pass.
- **Idea source:** a thread on why model-written Blender scripts break (2026-10-28): units, and defects a render hides.
- **Known gap:** it does not check self-intersection, which is slow on big meshes.
## PartLLM spike: can it find the part a hand holds? (CC-49)
- **So what:** not yet; the editor should not trust it to place holds.
  - It found the top tube of a handrail well (2 of 9 "this part exists" checks hit, and both were handrail "rail").
  - It also invented parts that are not there: 11 of 13 "this part is absent" prompts got a part anyway.
  - Keep holds as pieces placed by the human or by the proved bar tools (`src/slice/holds-world.ts`), and re-test when a newer release or a point prompt is tried.
- **What we ran:** PartLLM (Apache-2.0, weights `Czvvd/PartLLM`) on a Modal L4, text-guided with "bar", "rail", "ledge", "step", plus full-shape once, on our six object GLBs.
  - Code: `pipelines/partllm/modal_app.py` (run) and `pipelines/partllm/score.py` (score).
  - Answer key, hand-labelled from side and top views: `data/eval/partllm/answer-key.json`; scores and one picture per object: `data/eval/partllm/`.
  - Raw outputs (62 MB) live in `../conquercourse-assets/partllm/` with `SHA256SUMS`.
- **Per object (precision = share of the part inside the real hold, recall = share of the hold covered):**
  - `rail-skate-01`: "rail" hit (precision 1.00, recall 0.95); "bar" took a post (miss); "ledge" and "step" invented.
  - `rail-skate-02`: "rail" hit (0.98 / 0.52); "step" took the lower end of the sloped rail (0.79 / 0.47, a false claim).
  - `railing-iron`: "rail" nearly (0.47 / 0.62, just under our 0.5 bar), "bar" spread over the pickets (0.14 / 0.35).
  - `bench-concrete`: "ledge" missed (0.11 / 0.06); "bar" took the whole back and seat.
  - `box-skate-03`: "ledge" took the whole box (0.11 precision, 0.85 recall), so it cannot say which edge.
  - `stairs-park-07`: "ledge" missed (0 / 0); "step" gave a part (0.34 / 0.15) but the steps are soft in this mesh, so it is not scored.
- **Why it fails:** it must return a part for every name it is given (all four names always came back), and it was trained on furniture-like parts, not skate-park edges.
- **Not tested:** the point prompt ("what is the part under this point?"); that is the form the editor would use, so it is the next thing to try.
- **Cost and time:** about 25 GPU minutes on an L4, an estimate of about $1 (exact figure on the Modal dashboard); the model needs about 70 to 125 s per mesh including load.
- **Known gap:** six objects, one answer key by one labeller, so a small sample.

## Sounds (CC-53)
- **So what:** the player now hears the grab and the let-go, so timing on the lache pair can be learned by ear as well as by eye.
- **How:** plain tones made in code (`src/ui/audio.ts`), so there are no files and no licence to track.
- **Events:** jump, landing (silent for a soft touch-down), vault, grab (bar, rope or wall), let-go (bar or rope), splash and finish.
- **Never:** a sound that says how well you did; each sound only says what happened.
- **Start and mute:** audio wakes on the first key press; M or the small button at the bottom right mutes, and the choice is remembered.
- **Dojo:** shares the mute switch only, because the Dojo has no simulator events.
- **Checks:** `tests/audio.test.ts` (fake AudioContext, each event plays once, mute works) and `scripts/sound-check.mjs`.
- **Bot run on the lache demo:** vault 1, jump 1, grab 2, let-go 2, landing 2, finish 1, no errors.
- **Not tested:** how it sounds; headless Chromium cannot be heard, so the product owner should listen once.

## Object bake-off (CC-55)
- **So what:** for the shapes a course needs (thin rails, boxes, benches), TRELLIS.2 is the best of the three at the shape, SAM 3D Objects is the safest, and Pixal3D is not good enough yet.
  - Shape matters most, because collision comes from the same mesh as the picture; texture is judged second and only by eye.
  - All three give a plausible bench and stairs; the difference is in the thin parts and in the hard case (a lattice railing).
- **What was compared** (six crops, one object each, the same cut-outs for both new models; `data/eval/object-bakeoff/inputs/`):
  - **SAM 3D Objects:** the shipped objects from CC-38 (seed 42, padded photo for the bench and the railing, scaled to a typical height).
  - **TRELLIS.2 (4B):** Microsoft, MIT weights; DINOv3 image encoder; one L40S on Modal.
  - **Pixal3D:** Tencent, MIT; it sits on the TRELLIS.2 backbone and estimates the camera with MoGe-2.
  - **Tripo:** not run; the account has 60 credits and one textured object costs about 110 (see the README), so the product owner decides on a top-up.
  - The railing crop is a plain box crop for the two new models, because the SAM 3 mask of that photo covers only 1% of it (a thin lattice).
    - That makes the railing row a mask-failure test for them, not a fair comparison with SAM 3D, which used a padded photo.
- **Shape, one object at a time** (picture: `data/eval/object-bakeoff/sheet-3q.png`, side view `sheet-side.png`, grey shading so only the shape shows):
  - **Handrails (2):** TRELLIS.2 gives a clean continuous tube with its posts, the best of the three; Pixal3D collapses them into a small tangle (8,460 open edges on one, flagged by the census).
    - TRELLIS.2 makes the rails too long (7.7 m and 6.7 m after scaling to 1 m high; SAM 3D 3.8 m and 3.6 m), because the photo is a slanted view.
  - **Box (platform):** SAM 3D and TRELLIS.2 both give a long low box with a step; Pixal3D gives a small block.
  - **Bench:** all three have a seat and a back; Pixal3D fills the space under the seat.
  - **Railing (hard case):** SAM 3D keeps the spear-topped panel; TRELLIS.2 gives a solid box and Pixal3D a stone pier with a gate, neither usable.
  - **Stairs:** Pixal3D keeps the steps (stripes), TRELLIS.2 a flat wedge and SAM 3D a flat ramp; none is good for stepping on.
- **Census (the same rules as CC-50, after scaling every mesh to the typical height):**
  - TRELLIS.2: five of six pass; the railing fails with 1,045 open edges (about 1%).
  - Pixal3D: five of six pass, but the first handrail fails with 7,367 empty triangles and 8,460 open edges, and the stairs and bench have 100 to 400 edges shared by three triangles.
  - Both give about 95,000 to 100,000 triangles (we asked for 100,000); the game needs 5,800, so every object would need decimating, as the SAM 3D ones were.
  - Numbers: `data/eval/object-bakeoff/open-models-census.json`.
- **Time and cost** (one L40S, about $1.95 an hour; the Modal dashboard has the exact figure):
  - TRELLIS.2: 566 s in all, 83 s to load, 27 to 176 s per object, about $0.31.
  - Pixal3D: 636 s in all, 54 to 227 s per object, about $0.34 (one run of 25 minutes stalled in the UV step at its default 1,000,000 faces and a 4,096 texture and was stopped, about $0.8; the second run uses the same 100,000 faces and 1,024 texture as TRELLIS.2).
  - SAM 3D: already done, $0 now.
- **Licences, as far as the public pages show (not legal advice):**
  - **TRELLIS.2 and Pixal3D weights and code:** MIT; third-party parts keep their own terms (Pixal3D lists them in its NOTICE file).
  - **DINOv3 License** (Meta, both models load it): a limited, worldwide, royalty-free licence to use, copy, modify and distribute; it does not mention commercial use either way.
    - Distributing the weights needs the licence text and a visible "Built with DINOv3"; it bans reverse engineering and uses such as military or nuclear.
    - You own what you make with it; Meta changes the terms at will and the licence ends on breach.
    - A game that ships only meshes made with it, not the weights, is not addressed by the text; the product owner may want a lawyer's view before shipping.
  - **Pixal3D loads DINOv3 from a third-party mirror** (`camenduru/dinov3-vitl16-pretrain-lvd1689m`), not from Meta; same licence in principle, but not the official copy.
  - **NAF upsampler** (pulled from `valeoai/NAF` by Pixal3D at run time): its licence was not checked.
  - **RMBG-2.0** (non-commercial, gated) was never loaded: a stand-in returns our cut-outs, so no output depends on it.
  - **SAM 3D Objects:** SAM License (see `docs/ASSETS.md`); the shipped objects are CC0 or credited photos.
  - **Tripo:** paid-plan rights per its help page; free-user and API terms unclear (README).
- **Recommendation:**
  - Keep SAM 3D Objects as the shipping source (Meta model, results exist, one licence we already read).
  - Use TRELLIS.2 where SAM 3D is weak: long thin rails, which it draws better; it would need its length fixed and its mesh decimated.
  - Skip Pixal3D for now.
  - Run Tripo only if the product owner tops up and wants the collaboration beat; the two Rookies already carry that story.
- **Gaps, said plainly:**
  - Six crops and one judge (by eye); sizes come from a typical height, not from the real object, so no model can be scored on true size.
  - The railing row compares a plain crop with a padded photo, so it says nothing about the models' skill on railings.
  - Stairs are not good on any of the three; the steps do not survive.
  - Texture was not judged beyond a glance (grey sheets); that is the lower priority.
- **Files:** `pipelines/objbake/modal_app.py`, `scripts/bakeoff-census2.ts`, `scripts/bakeoff_sheet.py`, `data/eval/object-bakeoff/` (README, inputs, `outputs/*.json`, census, sheets); the twelve GLBs (54 MB) are in `../conquercourse-assets/objbake/` with `SHA256SUMS`.
## Real hills (CC-51)
- **So what:** a place on the map now keeps its real hills, so Montmartre or a San Francisco block is a climb and not a flat plate.
  - It costs the player a smaller place: a hill uses up the height a lane can see, so hilly places must be shrunk much harder.
  - The map mode's "Real hills" box (on by default, `?hills=0` turns it off) builds with them.
- **Where the heights come from:** AWS Terrain Tiles (Terrarium PNGs, no key), read in the browser; code in `src/world/terrain.ts`, pure apart from `fetchGround`.
  - Each building stands on the ground under its middle, shrunk like the rest; the lowest ground of the place is y = 0.
  - A hill becomes steps from roof to roof, which the simulator already handles (decks at different heights).
- **Do the tiles tell the truth?** `scripts/terrain-check.ts`, numbers in `data/eval/cc-51-terrain/elevations.json`:
  - Against two known heights: the Butte Montmartre (130 m) reads 129.8 m, and the Denver State Capitol (1,609 m) reads 1,608.3 m.
  - Against Open-Meteo at the other five places: within 7 m, except the steep Lombard Street block, 11 m low (66.7 m against 78 m; the 90 m model smooths a steep street).
  - Open-Meteo is a surface model with buildings and trees in it, so this is a sanity check, not an exact one.
- **What hills do to a course** (`data/eval/cc-51-terrain/lanes.json`, all four lanes cleared by the ideal-run search):
  - Barcelona Eixample (9 m of slope): the shrink must go from 0.24 to 0.09.
  - Sydney quay (37 m): 0.20 to 0.12.
  - Montmartre (39 m) 0.07 and San Francisco Lombard (62 m) 0.10; neither works at the flat shrink.
  - **Why (before CC-56):** a lane cut one level plane and saw only 4.3 m above the lowest ground (`BAND`, now removed); on a hill, the roofs uphill poked above that and dropped out unless everything was smaller.
- **Gaps, said plainly:**
  - The simulator has no slope physics (no slower uphill, no sliding); a slope is only the steps between roofs.
  - Streets between buildings are still water, so the hill shows only on rooftops.
  - A tilted cut (a plane that follows the hill) would keep bigger buildings; not built.
  - Tiles are about 3 to 5 m per pixel and the grid is 20 m, so small steps still come from OSM.
- **Tests:** `tests/terrain.test.ts` (height decoding, tile maths, blending, a fake-network grid, a roof lifted by its hill, a gentle slope that a lane clears).
- **Try it:** `/?mode=map`, search "Lombard Street San Francisco", build; or the Course menu "Place: San Francisco hill".
## Photo to course draft (CC-52)
- **So what:** the model can read a park photo into a rough course, but not reliably enough to trust.
  - It finds the obstacles in the photo, but adds extra ones, and its sizes are off by about 40%.
  - Two thirds of its drafts clear as drawn, and the simulator is what makes the rest safe.
  - The demo beat is "drop a photo, get a draft, the simulator tells you if it clears".
  - It is not "drop a photo, get a finished course".
- **How it works:**
  - Muse Spark Open (it can see images) is asked for a short list of ground, gaps, blocks (steps, ledges, boxes, benches, rails) and bars, in metres (`src/slice/photo-course.ts`, `functions/api/photo-course.ts`).
  - The answer becomes editor pieces, the simulator proves them, Fix it repairs what it can (`src/slice/photo-proof.ts`).
  - Try it in the editor with `?mode=editor&labs=1` (button "Photo to course (labs)") or `?photo=/assets/park/park01.jpg`; it is hidden without `labs`.
- **The test:** 10 park photos (6 we had, 4 new CC0 ones), 2 answers each, scored against a hand-made answer key (`data/eval/photo-course/answer-key.json`).
  - The key is one person's estimate from the photo, so the score means agreement with a careful eyeball, not truth.
- **Results (20 answers):**
  - 19 gave a readable layout; 1 ran out of room at 4,000 tokens and gave nothing (park01, first answer).
  - 13 of 19 clear as drawn.
  - Fix it repaired none of the other 6; taking out invented bars repaired 2 more, so 15 of 19 end clearable.
  - The model found 95% of the obstacles in the key, but only 5 of 20 answers had the same number of obstacles as the key (it adds extras).
  - Mean size error is 41% of the key's size; the best photos are a bench or box with one obstacle (3% to 33%), the worst are crowded skateparks (50% to 70%).
  - The same photo gives a different layout on a second try for 6 of 10 photos.
- **What goes wrong:**
  - It invents bars to hang from in photos with none (a railing, a tree branch): 5 of the 6 failing drafts had one.
  - Fix it for bars only moves bars, so it cannot remove one; the editor now takes invented bars out as a second repair.
  - A photo has no scale, so heights are guesses from known things (a stair step, a bench seat).
  - On a crowded skatepark it lists everything instead of one line a runner would take.
  - Fix it's 6 s budget is shorter than one proof on the VM (about 7 s), so it can give up before it finds a fix (park03, second answer).
- **Cost:** about 3,150 tokens and 12 s per photo (63,116 tokens for all 20 answers, mostly the model's own reasoning).
  - We do not know the unit price for this model, so there is no money figure.
- **Not tested:**
  - Photos with people, because we do not use them.
  - A prompt tuned to these photos (the prompt was run as first written; tuning on 10 photos would not be a fair test).
  - Scale from a reference object.
- **Next step if we keep it:**
  - Ask for one line only (the runner's path).
  - Give the model a known object for scale.
  - Allow bars only when the photo shows a bar.
- **Evidence:**
  - Screenshots `data/eval/photo-course/screens/1-bars-draft.png` and `2-skate-draft-fixed.png` (VM run of `scripts/photo-check.mjs`, saved model answers, ALL OK).
  - Raw answers `data/eval/photo-course/outputs/`, scores `results.json`, `run.json`.
  - Scripts `scripts/photo-course-ask.ts` (needs the key, runs where the key lives), `scripts/photo-course-score.ts` (no key, heavy, run on the VM).


## Shift+I and hazard floors (CC-57)
- **So what:** the demo can now show the whole course done right with one key, and a fall no longer always means water.
- **Shift+I:**
  - It plays one ideal run from the standing start (always, CC-241) to the finish, without handing back after each obstacle.
  - Plain I still shows one obstacle.
  - Any other key takes the run back, and R retries as before.
  - A button "Whole course (Shift+I)" sits next to "Ideal run (I)".
- **Stored plans:** every demo course carries its whole-course plan (`course.plan`), so Shift+I starts at once.
  - `npm run plans` makes new plans for all eight demo courses (about 2 s each on the VM).
  - `tests/demo-plans.test.ts` fails when a plan no longer clears its course, so a change to the simulator or the search cannot leave a stale plan behind.
  - A course without a plan is searched in a Worker (`src/sim/ideal-worker.ts`), so the page keeps drawing.
- **Bug found on the way:** the "Ideal run: watch how it is done" line was wiped every frame by the message code, so nobody saw it.
  - It stays on screen now.
- **Floors:** a course names its floor in `hazard` (water by default, lava, mud, spikes, dark drop).
  - Only the paint, the words and the sound change; the run ends the same way on every floor, and the simulator still says "splash".
  - Words say what the floor did and what would have worked, never how well you did.
  - Lava glows and pulses, mud has bubbles, spikes are steel cones, the dark drop is a gradient that falls away.
  - `?hazard=lava` tries a floor on any course; the editor has a "Floor you must not touch" picker; the generator picks by seed (`seed % 5`, water on every fifth) without changing the random draws.
  - Demo choices: the lache demo is lava, lane 1 is spikes, the generated sample (seed 2) is mud.
- **Checks:** `scripts/ideal-all-check.mjs` runs Shift+I on all eight demo courses (all clear, run on the VM), the any-key stop, and each floor (fall, words, sound).
  - Screenshots: `data/eval/cc-57-floors/`.
- **Known gap:** lava, mud and spikes are paint, words and sound only; mud does not slow you down.

## Roll and survivable drops (CC-56)
- **So what:** a big drop is no longer a wall of the editor; it is a move.
  - Tap X just before you land and a fall that would end the run is spread out and survived, keeping most of your speed.
  - Lanes are cut by what a player can survive and reach, not by a 4.3 m band.
- **Physics, same as before:** the same speed change spread over more time is a gentler push.
  - Fall speed at touchdown is `v = sqrt(2 g h)`.
  - The push is `v / stop time`, but the stop cannot last longer than the body can travel (`2 x travel / v`), so a big fall is stopped harder than a soft landing time alone would say.
  - Numbers (`src/sim/landing.ts`): stiff legs 0.1 s or 0.3 m of travel, bent knees 0.3 s or 0.6 m, roll 0.5 s or 1.2 m; a stop above 60 m/s² is a stumble (keeps 30% of the speed); above 80 m/s² the run is over.
  - A roll is never a stumble and keeps 85% of the forward speed.
- **What each landing survives** (worked out by `safeDrop`, tested at the edge):

| Landing | Clean up to | Survives up to |
|---|---|---|
| Straight legs | 1.8 m | 2.4 m |
| Bent knees (hold the down key) | 3.7 m | 4.9 m |
| Roll (tap X just before the ground) | 9.8 m | 9.8 m |

- **New failure:** a landing past the limit is a "hard landing" (`outcome 'hurt'`, event `hard-landing`), not water.
  - The panel says what the ground did and what would have worked: tap X just before you land.
  - It never grades technique.
- **Input:** X, buffered a quarter of a second (`ROLL_BUFFER`) before a landing; a fresh press on the ground starts a ground roll (below).
- **Lanes:** `LANE_DROP` is 7.8 m (80% of the roll limit, so the ideal run has room to spare); a lane with a bigger drop between grounds is not a course, and the advice says so.
  - A lane may start on a roof: levels 3 m and 6 m above the lowest point are tried, and ground down to 7.8 m below the level counts.
  - The finish deck sits a metre below a high ending, level with a deep one.
- **Ideal run and drums:** the plan presses X itself when a fall is more than a squat takes cleanly (`rollNeeded`); the drum lane shows an X drum.
- **Prediction (debug view, B):** says "You hit the ground at N m/s: a clean landing / a stumble (tap X)", or "Hard landing".
- **Demo:** `/?course=/assets/demo/drop.course.json` (a 5 m ledge; add `&bot=ideal` to watch the roll).
- **Tests:** `tests/roll.test.ts` (drops of 1, 3, 4, 5, 8 m with and without squat and roll; the limits against the landing report; the early-press buffer), `tests/demo-drop.test.ts`.
  - Two older tests changed because a 2.5 m and a 3 m fall with straight legs are now a hard landing, not a stumble.
- **Gaps:**
  - The roll is a state with no tuck animation yet.
  - Fix it does not yet shorten a lane drop.
  - The key is X (C was already the camera); the product owner confirms.

## Pose-conditioned Kimodo (CC-54)
- **So what:** holding Kimodo to key poses makes a plain hang pass the gate in all four seeds, but a swing and a vault still fail, so the Rookie keeps motion capture for those moves.
- **What it was:** hand-set key poses for hang, swing and vault go to Kimodo as full-body position constraints; the same text without poses is the baseline.
- **Hang:** 4 of 4 pass, and the hands end 0.23 m from the pose on average (0.57 m without the pose).
- **Swing:** 0 of 4 pass in two rounds; the knees fold and the hands leave the bar, so the pendulum is not followed.
- **Vault:** 0 of 4 pass in two rounds; the tucked pose is fine alone, but the result is in the air longer than the held rule allows.
- **MediaPipe:** found the body in 4 of 4 front pictures and 1 of 4 side pictures of a plain mannequin, so it did not feed Kimodo.
- **Cost:** about $0.2 of Modal.
- **Next step:** no more spend here; a swing is better tracked from the simulator's own pendulum path.
- **Details:** `data/eval/pose-kimodo/README.md`.
## Cup stacks (CC-60)
- **So what:** a familiar real set-up, sport-stacking cups, is now an obstacle shape.
  - Any pyramid the player knows becomes steps to climb and a valley to cross.
  - It is the cheapest "any object becomes a world" step, because the simulator already has steps and vaults.
- **What it is:** a Stack piece in the editor (`Stacks:` row: 3-3-3, 3-6-3, 6-6, 1-10-1, Cycle).
  - The picture is real stacked cups, mouth down, one colour per row, drawn with one instanced cone per cup (`src/slice/cups.ts`).
  - The collision is a thin floor with the stepped outline of the pyramids on it (`src/slice/stack.ts`), so the lane, the proof, the vault and the ideal run work as for any other piece.
  - A cup is 9 cm; the piece scale makes it runner-sized (default stacks are 0.7 to 1.1 m tall).
- **What the proof found** (the ideal-run search, from a standing start, 9 m run-up):
  - 3-3-3 at scale 5, 3-6-3 at 4.5 and the cycle at 3 clear.
  - 6-6 and 1-10-1 do not clear at 4.5 or more, so their defaults are 3.5 and 3.
  - The valley between two tall pyramids is the hard part: a 1 m climb out of a valley one cup wide.
- **Demo:** `?course=/assets/demo/stack.course.json` ("Stack demo: climb the cup pyramids" in the menu), made by `scripts/make-stack-demo.ts` through the same road as the editor.
- **Saying:** "Speed climbs the cups, and speed carries you off the top."
  - Backed by a test: at running speed the one-cup flat top is crossed in under a fifth of a second.
- **Tests:** `tests/stack.test.ts` (cup counts, row geometry, default heights, the lane equals the outline, the demo clears); `scripts/editor-check.mjs` adds a stack and reloads.
- **Evidence:** screenshots of the run in Play with real cups, and the stepped outline in the editor's side view, linked on CC-60.
- **Known gaps:**
  - Cups are shapes, not rigid bodies: they do not fall over.
  - At scale 3 or less the steps are about as narrow as a 10 cm cell, so the outline is blurred.
  - The stack is one row of pyramids across the lane (four cups wide), not a free 3D pile.


## The lache swing: pivot at the bar, full circles, a real release (CC-58)
- **So what:** the swing now pivots exactly at the bar, can go over the top and round in full circles, and a bigger pump throws the body further.
  - The widest lache a full pump clears is about 6.8 m between the bars; 7 m is just out of reach.
  - A gap of 3 m or less needs only the first swing; 4 m and wider need the swing built up, which takes about 2.4 s of pumping.
- **What was wrong (the product owner, playing the lache demo):**
  - The character swung above the bar: the body was drawn turned about its hands, but placed with its feet where the feet are, so the hands drifted off the bar by about 2 m at 90 degrees.
    - Now the body is placed with the hands on the bar before it is turned, as the rope already did; the screenshots below show the hands on the bar at 0, 60, 120 and 180 degrees.
    - The body also keeps facing one way on a bar (it used to turn round when the swing went backwards).
  - The swing stopped at 100 degrees (`MAX_SWING`); that clamp is gone, and the angle wraps once round.
  - The release was weak, but not because of the release speed: the middle of the body is half the body length (1.05 m) from the bar, and the code used 1.1 m, so the speed was already right.
    - The real causes were the 100 degree clamp, which capped the speed at the bottom near 4.5 m/s, and a slow pump.
    - Now the code uses one consistent rod (hands at the bar, feet at the far end): the middle is half a rod from the bar and the swing behaves like a simple pendulum two thirds of a rod long (1.4 m, a 2.4 s period, unchanged).
- **The limit is the grip, not a wall:**
  - The faster the body swings, the harder the bar pulls on the hands: its weight along the arms plus the pull of the circle.
  - Hanging still the bar carries one body weight; at the bottom of a fast swing it carries much more.
  - A body gets over the top only if it starts the bottom of the swing at about 5.3 rad/s, where the bar pulls about 4 body weights.
  - Pumping stops adding energy when the bar would pull 97% of what the hands can hold at the bottom of the swing; that is the top speed of the swing.
  - If the pull ever goes past the hands' limit (a hard catch), the hands open and the body flies on with its own speed (the message says "Your grip gave out").
- **Numbers (all tunable in `DEFAULT_HANG`, `src/sim/holds.ts`):**
  - **Grip: 5.5 body weights.**
    - Strain-gauge bars measured about 3.5 to 3.7 body weights in ordinary forward and backward giant swings (Kopp and Reid, 1980).
    - An old estimate puts the peak at about 4.9 (Cureton, 1939).
    - An elite gymnast in strapped grips peaked at 5.1 body weights in a basic swing and 5.9 to 6.6 before a dismount (Cagran, Huber and Müller, ISB 2009).
    - These are forces on the whole bar, not the hands alone, and the studies are small.
    - 5.5 is the lower middle of the elite range: a trained ninja, not an ordinary person.
    - Hands that hold under about 4 body weights cannot pump a full circle (a test checks this); 7 m between bars would need about 5.7.
  - **Pump: 6 rad/s^2**, with the swing the full swing is reached in about 2.3 s; against the swing it takes energy out.
  - **Top release speed:** about 6.8 m/s at the bottom of a full-pump swing, in the direction of the swing.
- **Shortest pump that crosses each gap** (bars at the same height, pumping with the swing, then letting go and holding a hand up; `npx tsx scripts/swing-explore.ts`):

| Gap between the bars | Shortest pump | What it means |
|---|---|---|
| 2 m | 0.4 s | the first swing |
| 3 m | 0.6 s | the first swing |
| 4 m | 2.4 s | the swing built up first |
| 5 m | 2.4 s | the swing built up first |
| 6 m | 2.5 s | nearly a full pump |
| 6.5 m | 2.5 s | nearly a full pump |
| 6.8 m | 2.5 s | the edge of what the grip allows |
| 7 m | never | beyond the grip |

- **Tests:** `tests/holds.test.ts` (energy kept over many full circles, a start just too slow does not get over the top, fastest straight down and slowest at the top, the bar's pull, a pumped swing reaches the grip and no further, weaker hands cannot circle, the release speed is omega times the middle of the body) and `tests/lache.test.ts` (wider gaps need a longer pump, 7.5 m is never crossed, without pumping not even 3 m).
- **New demo:** the Course menu has "Wide lache: a 6 m swing" (bars 6.3 m apart), and every stored plan was regenerated.
- **Screenshots:** `data/eval/cc-58-swing/` (`rookie-pivot.png`: the Rookie at 0, 60, 120 and 180 degrees about the bar; `custom-pivot.png`: the custom body at 60 and 120 degrees; the other custom pictures came out blank in the software renderer); `?hangtest=1.05` (radians) hangs the runner still on the first bar for pictures.
- **Gaps:** the arms are a pose (up, straight) and not a grip animation; the body does not tuck when it goes over the top; the 180 degree picture has the bar behind the hint banner.

## The trebuchet (CC-62)
- **So what:** the character can now be thrown across a gap by a falling counterweight, and a bar hanging in the air can catch them on the way down.
  - The throw is the first obstacle where the player chooses how big the push is (the counterweight) and when to let go (Space), so the demo has a launch beat with a grab at the end.
  - Try `/?course=/assets/demo/launch.course.json` (throw onto the tower) and `/?course=/assets/demo/launch-bar.course.json` (the throw reaches a bar, the bar reaches the tower).
  - Keys: hold → to pull the pin, Space to let the rider go (the hint says LET GO NOW), E to hold the bar in the air, X to roll out of the landing.
- **The machine:** a stiff arm turning about a pivot, a counterweight on the short side, a stiff sling to the rider (`src/sim/trebuchet.ts`).
  - Two angles (the arm and the sling) make a double pendulum with a heavy short end; it is integrated with RK4 at the fixed step like the rope.
  - Defaults: pivot 5.5 m up, arm 5.5 m long side and 1.3 m short side, sling 3 m, counterweight 1200 kg, rider 80 kg.
  - The rider starts standing on the deck at the end of the sling.
    - A counterweight that is too light cannot lift the rider: the arm barely moves (a dud, with a message).
- **Laws the tests check** (`tests/trebuchet.test.ts`):
  - Energy is conserved by the swing (drift under 0.3 percent).
  - The throw never holds more energy than the counterweight gave up.
    - With the default machine the rider takes about 58 percent at best, the range of a well-tuned real trebuchet (half to two thirds).
    - The stiff, frictionless model tops out near 80 percent for a very heavy weight.
  - A balanced arm (weight times distance equal on both sides) does not turn; a lighter weight lets the rider drag the arm the wrong way.
  - A heavier counterweight throws farther: about 18 m of best range at 1000 kg, 27 m at 1200 kg and 35 m at 1400 kg on the first geometry we tried; the shipped default was retuned for a 20 m throw.
  - The flight after the release is the ordinary flight: the most range for the same speed is at 45 degrees, exactly v squared over g.
- **Release timing is the skill:**
  - The arm stops against the frame at 140 degrees and the rider keeps swinging round the stopped tip, so waiting for the stop is not the best moment.
  - On the Launch course the good releases last about half a second; far decks make the window shorter (a deck at 18 m has about a fifth of a second).
  - The look-ahead cue (`predictLaunch`, same code as the debug view, B) says where the rider would come down if they let go this instant.
- **Why the landing deck is up in the air:** the best throw peaks near 10 m and comes down from there.
  - On flat ground that is a hard landing even with a roll (the limit is 9.8 m), so the demo lands on a tower 4 m up, a fall the roll takes.
- **The bar variant:** the bar hangs where the throw's hands pass it, the tower is beyond the throw's reach on its own, and the bar's swing carries the rider the rest of the way.
  - A test shows the course is not clearable without the bar (`tests/demo-launch.test.ts`).
  - The window is narrow (about a tenth of a second when it was tuned); its numbers depend on the swing model of CC-58, and the stored plan was checked after that change.
- **The ideal run:** `searchIdealRun` searches the release moment (and the hang time on the first bar if there is one); stored plans for both demos are in the files (`npm run plans`).
- **In the editor:** a Trebuchet button in the Overhead row starts the lane in a machine and shows a counterweight box (kg).
  - The simulator's proof includes the machine, so the verdict says whether that weight reaches the lane (`src/slice/launch-lane.ts`).
  - Gap: Fix it and the advice do not know about the machine yet; they work on the lane alone.
- **The Dojo lesson (turning moments):** the experiment `lever` is "Balance the arm".
  - The question is how heavy the weight must be to just balance a rider.
    - The answer comes from the simulator (bisection on whether the arm turns), not from a formula.
  - Discoveries: the balance weight falls as the weight moves out from the pivot (inverse), grows as the rider sits farther out (direct), and a heavy weight close in matches a light weight far out.
    - The note also reports how fast the tip moves for twice the balancing weight on a longer arm.
  - The formula (moment is force times distance) is the last step of the lesson and never on the Course.
    - The momentum lesson is separate (CC-66).
  - The saying: "A long arm gets you far; letting go late gets you thrown into the ground."
- **Gaps:** the sling is a stiff link (a real sling is a rope that can go slack); the counterweight is fixed to the arm, not hinged; the rider is drawn in the running pose, with no seated or tucked pose; the machine is a plain frame of boxes.
- **Evidence:** bot runs of both demos clear in the browser (`scripts/launch-check.mjs`); screenshots in `data/eval/cc-62-trebuchet/`.

## Roller coaster (CC-61)
- **So what:** the game now has a contraption with no legs and no arms: a cart on rails.
  - Nothing drives it but gravity, so the lesson is the shape of the track: height is stored speed.
  - A first hill that is too low stalls the cart; a hilltop that bends away too fast throws it off the rails.
  - It is the first of the "any setup becomes an obstacle world" contraptions (CC-59).
- **Physics** (`src/sim/cart.ts`, Earth gravity only):
  - The rails are a smooth curve (a natural cubic spline) through the dots; the cart's speed along them comes from the height it gains or loses, minus a little rolling and air drag.
  - It is integrated with RK4 at the fixed step, like the rope and the bars.
  - The rails push up on the cart with `g cos(slope) + bend × speed²` per kilogram; in a valley that is more than the weight, on a crest it is less.
  - At zero the rails let go and the cart flies on as an ordinary projectile (a splash, or a landing on the finish deck).
  - On a hill it cannot climb the speed reaches zero; it rolls back for a moment and the run ends as "stalled".
- **Keys:** the first push is → or Space; holding ↓ (or S) brakes.
  - The brake is the only skill: slowing before a sharp hilltop keeps the cart on.
- **Proof** (`searchCartRun` in `src/sim/ideal.ts`):
  - The ideal run pushes at the start and finds where to brake, one crest at a time, as the starting point that clears the whole course with the widest window.
  - Fix it for a track (`src/slice/fixcart.ts`) tries, in order of size: raise the first hill, lower a hill, make a hilltop broader; the first that rolls home with no brake wins.
- **Demo courses** (`public/assets/demo/coaster*.course.json`, made by `npx tsx scripts/coaster-demos.ts`, which must be run again whenever `src/sim` changes; `tests/demo-coaster.test.ts` fails on a stale plan):
  - "Coaster: ride the hills": rolls home with no brake.
  - "Coaster: a sharp hilltop (brake)": the proof brakes from 17.6 to 25.6 m; without the brake the cart leaves the rails.
  - "Coaster: first hill too low": stalls on the second hill, and carries no proof because none exists.
- **Builder** (`?mode=coaster`): drag the dots, double-click to add or remove one, and the verdict under the picture is the same physics.
  - Fix it and a push slider are there; "Play it" opens the Course with the track in the address (`?coaster=0,9;7,5;...&push=1.5`).
  - A track is not a lane through pieces, so it has its own small editor instead of a piece in the world editor.
- **Dojo:** "Coaster: hills and speed" asks how high a hill the cart can climb; the formula (start height plus push squared over two g) is the last, earned step.
- **Rendering:** rails, ties and posts from the same curve, the cart, and the Rookie seated in it with the swing clip's own seated body (hands up).
- **Debug view (B):** on a coaster it rolls the cart on with no brake and says where it leaves the rails or stalls.
- **Tests:** `tests/cart.test.ts` (energy conserved, never above the start height, friction only takes energy out, leaves the rails on a sharp top and stays on a broad one, braking proof, stall, a bigger push climbs higher), `tests/fixcart.test.ts`, `tests/demo-coaster.test.ts`.
- **Checks on the VM:** `scripts/coaster-check.mjs` (the bot rides two demos home, the third stalls with the right message) and `scripts/coaster-builder-check.mjs` (drag, Fix it, Play it).
- **Screenshots:** `data/eval/cc-61-coaster/`.
- **What "a ride" means (changed after CC-61 shipped):**
  - A direct commit (3696eaf) made the track ground, so a cart that flies off a hilltop can land on the track again and finish.
  - Three coaster tests and Fix it then passed or failed for the wrong reason: the sharp hilltop "cleared" with no brake.
  - A coaster is now ridden well only when the cart finishes and never left the rails on a hilltop (`flewOff` in `src/sim/cart.ts`); the proof, Fix it and the tests use that.
  - Flying across the planned gap between two rail sections does not count as leaving.
  - The demo plans were regenerated with `npx tsx scripts/coaster-demos.ts`: the sharp hilltop needs the brake again (17.6 to 25.6 m).
- **Known gaps:**
  - No loops (the track is a function of x).
  - The track is 2D only: no banking.
  - The seated pose is the rope's swing clip, not a made-for-the-cart pose.
  - The finish deck is a plain block.
  - The builder is a separate page, not a piece inside the world editor.
## Preview before apply (CC-63)
- **So what:** Fix it, the design partner's changes and one piece of advice no longer change the layout behind the player's back.
  - Each one first becomes a proposal: hollow outlines show where things would go, and the simulator says whether the lane clears after it.
  - The player decides: Apply (one undo step), Cancel, or switch single changes off.
- **Why one flow:** the three sources answered different wishes ("make it work", "do what my partner said", "try this small shift"), but they all end in the same question, "is this how I want it?"
  - So the buttons stay different at the start (the header Fix it needs no chat; the partner's button appears only when it suggested something; an advice row says "Show it").
  - The step after them is shared.
- **What the preview draws:**
  - **Plan and 3D view:** a grey outline where a piece is now, a teal hollow outline where it would be, and an arrow between them.
    - A turned or resized piece shows that in its outline.
    - A turned or shifted lane shows a dashed teal line.
  - **Side view:** a dashed teal ground line after the change, and bars as teal circles with an arrow from where they hang now.
  - **Words:** one line per change ("Move “Bar 1” 0.8 m down.") with a checkbox.
    - Switching one off redraws the outlines and re-runs the proof.
- **The partner's buttons:** the duplicate Fix it inside the reply is gone. "Show these N changes" previews the edits; if they do not clear, "Fix it from here" previews the smallest further changes starting from them.
- **Bars:** Fix it for bars now gets 40 seconds, because one proof is 7 to 20 seconds (more on a busy machine) and the old 6 seconds gave up before the first try.
- **Code:** `src/slice/preview.ts` (pure: proposals, plain words, the result of the switched-on changes), `src/slice/view3d.ts` (ghosts), `src/modes/editor.ts` (the card and the drawing); tests in `tests/preview.test.ts`, browser walk in `scripts/editor-check.mjs`.
- **Known gap:** the outline shows position, size and turn, not what a drop or a swing would cost.
- **Pictures:** `data/eval/cc-63-preview/` holds the 3D, plan and side view of a bars preview and the Fix it card (bars too high, one bar would move 0.8 m down).
- **Browser walk:** the new steps pass on the VM (Fix it previews first, bars preview, switch off re-runs the proof, Apply moves the bars, one Undo brings them back).
  - Two older steps did not pass in that run and are not from this change: "no scroll at 1024x640" (the top bar now wraps with the Stacks buttons) and "advice offered" (timed out while the VM load was above 30).
  - "Design partner answers" needs the Baseten key, which the VM does not have.
## Lache playtest fixes (CC-67)
- **So what:** the corner window shows what is ahead, a release throws with all the swing's energy, and a roll works on the ground as well as on a landing.
- **Corner window:** it is now a first-person view from the eyes (just under the hands on a bar, 1.62 m up on the ground), looking along the way the body faces and a little down; the horizon stays level when the body swings.
  - The body is hidden while it is drawn.
  - F still toggles it and it shows by itself on a bar.
- **Release, measured** (a swing at about 6.3 rad/s, released at the bottom):
  - Flight was ballistic before the fix too (the horizontal speed stayed 6.66 m/s for 60 ticks, no drag), so nothing leaked in the air.
  - The weak feel had two causes.
    - The flight kept only the middle's own speed (rod: w x 1.05 m), 75 % of the swing's kinetic energy; the other 25 % was spin about the middle, which the picture drops the moment the hands open while the legs are whipping at twice the speed (13.3 m/s).
    - The flight started from the feet's place, up to 0.75 m ahead of and 0.27 m above where the middle really was, then the body went upright: a jump in the picture at the moment of release.
  - The fix (`releaseRadius`, `releaseHang` in `src/sim/holds.ts`):
    - A body that lets go tucked in turns all the swing's energy into flight, so the speed is w x L / sqrt(3) = w x 1.21 m: 7.69 m/s instead of 6.66 m/s at the bottom (15.5 % more speed, 33 % more range).
    - The middle keeps its place, and the feet drop to half a rod under it, so the path is continuous.
  - Tests (`tests/release.test.ts`): the flight energy equals the swing energy; the speed on the runner while swinging is the same number; the middle does not jump; the horizontal speed is constant and the middle follows a parabola; the range on level ground is v^2 sin(2a) / g within 2 %.
- **What changed for the lache:** the widest gap a full pump crosses is now 7 m between the bars (it was 6.8 m); 7.5 m is still out of reach.
  - A short pump no longer crosses 3 to 6 m on its own: they need a swing built over about 1.6 s.
- **Ground roll (X on the ground, standing or running):**
  - From a stand it rolls about 1.6 m (starts at 2.5 m/s, ends at 85 % of it); running, it keeps 85 % of the speed over 0.7 s, the same time as the landing roll (0.5 s to roll out, 0.2 s to get up).
  - The push-off of 2.5 m/s comes from the legs pushing for 0.4 s at about 0.6 g.
  - It costs 0.02 of the energy store (a vault is 0.025) and the next roll waits 0.3 s after getting up: it cannot be spammed.
  - It ends at an edge or at the face of something it cannot roll over, so it never falls off a ledge by accident.
  - It cannot start in the air: a press there is the landing roll, as before.
    - The rolled body height (0.55 m) is a constant (`ROLL_BODY_HEIGHT`) for a later duck-under obstacle; nothing uses it yet.
  - The roll clip plays for ground rolls too (`rolledAt`), with the soft landing sound.
- **Roll drums:** the X drum shows for every landing the ideal run rolls out of (a test covers the 5 m ledge of the drop demo and a release from a bar onto a deck 5 m lower).
- **Generator:** a lache pair's deck gap is drawn from 5.5 to 6.8 m now (it was 6.5 to 7.8 m): with the new release a 7 m gap leaves almost no room, and one seed lost its moves when the proved presses were laid along the whole course.
  - The key C is proposed; the product owner confirms.

## Places after the cap (CC-56 reassess)
- **So what:** with the 4.3 m cap gone, real places need much less shrinking and give longer lanes, and the "hilly places are tiny worlds" finding no longer holds for gentle and medium hills.
  - The steep hills (Montmartre, San Francisco) still give short lanes, so the pitch line is "any place, shrunk to about half to a third", not "any place at real size".
  - Real size is still not a course: Barcelona's 20 m blocks give no lane at 0.8 or 1.0.
- **What was run:** the same OSM script (`scripts/osm-lane.ts`) on the commit before CC-56 and on `main`, on the same saved map data, with and without real hills (`scripts/reassess-cap.ts` makes the table; everything is in `data/eval/cc-56-reassess/`).
  - A third variant lifts the script's own rule that no building is taller than 8 m once shrunk; it changes almost nothing.
  - A fixed-shrink scan at 0.6 asks how far the ladder could have gone; the 0.8 and 1.0 scans were stopped as too slow (the one that finished, Barcelona flat, found no lane).
- **Before and after** (shrink is the factor each place needed; lane is the best lane's length after shrinking; every lane was cleared by the ideal-run search):

| Place | Shrink before | Shrink after | Lane before | Lane after | Tallest drop after |
|---|---|---|---|---|---|
| Barcelona, flat | 0.238 | 0.238 | 33 m | 51 m | 2.1 m |
| Barcelona, hills (9 m) | 0.086 | 0.238 | 12 m | 56 m | 2.7 m |
| Sydney quay, flat | 0.200 | 0.556 | 25 m | 52 m | 2.3 m |
| Sydney quay, hills (37 m) | 0.120 | 0.556 | 16 m | 37 m | 1.4 m |
| Montmartre, flat | 0.200 | 0.556 | 31 m | 63 m | 3.2 m |
| Montmartre, hills (39 m) | 0.072 | 0.333 | 18 m | 9 m | 0.6 m |
| San Francisco, flat | 0.164 | 0.455 | 38 m | 41 m | 0.6 m |
| San Francisco, hills (62 m) | 0.098 | 0.455 | 14 m | 8 m | 0.3 m |

- **What changed:**
  - The shrink needed is 2 to 5 times larger (a bigger, less tiny world): Sydney 0.12 became 0.56, Barcelona hills 0.09 became 0.24, San Francisco hills 0.10 became 0.46, Montmartre hills 0.07 became 0.33.
  - These "after" values are the first rung of the search ladder in most cases, so the true limit is higher: at a fixed 0.6 Sydney hills still gives a 53 m lane, while Barcelona hills and San Francisco hills give none.
  - Flat lanes are longer (24 to 38 m became 41 to 63 m) because a lane can start on a roof and drop (levels 3 m and 6 m above the lowest ground are tried).
  - The tallest drop a lane uses is 0.3 to 3.2 m, far below the 7.8 m limit; roofs are mostly stepped, not dropped, so the roll matters less on real places than on the drop demo.
- **What still holds:**
  - Steep hills give short lanes: Montmartre and San Francisco hills give lanes of 8 to 9 m, shorter than before, because the next roof uphill is more than 0.9 m up (no jump makes it).
  - A tilted cut that follows the hill is still the likely fix; not built.
  - Streets between buildings are still water, and there is still no slope physics.
  - All 8 places still clear with the ideal-run search.
  - The 4.3 m cap was not the only limit: the 0.9 m climb limit now decides, so tall buildings still drop out of the lane.
- **Search time:** the table's seconds are noisy (the VM ran at 8 to 20 load from other work), and show no clear slowdown for whole places.
  - One Fix it case is clearly slower after CC-56: about 3.7 s before and 5.2 s after (35 to 45% more), the same answer.
  - Cause not isolated; the per-tick roll check and the heavier landing are the suspects.
  - Fix it's time budget went from 6 s to 12 s so it does not give up early on a busy machine.
- **Two editor-check failures, bisected** (first-parent commits since the marathon end, on the VM):
  - `no scroll at 1024x640` began at the CC-57 commit that added the floor picker to the lane panel (a8443cb): one more row pushed the side panel 27 px past the screen.
  - **Fix:** the floor is one line, and on short screens (under 700 px) the panel's rows sit closer; the check passes again.
  - `adviceOffered` is false on the VM already at the marathon-end commit, so no merge broke it: advice has a 1.5 s clock and one proof of the ten-times-too-big block takes 4 to 5 s there.
  - The CC-56 slowdown makes the tipping point likelier on slower machines; CC-69 (speed) and CC-70 (run advice and Fix it in a worker, with a budget that does not depend on the clock) cover it.
  - `partnerAnswers` is false on the VM because the key lives on the laptop.
- **Regression check** (on the VM):
  - `npm run test:quick`: 334 of 334 pass on a quiet machine; on a busy one four time-based tests failed (two of them also fail on the code before CC-56 under the same load).
  - The slope test in `tests/terrain.test.ts` now has a 3 minute limit, because its lane search tries five start levels instead of three.
  - Browser checks pass: demos, lache, map (after a warm-up run), drums, debug, ideal-all, roll, sound.
  - `scripts/editor-check` has three false answers that are the same on the code before CC-56 (the 1024x640 no-scroll check, the advice offer, and the partner, which needs the key that lives on the laptop).
  - The generated sample course is unchanged, and the stored plans test passes.


## Lache playtest fixes, round two (CC-67)
- **So what:** the corner window turns with the body, a body that hops off a bar and comes back can catch it again, and every landing that could stumble or hurt shows the X drum.
- **Corner window turns with the body:** the camera sits at the head and turns about the bar by the swing angle (a quaternion, so it passes the top without a flip).
  - At 90 degrees it looks straight up at the sky; at 180 degrees it is upside down and shows the lava floor and the deck above.
  - After a release the head settles level over about 0.3 s (the body has no spin in flight); on the ground it is level.
  - Screenshots at 0, 90 and 180 degrees: `data/eval/cc-67-fixes/looking-ahead-theta-*.png`.
- **Regrab:** once the hands have let go of a bar, the zone for grabbing is an ellipse round the bar, 1.2 m along the run and 0.6 m up and down (`regrabX`, `regrabY`), after the 0.2 s no-catch time.
  - A release straight up comes back down about 1.05 m to the side of the bar (half a rod), so the ellipse is wider than the 1.0 m first guessed.
  - Falling past the bar from above counts.
    - The first grab from a run and jump keeps the 0.6 m circle.
  - The catch does not move the body: the hands start where they were and ease onto the bar over 8 ticks (`handOffset`), so the path is continuous (a test checks that no tick moves the feet more than 15 cm).
  - The same catch speed rule (`catchKeep`) applies.
    - A release that carries the hands more than about 1.2 m away is not caught again (a test).
  - Effect on the lache: the widest gap a full pump crosses is now 7.5 m (it was 7 m); 8 m is out of reach.
- **Roll drums:** the X drum is on the strip at every landing that would stumble or hurt with straight legs and no roll (a fall of more than about 1.8 m, `rollAdvised` in `src/sim/drop.ts`), as well as where the ideal run presses the roll to survive.
  - The prediction treats the floor over a gap as the water until the real landing deck is found; before, a fall over a gap onto a deck was missed.
  - The lache demos had no X drum after the second release because their last landing was only a 1.5 m fall, which is clean even with straight legs.
    - The final decks are now 2 m lower, so the landing is a 3 m fall and the X drum shows (and the demo teaches the roll).
  - The lache pair is needed again: with the stronger release one bar could be skipped, so the last deck is 3 m farther (48 m); the plan uses both bars (a test).
  - If the owner meant a red cross for a wrong press on the strip, that is not built; the strip still only shows the ideal line.



## The speed vault (CC-68)
- **So what:** the vault now looks and feels like a vault: the runner plants a foot well before the obstacle, arcs over it with a hand on top, comes down just past the edge and stops, instead of reaching late and sliding across the deck.
- **Why it changed (owner playtest, 2026-10-28):** the vault started within 1.2 m of the box and the feet landed up to 3.6 m past its edge, then the runner coasted 3 to 4 m more.
- **Measured before** (`data/eval/cc-68-vault/before.json`, speeds 4 to 8 m/s, steps 0.4 to 1.2 m):
  - Takeoff distance: 0.45 to 1.2 m before the face (and the 0.2 s buffer meant the V was pressed about 1 m earlier at most).
  - Feet landed 1.3 to 3.6 m past the edge.
  - No arc: the feet rose to the top and no higher.
  - Sliding with no key held: 3.1 to 4.0 m, 106 to 121 ticks (0.9 to 1.0 s).
- **Measured after** (`data/eval/cc-68-vault/after.json`, `scripts/vault-measure.ts`):
  - Takeoff distance 1.96 to 2.45 m for a well-timed press (the plant is inside 1.2 to 2.6 m, growing with speed and with the step).
  - Feet land 0.5 m past the edge every time, after an arc that peaks 0.25 m above the top.
  - Sliding with no key held: 0.7 to 1.0 m, 25 to 30 ticks (0.2 to 0.25 s).
  - A plant closer than 1 m before the face is too late: the vault does not start and the runner meets the step.
- **Owner follow-up (2026-10-28): no teleport.** The first version moved the body at one steady pace and jumped to the exit speed at the end.
  - Now the feet path is continuous in position and in velocity every tick: along the run it is a cubic that starts at the speed the runner had and ends at the exit speed, and up it eases from rest to 0.25 m above the top and back down onto it.
  - **Tests** (`tests/vault.test.ts`) over 36 cases (steps 0.4, 0.8, 1.2 m; speeds 4, 6, 8 m/s; plants from 1.05 m to the ideal distance):
    - No tick moves the runner further than its own speed times dt plus 2 cm.
    - Velocity changes by under 0.7 m/s (along) and 1 m/s (up) per tick, and never runs backward.
    - The whole vault covers the plant distance plus 0.5 m, never more than 3.4 m in all.
  - **Debug view (B):** a magenta line shows the vault path from the ideal plant point to just past the edge, a tick marks the plant, and the panel says how many metres before the step to plant and the window for pressing V.
- **The numbers:**
  - **Plant distance** = 0.9 + 0.12 x speed + 0.45 x rise metres, clamped to 1.2 to 2.6 m (a speed vault plants 1.5 to 2.5 m before the face at running speed).
  - **Vault time** = the plant distance plus the 0.5 m landing at the kept speed, and never less than 0.3 + 0.15 x rise seconds (a very tall step at top speed costs some speed).
  - **Window:** a plant from 1 m before the face up to the ideal distance plus 0.15 m works; the 0.2 s buffer holds an early V until the step is in range.
  - **Speed:** a well-timed vault keeps 92% of the speed; a short run to the edge for the whole vault is slower, never below 60% of that.
  - **Plant:** for 0.3 s after landing, with no key held, the feet grip 4 times as hard, so the runner stops within about a metre; holding run keeps the speed.
- **Ideal run and drums:** the search looks for the V press up to 5 m before the face (a wider, coarser grid), so the V drum is now about 2 m before the step (the middle of the presses made at a real plant distance), not at its edge; stored plans were regenerated (`npm run plans`).
- **The Rookie's vault:** `public/assets/motion/vault.json`, a Kimodo clip (CMU has only step-overs: 12 takes, 12 pass the gate, none shows a hand on the obstacle).
  - Of 12 Kimodo samples, all pass the gate and 3 pass the new vault check; the best is shipped.
  - **Quality, honestly:** the contact sheet shows a plausible leap with one hand forward and the legs tucked, not a clean hand on a box; it has not been judged side by side.
    - Without the clip the run pose is drawn.
  - **Cost:** about $0.06 of Modal (one L4, 267 s, price assumed at $0.80 an hour; check the dashboard).
- **Reference only:** the owner named the mobile parkour game Vector as a model of how parkour moves should look; none of its footage, animation or assets is used.
  - Real vault types for reference: speed, safety, kong and lazy vaults; ours is a speed vault.
- **Known gaps:** no hand-on-the-box contact is drawn (the arms come from the clip); a vault over a very long or curved top uses the first 0.5 m only; the arm pose is not checked against the real top height.

## Lache playtest fixes, round three (CC-67)
- **So what:** the first-person camera turns with the body, the roll drum sits where the key is pressed, and a hard pump on the first bar is a real shortcut over the second bar.
- **First-person camera (C key's third view):** it uses the same head as the corner window: the eyes just under the hands on a bar, turned about the bar by the swing angle with a rotation (no flip at the top), so the whole view tilts and goes upside down through a full circle.
  - After a release it settles level over about 0.3 s; on the ground it is level.
    - Dragging still turns the head, relative to the body.
  - `?cam=first` starts in that view (for pictures).
    - Pictures at 0, 90 and 180 degrees, corner window and main camera: `data/eval/cc-67-fixes/corner-theta-*.png` and `main-first-theta-*.png`.
- **Roll drum place:** the X drum sits on the path point 36 ticks (0.3 s) before touchdown (`ROLL_DRUM_TICKS`), not at the landing and not at the moment the fall is first seen.
  - The key buffer is 0.25 s, so a press there always counts.
  - The debug view draws an orange ring at the same point on its predicted path and says "tap X at the orange ring".
  - Tests check the drop demo and both lache demos: the drum is within 2 cm of the path point 36 ticks before the landing.
- **The skip:** a full pump on the first bar, then letting go with the hand kept off the key, flies over the second bar onto the far deck.
  - In the lache demo the far deck is 6.8 m from the first bar (it was 9 m, so one bar could not reach it).
    - The deck is 2 m lower, so a full pump reaches about 8.7 m; 6.8 m needs a hard pump (about 1.7 s, 208 ticks) and leaves a window of about 0.3 s to let go.
  - The search compares the two routes (`searchIdealRun(course, { routes: true })`, used by `npm run plans`): bar to bar 10.5 s and skip the second bar 9.4 s here, so the plan follows the skip.
    - Both are stored in the course as `routes`.
  - New plan field `airHands`: false keeps the hand off after that release, so the second bar is not grabbed on the way over.
    - The hint and the debug view say it as a fact: "Or keep your hand off it: you land on the ground at 45.9 m. You fly over the second bar: it is skipped." After the landing: "You skipped the second bar."
  - No scoring and no grading: the messages say what happens, nothing about how well it was done.
  - The wide lache demo (bars 6.3 m apart) has no skip: its far deck is 12 m from the first bar, beyond any swing.
    - It reports one route.
- **Tests:** `tests/skip-route.test.ts` (the skip works; a short swing does not; bar to bar still works; the search follows the faster route and reports both; the hint is a fact) and the new drum tests.
- **Cost:** comparing routes adds about 250 runs to a search, so it is opt-in (stored plans and the explore scripts use it); ordinary searches are as fast as before.
## Roles for pieces and the Moves window (CC-43)
- **So what:** a world can now use every move of the game.
  - A piece can play a role: the Warped Wall, a rope anchor or a trampoline bed.
  - The editor says which moves the world has and lacks.
  - Every suggestion it makes is proved by the simulator before it is shown, and goes through the same preview as Fix it.
- **Where it lives:**
  - `src/slice/roles.ts` is pure: the course a world makes with its roles (`roleCourse`), the moves a world has (`movesInWorld`), the candidates for one piece (`roleCandidates`) and the proved list (`suggestRoles`).
  - `Piece.role` is saved with the world and travels through undo and the preview.
  - The Moves button in the editor opens the window.
- **What each move needs, in plain words** (`MOVES` in `roles.ts`, shown in the window):
  - **Gap jump:** a gap of 2.5 to 5 m between two pieces of ground.
  - **Step up:** a block 0.3 to 0.9 m high to jump on, up to 1.3 m to vault.
  - **Warped Wall:** a face 3.4 to 4.3 m high after a flat run-up as long as it is tall (it needs about 4.9 to 6.6 m/s at the foot of the curve).
  - **Rope swing:** an anchor about 6.6 m up over a gap of 6 to 9 m.
  - **Trampoline:** a low flat bed, 2 to 6 m long, in front of ground 2 to 4 m higher.
  - **Lache pair, drop with a roll, stacks, trebuchet:** as in their own sections; the coaster has its own page.
- **Suggestions are the smallest change that gives a piece the size its role needs:**
  - A 2 m face becomes a wall with scale ×2.
  - A 1.2 m mat becomes a bed with scale ×2.5.
  - A 3.3 m pole becomes a rope anchor with scale ×2, and a floating beam is lifted or lowered to 6.6 m.
  - A long block can be turned 90° so it is short along the run, which can open a gap.
- **Proofs:** each role was tested with a small world that clears with the role and does not clear without it (`tests/roles.test.ts`).
  - Wall: a 4 m face on a 0.5 m deck.
  - Trampoline: a 3 m drop onto a bed 8 m long, then a deck 2.7 m higher.
  - Rope: a 7 m gap under a pole 6.6 m tall.
- **Simulator changes this needed** (small, with tests):
  - The wall stands on the ground at its foot (`groundAt`), not only on level 0; before, a wall on a raised deck put the runner 0.5 m under the top and stuck.
  - The ideal-run search no longer plans a jump off the end of a bed; a bed is left by its bounce (a spurious jump made every bed course fail).
  - `laneToCourse` can cut a run of ground into platforms at chosen points (a wall face, the two ends of a bed) and can keep real gaps up to 14 m for a rope.
- **Modelling choices:**
  - The deck on top of a wall is made at least 8 m long, because the runner stops there and needs room to run on (`WALL_TOP_RUN`).
  - A trampoline bed must be flat ground of its own; a curved piece is refused with a plain note.
  - Rope anchors are not ground.
- **Known gaps:**
  - The advice that suggests shifts for an unclearable lane does not know roles; when a world uses roles the editor says so and points to Moves and Fix it.
  - The trampoline proof depends on the ideal-run search landing a full-speed jump on the bed; a bed that needs a slower approach is not found.
  - The window lists the lache pair, stacks and trebuchet but only adds the bars; a stack comes from the Stacks row.


## The vault uses the hands (CC-68, round two)
- **So what:** the vault no longer looks like running up the step: the hands go on the top, the arms hold the body while it passes over, then let go.
- **Owner feedback (2026-10-28):** after the plant fix, the vault still looked like running up the step; a vault must use the hands.
- **How it is built** (`src/motion/vault-pose.ts`, from the simulator's contact point `vaultHand` = just behind the front edge, on the top):
  - **Plant:** the body leans into the obstacle and the near hand reaches toward the top as far as the arm goes.
  - **Hands down:** while the contact point is within the arms' reach (ahead of the shoulders or just behind them), both hands are pinned exactly on it (the arms are solved to that point), the shoulders go above the hands and the hips are lifted by the arms, so the body arcs over the top.
  - **Legs:** gathered together and folded behind the body while it is over the hands (a speed vault), then opened out for the landing.
  - **Head:** turned back up so it looks ahead, not down with the trunk.
  - **Release:** the hands let go once the body is past, and the pose blends into the running pose at the landing, so nothing jumps.
  - **Clock:** the simulator's vault progress (tick over length) drives it; the shoulders' position comes from the simulator's feet path.
- **The Kimodo clip is not used:** it passed the gate but shows no hands on the top, so the procedural pose wins (`public/assets/motion/vault.json` stays in the repo and in `docs/ASSETS.md`).
- **Tests** (`tests/vault-pose.test.ts`, on the real simulator vault over a 1 m step):
  - While the hands are down, both hands are within 3 cm of the contact point.
  - The hands are down in the middle of the vault, not at the plant and not after the landing.
  - The pose starts and ends exactly in the running pose, and no joint moves more than 25 cm between two frames of 1/120 s.
  - The shoulders are above the hands and the head looks ahead.
- **Debug view (B):** an orange cross marks the contact point on the step, next to the vault path and plant mark.
- **Pictures:** `data/eval/cc-68-vault/film/` (the stepped clock, one frame per stage) and a contact sheet; see the report for how they look.
## Recoil: momentum is conserved (CC-66)
- **So what:** the game now has a move that gives you speed beyond what you can run, and it teaches one law: what the ball carries away backward, you carry forward.
  - The demo is a gap no run-up can jump: a 10.5 m gap, against under 8 m for a perfect running jump (7.5 m clears, 8 m does not).
  - The proof (ideal run) finds where to fire and where to jump, and the bot clears it.
- **How it plays:** run onto the teal pad to clip the launcher on (one load per visit), then press K.
  - On the ground the push is forward only; the ground takes the upward part.
  - In the air both parts count, so a shot just after take-off adds to the jump and nothing slows it (a fire on the ground decays: sprinting pulls the speed back toward top speed with a time constant of 0.9 s).
  - Fire at take-off or just after: the search found a window of about 1.3 m of good jump presses.
- **The law, in code** (`src/sim/recoil.ts`):
  - The ball leaves at a muzzle speed relative to the runner (how a launcher is rated), backward and `angle` above the horizontal.
  - Before the shot the runner and the loaded ball move together; after it the total momentum is the same, exactly (tests to 9 decimals, along the lane and up).
  - The runner's gain is ball mass x muzzle speed x cos(angle) / (runner mass + ball mass); in the air the upward part gives a push down.
  - An optional stored energy limits the muzzle speed: the shot cannot make more kinetic energy than the launcher stores (a test checks it at three running speeds).
- **Defaults:** the runner is 70 kg, the ball 12 kg at 30 m/s, so one shot gives 4.4 m/s; the heavy crate piece is 25 kg thrown at 6 m/s, which gives 1.6 m/s (a gap of up to about 9 m, not 10.5).
- **Heavy and slow, or light and fast:** 24 kg at 15 m/s and 12 kg at 30 m/s push within 15% of each other (the total mass differs a little), and a ball twice as heavy gives about twice the push.
- **Pieces:**
  - Course: `course.recoil = { x0, x1, kind, ballMass, muzzle, angle, charMass, energy?, shots }`, the K key, a view with the pad, the launcher on the runner's back and the ball flying back (`src/ui/recoil-view.ts`).
  - Editor: "Launcher" and "Heavy crate" buttons next to the trebuchet, with the ball's mass and speed as the knobs; the pad goes on the start deck (`src/slice/recoil-lane.ts`).
  - Fix it for the launcher (`src/slice/fixrecoil.ts`): a faster ball first, then a heavier one, tested with the real proof; the reply has a "Use it" button.
  - Drums: a K drum where the ideal run fires.
  - Dojo: "Recoil: push back, go forward" with its lesson and two diagrams; the formula is the last, earned step (ball mass x its speed = your mass x your speed, against the ground).
- **Outcomes:** a clean boost clears the gap; a light or slow ball falls short into the water (a test); the fall panel says what the push did and that a heavier or faster ball pushes harder.
- **Gaps and fallbacks:**
  - "Too much" is not a failure here: more push only carries the runner farther, and the far deck is long, so nobody overshoots.
    - Fallback: a hard landing from the 7.8 m drop limit and X rolls (CC-56) still apply to any lane that ends in a drop.
  - The crate is drawn as a box on the runner's back with no carrying pose; the Rookie keeps the running pose (the cannon looks plausible, the crate is plain).
  - Fix it for the launcher shows the new ball in words and a button, not outlines like the pieces' preview (CC-63).
  - One dimension only along the lane for the ground shot; the throw in the air also moves the runner up or down by the ball's upward part.
  - A second shot per visit (`shots` above 1) works in the simulator and has no editor knob.

## Plank bridge (CC-82)
- **So what:** a plank is the first obstacle the player can break by building it wrong.
  - It teaches architecture through one number you can feel: a longer plank sags far more, a thicker one far less, and a post in the middle helps a lot.
- **The physics** (`src/sim/beam.ts`, Earth gravity only):
  - A plank rests on two decks (and on a post in the middle if asked).
    - The rider is a load that walks along it.
  - Sag under a load in the middle is `load × length³ ÷ (48 × stiffness × I)`, with `I = width × thickness³ ÷ 12`.
    - The plank's own weight is spread evenly and adds its own sag.
  - It breaks when the bending stress in its outer face reaches the material's strength.
    - The stress is `moment × (thickness ÷ 2) ÷ I`.
  - Numbers (sources: the Wood Handbook of the US Forest Products Laboratory for pine, mild structural steel):
    - **Pine:** stiffness 9 GPa, bending strength 40 MPa, density 500 kg/m³.
    - **Steel:** stiffness 200 GPa, yield 250 MPa, density 7850 kg/m³.
    - **Rider:** 70 kg.
- **Simplifications, stated:**
  - The load is the rider's weight applied slowly: no extra push from running or jumping.
  - A post in the middle makes two planks that meet on the post.
    - The gain from a continuous beam is ignored, so a post helps slightly less than in a real plank.
  - No knots, no creep, no damage from earlier crossings.
- **In the game:**
  - **Mode:** running onto a plank hands the runner to it (`mode 'plank'`).
    - The feet follow the bent plank, a dip costs speed (climbing out of it, and the plank shaking some away), and Space jumps off.
  - **Break:** a plank that bends past its strength snaps under the feet (event `plank-break`) and the runner falls into the floor below or onto a lower deck.
    - The fall words say how much it bent and what would have helped, never how well you did.
  - **Search:** a gap with a plank over it is not a jump edge, so the ideal run just runs across.
    - The proof says a course is clearable only if the plank holds.
- **Demos** (`scripts/make-plank-demo.ts`):
  - **Plank bridge: it sags but holds:** a 9 m gap, wider than any running jump (about 8 m at top speed), with a 3.5 cm pine plank.
    - The worst place is the middle: it dips 100 cm and uses 53% of what pine can take.
    - Without the plank the course cannot be cleared (a test).
  - **Plank bridge: too thin, it breaks:** the same gap with a 2 cm plank.
    - It would use 134% of what pine can take, so it snaps at the middle.
    - Fix it says: use a plank 2.8 cm thick.
- **Editor:**
  - A "Plank" button adds a plank piece.
    - Its knobs (material, thickness, width, a post in the middle, drawing length) are in the piece panel, with a line saying whether it holds over its length.
  - Where the piece lies across a gap between two pieces of ground, the lane keeps the real gap (up to 14 m) and the course gets a plank over it.
    - The real span is the gap, not the piece's drawn length.
  - Fix it for a plank that would snap says the smallest change in words (a thicker plank, or a post) and applies it on "Make it so".
- **Dojo:** "Plank bridge: how far it sags" (knobs: length of the gap, thickness, a post).
  - The learner finds that doubling the length gives eight times the sag and doubling the thickness gives one eighth.
  - The formula is the last step, never on the Course.
  - The shape classifier gained two shapes for this: a cube curve and an inverse cube curve.
- **Saying:** "A plank that is twice as long sags eight times as much."
- **Evidence:** `data/eval/cc-82-plank/` (the plank dipping under the runner, the thin plank's fall panel, the Dojo lesson and its diagram); `scripts/plank-check.mjs`; 19 beam and Dojo tests, 10 plank-in-the-world tests, 5 editor tests.
- **Gaps:**
  - A single beam: no trusses, no continuous-beam gain from a post, no dynamic load from a running rider.
  - A broken plank just disappears (no falling pieces).
  - A plank piece must be laid roughly along the lane and across a gap whose two sides are at the same height.
  - The runner's feet follow the bent plank but the Rookie keeps its running pose.

## Poses for the cart, the sling, a hard landing and the giant swing (CC-77)
- **So what:** the Rookie's body now matches the simulator in the four places the owner saw a wrong or missing motion; every move in the motion table has a clip or a built pose, and `motionGaps()` is empty.
- **Seated rider (coaster):**
  - Hips on the seat (0.34 m up), knees bent with the thigh nearly level, back leaning a little, both hands on a grab bar in front.
  - The thigh pitch is solved from the bone lengths so the feet land on the cart floor (`seatThighPitch`, `src/motion/poses.ts`); the hands reach the bar by two-bone reach (`ik2`).
  - The cart now has the grab bar (`src/render/track.ts`), 0.5 m ahead of the hips and 0.72 m up.
  - It replaces the swing clip's folded body, which had the hands up.
- **Sling rider (trebuchet):** tucked, leaning back, knees up and forward, both hands up and forward on the sling lines.
  - The sling lines are not drawn by the Course yet, so the hands reach a point where the lines would be (a known gap).
- **Hard landing:**
  - Clip: CMU 90_16 ("fall on face") passed the gate and the new hurt check; it plays at its own speed (2.1 s), the body lies still for 1.2 s and gets up slowly over 2.5 s.
  - Fallback: without the clip the same three parts are built from bones (stand, the tuck, lying flat on the front).
  - The check was needed: without it the pipeline chose a stumble into a second person.
  - `?hurt=bones` forces the built fall; `?demo=hurt-ab` is a blind A/B of clip against built fall, with the answer saved in the browser.
- **Giant swing:** the body is the swing clip's hang, turned about the bar by theta (as before), plus two things from the simulator:
  - the legs lag behind a fast swing (up to 0.45 rad, from omega), and
  - over the top the knees come up and the legs tuck, then open again on the way down.
  - The bones keep their lengths (a test), and the hands stay on the bar.
- **Gallery:** `?demo=poses` draws each pose for pictures; `scripts/poses-check.mjs` writes them to `test-results/poses/` (contact sheets in `data/eval/cc-77-poses/`).
- **Tests:** `tests/poses.test.ts` (seat geometry, hurt phases, giant-swing legs, which pose a state asks for), `tests/motion-table.test.ts` (no gaps), `pipelines/tests/test_movecheck.py` (the hurt check: a fall passes; a stumble, a dip that comes back up and a fall onto the back do not).
- **Gaps:**
  - The sling lines and the trebuchet's seat are not drawn, so the sling pose floats on the arm's end.
  - The hurt clip is acted (a stage fall with arms thrown up first); the blind A/B will say if the built crumple reads better.
  - No tuck animation is drawn for the roll over the top of the giant swing, only the legs.


## Climb (CC-76)
- **So what:** a wall the jump and the vault cannot take is now a move: hold E at its edge and pull up.
  - On San Francisco's steep hills the best lane grew from 8.2 m to 27.2 m.
  - Montmartre's hills did not change (8.7 m): its hills are steep curved slopes, not walls, and the climb takes walls only.
- **How it plays:**
  - Run at the wall (or jump) and hold E when the hands meet the top edge.
  - The body stops against the wall, hangs from the edge for 0.25 s and pulls up and over in 0.85 s, 1.1 s in all, and stands on the top at 2 m/s.
  - The run speed is gone and the pull-up spends as much energy as two jumps.
  - Letting go of E while still hanging drops the body; after the pull-up starts it is committed.
- **Where the limits come from (Earth gravity, the Rookie's reach):**
  - The hands are 2.1 m over the feet with the arms stretched up and the fingers must get 0.1 m over the edge: from the ground a wall up to 2.2 m can be grabbed, from 1.0 m up (below that a jump or a vault does it).
  - A jump adds the height gained while the body is slow enough to catch: the hands close on an edge only while the body rises no faster than 2 m/s, which at a 4.5 m/s take-off is 0.83 m up.
  - Edge at most 2.2 + 0.83 = 3.03 m over the ground, minus 0.2 m for the arms to start the pull-up: the tallest wall is 2.83 m.
  - A vault takes up to 1.3 m (CC-68), so the climb is the move from there up.
- **The search:** above a vault's reach, `searchIdealRun` tries standing at the foot of the wall holding E, and a jump with E held in the air, and keeps the one that clears; the plan carries `climbXs` or `climbHands`.
  - In the air the bot holds E only until the last bar is behind it, so a fall beside a ledge stays a fall (a rescue grab of the edge below made the lache-wide demo skip its roll).
- **The lane builder:** a step up to 2.83 m no longer rules a lane out (`CLIMBABLE` in `src/slice/slice.ts`; before, 0.9 m).
- **Seen in play:** the debug view (B) puts a cyan ring on the edge of the next wall the hands can take and says how to take it; the drum lane shows the E grab where the hands meet the edge; the hint says "hold E at the wall".
- **Pose:** the hang pose for the hold, the hands pinned on the real edge, then the body folds up to the stand pose (procedural, not a clip).
- **Demo:** `/?course=/assets/demo/climb.course.json`: a 2 m wall, then a 5 m drop to roll out of.
- **Real keys (`scripts/climb-check.mjs`):** the climb starts 0.6 m from the wall, ends on the top and the run goes on.

### Places with the climb
| Place | Before the climb | With the climb |
|---|---|---|
| San Francisco, hills | shrink 0.455, best lane 8.2 m | shrink 0.455, best lane 27.2 m, 3 lanes |
| San Francisco, flat | shrink 0.455, best lane 41.2 m | shrink 0.455, best lane 27.2 m (the score now prefers a lane with a climb) |
| Montmartre, hills | shrink 0.333, best lane 8.7 m | shrink 0.333, best lane 8.7 m (no change) |
| Montmartre, flat | shrink 0.556, best lane 63 m | shrink 0.556, best lane 65.7 m |
- **A lane's length is not what it can do:** the search keeps the lanes with the best score (variety of obstacles), not the longest, so a flat place can show a shorter best lane when a lane with a climb scores higher.
- **Why Montmartre did not change:** its lane (found at shrink 0.556) starts with a curved top that rises 2.6 m in 1.4 m, a slope steeper than 45 degrees, and the climb only takes vertical faces.
- **Next:** treat a steep curved top like a wall (the edge is where the slope eases below 45 degrees).

## Shortcut discovery (CC-71)
- **So what:** the simulator now finds routes the designer did not plan, so the ideal run can show a player a shortcut they did not think was possible, and the editor and the generator can use it.
- **How it works** (`src/sim/shortcuts.ts`):
  - It looks at the ideal line first: does it already skip a bar?
  - Then it switches off each bar, each pair of neighbouring bars, the wall and the rope in turn (`variantsOf`), and runs the ideal-run search on the course without it.
  - A line counts only when it clears the real course with everything in place (bars not held are flown past: `plan.noGrab`) and is faster than the line that holds every bar.
  - The baseline is the stored bar-to-bar route from CC-67 (`course.routes`), so nothing is searched twice.
  - It also reports move choices: the best line with the vault or the roll switched off (`course.off`, used only by this search).
- **Where it shows:**
  - The Course: I and Shift+I say "Shortcut: ..." next to the ideal run.
  - The end panel of the ideal run and of a normal clear says a shortcut exists, with a "Watch the shortcut" button (a fact, never a grade).
  - `?bot=shortcut` plays the best one.
  - Demo courses store their shortcuts beside the plan (`npm run plans`); any other course works them out in a worker the first time.
  - The editor: "Look for routes you did not plan" lists them.
  - "Close it" previews a change with the CC-63 outlines: everything after the skipped bar moves on, the smallest push that the simulator proves.
  - "Keep it" marks the route as meant (`designedShortcuts`) and draws a dashed purple arrow in the side view.
  - The design partner's brief carries the list (`routes_the_simulator_found_that_the_designer_did_not_plan`).
  - The generator: `generateChecked(seed, { shortcuts: 'label' | 'refuse' })` stores the shortcuts or tries the next seeds.
- **Shortcuts on every demo course** (planned line, shortcuts found, move choices; `data/eval/cc-71-shortcuts/`):

| Course | Planned line | Shortcuts found | Move choices |
|---|---|---|---|
| circular-quay-sydney | 5.99 s | none | roll: 5.85 s without |
| drop | 6.85 s | none | roll: cannot be cleared without it |
| eixample-barcelona | 6.78 s | none | - |
| generated-1 | 25.03 s | Bar 1 + Bar 2: jump past bar 1 and bar 2; saves 1.93 s | vault: 32.76 s without |
| lache-wide | 14.55 s | none | vault: cannot be cleared without it |
| lache | 10.5 s | Bar 2: pump 1.74 s on the bar you hold, let go, and fly past bar 2; saves 1.14 s (kept by the designer) | vault: cannot be cleared without it; roll: 11.39 s without |
| lane-1 | 3.73 s | none | - |
| lane-2 | 3.98 s | none | - |
| launch-bar | 5.59 s | none | - |
| launch | 3.91 s | none | roll: cannot be cleared without it |
| montmartre-paris | 4.67 s | none | - |
| san-francisco-lombard | 5.18 s | none | - |
| stack | 3.03 s | none | - |

- **The ones nobody planned:**
  - **Every generated course with a lache can skip the lache by a plain jump** (11 of 11 seeds scanned, seeds 1 to 12; the one course without a lache had none).
  - The generator's lache gap is 5.5 to 6.8 m; a plain run-and-jump clears a flat gap up to 8 m at full speed (7 m when a jump costs speed, as on bar courses).
  - The jump saves about 2 s against swinging, so the bars are optional in all of them.
  - **The lache demo:** a full pump on bar 1 flies over bar 2 and saves 1.14 s; CC-67 made this on purpose, so the demo keeps it (`designedShortcuts`).
  - **Roll pays in the lache demo:** without the roll the best line takes 11.39 s against 9.36 s, because the last landing is a 3 m fall.
  - **Required moves:** the vault in both lache demos, the roll in the drop and launch demos (they cannot be cleared without them).
  - **No shortcut** in the lane, stack, launch, wide-lache and place courses (the OSM places have no bars, wall or rope to skip).
- **Fallback and next steps:**
  - The generator's lache is still skippable: its gap needs to be at least 8.5 m (and at most what two bars reach) to need the bars; `generateChecked` with `refuse` finds no course until that changes.
  - Only single bars, neighbouring pairs, the wall and the rope are switched off (not every combination), and only the vault and the roll are compared.
  - The band, the trebuchet and the recoil are not switched off yet.
  - "Close it" works for bars only; for the wall and the rope it says so and leaves the change to the designer.
  - A first look for a course without stored shortcuts takes about a minute in the worker (the table shows the search seconds per course).

### More seeds (13 to 28)
- Seeds 13 to 28 hold 13 lache courses, and each has exactly one shortcut (a plain jump over the bars).
- Seeds 13, 16 and 27 have no lache zone and no shortcut.
- Together with seeds 1 to 12, all 24 lache courses were skippable by a plain jump.
- These runs used the generator before the lache gap grew to 8.5 to 10 m (it was 5.5 to 6.8 m), which is why the gap was raised.
- Search time per course ranged from 43 s to 600 s.

## Real photos beside the real worlds (CC-85)
- **So what:** the real-world courses show only extruded blocks; next to them the player now sees the real place, so the skyline is appreciated and the shrinking is understood.
- **What shows:**
  - Montmartre, Eixample, Circular Quay and Lombard Street each have 2 to 3 photos from Wikimedia Commons (CC0, CC BY or CC BY-SA).
  - Small thumbnails sit at the bottom left of the Course, with the author and licence under each one.
  - A click opens a large view: "Real photo of <place>, <author>, <licence>", a "Where is this?" line and links to the licence and the source.
  - Arrow keys move between photos, Esc closes, and the game does not run while a photo is open.
  - The Hide switch (remembered) and `?photos=0` turn the strip off.
- **Map mode:** a pin inside a place with photos shows the same strip in the side panel.
- **Where the files are:** `public/assets/places/<place>/photo-N.jpg` (under 250 KB each), `credits.json` and `public/assets/places/photos-index.json` (place centres for the pin match).
- **How a course finds its photos:** the OSM courses are named `OSM <slug>`, and the slug is the folder.
- **Adding a place:** put 2 to 3 licensed photos and a `credits.json` in a new folder, add it to `photos-index.json` and add a row for each photo to `docs/ASSETS.md`; `tests/place-photos.test.ts` fails without a file, a free licence, a credit or an ASSETS row.
- **Chosen photos:** only wide views with no person who can be recognised; a distant crowd is too small to identify.
  - Five candidates were left out (a flag on a balcony, a street with pedestrians, a promenade crowd, a panorama too wide to scale, and two with people at the edge).
- **Known gap:** the photos show the place from a hill, the water or the street, while the course is one slice through it.
## Performance (CC-75)
- **So what:** the places and the coaster were already cheap (5 to 12 draws), so the win is for crowded editor courses: 300 loose pieces went from 167 draws to 11, and a city of 3,000 buildings draws half the triangles.
- **Overlay:** `?perf=1` or key P shows it in the Course, the editor 3D view and the map.
  - It shows the frame time and fps, draws, triangles, meshes, instanced meshes and their instances, geometries, textures, the renderer, the simulator step cost and the heap.
  - The same numbers are written to `<html data-perf>` as JSON for scripts.
  - The map shows only the frame time, because MapLibre does not expose its draw counts.
- **What was merged** (`src/render/static-merge.ts`, used by `src/modes/course.ts`):
  - **Decks:** one mesh per material (grass, stone, bed) instead of one per deck.
  - **Loose pieces:** raw meshes are merged into one mesh and, over 20,000 triangles, cut into 64 m chunks so the renderer skips the chunks it cannot see.
  - **Photo objects:** the same file used several times is loaded once and drawn as an instanced mesh per 8 m of the run, so far-apart copies are still culled apart.
  - **Cups and the editor's plain pieces:** one shared material each instead of one per piece.
  - **Far chunks:** a big place stops drawing chunks more than 260 m from the camera.
- **Numbers** (software GPU, best of two runs, same machine; `data/eval/cc-75-perf/before.json` and `after.json`):

| Scene | Draws before | Draws after | Triangles before | Triangles after | Render ms before | Render ms after |
|---|---|---|---|---|---|---|
| Montmartre | 5 | 5 | 12,751 | 12,763 | 43 | 46 |
| San Francisco hill | 5 | 5 | 13,045 | 13,057 | 50 | 41 |
| Coaster | 12 | 12 | 15,133 | 15,133 | 35 | 24 |
| Stacks | 7 | 6 | 14,081 | 14,081 | 37 | 39 |
| 300 pieces, 30 benches, 12 stacks | 167 | 11 | 85,697 | 139,901 | 128 | 62 |
| 3,000 buildings in one mesh | 6 | 17 | 46,229 | 24,340 | 167 | 137 |

- **The trade, in words:**
  - **Crowded courses:** fewer draws cost more triangles, because an instanced mesh is drawn whole when any copy shows.
    - That is the right trade on a real graphics card, where draws cost the processor and triangles are cheap.
    - It was also faster here.
  - **Big city:** chunking draws more calls but half the triangles.
  - **Places and coaster:** already small, so they did not change.
    - Times of 20 to 50 ms are noise from other work on the machine.
- **Frustum culling:** it is on everywhere.
  - Only the skinned Rookie and the debug lines turn it off, and the Rookie must, because its bounds are the bind pose.
- **Dispose on mode change:** nothing to do, because switching mode reloads the page.
  - The Course does not rebuild its scene on restart.
- **Check:** `npm run perf` loads the six reference scenes and fails if draws or triangles go over `scripts/perf-budget.json` (about 30% above today's numbers).
- **Known gaps:**
  - Software-GPU times are relative, not what a real graphics card gives.
  - The editor 3D view was only given shared materials; its pieces stay separate because each can be picked and dragged.
  - The map piece is already one mesh, so the Slicer (CC-72) can draw several cut planes without a draw-call problem, but a place of thousands of buildings should be cut into chunks when it is built (the Course does it on load).
## The cannon: more power and an aimed angle (CC-66)
- **So what:** the recoil idea now has a big, aimed cannon: one shot throws the runner tens of metres a second, and the player decides the angle.
  - The demo is a 32 m gap with a 4 m drop onto the far deck; nothing a runner can do crosses it, one aimed shot does, and the landing needs a roll.
  - A steep shot flies high and lands too hard even for a roll; a flat one falls short: the middle is the answer, which is the lesson.
- **The numbers:** an 80 kg ball at 45 m/s against the 70 kg runner gives 24 m/s of push (a sprint is 9).
  - The tank must store the energy the shot makes, half the reduced mass times the muzzle speed squared: about 38 kJ, the energy of a 1000 kg car rolling at about 31 km/h (shown while the cannon is loaded).
  - A smaller tank limits the muzzle speed (a test).
- **A vector law:** the ball leaves backward and down by the aim angle, so the runner is pushed forward and up by it.
  - Momentum is conserved along the lane and up, to 8 decimals in tests, at any aim and any running speed.
  - On the ground a push up counts (it lifts you off) and a push down does not (the ground holds you up); in the air both count.
- **Aiming:** while the cannon is loaded, Up (or W) tilts the barrel steeper and Down flatter (34 degrees a second, from level to 77 degrees); the barrel on screen tilts with it.
  - Dots show where you would land, from the same prediction the debug view uses (a test compares it with the real flight and with the textbook range).
  - The words say the aim, the tank energy and the landing ("a hard landing unless you tap X just before the ground").
- **Best angle:** on level ground the range peaks within 4 degrees of 45 (test); a steeper shot goes higher and shorter, a flatter one lower and shorter.
  - On the demo the stored line aims about 14 degrees, fires at 11 m and rolls out of the landing.
  - The window of aims that clear is wide at low angles and ends where the landing is too hard.
- **The ideal run** searches the angle and the fire place together (`searchCannon`); the drum lane shows an aim drum (the angle) and the K drum, and the X drum before the landing.
- **Editor:** a "Cannon" button next to "Launcher" and "Heavy crate", with the mass and speed of the ball as knobs (the proof searches the angle); Fix it for a cannon raises the speed first, then the mass, up to 120 kg at 60 m/s.
- **Dojo:** "Cannon: the best angle" with a hill-shaped curve, two diagrams, and the formula (distance = forward speed x time in the air) as the last step.
- **Gaps and fallbacks:**
  - The Rookie is drawn standing in front of the cannon, not sitting on it.
    - Fallback: the running pose; a seated pose belongs to the motion pipeline (CC-64).
  - The ball is drawn as a big rubber ball; there is no muzzle blast or sound of its own (the shot uses the existing clang).
  - Fix it for a cannon takes 10 to 60 seconds (each test runs the full search, CC-69).
  - The aim cannot be changed in the air, only while loaded.
## Elastic band (CC-65)
- **So what:** the band is the first move that throws the runner faster than the legs can run, and it teaches stored energy: what you spend stretching it comes back as speed.
- **A correction to the first idea ("run into it"):** a band can only pull toward its post, so a forward throw needs the band stretched backward.
  - The player runs away from the post, which stretches it, then turns round and runs toward the post.
  - Running forward into a band that is tied behind would only drag the runner back.
- **How it plays** (`/?course=/assets/demo/band.course.json`):
  - The runner starts clipped on, one rest length (1 m) behind a striped post.
  - Hold ← to run away from the post and stretch the band.
    - The hint says how far it is stretched.
  - Hold → to turn round.
    - The band pulls toward the post while it is stretched, on top of the legs.
  - At the rest length it goes slack and unclips (no drag back).
    - Then it is an ordinary run: press Space at the edge.
  - Stretched past its limit (22 m on the demo) it snaps, lets go, and nobody is hurt.
  - Debug view (B): "If you turn round now" draws where the throw lands.
  - The drum lane shows a "Turn →" drum at the stretch the ideal run turns at, then the jump drum at the edge.
- **Physics** (`src/sim/band.ts`, all metres, seconds and kilograms; the runner weighs 70 kg):
  - The pull is the stiffness times the stretch (a spring that only pulls); the stored energy is half the stiffness times the stretch squared.
  - The legs can push away from the post with at most the standstill acceleration (10 m/s²), so the stretch where pull equals push is acceleration × mass ÷ stiffness: a softer band stretches farther and stores more (the energy at that stretch is proportional to one over the stiffness).
  - Momentum carries the runner a little past that point (up to about a quarter farther).
  - Above top speed the legs only stop pushing: they do not brake the extra speed, so an assisted sprint can pass 9 m/s.
    - A little drag is kept.
  - Energy law, tested: the work the band does pushing forward never exceeds what it stored (within 3 %), and most of it is given back (over 60 %).
- **What a stiffness does** (`scripts/band-explore.ts`; pull to 85 % of the reachable stretch, take-off 2.5 m past the clip):

| Stiffness (N/m) | Stretch (m) | Speed leaving the clip (m/s) | Speed at the edge (m/s) | Range of a jump there (m) |
|---|---|---|---|---|
| 1500 | 0.5 | 3.6 | 5.8 | 5.3 |
| 150 | 4.3 | 8.1 | 8.3 | 7.6 |
| 90 | 6.9 | 9.2 | 9.2 | 8.4 |
| 60 | 10.2 | 10.5 | 10.2 | 9.3 |
| 45 | 13.5 | 11.7 | 11.1 | 10.2 |
| 35 | 17.2 | 12.9 | 12.2 | 11.2 |
| 28 | 21.4 | 14.1 | 13.3 | 12.2 |

  - A plain run-up jumps about 8.3 m at best; a soft band and a long stretch clear 11 to 12 m.
  - A stiff band hardly stretches and gives no boost (the 1500 N/m row is slower than a plain run, because the runner has not had room to speed up).
- **The demo course:** a 10 m gap (1.5 to 11.5 m), a 35 N/m band that snaps at 22 m, a runway of 40 m behind the post.
  - The ideal run stretches it about 16 m and turns; stretches from 14.4 to 20 m all clear.
    - A stretch of 14 m or less lands in the water.
  - No plain run-up clears it (tested over every take-off point).
- **Proof and Fix it:** the ideal-run search finds the stretch and the take-off press together (`searchBand` in `src/sim/ideal.ts`).
  - Fix it for a band tries softer bands (15 % steps down to 20 N/m) and says which one clears (`src/slice/fixband.ts`); it takes about ten seconds when nothing clears.
- **Editor:** a "Band" button in the Overhead row starts the lane at a band, with a stiffness box (`src/slice/band-lane.ts`).
  - The Trebuchet and Band buttons switch each other off.
- **Dojo lesson "Stored energy":** knobs are the stretch and the stiffness; the answer is the speed the band alone gives.
  - The formula (speed = stretch × √(stiffness ÷ mass)) is the last, earned step.
  - Saying: "A soft band pulled far outthrows a stiff one pulled little."
- **Known gaps:**
  - A straight band in the side view only; the clip pulls at belt height and the post is a plain striped pole.
  - The runner is drawn in the running pose, also while pulling (facing left); there is no leaning or braced pose.
  - The jump while clipped on is not allowed (the clip unclips only when the runner is back at the rest length).
  - A real band also pulls sideways and in the air; ours is along the run only.

## Round trip between the Course and the editor (CC-80)
- **So what:** a course is no longer a one-way street: from the Course you can go back to the very same pieces in the editor, and when a hard press keeps ending in a fall, the editor can offer the smallest change that makes it easier.
- **What a course remembers:** an editor course carries its source in `course.source` (the pieces, the lane, the floor, the trebuchet counterweight).
  - A course without a source (a demo, a generated one) becomes an editable copy: each platform a box, a stepped or curved top split into columns of equal height, bars as bars.
  - The copy is approximate on purpose: the lane cuts steep faces into ramps, so a copy of a cup stack may not clear.
    - The lache copy does.
  - A coaster opens its track in the coaster builder instead.
- **Edit this course:** a button under the top bar and on the fall panel.
  - It writes a handoff into the session (the course without its baked scene and plans, where the runner was, the checkpoint, how many falls).
  - The editor opens on those pieces, selects the piece nearest the runner and centres the 3D view on it.
- **Back to the Course:** the button in the editor's top bar (and T) rebuilds the course from the pieces now, checks that it clears, and returns at the same obstacle, a few metres before the selected piece.
  - It goes through the same resume the Dojo uses, so the Course puts itself back.
  - The undo list (the last 25 steps) is kept in the session and comes back when the world is the one it ended with.
  - Worlds with photo objects or a map place do not keep their undo list: their meshes are too big for the session.
- **Make it easier:** on the fall panel, and as a button in the design partner.
  - The narrowest press window is the hardest press in milliseconds (the jump off the start deck is left out: the lane always puts the first ground 3 m past it).
  - The search tries the smallest changes to the three pieces nearest the fall (move along the lane, lower a bar, make a block smaller) in order of size, and offers the first that widens that window by a quarter, or the best that widens it by 15%.
  - It is shown with the same hollow outlines as every other change, with one sentence ("The narrowest press window grows from 314 ms to 405 ms."), and **Apply and try it** returns to the Course with the change in place.
  - When nothing small helps it says so, and the layout is left alone.
- **Measured:** a 5 m gap between two decks gives "Move “Block 1” 1 m further along: 314 ms to 405 ms"; a 4 m gap is already comfortable and gets no offer.
- **Speed and gaps:**
  - A lane with bars takes about a minute for each search on a busy machine, so it gets a 150 s budget and may find nothing in time.
  - The step budget and worker pool of CC-69 will help.
  - The Course cannot be rebuilt in place, so "try it" is a page reload that lands back on the same obstacle.
- **Checks:** `tests/roundtrip.test.ts` (an unedited course comes back byte for byte, the copy of the lache demo clears), `tests/easier.test.ts`, and `scripts/roundtrip-check.mjs` (play, fall, make it easier, apply and try it, edit again, back, clear).


## Roll window (CC-67, round four)
- **So what:** the roll is now a real timing skill: it must be pressed just before the ground, not early, and the drum on the strip arrives exactly when the key is due.
- **The window:** the last 0.15 s before touchdown and the last 1.2 m above the ground, both at once (`rollWindowOpen` in `src/sim/drop.ts`).
  - On a 5 m drop the height limit is the shorter one (1.2 m takes about 0.13 s); on a slow fall the time limit is.
  - A press before the window opens is ignored.
    - There is no hidden buffer (`ROLL_BUFFER` is gone), so a roll pressed too early gives no benefit and the landing is a normal one: the hard landing is the consequence.
  - A press up to 3 ticks after touchdown is forgiven (`ROLL_FORGIVE_TICKS`): a stumble or hard landing waits 3 ticks (`landGrace`), and an X in that time turns it into the roll; after 3 ticks it counts.
- **Where it is used:** the simulator (`stepWorld`: `rollArmed`, `landGrace`), the ideal run (`rollNeeded` presses at the first tick of the window, a tick is 1/120 s so the 18-tick window is easy to hit), the drum lane (the X drum is at the runner's x where the window opens in that flight), the debug view (the orange ring is at the same point on the predicted path, `rollWindowStart`) and the hints (the controls card, the fall panel, the predictions and the Roll role say "the last 0.15 s before you land (about a metre up; earlier does nothing)").
- **Tests (`tests/roll-window.test.ts`):** every demo course and generated seeds with a roll landing have the drum within 2 cm of a window start; the window opens within 0.15 s and 1.2 m of touchdown and one tick earlier it is closed; on the drop demo an early press at the ledge edge does not roll (hard landing), a press inside the window does, a press 2 ticks after touchdown is forgiven and one 8 ticks after is not.
- **Changed tests:** the roll tests no longer expect a quarter-second buffer; they play 6 ticks past touchdown because a hard landing now waits 3 ticks.
- **Replaces round three's drum place:** the X drum was 0.3 s before touchdown (about 2.5 m up on a 5 m drop); it is now where the window opens, about 1.2 m up, which is when the key is due.
- **Predictions:** the jump, release and launch predictions let the 3-tick wait run out (`settled` in `src/sim/predict.ts`), so a fall with no roll is reported as a hard landing, not as a clean one.
- **Real keys:** on the drop demo (`scripts/roll-check.mjs`, slow motion), X pressed 0.1 s before the ground rolls and the run goes on; with no roll the outcome is a hard landing.
  - Picture of the orange ring and the drum: `data/eval/cc-67-fixes/roll-ring-fall-0.png`.

## The drone ferry (CC-87)
- **So what:** the game has its first flying machine: a cargo drone carries the character across a 40 m gap no jump can make, and teaches thrust against weight, leaning, battery and the limits of lift.
- **The design:** `docs/drone.md` (what a drone teaches, three ways to play, what stays out, the honest numbers).
- **How it plays:**
  - Run onto the teal pad and hold E: the drone lifts a little way off the ground.
  - The left and right arrows lean it, the up and down arrows climb and descend, and E keeps the rider on.
  - Coming down slowly and level on a deck sets the rider down; letting go of E low steps off, letting go high is a drop (X rolls out of a big one).
- **The physics** (`src/sim/drone.ts`, Earth gravity, a point mass):
  - Push (thrust) along the lean, weight, linear drag, and a stabiliser that holds the height, so leaning costs push (the push needed is the weight divided by the cosine of the lean).
  - The battery pays for the push with the standard rotor law: power is the thrust to the power 1.5, divided by the square root of 2 × air density × rotor disc area, divided by how good a real rotor is (0.65), plus 300 W of electronics.
  - The cargo drone weighs 85 kg and carries 70 kg (1,520 N), the rotors can push 3,100 N, the discs add up to 12.3 m², so hovering takes about 17 kW.
  - The demo pack is 50 Wh (180 kJ), about 10 seconds of hovering; real person-carrying drones carry roughly 10 kWh.
  - A rider above about 220 kg cannot lift off, and a lean beyond 60° cannot hold the height at the drone's weight.
- **Outcomes:**
  - A soft touchdown (slow, level, not racing along the ground) sets the rider down.
  - A hard one, or flying into the side of a deck, is a crash and ends the run (outcome hurt).
  - A flat battery stops the rotors and the drone falls; water ends the run as usual.
- **The proof:** the ideal run (`searchDroneRun` in `src/sim/ideal.ts`) finds where to lean back and where to start coming down so the drone lands softly on the far deck; on the demo the braking point has a window of about 0.3 s.
- **Where it shows:**
  - Course: `/?course=/assets/demo/drone.course.json` (the Course menu has "Drone ferry"); Shift+I plays the proved line.
  - Debug view (B): the path if you stop leaning and come down now, and where it sets you down.
  - Drum lane: an E drum where the ideal run boards.
  - Editor: a Drone button next to Launcher, with rider (kg) and battery (Wh) knobs; Fix it tries a bigger battery first, then a lighter rider.
  - Dojo: "Hover: push against weight" (rider weight and lean; the formula is the last, earned step) and the saying "Lean to go, but a leaning drone must push harder to stay up."
- **Tests:** `tests/drone.test.ts` (hover, lean, payload limit, battery, drag, wind, touchdown), `tests/demo-drone.test.ts` (the course, the crash cases, the preview), `tests/drone-editor.test.ts` (the editor piece, Fix it, the lesson); `scripts/drone-check.mjs` is the browser check.
- **Gaps:**
  - 2D side-view flight only.
  - The stabiliser is always on in the Course; raw thrust (no stabiliser) is in the physics (`stabiliser: false`) but only shown through the Hover lesson numbers.
  - The rider uses the seated cart pose, not a harness pose.
  - Wind is in the physics (`wind` gusts) but the demo is calm.
## Course experience pass (CC-84)
- **So what:** the first minute of the demo now shows real places and real objects, the corner camera is always there, and the camera can come right up to the character's face.
- **Demo menu:**
  - The two plain-shape lane demos ("Demo scene, lane 1 and 2") are gone from the menu; their files stay for tests.
  - The menu is grouped: Real places, Real objects (built in the editor), Contraptions, Moves, Make your own, Basics.
  - Each entry has a one-line note (shown under the menu and as a tooltip).
- **Courses made from real objects** (`npx tsx scripts/make-real-demos.ts`, the same steps as the editor: place the library objects, cut the lane, make the course, put the real meshes in as the scene, prove it, store the plan):
  - **Park rail run:** three real handrails and a skate box.
  - **Bench and stairs:** a skate box, a concrete bench and park stairs.
  - **Skate box and rail:** stairs, a long box, a handrail and a bench.
- **Front view:** the corner window is on for every course (F toggles it, `?front=0` starts it off).
  - It used to show only on a bar or after F.
- **Face zoom:**
  - The mouse wheel goes on past the closest normal view; the target glides to the head and the camera swings round to the front of the face, about 0.7 m away.
  - Dragging still turns the view around the head, and a double-click resets it.
  - The C key keeps its order: side, 45 degrees, first person.
- **Checks:** `scripts/experience-check.mjs` (menu groups, front view on every menu course, F off and on, face zoom and reset) and `scripts/demos-check.mjs` (every menu course loads and shows the front view).
- **Known gap:** the face is the Rookie's simple face.

## Trebuchet polish (CC-74)
- **So what:** a first-time player can now win the launch-and-catch demo, and the editor can tune the machine for them.
- **Fix it and advice know the machine** (`src/slice/fix-launch.ts`):
  - The machine has three knobs: the counterweight (kg), the arm (its ratio, long end to short end) and a pin (the arm angle at which it lets the rider go by itself).
  - Fix it changes the machine before it moves any piece, smallest change first, and every suggestion is proved by the ideal-run search with the machine on.
  - The preview (CC-63) shows it as one plain line each, for example "Use a 1300 kg counterweight (now 500 kg).", and Apply sets the counterweight box.
  - When the lane clears but the release window is narrow (under a quarter of a second), advice offers a pin at the best arm angle.
  - The jumpable-step shortcuts are skipped when a machine throws the rider, because a 4 m landing is fine for a throw.
- **The release window** (`src/sim/launch-window.ts`):
  - It is the unbroken run of release times (ticks after the pin) around the best one that still win, where the player may hold the bar for as long as they like (the cue tells them when to let go).
  - The old numbers measured about 100 ms with the hang time fixed; counted this way they are 175 ms.
- **The easy bar demo** now has the bar 9 m up and 16 m out (it was 8 m up and 18 m out): the window is 250 ms.
  - The old numbers stay as "Launch and catch: hard" (175 ms).
  - Both still need the bar: without it the throw falls short of the tower.
  - A grid of 99 bar places (x 11 to 21 m, y 4 to 12 m) and two finer ones found these numbers: the bar on the safe edge of the family of throws gives the widest window.
  - The window stops at 250 ms for this bar because the catch zone is 0.6 m and the rider crosses it at about 15 m/s.
- **The LET GO NOW cue and the debug preview** (`predictLaunch`):
  - It used to say go when the rider would come back down on the machine's own deck, and "hurt" for every throw, because it never tapped the roll.
  - Now it never says go for the machine's deck, and it flies the throw a second time with the roll tapped before the ground when the first flight hurts.
  - Against what really happens (release at each tick, play the stored plan on) it agrees on at least 95% of ticks, and the landing it shows equals the real landing to 5 cm.
- **Known gaps:** the trebuchet is not in the shortcut finder yet (CC-71); the pin takes the skill out of the release, so it is offered only as an assist.



## Dropping a pin (CC-78)
- **So what:** a pin used to wait on the public map servers, and they are often down.
  - Now the site asks all of them at once, keeps the answer, and twelve places are built ahead of time and load in about a second.
  - Nothing in the demo depends on a public server answering.
- **Cause of "timed out after dropping a pin"** (measured from a Vultr machine in Singapore on 2026-10-28, three places, two runs):

| Step | Answer | Time |
|---|---|---|
| Overpass `overpass-api.de` | 406 for tool user agents, 502 with a named one, no answer for a browser-like one | 0.5 s, or hangs |
| Overpass `lz4.overpass-api.de` | no answer | 25 s limit |
| Overpass `z.overpass-api.de` | 502 once; later 200 for Shibuya, Edinburgh, Valletta, Hamburg, Rome and Lisbon | 31 to 39 s |
| Overpass `overpass.kumi.systems`, `overpass.private.coffee` | no answer on every try (one answered Rome once) | 60 s limit, 81 s once |
| Overpass `overpass.openstreetmap.fr` | 403 | 0.5 s |
| Overpass `maps.mail.ru` | 200 (Eixample, Positano, Ciutadella), 504 or no answer for others | 16 to 23 s |
| Nominatim search | 200 | 0.7 s |
| Terrain tile | 200 (99 KB) | 1.7 s |
| Map style | 200 | 0.1 s |

- **What the old code did:** it asked three servers one after another, six tries in all, each up to 60 s, with waits of 3, 6, 12, 15, 15 and 15 s between.
  - Worst case: about 7 minutes before an error, and two of the three servers never answered from this machine.
  - The lane search is not in the pin's path (the editor does it later); alone it took 23 to 372 s per place on a busy machine.
- **The fix**
  - **`/api/places`:** the site's own function asks six servers at once (28 s limit each), the first good answer wins and the rest are cancelled.
    - It keeps each answer 30 days in the Cloudflare Cache API, by pin rounded to 11 m and radius to 10 m.
    - D1 was not used: the Cache API needs no migration and no binding, and an answer is only a cache.
    - Limits: radius 60 to 300 m, 20 new places per address in ten minutes (cache hits are free), answers under 1.5 MB.
    - Run in the Workers runtime (`wrangler pages dev`): a miss took 15 s, the next call 0.04 s with `x-cache: hit`.
  - **Dev server:** `vite.config.ts` serves the same lookup at `/api/places` and keeps answers on disk in `node_modules/.cache/cc-places`.
  - **The browser:** asks the site first (35 s), then the six servers straight from the browser (20 s), then gives a plain error that offers the three nearest ready places.
  - **Ready places:** twelve places in `public/assets/places/` (940 KB on disk, 11 to 214 KB each, pretty-printed like all JSON; served compressed), built by `npx tsx scripts/make-places.ts`.
    - Each holds the trimmed building answer, the ground heights and the lane the simulator cleared.
    - A pin within 300 m of one snaps to it (a tick box turns this off); the list shows them with their hill size.
  - **Steps with times and a Cancel button:** asking the map, height of the ground, building the place, finding a lane (in a worker, so the page never freezes).
  - **Explain strip:** after Build the editor no longer opens by itself; the strip says what was found and how the place was shrunk, and the map paints each footprint by what it became.
    - Colours: flat run (green), step (yellow), wall to climb (red), edge of a gap (purple), not used (grey), with the lane as a dashed line.
    - "Open in the editor" opens the place (`?auto=1` opens it at once).
- **Ready places built:**

| Place | Hill | Buildings | Lane | Shrink |
|---|---|---|---|---|
| Montmartre steps, Paris | 39 m | 42 | 21.3 m (5 steps, 1 walls, 2 gaps; footprints: 4 gap-edge, 1 step) | 0.12 |
| Eixample, Barcelona | 9 m | 47 | 37.5 m (3 steps, 2 walls, 1 gaps; footprints: 2 gap-edge) | 0.238 |
| Circular Quay, Sydney | 37 m | 44 | 37.9 m (3 steps, 0 walls, 2 gaps; footprints: 3 gap-edge) | 0.333 |
| Lombard Street, San Francisco | 62 m | 95 | 22.9 m (6 steps, 0 walls, 1 gaps; footprints: 2 gap-edge) | 0.273 |
| Shibuya, Tokyo | 34 m | 69 | 14.7 m (3 steps, 1 walls, 1 gaps; footprints: 2 gap-edge) | 0.283 |
| Ciutadella Park, Barcelona | 13 m | 6 | 41.9 m (4 steps, 0 walls, 2 gaps; footprints: 1 deck) | 0.556 |
| Old Town, Edinburgh | 23 m | 77 | 33.4 m (7 steps, 2 walls, 2 gaps; footprints: 1 deck, 3 gap-edge, 4 step) | 0.2 |
| Positano, Italy | 100 m | 86 | 36 m (1 steps, 1 walls, 2 gaps; footprints: 1 deck, 1 gap-edge, 2 step) | 0.12 |
| Grand Harbour, Valletta | 22 m | 18 | 23.8 m (2 steps, 0 walls, 1 gaps; footprints: 1 deck) | 0.556 |
| Speicherstadt, Hamburg | 12 m | 21 | 103.3 m (5 steps, 1 walls, 2 gaps; footprints: 3 gap-edge) | 0.417 |
| Alfama, Lisbon | 49 m | 278 | 26.2 m (8 steps, 0 walls, 1 gaps; footprints: 2 gap-edge) | 0.333 |
| Spanish Steps, Rome | 26 m | 35 | 69.8 m (8 steps, 0 walls, 3 gaps; footprints: 1 deck, 3 gap-edge) | 0.556 |
| Park Güell, Barcelona | 67 m | 14 | 22.1 m | 0.2 |
| Tuileries Garden, Paris | 17 m | 5 | 62.4 m | 0.36 |
| Retiro Park, Madrid | 10 m | 9 | 22.8 m | 0.556 |
| Bryant Park, New York | 3 m | 21 | 27 m | 0.556 |
| Gas Works Park, Seattle | 16 m | 27 | 96.9 m | 0.556 |
| Dolores Park, San Francisco | 37 m | 40 | 38.2 m | 0.455 |
- **Where to find it:** the Course's "Open another course" menu has "Pick a real place on the map (labs)" with `?labs=1` (the browser remembers it); `?mode=map` works without it.
- **Checks:** `tests/places.test.ts` (14 tests) and `scripts/map-places-check.mjs` (14 checks, a test proxy refuses the map servers: ready place in about 1.4 s, a pin far from any place with the saved answer, the error with ready places offered, Cancel in under a second); `scripts/map-check.mjs` follows the new flow.
- **Known gaps**
  - A new place still needs a public server (the first pin there); the ready places are the fallback.
  - The footprints named on the map are the buildings the lane runs over or brushes; the search also counts steps and walls at the cuts between roofs, so the counts can be higher than the number of footprints (Alfama: 8 steps, 2 footprints).
  - The lane search for a new place takes seconds to minutes in a worker; the editor can be opened meanwhile, and the piece is re-cut to the lane's size when the search finishes.
  - The Cloudflare cache is per data centre, so a place can be asked again from another one.
## Search speed (CC-69, CC-70)
- **So what:** the ideal-run search, Fix it and the advice give the same answers as before, 1.5 to 3 times faster on one thread and 5 to 14 times faster in a pool of workers; the page no longer freezes after a fall on a generated course.
- **Causes found:** a constant (`safeDrop`) worked out in every simulated step, an unused run at every edge, the same proof asked three times, and budgets counted in milliseconds.
- **Changes:** the search is a generator with a one-thread driver and a pool driver (`src/sim/ideal-pool.ts`), proofs are remembered, budgets count simulated ticks (`workSeconds`), Fix it and the advice run in workers (`src/slice/proof-client.ts`), and a course stores the windows of its take-offs next to its plan.
- **A bug on the way:** the editor's "can clear" check also matched "cannot find", so a failing lane looked green and no advice was ever offered.
- **Numbers, logs and how to repeat:** `data/eval/cc-69-speed/README.md`.


## Live nearby photos (CC-90, steps 1 and 2)
- **Question:** can the game show real photos of the buildings the runner is passing, and could that become live, like a giant touring the world?
- **Answer:** yes.
  - Mapillary (owned by Meta) has dense street-level photos along all three lanes tested.
  - Wikimedia Commons adds landmark photos that already work in CC-85.
  - What stands in the way is not coverage but people in the pictures, and the licence fine print.
- **How it was measured**
  - `scripts/photos_coverage.py` takes the lane line of a ready place (metres east and south of the pin, as in `src/world/osm.ts`).
  - It walks the line every 10 m and counts photos within 60 m of each step.
  - A Mapillary photo "faces the lane" when its compass angle is within 60 degrees of the direction to the lane point; a 360 degree photo always counts.
  - Commons gives no viewing direction, so facing is not measured for it.
  - The line is walked in whole 10 m steps (170, 150 and 160 m), so the per 100 m figures use those lengths.
  - Inputs, outputs and `run.json` are in `data/eval/cc-90-photos/`; the token is never saved.

| Place | Lane | Mapillary photos within 60 m | Per 100 m of lane | Lane with a photo | Lane with a facing photo | Median distance | Commons files within 60 m |
|---|---|---|---|---|---|---|---|
| Montmartre, Paris | 178 m | 301 | 177 | 100% | 100% | 21 m | 1079 |
| Eixample, Barcelona | 158 m | 214 | 143 | 94% | 88% | 21 m | 240 |
| Edinburgh Old Town | 167 m | 621 | 388 | 100% | 100% | 6 m | 364 |

- **Capture years of the Mapillary photos near each lane**
  - Montmartre: mostly 2019 (216 of 301), then 2015 (43), 2023 (18), 2012 (15).
  - Eixample: mostly 2017 (117 of 214), then 2021, 2015 and 2025.
  - Edinburgh: 2019, 2020 and 2024 (about 150 to 175 each), up to 2026.
  - Panoramas: 9% in Montmartre, none in the other two.
  - The photos come from only 7 to 15 distinct creators per place, and one drive gives many frames, so the real variety is less than the counts suggest.
- **Commons caveats**
  - Commons geosearch finds files by their coordinate, which is often the landmark and not the camera.
  - Montmartre has 1079 files near the lane because many are filed under the basilica's position.
  - So Commons is good for "famous thing here" and weak for "what the street looks like from here".

### People in the pictures (the real risk)
- A contact sheet of up to 12 photos per place was viewed by eye; this is a small sample, not a measurement.
  - Montmartre: 7 of 12 show people close up, including a small child in a stroller; faces were blurred but the body, clothes and a child were clearly visible.
    - Only the 6 pictures without people close up are kept in the repo.
  - Eixample: 2 of 12 show adults, at a distance, in a street seen from a car.
  - Edinburgh: 1 of 12 shows two adults from behind; the rest are lanes seen from a car.
- Mapillary blurs faces and number plates, but blurring is not enough for the "never show footage of minors" rule, because a child can still be recognised by size, clothes and setting.
- Pedestrian places (Montmartre) are the worst; streets seen from a car dashboard (Eixample, Edinburgh) are the safest.

### Sources compared (facts from the live pages, 2026-10-29)
- **Mapillary Graph API v4** (`graph.mapillary.com/images`)
  - Search by `bbox` (area smaller than 0.01 degrees square, up to 2000 images) or by `lat`, `lng` and `radius` (at most 50 m, up to 100 images, best image first).
  - Fields we need exist: `geometry`, `computed_geometry`, `compass_angle`, `computed_compass_angle`, `captured_at`, `is_pano`, `thumb_1024_url`, `creator` (all returned in the test).
  - Rate limit: 10,000 search requests per minute per app.
  - Authentication: a client token in the `Authorization: OAuth` header worked; the `access_token` query parameter returned nothing in our test, so use the header.
  - Licence: user photos are CC BY-SA 4.0 unless Mapillary says otherwise; showing a photo needs the Mapillary logo and a link back, and the credit to the creator.
  - Caching: the terms set no caching period, but forbid scraping outside the published interfaces, and say an app must "materially supplement" Mapillary and not "merely redistribute" its content.
  - Privacy: faces and number plates are blurred by Mapillary; users may not try to undo it; photos of children may not be made available.
  - Commercial use falls under separate terms (section 12); a free hackathon demo is not that, but a paid product would need a check.
  - The help-centre licence page returned 403 to our fetch tool; the licence statements come from `mapillary.com/terms` and a search of the help centre.
- **Wikimedia Commons** (`list=geosearch`)
  - No key; a file is free to reuse with credit (CC0, public domain, CC BY, CC BY-SA), as in CC-85.
  - At most 500 files per query, and the search service answered "too busy" several times, so queries need a pause and a retry.
  - No viewing direction in the results.
- **Flickr**
  - Needs an API key we do not have, so it was not called and not measured.
  - It would give a licence filter and geo search; check its limits when a key exists.
- **Google Photorealistic 3D Tiles and Street View**
  - The only single system with both a 3D city and photos.
  - Its Map Tiles policy forbids pre-fetching, storing or caching content, and forbids machine analysis, geodata extraction and offline use, so it can only be shown live, never baked into the game.
  - Street View needs a visible "Report a problem" link; only panorama IDs may be stored.
  - Paid; not tested.

### Recommendation
- **Source order:** Mapillary first (street-level, facing known, free, Meta), Commons second (landmarks with a free licence, already shipped), Flickr third when a key exists, Google only as a live-demo option.
- **Place:** Edinburgh Old Town is the best test lane (388 photos per 100 m, median 6 m away, 100% of the lane covered, mostly from a car); Montmartre has the best landmarks but is full of pedestrians; Eixample is good but has a gap in 6% of the lane.
- **Fallback if live fetching fails:** the stored CC-85 strip (3 Commons photos per place, credits in `credits.json`), which already works and is checked by `tests/place-photos.test.ts`.
- **Known gaps**
  - No person detector yet, so we cannot say how many photos in a place show people.
  - Only three lanes, each about 100 m, so nothing is known about longer routes.
  - Camera heading in Mapillary is sometimes the phone's, not the lens's; "faces the lane" is a good guess, not a proof.
  - Photos from one drive can all be the same few minutes of one day, so a live view will repeat itself.

### Masking people instead of rejecting photos (CC-90)
- **Question:** the reject filter leaves Montmartre and Eixample with 9 and 3 usable photos; does covering each person (instead of dropping the photo) give the lanes enough photos?
- **Method:** `scripts/photos_mask.py` finds every person with torchvision Mask R-CNN (ResNet-50 FPN, COCO weights; code BSD-3-Clause, labels CC BY 4.0) on the photo and on its mirror image.
- **Cover:** the whole silhouette (not only the face), grown by about 10 px, filled from a heavily blurred copy of the picture.
- **Usable:** at most 15 percent of the picture masked and no person box over 25 percent of the picture.
- **Where the pictures live:** masked copies stay in `~/photos-masked` on the VM and are not in the repo; the repo holds numbers (`data/eval/cc-90-photos/masking/*-mask.json`) and three small contact sheets.
- **SAM 3:** not tried (Mask R-CNN was enough to answer the question; a SAM 3 run on the Modal volume is a possible next step and would need a cost statement first).

| Place | Candidates | Usable with the reject rule | Usable after masking | Lane steps with a photo: reject rule | After masking |
|---|---|---|---|---|---|
| Edinburgh Old Town | 57 | 23 | 56 | 100% | 100% |
| Montmartre | 55 | 7 | 31 | 44% | 94% |
| Eixample | 53 | 0 | 53 | 0% | 88% |

- **Numbers are on the same candidate set;** the earlier CC-90 counts (52 of 68, 9 of 55, 3 of 53) used Faster R-CNN with a different score cut, so they differ a little.
- **Masked share:** the median masked photo hides 0.6 percent (Edinburgh), 18.6 percent (Montmartre, before the 15 percent cut) and 4 percent (Eixample) of the picture.
- **Montmartre:** 24 of 55 photos are dropped for covering more than 15 percent, because crowds fill the steps.
- **By eye (24 masked photos, three contact sheets):** no face, clothes or child can be told apart; each person becomes a soft grey person-shaped smudge, and a scooter rider loses part of the scooter.
- **A second detector** (Faster R-CNN, score 0.5) was run over the kept pictures as they would be shown: 1 of 56, 2 of 31 and 9 of 53 still had a "person".
  - **Most of those are the grey smudges themselves,** which the detector reads as people (scores 0.9 and over, boxes of 2 to 13 percent of the picture).
  - **About four photos in 140 have a tiny figure** (under 0.7 percent of the picture, under about 60 px tall) that was not covered; this is the real miss rate, about 3 percent.
  - **Next step for the misses:** reject a photo when the second detector finds something that is not inside a covered area, or run the detector on zoomed tiles.
- **Terms read on 2026-10-29 (mapillary.com/terms and the CC BY-SA 4.0 legal code):**
  - Contributed images are CC BY-SA; the Mapillary logo must be shown for images and API data.
  - The terms do not mention caching or storing API images; they bar scraping outside the API, "make any derivative works based upon the Mapillary Services" and re-identifying or unblurring any content.
  - The terms ban images of children from the service, and say Mapillary's face and plate blurring is "technology designed to" blur, not a guarantee.
  - CC BY-SA 4.0 asks anyone sharing a changed copy to say that it was changed and to share the changed copy under the same licence; whether a masked photo counts as a changed copy under copyright is not stated, so treat it as one.
  - **Question for Mapillary:** may a game store and show masked copies of CC BY-SA images fetched through the API (with credit, the logo, a change note and ShareAlike on those copies)?
  - **Until answered:** the game does not store masked pictures; it can mask on the fly in the browser or in the proxy and show the original link and credit.
- **Recommendation:** masking unlocks Montmartre and Eixample for a demo, the minors rule is met in the by-eye check but not guaranteed (about 3 percent of photos keep a tiny figure), and the storage terms are open.


### Safe allow-list: reject any photo where masking fails (CC-90)

- Owner decision (2026-10-29): this is for the hackathon demo only; show that photos exist and that masking works.
- A photo is kept only when masking worked, checked twice.
- Reject when more than 15 percent is masked, or one person box is over 25 percent of the picture.
- Reject when a second detector (Faster R-CNN, score 0.5 or more), run on the original and on the masked picture, finds a person that the mask does not cover.
- A found box counts as covered when at least 60 percent of it lies inside the grown mask, so the grey smudge itself is not a miss.
- Masking runs at build time in `scripts/photos_safe.py`; `mask_photo` in `scripts/photos_mask.py` is the same function a proxy would call on the fly.
- Masked pictures go to `~/photos-masked`, never into the repo; the repo holds only the allow-list and mask numbers (`data/eval/cc-90-photos/masking/<place>-safe.json`).
- Kept photos (this run, 2026-10-29):
  - Edinburgh: 65 of 68 (49 untouched, 16 masked).
  - Montmartre: 27 of 55 (7 untouched, 20 masked; 19 lost to the 15 percent cut, 4 to the second detector, the rest to a big person box).
  - Eixample: 41 of 53 (all masked; 12 lost to the second detector).
- Sheet: `safe-before-after-sheet.jpg` has 6 pairs, before on the left; the before tiles are 160 px wide so no face can be told apart.
- The pairs are drawn from the middle of the masked range, so the difference is small in some; the hardest cases are in the older `*-masked-sheet.jpg` files.
- Not handled: reflections, and storing masked copies (the Mapillary terms question is still open).

## The map says "clear", the editor says it is not even on the lane (CC-91)
- **What the product owner saw:**
  - The Slicer or the explain strip said the simulator had cleared a lane.
  - The editor then showed pieces that were not along that lane, and the proof failed.
- **Two causes, both found by reading the same lane both ways (`scripts/lane-consistency.ts`):**
  - **The lane never travelled.**
    - The map handed the editor the buildings only.
    - The editor started on its own lane (turn 0, sideways 0, level 0) or on the last one it had saved.
    - Fix: the lane (turn, sideways, level) now goes in the same hand-over (`lane` in `cc.map.piece`), for the whole place, for the Slicer cut and for a lane found by the background search.
  - **The editor read a big scene from too few points.**
    - The editor sampled each piece at 600 points per square metre, but at most 40,000 points per piece.
    - A shrunk district is far bigger than that, so the lane strip (2 m wide) got a handful of points per 10 cm.
    - Empty cells count as gaps, and a gap hides which side of a wall the next sample is on, so false steps and walls appeared on a lane the map had read cleanly.
    - Fix: `laneProfile` (`src/slice/world.ts`) reads a thinned piece again along the lane at full density (`laneSamples` in `src/slice/slice.ts`); every place that read a lane from the world now uses it (editor, Fix it, advice, roles, bars).
    - The map proof reads the lane the same way (`reprofile` in `bestSlices`), so both ends see the same cells.
- **Measured on the 12 ready places, same lane, cells that differ between the map and the editor:**
  - Before: 40 to 450 cells per lane, tallest false step 2.4 to 6.3 m (a lane the map read at 0 to 2 m).
  - After: 0 cells in all 12.
  - The editor default lane (0, 0, 0) was no lane at all on Ciutadella and a different, much rougher one elsewhere.
- **Tests:** `tests/lane-consistency.test.ts` (18): all 12 places read identical cells, no false wall, the lane has ground along it and is the length the map reported; picked buildings handed over one by one read the same lane as the whole mesh; the lane clears again from the editor reading.
- **Browser check:** `scripts/lane-handover-check.mjs` (Build a ready place, open the editor, the editor lane equals the map lane, the proof clears).
- **Known gap:** the stored ready-place lanes keep the sideways step to 0.1 m and the level to 1 cm, so a lane read from them can differ from the original search by a few millimetres.

## Why the Slicer finds no path, and which heights help (CC-92)
- **Plain words in the Slicer:**
  - When a height has no lane the simulator can clear, the panel says why (`src/slice/why.ts`): the widest gap against what a run and jump crosses (about 8 m), the hardest jump when the far side is higher, the tallest wall against a climb (about 2.8 m), the longest fall against a roll.
  - A gap too wide for a jump also says what could cross it: a band or a swing between bars up to about 14 m, a cannon or a drone beyond that (the band demo throws across 10 m, the cannon demo crosses 32 m, the drone ferry 40 m).
  - A button offers the nearest height where a lane looks crossable.
- **The strip of heights:**
  - Ten heights across the slider, shape only (no simulator proof, so it is fast): green looks crossable, amber has a gap or wall in the way, red has no lane.
  - A height is green when any of the eight best-looking lanes there has gaps within a run and jump, walls within a climb, falls within a roll and a run-up the runner can reach.
  - Click a cell to go to that height; hover for the numbers.
- **Measured on the 12 ready places** (`scripts/cut-height-table.ts`, `data/eval/cc-92-why/cut-heights.json`; heights are in the shrunk game metres the lanes use):
  - **Did lowering the cut help?** No.
    - A cut at 3 game metres or lower had no crossable-looking lane in any of the 12 places.
    - The lowest crossable height was 4 game metres in one place (Montmartre), 6 in six places, 8 in two, 12 in one and 16 in one.
    - Circular Quay has no crossable height at its shrink.
    - A low cut leaves every building standing taller than a climb across the lane, so the lane meets walls; a cut near the roofs turns the same buildings into steps and gaps.
    - What does help is a smaller shrink (the ladder in the explain strip), see the next point.
  - **Are the gaps too wide?** Often, and the shrink sets them more than the height does.
    - The widest gap on the best lane takes only two to four different values over the nine heights in every place, and it does not fall steadily as the cut goes down; it comes from the street between two buildings.
    - The widest street gaps are up to 113 m in real metres (the Shibuya crossing).
      - The game scales it by the shrink (0.12 to 0.56), but caps building height, so a smaller shrink narrows the gaps without shortening the walls.
    - Widest gap on the lanes that look crossable: 0 to 8.1 m, all within a run and jump.
    - Circular Quay: 10.1 to 11.3 m at every height.
      - A band (up to about 14 m) crosses it; a smaller shrink would too.
    - Without a crossable height the gaps are 10 to 34 m: a band, a cannon or a drone, or shrink the place more.
- **Why the Slicer used to say "clear" and then the editor said no:** see CC-91 above; the proof and the editor now read the lane the same way.
- **Cache fix found on the way:** the Slicer remembered a proof by cut height and shrink only, so picking or leaving out a building could show the proof of the old set.
  - The key now includes the picked buildings.
- **Tests and checks:** `tests/why.test.ts` (7), `scripts/why-check.mjs` (strip, reason, button, dragging).
- **Known gaps:**
  - The strip is a first look; only the proof for the chosen height is the simulator.
  - The suggestion to lower or raise the cut moves the slider (the lane it draws is the preview) and does not use the editor preview outlines of CC-63.
  - Suggestions to "try this heading" and "add a band here" are not built yet; the reason names the move in words.

## The green line: how it is chosen and how to move it (CC-93)
- **How the Slicer picks the line:**
  - It turns a rod through the pin in 18 steps of 10 degrees (half a turn; the other half is the same lane backwards).
  - For each turn it tries up to 15 sideways steps about a metre apart across the place.
  - Each line is read as a strip 2 m wide (the top of whatever is under it, per 10 cm); lines with a wall taller than a climb or a fall longer than a roll are dropped.
  - Lines are scored by variety (a gap, a step, a curve, a wall) and length (12 to 70 m is best); the simulator tries to clear the best-scoring ones first and the first it clears is the green line.
- **Drag and rotate:**
  - Two white dots sit on the ends of the green line and a square dot in the middle.
  - Drag an end to turn the line about the other end, drag the middle to move it; on release the simulator reads the new line at the same height and proves it.
  - "Back to the suggested line" restores the search choice.
  - A line the player draws goes to the editor as the lane, like the suggested one (CC-91).
- **Checks:** `scripts/why-check.mjs` drags a dot with the mouse, moves the middle dot, resets.
- **Known gaps:**
  - The line is a whole line through the place: the lane runs over everything solid on it, so the two end dots set its direction and sideways step, not where it starts and stops.
  - The strip does not follow a dragged line; it always shows the best lane per height.
  - Dragging works with a mouse; touch dragging is not checked.
## The Courses gallery (CC-89)
- Every page has a small "Courses" button; it opens a gallery of cards, one per world.
- A card has a picture, a title and one line about the world, under the same headings as the old menu (Real places, Real objects, Contraptions, Moves, Make your own, Basics).
- Click a card, or move with the arrow keys and press Enter, and the page goes to that world; the world you are in is marked "You are here".
- The search box narrows the cards as you type; Esc or a click outside closes the gallery.
- The Course waits while the gallery is open, and no key reaches the game or the editor behind it.
- The first-visit chooser is the same gallery in a dialog; it replaces the old drop-down list.
- The list lives in `src/ui/world-picker.ts` (`DEMO_GROUPS`), so a new course is added in one place and shows up on every page.
- Pictures: `npm run thumbs` takes a still of each course at its first obstacle into `public/assets/thumbs/`; `tests/world-picker.test.ts` fails when a card has no picture.
- The "Make your own" cards (random course, editor, coaster builder, map) have a drawn icon instead of a still.
- Where the button sits: top right everywhere (in the Course under the Debug button, in the Dojo left of the Back button, in the editor left of its More menu); `scripts/picker-check.mjs` checks that it covers no control at 1280x720, 1024x640 and a phone width.
- On a phone the button sits bottom left, away from the Feedback button.
- Not done: a pick leaves the page, so unsaved editor work is lost unless that mode already asks first.

## Lache gap in the generator (2026-10-29, CC-47)
- The 24 generated lache courses of the shortcut job were all skippable by a plain jump, because the lache gap (5.5 to 6.8 m) was under what a jump clears (8 m).
- The lache gap is now 8.5 to 10 m, so the bars are needed.
  - Sweep with one lache between two gaps: 8.5 m, 10 m and 12 m clear with the bars; 14 m does not (`data/eval/janitor/lache-gap/sweep.txt`).
  - At 8.5 m and 10 m the only shortcut left is inside the lache (pump on bar 1, let go, fly past bar 2); no plain-jump skip.
- Sample `generated-1` and its plan were regenerated; its golden hash changed on purpose (the course changed).

## Live photos that follow the runner (CC-90, step 3 and the people filter)
- **What the player sees**
  - On a real-place course the photo strip changes as the runner moves: one to three street photos taken within 60 m of the spot and pointing at it.
  - Each photo shows the creator, "CC BY-SA 4.0" and, in the large view, a link to the photo on Mapillary; the line under the strip names Mapillary.
  - Where there is no allowed photo, or the photo service is down, the stored CC-85 strip stays (and where a place has neither, no strip).
  - The Hide switch and `?photos=0` work as before.
- **How it works**
  - `src/world/live-photos.ts` maps the runner's x to a point on the place's lane line (start to finish of the course = the line's two ends), picks allowed photos near it that face it, and asks for new addresses at most every 2 s and 15 m, with one answer per 20 m cell.
  - `src/ui/live-photos.ts` draws the strip with the CC-85 strip code and falls back to the stored photos.
  - `functions/api/photos.ts` is the proxy: the token lives only in the Pages secret `MAPILLARY_TOKEN` and never reaches the page; it returns five fields, caches 30 minutes, and limits each address.
  - Picture addresses expire, so the allow-list holds only ids; the proxy turns an id into a fresh address when the photo is shown.
- **The people filter (offline)**
  - `scripts/photos_people.py` takes up to four photos facing the lane at each 10 m step, runs torchvision Faster R-CNN (ResNet-50 FPN, COCO weights) and keeps a photo only if no person is found at any size.
  - This is stricter than the 2 percent size rule in the brief on purpose: a far figure can be a child, and the detector cannot tell.
  - So no unfiltered photo reaches a player: the live service is asked only about ids on the list.

| Place | Facing candidates checked | Rejected: person 2 percent or larger | Rejected: smaller or far figure | Kept | Lane steps (10 m) with an allowed photo within 60 m |
|---|---|---|---|---|---|
| Edinburgh Old Town | 68 | 2 | 13 (and 1 download failed) | 52 | 17 of 17 (100%) |
| Montmartre | 55 | 27 | 19 | 9 | 7 of 18 (39%) |
| Eixample | 53 | 11 | 39 | 3 | 5 of 16 (31%) |

- **Looked at by eye:** the kept sheets (8 photos Edinburgh, 8 Montmartre, 3 Eixample: 19 in all, as many as there are) show no person.
  - One Montmartre photo has a glass wall where a reflection could hide a person; the detector cannot see inside reflections.
  - The 3 Eixample photos are frames from one drive and look almost the same.
- **Before the strict rule** (people under 0.5 percent of the picture allowed): Edinburgh kept 63, Montmartre 19, Eixample 25; 17, 10 and 22 of those had a small person in them, which is why the rule was tightened.
- **What this means**
  - Edinburgh Old Town (narrow lanes seen from the pavement) is the place where live photos work; the stored strip is better in Montmartre and Eixample, which are full of pedestrians.
  - The filter is a detector, not a guarantee: a person it misses gets through, so the list is remade when places or the detector change, and nobody should treat it as proof of "no people".
- **Gaps**
  - Edinburgh has a lane and a list but no stand-alone Course yet (the other ready places are reached from map mode), so the browser check runs on Montmartre; Edinburgh is covered by unit tests and by the coverage count above.
  - The four older OSM courses (Montmartre, Eixample, Circular Quay, Lombard Street) were built before the ready-place lanes, so their course length does not match the place's lane line; the strip spreads the lane evenly over the course, so a photo can be a few tens of metres off.
  - The official Mapillary logo is not drawn (the terms ask for it); the strip names Mapillary in text and links to the photo.
  - The per-address limit lives in one server instance, so it is best effort; the edge cache does most of the work.
- **To switch it on**
  - Set the secret once: `npx wrangler pages secret put MAPILLARY_TOKEN` (paste the client token), then `npm run deploy`.
  - Without the secret the proxy answers 503 and the stored strip stays.

## Street furniture from Mapillary map features (CC-187, `?furniture=1`)
- **Parked (owner, 2026-10-30):** the pieces look like red and yellow lollipops, not like a street, so no screen draws them now.
  - To bring them back: set `FURNITURE_ENABLED = true` in `src/world/furniture.ts`; `?furniture=1` and the furniture behind `?backdrop=<slug>` work again.
  - The data stays: `public/assets/places/furniture/<place>.json` (positions and kinds from Mapillary map features, CC BY-SA 4.0), fetched by `scripts/furniture-fetch.ts`.
  - There is no photo behind any piece: Mapillary gives a class (lamp, bench, bin, sign) and a position, and the game draws a plain box or cylinder for it (`src/render/furniture-view.ts`).
  - Why it looks wrong: the shape is generic, the parts are drawn over-sized so they show at the shrunk scale of a place, and the colours are only there to tell the kinds apart.
  - A better version would lift real objects from photos (the object path of CC-221) for the kinds that matter, with a row in `docs/ASSETS.md` for each photo.
- **What the player sees**
  - On the four stored real-place courses (Montmartre, Eixample, Circular Quay, Lombard Street), with `?furniture=1`, real street lights, benches, bins, signs, traffic signals, poles and crosswalk paint stand where Mapillary's detectors saw them.
  - A white painted crossing marks the start line; it is a design touch, not a detection.
  - A small credit line names Mapillary and CC BY-SA 4.0 with a link to the licence.
  - It is off by default until the owner has seen it.
- **How it works**
  - `functions/api/features.ts` is the proxy (same pattern as `/api/photos`): the token lives in the Pages secret, only five fields and eleven classes come back, answers are cached 30 minutes.
  - `scripts/furniture-frame.ts` repeats the steps that placed each stored mesh (shrink, centre, drop to the lowest base, one scene item) and checks them against the mesh file: the footprint matches within 2.4 cm.
  - `scripts/furniture-fetch.ts` saves `public/assets/places/furniture/<place>.json` (about 184 KB for all four).
  - `src/world/furniture.ts` moves a point from metres east and south of the pin into the game's frame; `src/render/furniture-view.ts` draws instanced boxes and cylinders.
- **The lane is not touched**
  - Furniture is never in the physics and the course file is not read for anything but its ground height.
  - A thing that would stand inside the 2.6 m lane band at the runner's height is moved to the edge of the band (1.7 m from the run line).
  - Objects are drawn at least 0.5 of real size, and the parts are drawn over-sized (lamps about 4.5 m, signs 2.2 m, benches 1.4 m, CC-213), because the places are shrunk to 0.07 to 0.24 and a true-size lamp would be a few centimetres tall.
- Details, counts and pictures: `data/eval/cc-furniture/README.md`.

## Search: a second-best branch (2026-10-29, CC-69)
- The search takes, at each take-off edge, the middle of the presses that reach farthest; that can strand a later edge (the Park rail run as first built: the 4th jump landed so the last jump had no room).
- When the run reaches the last edges and still does not clear, the search now tries other presses at the last two take-off edges (5 spread over the whole range each, so at most 10 extra searches) and keeps the first plan that clears.
- Courses the greedy search already clears give the same plan (all golden hashes unchanged).
- The old Park rail run layouts (5 of 5 variants) now clear.
- Cost: only a run that got to the last edges and did not clear pays it (up to about 10 times that search).

- **The heavy crate piece was removed (CC-96):**
  - It was the same law as the launcher with other default numbers (25 kg at 6 m/s), and the launcher already has the mass and speed as knobs.
  - No demo used it.
  - An old saved world with a crate gets a launcher with the same numbers.

## Why a pin is slow, and the speed-up (CC-152)
- **Plain words: from the map to the 3D place**
  - Step 1: the map servers send the building outlines near the pin.
  - Step 2: the ground heights come from small picture tiles, one pixel per height.
  - Step 3: each outline is raised into a box at its height, standing on the ground.
  - Step 4: a worker looks for a lane over the roofs that the simulator can run.
- **What is slow:** only step 1 and the lane search.
  - The public map servers took 20 to 40 s, and gave nothing in 40 s for 4 of 7 new places.
  - The ground took 0.3 s and the mesh 2 to 14 ms.
  - The lane search took 25 to 126 s, in a worker, so the page does not freeze.
- **The speed-up:**
  - The buildings and the ground are asked the moment the pin drops, in parallel, and again when the radius changes.
  - Build joins that early request; with the servers held back 6 s, Build took 322 ms instead of 6578 ms.
  - A lane that was found is kept in the browser for that pin and shown at once next time.
  - `?speed=0` turns it off.
  - `scripts/warm-places.mjs` asks the site for a list of places so its cache answers them; run it from the demo network.
- **Numbers and the check:** `data/eval/cc-152-osm-speed/README.md`, `scripts/osm-speed.ts`, `scripts/map-speed-check.mjs`.
- **Which calls go direct and which go through a Pages Function (asked by the product owner):**

| Call | Goes | Why | Could it go direct? | What would be lost |
|---|---|---|---|---|
| Map tiles (OpenFreeMap) | Browser direct | No key, built for browsers | Already direct | Nothing |
| Search by name (Nominatim) | Browser direct | No key, one call per search | Already direct | Nothing |
| Terrain tiles (AWS Terrarium) | Browser direct | No key, public, allows browsers | Already direct | Nothing |
| Buildings (Overpass) | Function first (`/api/places`), then the six servers straight from the browser if the function fails | Shared cache: a place one player pinned is instant for the next, kept 30 days; the function also limits one address to 20 new places in ten minutes so we are polite to free servers | Yes, and it already does as the fallback | The shared cache (every first pin by every player waits 20 to 40 s) and the politeness limit; the cache is per Cloudflare data centre, so it is only a partial shield |
| Place photos (Mapillary `/api/photos`) | Function only | Secret: Mapillary needs a token, and a token in the page is public; also picture addresses expire, so the function asks fresh ones and caches them 30 minutes | No | We would have to ship the token (anyone could use it up) or drop live photos and keep only the saved ones |
| Ready places and saved photos | Our own files | Built in advance, no network to a third party | Already direct | Nothing |
| Muse Spark Open helpers (`/api/designer`, `/api/photo-course`, `/api/course-agent`, `/api/move-tips`) | Function only | Secret: the Baseten key; also tight rate limits and a short reply | No | The key would be public |
| Clears, stats, community (`/api/course-clear`, `/api/course-stats`, `/api/community`) | Function only | Trust: only the server can replay a run and keep one shared database | No | Honest leaderboards and the shared gallery |

- **So what for the question "why server functions at all":** only the Overpass call is a choice; the rest need a secret or a shared, trusted store.
  - Moving Overpass fully to the browser would cost the shared cache and the politeness limit, and would not make a first pin faster.
  - No code was moved; that needs the product owner's yes.

## Ready places audit and skins (CC-178)
- Where the places come from, why some have no path, the cut and shrink sweep, 3D sources and skins: [data/eval/cc-178-places/README.md](../data/eval/cc-178-places/README.md).
- `?places=all` shows every Ready place; the default list shows only places with a path and photos facing the lane.

## Slicing screen: the eight questions (CC-201 to CC-207)
- The product owner tried the slicing screen (`?mode=map`) and asked eight questions; this is what the code and the runs say.
- Switch: `?slice2=old` keeps the screen as it was before these changes.
- Runs and numbers: [data/eval/slice-ux2/README.md](../data/eval/slice-ux2/README.md).

### Q1: why did the Courses list not lead to the slicing screen? (CC-201)
- The card was hidden unless the address had `?labs=1`, and it was called "Map: search a place".
- It is now "Slice a real place", in the "Real places" group, and shown to everyone.
- The slicing screen has a "Back to courses" button at the top of the side panel.

### Q2: why did a green height still say no path? (CC-202)
- The green on the strip came from the shape of a coarse lane, not from the simulator.
- It also ignored the line the player had dragged.
- Now a height is green only after the same proof the lane uses (`pathAt` in `src/slice/slicer-core.ts`), on the line that is in use.
- While the proof runs the box is dashed grey; no path is pale red.
- A fix (a cut, a shrink, a building to take out) is shown only when it was run through the simulator and gave a path.
- If none does, the screen says so in plain words and shows no fix.
- Numbers on six places: the old strip had 1 green with no path and hid 13 heights that do have a path; in the browser, 16 of 16 greens that were clicked on four places gave a path.

### Q3: do the three dots change the result? (CC-203)
- Yes.
- The two round dots are the two ends of the line the runner follows; the square one moves the whole line.
- Until you drag, the game picks the line.
- After a drag, every check (the lane, the strip, the fixes) uses your line.
- A short note above the result says which of the two is in use, and a "Reset the line" button gives the game's line back.
- While you drag, the note says the result is checked again when you let go.
- A line dragged on one place no longer follows you to the next place.

### Q4: why did only two dots drag? (CC-204)
- Two of the three dots were outside the picture (one at x = -378 px), so there was nothing to grab; a click there was a click on the map.
- A real-mouse run reproduced it: one dot moved, the other two had nothing under the pointer.
- Now the camera pulls back and centres on the line when it is shown, and a "Show the whole line" button does it again; all three drag.

### Q5: what is the curvy red line? (CC-205)
- It is the ground line: where the ground itself is as high as the cut.
- It is a debug-style helper, not part of the course.
- It is now hidden; a tick box "Show the ground line" brings it back.

### Q6: does the course keep everything above the cut? (CC-205)
- Not quite.
- Everything is kept, but heights are measured from the cut.
- The runner starts on the cut height; taller things stand up from it as walls, so a higher cut makes walls shorter.
- Anything lower than a few metres below the cut is gone and leaves a gap, so a high cut turns low streets into gaps.
- This sentence, with a small side picture, is on the screen under the cut slider.

### Q7: why would the camera not go flat? (CC-206)
- The map library stops the tilt at 60 degrees by default.
- The slicing screen now allows up to 88 degrees, with a Tilt slider and right-drag; the wheel and pan work as before.
- The hand-over to the editor keeps its old 60 degrees.

### Q8: a gallery instead of a text list (CC-207)
- Each place is a card: a photo, name, city and a "ready" badge; click to select.
- Only four places have a stored photo (Wikimedia, free licences, credit on the card); the others show a plain skyline drawn from their real building heights.
- The default list is unchanged: a path and at least 30 photos facing the lane; `?places=all` shows the rest, with a note.
- Asset rows are in `docs/ASSETS.md`.

## No path, no option (CC-211)
- The product owner (2026-10-30): the point is to cross obstacles from the map, so an option without a path must not be offered, and nothing without a path is saved.
- Switch: `?slice2=old` keeps everything as it was before.
- A path means the simulator cleared it: the stored lane of a ready place (`path` in `public/assets/places/index.json`), the slicer proof (`pathAt`), or the stored best line of a course.

### What is no longer offered
- The ready-place list shows only places with a path; `?places=all` does nothing unless `&debug=places` is added.
- A pin only snaps to a ready place that has a path.
- "Build this place" opens the editor button only after the simulator has proved a lane; otherwise the screen gives the reason and the three nearest places that do have a path.
- The place is handed to the editor (session storage) only after the lane is proved.
- "Send to the editor" from the slicer is refused unless the cut height on the screen is green.
- The community gallery shows a card only after the simulator cleared it.
- A test (`tests/no-path.test.ts`) fails if a listed place has no cleared lane, or a course on a picker card is not cleared by its stored best line.

### What is no longer saved
- `POST /api/community` runs the simulator on the boxes and answers 422 when there is no path.
- `POST /api/course-event` keeps a row only for a stored course or a generated seed; other keys (a typed name, `coaster-custom`) are skipped.
- `POST /api/course-clear` already accepted only stored courses, and it replays the keys.
- `scripts/make-places.ts` writes no place whose lane is not cleared.
- The lane kept in the browser (local storage) was already written only when cleared.
- Still saved: `/api/places` keeps the raw map answer of any pin for 30 days in the edge cache; it is a cache of public map data, not a world.

### The two boxes that were removed
- "Real hills (ground height from satellite maps)":
  - On (default), the ground heights for the pin come from terrain tiles and are asked at the same time as the buildings.
  - The place is built on the real hill, the slope tint is drawn, and the lane search and the heights strip use the hill.
  - Off (`?hills=0`), the place is built flat and the step says "Flat ground (hills are off)".
  - For a ready place, off throws away the stored ground but keeps the lane found on the hill, so the proof no longer matches the flat place.
- "Use a ready place when one is near (loads at once)":
  - On (default), a pin within 300 m of a ready place loads that place from a file, with its ground and its proved lane, and moves the pin and radius to it.
  - Off, the site asks the map servers (20 to 40 s for a new pin) and the lane is searched again in the browser.
  - Nothing breaks when off; it is only slower and the radius is the one on the slider.
- Now neither box is shown: hills are always on and a ready place with a path is always used; `?hills=0` and `?useready=0` stay as debug switches.

## Coaster sections in the editor (CC-244)
- **So what:** a person can lay rails in the World Editor, chain sections with short gaps, and the character flies across the gaps and can grab bars and ropes.
- **The piece:** "Coaster" in the Add pieces menu, with a shape list (High start, Gentle dip, Long glide).
  - The first section is the start: the ride begins in the cart.
  - Each later section starts a little lower than the end of the one before it, because the cart only has the height it began with.
- **The gap:** about 3 m between sections is a short flight; the cart leaves the rails with the speed it has and lands on the next section.
  - Wider gaps work when there is height to spare (one section and a 5 m gap clears).
  - The proof is the simulator: if the search cannot clear the lane, the editor says so, as for any piece.
- **Bars and ropes:** a bar over a gap at any height is grabbed in the air by holding E; the search tries hang times for the first two bars (`searchCartRun`).
- **How it is built:**
  - The rail is a thin ribbon piece (`src/slice/track-world.ts`); the slice reads its height as ground.
  - `roleCourse` turns the platforms under the ribbons into rails and sets the course start at the first section.
- **Known gaps:**
  - Ground before the first section is skipped.
  - The shapes are fixed (no dot dragging yet); size and height can be changed like any piece.
  - The side view shows only the lowest part of tall sections until the side-view fit lands.
- **Checks:** `tests/coaster-editor.test.ts` (chains clear, a long flight with little height does not), `tests/coaster-bar.test.ts` (bars at four heights), `scripts/coaster-editor-shot.mjs` (screenshot at 1280 px).
