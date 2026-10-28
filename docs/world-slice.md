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

