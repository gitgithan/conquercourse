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
   - The playable band is `h0` to `h0 + 4.3 m` (the Warped Wall's height, the tallest thing the moves handle).
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
  - on by default for a course someone built (editor or `?course=`), off for the stock course until D (or `?drums=1`);
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
