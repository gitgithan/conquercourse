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
- The Labs are known by name; their order in the list is the order they landed.
- [System design](system-design.md) is the finale: it uses Search, Camera and perspective, Signal processing, Verification and hashing, Video to motion, Cut-out, lift and bake, and Collision from a 3D lift, and has no stage of its own.

## Two tiers (numbers and URLs never change)
- Tier 1, Foundations: the skills the game stands on.
  - Search and learn: Search, Optimization, Reinforcement learning, Generate and test.
  - See the world: Computer vision, Camera and perspective, Evaluating a detector.
  - Move and measure: Posing a character, Numerical integration, Statistics of timing, Signal processing.
  - Trust the result: Same run, any machine (same run on any machine).
- Tier 2, Pipelines: how a photo, a video, an idea and a map became part of the game, in the order the data flows.
  - Photo to course object: Cut-out, lift and bake, then Collision from a 3D lift.
  - Video to motion: Video to motion.
  - Idea to course: Design partner loop.
  - Know the limits: What the model cannot do.
  - More Labs join at the end of the list as one line each; Design partner loop (idea to course) and World Slicer (map to lane) get their own sub-headers.
- The groups are one list, `LAB_GROUPS` in `src/ui/labs-series.ts`; the bar, the Courses picker and this page follow it.

## How the Labs hand over to each other
- A pipeline Lab opens with a "from" chip and "uses: Lab N" chips for the Foundation Labs it relies on, and ends with a "next" button.
  - Photo to course object: Cut-out, lift and bake uses Computer vision, Camera and perspective and Evaluating a detector; next is Collision from a 3D lift, which uses Generate and test.
  - Video to motion: Video to motion uses Signal processing and Posing a character.
- A Foundation Lab opens with "used in:" chips that name the pipeline stages that rely on it.
  - Signal processing is used in Video to motion: Smooth and Gate.
- The stage map is `PIPELINE_MAP` in `src/ui/labs-series.ts`; the chips are one small module (`src/ui/lab-flow.ts`), tested in `tests/lab-flow.test.ts`.
- Inside a Lab the steps read top to bottom, and each step shows what it hands to the next one.

## 1. Photo to course object
*A street or park photo becomes an object on a course that the simulator can prove.*

| Stage | What happens | Lab that teaches it | How well |
|---|---|---|---|
| 1. Photo | One photo, one camera, no depth | Camera and perspective | Teaches (why one photo cannot say how far each part is) |
| 2. Cut-out | A mask finds the thing (or the people to blur) | Cut-out, lift and bake, [Cut-out, lift and bake](lift.md) (recorded cut-outs); Computer vision; Evaluating a detector | Cut-out, lift and bake shows recorded cut-outs only; Computer vision teaches masks and thresholds on street photos (people to hide, not objects to cut); Evaluating a detector teaches whether a find is good enough |
| 3. Lift to 3D | The cut-out becomes a 3D shape | Cut-out, lift and bake (recorded lifts); Camera and perspective explains why the lift needs a guess | Teaches (the lift itself is recorded, not run: see its Limits) |
| 4. Bake | The 3D shape becomes a game object | Cut-out, lift and bake | Teaches (the seven bake rules run live on a recorded object) |
| 5. Collision | A collider is fitted from the 3D | Collision from a 3D lift, [Collision from a 3D lift](collision.md) | Teaches the nine steps on the real monkey-bars lift; written up in [collision from 3D](../collision-from-3d.md) |
| 6. Place and prove | The object goes on a course and the simulator proves it can be cleared | Generate and test; Statistics of timing; Search | Generate and test teaches proposing and throwing out; Statistics of timing teaches how wide the press window is; Search teaches how the proof finds a run |

## 2. Video to motion
*A filmed move becomes a clip the character can play, only if it passes the plausibility check.*

| Stage | What happens | Lab that teaches it | How well |
|---|---|---|---|
| 1. Video | A film of a person moving | Video to motion, [Video to motion](motion.md) | Teaches (the frame clock; recorded clips, no video is processed live) |
| 2. Pose | Joints found in each frame | Video to motion, [Video to motion](motion.md); Camera and perspective | Video to motion shows the joint check on recorded poses (the pose finder is not run); Camera and perspective explains why a 2D pose cannot give depth |
| 3. Smooth | Wobble removed from each joint | Signal processing | Teaches (lag, flat peaks, sliding feet) |
| 4. Gate | The plausibility check decides what may be shown | Video to motion; Signal processing | Video to motion runs the gate on ten clips and gives a reason a person can read; Signal processing holds the port, checked against the Python gate |
| 5. Clip | The clip plays on the character, with reach and neck rules | Posing a character | Teaches (the game's two-bone reach and neck rule) |

## 3. Methods behind the pipelines
*Ideas the pipelines lean on, not a stage of any one of them.*

| Lab | Why it sits here |
|---|---|
| Search | The proof in "place and prove" is a search; this Lab is the search itself (it also appears under stage 6 above) |
| Optimization | Choosing the best settings after the proof (plans, windows, drone and rope settings) |
| Reinforcement learning | Learning a run from points; shows what the replay and the hash would have to check |

## Know the limits
*Every model fails somewhere; the product sorts the failures and covers them.*

| Stage | What happens | Lab that teaches it | How well |
|---|---|---|---|
| Failures | Real failures are sorted into bins (uses Computer vision) | What the model cannot do | Teaches |
| Check | A gate's limit is tuned for precision and recall (uses Evaluating a detector) | What the model cannot do | Teaches (14 photos) |
| Fall back | The cheapest safe design is chosen (uses Generate and test) | What the model cannot do | Teaches |

## Map to lane
- World Slicer, [World Slicer: map to lane](slicer.md), teaches the six steps from a pin on a recorded OpenStreetMap area to a lane the simulator proves.
- It uses Collision from a 3D lift (the simulator proves it), Generate and test (propose, then throw out) and Search (the proof search).

## Where each Lab sits
| # | Lab | Section | Stage |
|---|---|---|---|
| 1 | Search | Methods | Search (also Photo stage 6) |
| 2 | Optimization | Methods | Optimize |
| 3 | Posing a character | Video | Clip |
| 4 | Computer vision | Photo | Cut-out |
| 5 | Camera and perspective | Photo | Lift to 3D |
| 6 | Numerical integration | Methods | Replay |
| 7 | Statistics of timing | Methods | Keys |
| 8 | Signal processing | Video | Smooth |
| 9 | Generate and test | Photo | Place and prove |
| 10 | Evaluating a detector | Photo | Cut-out |
| 11 | Verification and hashing | Methods | Hash |
| 19 | Same run, any machine | Methods | Hash |
| 12 | Reinforcement learning | Methods | Learn |
| 13 | Video to motion | Video | Gate (also Video, Pose) |
| 14 | Cut-out, lift and bake | Photo | Bake (also Cut-out, Lift) |
| 15 | Collision from a 3D lift | Photo | Collision |
| 16 | Design partner loop | Idea | Fix it |
| 18 | World Slicer: map to lane | Map to lane | Slice, Prove (the whole pipeline) |
| 20 | Spike the riskiest call first | Methods | Plan |
| 21 | What the model cannot do | Limits | Check |

## Gaps, shown honestly
- Photo: no Lab runs the lift model or the cut-out tool live (Cut-out, lift and bake uses recordings); Collision is taught on one lift (the monkey bars).
- Video: no Lab runs a pose finder on a video (Video to motion uses recorded clips); the Python gate itself has no Lab of its own beyond Signal processing's port.
- Computer vision and Evaluating a detector both sit at "Cut-out" and neither cuts a game object out of a photo: Computer vision hides people, Evaluating a detector scores a recorded detector.
- See [the overlap audit](overlap-audit.md) for topics several Labs repeat.

## Video to motion now mounts Signal processing and Posing a character
- The Smoothing and Gate steps open Signal processing's sliders and gate table, from the same panel code.
- The Retarget step opens Posing a character's bone solver, from the same panel code.
- Signal processing and Posing a character still work on their own pages.
- Picture: `docs/evidence/cc-133-pipeline-labs/lab-motion-woven.png`.
