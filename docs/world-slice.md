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
  - Add "Toy brick (3 cm)": it arrives enlarged ×15; type 0.5 in "Real height" and it is a half-metre block.
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
  - on by default for a course someone built (editor or `?course=`), off for the stock course until G (or `?drums=1`);
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
- **So what:** we cannot compare TRELLIS.2 and Pixal3D yet, because both need a licence a person has to accept first.
  - The blocker is Meta's DINOv3 image encoder (gated on Hugging Face; the `sam-hf` account has no access).
  - Until then SAM 3D Objects stays our only object source with results.
- **What is needed to unblock (the product owner's call):**
  - Read the DINOv3 License and accept it on Hugging Face with the account behind `sam-hf`, or decide not to.
  - TRELLIS.2 and Pixal3D then run in about an hour on one Modal GPU, for a few dollars.
  - `briaai/RMBG-2.0` stays out: it is non-commercial and a SAM 3 mask replaces it.
- **Other options found:**
  - Hunyuan3D-2.1 is open to us, but its Tencent Community License excludes the EU, UK and South Korea.
  - Stable Fast 3D is gated like DINOv3.
- **Census of the SAM 3D results:** eight of nine pass; park06 is refused for being 33 m long.
- **Tripo:** it only made the two Rookies, so there is no earlier Tripo object result, and no new paid step was taken.
- **Details:** `data/eval/object-bakeoff/` (README, probe table, census, `run.json`); cost under $0.01, no GPU.
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
  - It plays one ideal run from the start (or from where retry would start) to the finish, without handing back after each obstacle.
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
- **Input:** C, buffered a quarter of a second (`ROLL_BUFFER`); a press on the ground does nothing.
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
