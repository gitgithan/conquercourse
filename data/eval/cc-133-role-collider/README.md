# Role-first collider: monkey bars from a noisy photo lift (CC-133)

## So what
- A photo lift can now be the skin of a monkey-bar course piece whose collision is a clean row measured from the lift, so noise in the mesh cannot make a snag or a gap that is not in the photo.
- The demo course (`public/assets/demo/bars-lift.course.json`) swings across 9 evenly spaced rungs at 2.08 m; the ideal-run search solves it and a recorded run grabs the rungs in turn (`tests/bars-lift-course.test.ts`).
- The new switch `rolecollider` is on in dev and preview and off in production; with it off, "Fit to selected" is the old box fit, unchanged.
- Limits are in the last section: the Saienji lift's real rung spacing is under the sim's 0.3 m least, so the collider uses every second rung; the second lift (BY-SA) measures badly.
- Next: run the same clean-up on the other six lifts, and feed it the finder's role word ("pull-up bar" means bars).

## The idea
- The role says what to measure: bar (height, span, one spacing), wall (height, width), pole (height, thickness), platform (height, size).
- The lift is cleaned first, in 3D, like opening and closing a 2D mask:
  - voxelise the surface (5 cm cells, triangles split so thin rungs are not missed);
  - close it (dilate then erode) so holes and cracks fill;
  - keep the largest connected piece, so floating blobs go.
- Bars: take the top 0.3 m, count cells per column along the long axis, find the peaks (rungs), drop an end peak that is a post, round each gap to a whole number of unit gaps (a missed rung gives a double gap), fit one line through the peaks (least squares), snap the count.
- Clamps match the sim: spacing 0.3 to 1.0 m (under 0.3 m uses every k-th rung), rung height 1.8 to 4.5 m, radius 2 to 4.5 cm.
- The photo mesh is only the skin: `src/slice/role-collider.ts` returns a primitive in the fit step's shape and a `BarRun` the simulator reads.

## Results
| Input | What is true | What the collider says |
|---|---|---|
| Noisy fixture (`tests/fixtures/noisy-bars.json`: holes, a blob, depth squeezed to 40 %, size 1.3 times too big) | 10 rungs, 0.5 m, 2.1 m up | 10 rungs, 0.50 m, 2.08 m (known height fixes the scale) |
| Saienji CC0 lift (typed height 2.2 m) | about 15 to 17 rungs about 0.28 m apart, 5.3 m long | 9 rungs, 0.575 m (every second rung), 2.08 m |
| Kenpei BY-SA lift | ladders at both ends, irregular rungs | 6 peaks found, 11 rungs at 0.35 m: not trusted |

## Files
- Code: `src/slice/role-collider.ts`, the wiring in `src/slice/bars-world.ts` (`fitBarsByRole`), the switch in `src/switches.ts` and `src/modes/editor/tools/bars.ts`.
- Tests: `tests/role-collider.test.ts` (fixture always; the real GLB when `../conquercourse-assets/bar-photos/best/` exists), `tests/bars-lift-course.test.ts`.
- Scripts: `scripts/make-noisy-bars-fixture.ts`, `scripts/shrink-glb-texture.py`, `scripts/make-bars-lift-demo.ts`, `scripts/cc133-bars-lift-shots.mjs`.
- Pictures and film: `docs/evidence/cc-133-role-collider/`.
- `run.json` has the numbers.
