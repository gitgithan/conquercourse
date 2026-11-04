# The Labs as a series: three pipelines

*The Labs teach the pipelines we used to build the game, in the order the data flows.*
*A Lab's number never changes (links in docs and films use it); only the grouping is new.*
*The grouping is one list in `src/ui/labs-series.ts`; the bar at the top of every Lab and the Courses picker read it.*
*Recipes to rebuild each pipeline are in [pipelines](../pipelines.md); this page says which Lab teaches which stage.*

## How to read the maps
- "Teaches" means the Lab runs real game code for that stage and has a test that pins its claim.
- "Partly" means the Lab teaches an idea the stage depends on, not the stage itself.
- "Not yet" means no Lab covers the stage.
  - It is listed so the series stays honest.
- Labs 13 to 15 (motion, lift, collision) and Lab 18 (map to lane) are numbered in the order they landed.
- Lab 17, [System design](system-design.md), is the finale: it uses Labs 1, 5, 8, 11, 13, 14 and 15 and has no stage of its own.

## Two tiers (numbers and URLs never change)
- Tier 1, Foundations: the skills the game stands on.
  - Search and learn: Lab 1, Lab 2, Lab 12, Lab 9.
  - See the world: Lab 4, Lab 5, Lab 10.
  - Move and measure: Lab 3, Lab 6, Lab 7, Lab 8.
  - Trust the result: Lab 11.
- Tier 2, Pipelines: how a photo, a video and a run became part of the game, in the order the data flows.
  - Photo to course object: Lab 14, then Lab 15.
  - Video to motion: Lab 13.
  - Run to shared link: no Lab planned (owner decision: not visual enough); its stages and the Foundation Labs it uses are listed.
  - Idea to course: Lab 16 (design partner loop).
  - More Labs join at the end of the list as one line each; Lab 16 (idea to course) and Lab 18 (map to lane) get their own sub-headers.
- The groups are one list, `LAB_GROUPS` in `src/ui/labs-series.ts`; the bar, the Courses picker and this page follow it.

## How the Labs hand over to each other
- A pipeline Lab opens with a "from" chip and "uses: Lab N" chips for the Foundation Labs it relies on, and ends with a "next" button.
  - Photo to course object: Lab 14 uses Labs 4, 5, 10; next is Lab 15, which uses Lab 9.
  - Video to motion: Lab 13 uses Labs 8 and 3.
- A Foundation Lab opens with "used in:" chips that name the pipeline stages that rely on it.
  - Lab 8 is used in Video to motion: Smooth and Gate.
- The stage map is `PIPELINE_MAP` in `src/ui/labs-series.ts`; the chips are one small module (`src/ui/lab-flow.ts`), tested in `tests/lab-flow.test.ts`.
- Inside a Lab the steps read top to bottom, and each step shows what it hands to the next one.

## 1. Photo to course object
*A street or park photo becomes an object on a course that the simulator can prove.*

| Stage | What happens | Lab that teaches it | How well |
|---|---|---|---|
| 1. Photo | One photo, one camera, no depth | Lab 5, Camera and perspective | Teaches (why one photo cannot say how far each part is) |
| 2. Cut-out | A mask finds the thing (or the people to blur) | Lab 14, [Cut-out, lift and bake](lift.md) (recorded cut-outs); Lab 4, Computer vision; Lab 10, Evaluating a detector | Lab 14 shows recorded cut-outs only; Lab 4 teaches masks and thresholds on street photos (people to hide, not objects to cut); Lab 10 teaches whether a find is good enough |
| 3. Lift to 3D | The cut-out becomes a 3D shape | Lab 14, Cut-out, lift and bake (recorded lifts); Lab 5 explains why the lift needs a guess | Teaches (the lift itself is recorded, not run: see its Limits) |
| 4. Bake | The 3D shape becomes a game object | Lab 14, Cut-out, lift and bake | Teaches (the seven bake rules run live on a recorded object) |
| 5. Collision | A collider is fitted from the 3D | Lab 15, [Collision from a 3D lift](collision.md) | Teaches the nine steps on the real monkey-bars lift; written up in [collision from 3D](../collision-from-3d.md) |
| 6. Place and prove | The object goes on a course and the simulator proves it can be cleared | Lab 9, Generate and test; Lab 7, Statistics of timing; Lab 1, Search | Lab 9 teaches proposing and throwing out; Lab 7 teaches how wide the press window is; Lab 1 teaches how the proof finds a run |

## 2. Video to motion
*A filmed move becomes a clip the character can play, only if it passes the plausibility check.*

| Stage | What happens | Lab that teaches it | How well |
|---|---|---|---|
| 1. Video | A film of a person moving | Lab 13, [Video to motion](motion.md) | Teaches (the frame clock; recorded clips, no video is processed live) |
| 2. Pose | Joints found in each frame | Lab 13, [Video to motion](motion.md); Lab 5, Camera and perspective | Lab 13 shows the joint check on recorded poses (the pose finder is not run); Lab 5 explains why a 2D pose cannot give depth |
| 3. Smooth | Wobble removed from each joint | Lab 8, Signal processing | Teaches (lag, flat peaks, sliding feet) |
| 4. Gate | The plausibility check decides what may be shown | Lab 13, Video to motion; Lab 8, Signal processing | Lab 13 runs the gate on ten clips and gives a reason a person can read; Lab 8 holds the port, checked against the Python gate |
| 5. Clip | The clip plays on the character, with reach and neck rules | Lab 3, Posing a character | Teaches (the game's two-bone reach and neck rule) |

## 3. Run to shared link
*A run is only keys; a link carries the keys; anyone's browser replays them and gets the same run.*

| Stage | What happens | Lab that teaches it | How well |
|---|---|---|---|
| 1. Run | The simulator steps in fixed ticks | Lab 6, Numerical integration | Teaches (step rule and size, energy invented) |
| 2. Keys | The presses are recorded as keys | Lab 7, Statistics of timing | Partly (how shaky presses change a clear; not the key log) |
| 3. Replay | The keys are played again from the start | Lab 6, Numerical integration; Lab 11, Verification and hashing | Teaches (does a replay at your step match the recording; the judge `verifyLog`) |
| 4. Hash | A fingerprint shows a changed tick | Lab 11, Verification and hashing | Teaches (what to hash, which function, avalanche) |
| 5. Share | The link carries a version, a course hash, a nick and the keys | Lab 11, Verification and hashing | Partly (the "what the game hashes" card; no Lab builds or opens a link) |

## Idea to course
*A design partner proposes a course; the simulator checks it; Fix it repairs it.*

| Stage | What happens | Lab that teaches it | How well |
|---|---|---|---|
| Propose | A recorded partner answer is read | Lab 16, Design partner loop (uses Lab 9) | Teaches |
| Check | The simulator runs and says why | Lab 16 (uses Lab 1) | Teaches |
| Fix it | One proved easing is applied | Lab 16 | Partly (not the editor's search) |
| Show | Only a cleared course is shown | Lab 16 | Teaches |

## 4. Methods behind all three
*Ideas the pipelines lean on, not a stage of any one of them.*

| Lab | Why it sits here |
|---|---|
| Lab 1, Search | The proof in "place and prove" is a search; this Lab is the search itself (it also appears under stage 6 above) |
| Lab 2, Optimization | Choosing the best settings after the proof (plans, windows, drone and rope settings) |
| Lab 12, Reinforcement learning | Learning a run from points; shows what the replay and the hash would have to check |

## Map to lane
- Lab 18, [World Slicer: map to lane](slicer.md), teaches the six steps from a pin on a recorded OpenStreetMap area to a lane the simulator proves.
- It uses Lab 15 (the simulator proves it), Lab 9 (propose, then throw out) and Lab 1 (the proof search).

## Where each Lab sits
| # | Lab | Section | Stage |
|---|---|---|---|
| 1 | Search | Methods | Search (also Photo stage 6) |
| 2 | Optimization | Methods | Optimize |
| 3 | Posing a character | Video | Clip |
| 4 | Computer vision | Photo | Cut-out |
| 5 | Camera and perspective | Photo | Lift to 3D |
| 6 | Numerical integration | Run | Replay |
| 7 | Statistics of timing | Run | Keys |
| 8 | Signal processing | Video | Smooth |
| 9 | Generate and test | Photo | Place and prove |
| 10 | Evaluating a detector | Photo | Cut-out |
| 11 | Verification and hashing | Run | Hash |
| 12 | Reinforcement learning | Methods | Learn |
| 13 | Video to motion | Video | Gate (also Video, Pose) |
| 14 | Cut-out, lift and bake | Photo | Bake (also Cut-out, Lift) |
| 15 | Collision from a 3D lift | Photo | Collision |
| 16 | Design partner loop | Idea | Fix it |
| 18 | World Slicer: map to lane | Map to lane | Slice, Prove (the whole pipeline) |

## Gaps, shown honestly
- Photo: no Lab runs the lift model or the cut-out tool live (Lab 14 uses recordings); Collision is taught on one lift (the monkey bars).
- Video: no Lab runs a pose finder on a video (Lab 13 uses recorded clips); the Python gate itself has no Lab of its own beyond Lab 8's port.
- Run: no Lab opens a real share link or shows the server's replay check.
- Labs 4 and 10 both sit at "Cut-out" and neither cuts a game object out of a photo: Lab 4 hides people, Lab 10 scores a recorded detector.
- See [the overlap audit](overlap-audit.md) for topics several Labs repeat.

## Lab 13 now mounts Labs 8 and 3
- The Smoothing and Gate steps open Lab 8's sliders and gate table, from the same panel code.
- The Retarget step opens Lab 3's bone solver, from the same panel code.
- Labs 8 and 3 still work on their own pages.
- Picture: `docs/evidence/cc-133-pipeline-labs/lab-motion-woven.png`.
