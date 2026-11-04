# Lab 15: Collision from a 3D lift

*Photo to course object, stage 5 of 6: Collision (see [the series map](pipelines.md)).*
*Before it: baking a lift to a game object.*
*After it: placing the object on a course and proving it with the simulator (the last step of this Lab does that for the bars).*
*The whole pipeline is in [pipelines](../pipelines.md); the method this Lab runs is in [collision-from-3d](../collision-from-3d.md).*

## When you open it
- Live: it opens at step 6 (rung peaks) on the real Saienji CC0 monkey-bars lift at 5 cm cells, with "A rung is missed" already applied.
- Every output is filled: the nine-step table, the comparison of a copied mesh against the fitted row, and the bars simulator with the recorded keys played.
- A small label says "Showing our setting, already run"; change a control to try your own.

## The question
- A photo lift is noisy.
- How does it become a few clean numbers the physics can trust, and what happens to those numbers when the lift is broken?
- Open it at `?mode=lab-collision&labs=1`.

## What runs
- The lift: `public/assets/objects/monkey-bars-saienji-cc0.glb`, read with `readGlbMesh` and scaled to the maker's typed 2.2 m, as `scripts/make-bars-lift-demo.ts` does.
- The game's own functions from `src/slice/role-collider.ts`:
  - `voxelise`, `closing`, `largestComponent` (the clean-up, in the order `cleanLift` runs them: close holes first, then keep the biggest piece).
  - `barProfile` (the top band cut into slices, the peak line, the peaks kept) and `fitRow` (rounded gaps, the least-squares line, `GAP_MIN` and `GAP_MAX`); `measureBars` now calls both, so the Lab and the game share one code path.
  - `regulariseRungs` and `roleCollider` (the test checks the step-by-step run equals the whole call).
- The bars simulator: `src/sim/bars.ts` through `verifyLog` from `src/sim/replay.ts`, playing the recorded keys in `public/assets/demo/bars-lift.run.json`, and `searchIdealRun` on demand.
- Lab code only: `src/labs/collision/collision-core.ts` (the side-on shadows, the gap table, the break-it controls and the comparison).
- Everything runs in the page; no worker, no paid call.

## The nine steps
- **1.
  - The lifted skin:** 4,733 points, 17,460 triangle corners, scaled to 2.2 m.
- **2.
  - Voxelise:** every triangle is split until its edges are shorter than a cell, then the cells it touches are marked.
- **3.
  - Close holes:** grow by one cell, shrink by one; 41 cells fill at 5 cm.
- **4.
  - Keep the largest piece:** one piece on this lift, so nothing drops; a lift with floating blobs would show them in red.
- **5.
  - Top band:** the 0.3 m under the highest cell, so legs and posts do not count.
- **6.
  - Rung peaks per slice:** 107 slices of 5 cm; the peak line is the median plus 40% of the way to the maximum; 15 rung peaks stay.
- **7.
  - One spacing:**
  - Neighbouring gaps are rounded to a whole number of unit gaps: a double gap means a missed rung, a half gap a split rung.
  - One line through the places gives a unit of about 0.287 m.
  - That is under the editor's 0.3 m, so every second rung is used.
- **8.
  - The BarRun:** `{ x: -2.255, y: 2.08, n: 9, gap: 0.575 }`.
- **9.
  - In the simulator:** the row goes into a course like the demo course and the recorded ideal-run keys clear it in 914 ticks.

## Step 10: Skin versus collider
- **The idea:** a photo becomes a skin (what the player sees), never a collision shape; the collider is a simple shape the simulator can trust (see [lessons](../lessons.md), "The body and obstacles" and "Photos to 3D objects", and [lessons-obstacle-creation](../lessons-obstacle-creation.md)).
- **The widget:** a real lifted object (skate box, gabion wall, iron bollard, spruce stump or concrete planter from `public/assets/lab/lift/real/`) is drawn side-on with what the ball collides with on top.
  - One ball is dropped on the left end and pushed to 1.5 m/s along the object at 120 Hz; it is a sphere of 10 cm against triangles.
  - The same run is played on the lift and on the same photo lifted again (every point moved by up to 5 mm, a seeded draw).
- **The toggle:** "Collide with the skin" uses every triangle (or a thinner skin from the detail slider); "Collide with the collider" uses a box with each side rounded to the 5 cm cell.
- **What you see:** snags (the ball is slowed below 85% of its speed on contact), jitter (how much the ball's height bends from tick to tick, in mm), the run hash (1 mm steps) and the cost (triangles x ticks checks).
- **The detail slider:** fewer triangles cost less but the surface gets lumpier; clustering is a simple vertex-grid merge, so some detail levels bring a new snag.
- **The challenge:** pick, from five colliders, the one that keeps the run identical.
  - It must give the same hash on both lifts, the ball must get across, and its top must sit within 3 cm of the skin's top.
  - Only the box rounded to 5 cm passes: the skin and the thinner skin change with the lift, the tight box moves with every lift, the loose box gives the same run but a top one metre too high.
- **Code:** `src/labs/collision/skin-collider.ts` (pure, tested) and `src/labs/collision/skin-widget.ts` (the card).

## Break it
- **A rung is missed:** one peak is removed; the copied mesh has a double gap, the fitted row is the same 9 rungs.
- **A rung is split:** one extra peak half way between two rungs.
- **Two rungs are fused:** two neighbouring peaks become one in the middle.
- **Wobble every rung:** every peak moves by up to the slider's centimetres (a seeded draw, so the same seed always gives the same wobble).
- The table compares a collider that copies the peaks with the fitted row:
  - the gap spread, the number of gaps the editor would not allow, and the worst distance of a true rung from the nearest rung held.
  - The simulator card plays the same recorded keys on the changed row, and a button searches a new run.

## How it was designed
- **The one question:** how does a noisy lift become a clean collider, and what does the fit buy?
- **The choices and why those:**
  - Nine steps, each with its own side-on picture and its own outputs, because each step is a place the pipeline can go wrong.
  - The step order follows the code, not the order we first wrote in the doc: the code closes holes first, so a frame cut in two by holes is one piece again before the biggest piece is kept.
  - The cell-size slider is there because the answer depends on it (see Limits).
  - The breaks act on the rung peaks, the input of the fit, so each one is a clear case of the rounding rule (double gap, half gap, merged peak).
- **Which real game code runs:** the list above; the step-by-step run is tested to equal `roleCollider`.
- **Which data is precomputed:** none.
  - The lift and the recorded keys are shipped game files, fetched on open.
- **Order of the screen and why:** the step picture first, the table of all nine steps next, the comparison after, the simulator last, and the equations behind a button.

## How we prove the lesson is right
- `tests/lab-collision.test.ts` (36 tests) pins:
  - the Saienji lift gives 9 rungs, 0.575 m apart, at 2.08 m, and the step-by-step run equals `roleCollider`.
  - 15 rung peaks about 0.29 m apart, which the 0.3 m limit turns into every second rung.
  - the double-gap and half-gap rounding in `regulariseRungs`, and `GAP_MIN` and `GAP_MAX` in `fitRow`.
  - determinism, including the seeded wobble.
  - the break-it cases: a missed rung and a 3 cm wobble (five seeds) leave the fitted row at 9 rungs and 0.575 m; every break leaves the fitted row regular and legal while the copied row is not.
  - the fitted row builds the demo course, the recorded keys clear it, and `searchIdealRun` clears it.
  - Step 10: a flat box gives a flat run (rests 10 cm radius above the top); the run is deterministic; on every shipped object the skin does not keep the run across a second lift and the 5 cm box does; exactly one of the five colliders passes the challenge; the cost is triangles x ticks.
- What would make the Lab's claim false: a break that makes the fitted row irregular or illegal (the test loops over all of them), or a step-by-step run that differs from `roleCollider`.
- Browser check: `scripts/lab-collision-check.mjs` opens the page at 1280 px and fails on a page error or an empty output.
- Picture: [the Lab at 1280 px](../evidence/cc-133-pipeline-labs/lab-collision.png).

## What we saw
- The raw gaps between the 15 peaks are 0.25 to 0.55 m, and 5 of 14 are under the editor's 0.3 m: a collider that copies them could not even be built in the editor.
- A missed rung or a split rung is absorbed by the rounding; a 3 cm wobble is absorbed; at about 5 cm or more the rounding starts to flip.
- Fusing two neighbouring rungs can make the row wrong but still regular: at some places it gives 16 rungs 0.31 m apart and the recorded keys no longer clear it.
- Regular does not mean right; the fit protects the physics from noise and cannot see a count that the noise changed.

## Limits
- The cell size changes the answer: 3 cm gives 9 rungs 0.526 m apart, 8 cm gives 6 rungs and 12 cm gives 4 (the test pins the 12 cm case and that 8 cm is not 9).
  - The game uses 5 cm; no test says that 5 cm is the best size.
- Breaks act on the peaks, not on the mesh; a real hole or fused blob would reach the fit through the profile, which the Lab does not simulate.
- The fused case depends on where the two rungs are; two places are pinned (the 4th and 7th rung), not all of them.
- The fit is a straight line: a row bent in a curve, or rungs of different thickness, are not fitted (as in [collision-from-3d](../collision-from-3d.md)).
- Only the bar role is drawn; walls, poles and platforms have no worked example here.
- One lift: the other bar photos in `data/eval/bar-photos` are not shown.
- The recorded keys were found for the unbroken row; a changed row is also tried with a fresh search, which is not run on open.
- The Lab says nothing about the quality of the lift itself (the 3D model step is the stage before).

- Step 10 limits:
  - The ball rolls on one middle line and only feels the surface along the run and up; real bodies are wider.
  - The 5 mm re-lift is a seeded wobble of every point, not a second real model run; a real second lift would also change the shape.
  - The snapped box only works for box-like objects (a round log or a bench with a backrest are not shown; their skin run does not even get across).
  - Detail uses vertex clustering, not a quality mesh reducer.

## How to make the lesson better
1. Break the mesh, not the peaks: delete a rung's triangles, fuse two with a bridge, add noise to the points, and run the whole chain.
2. Show a second lift (a thin-rung photo) next to the Saienji one.
3. Plot the answer against the cell size for every size, so the sensitivity is one picture.
4. Add a wall and a pole worked example.
5. Link stage 3 and stage 5 of the pipeline by name when those Labs exist.
