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
