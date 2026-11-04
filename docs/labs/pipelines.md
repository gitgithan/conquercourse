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
- Labs 13 to 15 (collision, lift, motion) are being written now; their rows say "arriving" until their doc is on `main`.

## 1. Photo to course object
*A street or park photo becomes an object on a course that the simulator can prove.*

| Stage | What happens | Lab that teaches it | How well |
|---|---|---|---|
| 1. Photo | One photo, one camera, no depth | Lab 5, Camera and perspective | Teaches (why one photo cannot say how far each part is) |
| 2. Cut-out | A mask finds the thing (or the people to blur) | Lab 4, Computer vision; Lab 10, Evaluating a detector | Lab 4 teaches masks and thresholds on street photos (people to hide, not objects to cut); Lab 10 teaches whether a find is good enough |
| 3. Lift to 3D | The cut-out becomes a 3D shape | Lab 13 (lift), arriving | Not yet on `main`; Lab 5 explains why the lift needs a guess |
| 4. Bake | The 3D shape becomes a game object | none | Not yet |
| 5. Collision | A collider is fitted from the 3D | Lab 14 (collision), arriving | Not yet on `main`; written up in [collision from 3D](../collision-from-3d.md) |
| 6. Place and prove | The object goes on a course and the simulator proves it can be cleared | Lab 9, Generate and test; Lab 7, Statistics of timing; Lab 1, Search | Lab 9 teaches proposing and throwing out; Lab 7 teaches how wide the press window is; Lab 1 teaches how the proof finds a run |

## 2. Video to motion
*A filmed move becomes a clip the character can play, only if it passes the plausibility check.*

| Stage | What happens | Lab that teaches it | How well |
|---|---|---|---|
| 1. Video | A film of a person moving | Lab 15 (motion), arriving | Not yet on `main` |
| 2. Pose | Joints found in each frame | Lab 15 (motion), arriving; Lab 5, Camera and perspective | Partly (Lab 5: why a 2D pose cannot give depth) |
| 3. Smooth | Wobble removed from each joint | Lab 8, Signal processing | Teaches (lag, flat peaks, sliding feet) |
| 4. Gate | The plausibility check decides what may be shown | Lab 8, Signal processing | Teaches (a TypeScript port of the gate, checked against the Python gate) |
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

## 4. Methods behind all three
*Ideas the pipelines lean on, not a stage of any one of them.*

| Lab | Why it sits here |
|---|---|
| Lab 1, Search | The proof in "place and prove" is a search; this Lab is the search itself (it also appears under stage 6 above) |
| Lab 2, Optimization | Choosing the best settings after the proof (plans, windows, drone and rope settings) |
| Lab 12, Reinforcement learning | Learning a run from points; shows what the replay and the hash would have to check |

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

## Gaps, shown honestly
- Photo: Bake has no Lab; Lift and Collision are being written.
- Video: Video and Pose are being written; the Python gate itself has no Lab of its own beyond Lab 8's port.
- Run: no Lab opens a real share link or shows the server's replay check.
- Labs 4 and 10 both sit at "Cut-out" and neither cuts a game object out of a photo: Lab 4 hides people, Lab 10 scores a recorded detector.
- See [the overlap audit](overlap-audit.md) for topics several Labs repeat.
