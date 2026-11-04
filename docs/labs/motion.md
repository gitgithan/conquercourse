# Video to motion

*Video to motion, stages 1 to 4 of 5: Video, Pose, Smooth and Gate, then a clip on the character (see [the series map](pipelines.md)).*
*Before it: the photo-to-course Labs ([Camera](camera.md), [Posing a character](ik.md)).*
*After it: running, recording and sharing a run ([Hashing](hashing.md)).*
*Behind `?labs=1`. Open `?mode=lab-motion&labs=1`. Serves the university Labs (`docs/university-labs.md`).*
*Evidence: [the Lab at 1280 px](../evidence/cc-133-pipeline-labs/lab-motion.png).*

## When you open it
- It opens already run, on the real failure: the whole filmed jump roll, which the gate holds back.
- Every step is filled: the frame clock, the joint check, the smoothing table, the gate table with a verdict on all ten clips, the recorded run of the real pipeline, the Rookie view and the tick slider.
- Pick any clip in the list; the six steps follow it.
- No video, model or paid call runs in this Lab; every clip is a recorded file.

## The question
- A film of a person becomes a body that moves in the game; at which steps can it go wrong, and who stops it?
- The answer the Lab shows: the gate stops it, with a reason a person can read, before the character ever moves.

## The six steps
1. **Source frames and their clock.** Frame i is at i divided by the video's own rate (29.97 for the filmed clips).
   - A typed-in rate is a second clock: the gate refuses a good leap when it is typed as 24 instead of 30, because gravity is a clock too.
2. **Joint positions per frame.** 30 named joints in metres; the names and every frame must have the same length (the off-by-one lesson).
   - The Lab shows the game's own reader refusing a clip that lost one name, with its message.
3. **Smoothing.** Only what the game applies (the 1-2-3-2-1 triangle, then one length per bone), measured by the gate's soft rules.
   - The price of smoothing (lag, flat peaks, jitter against lag) is Signal processing ([signal.md](signal.md)); it is not repeated.
4. **The plausibility gate.** Hard rules block, soft rules are reported.
   - It shows ten clips: five recorded passes, two recorded failures, four clips we broke on purpose, and the recorded Python-gate run of the filmed roll.
5. **Retarget and play.** The clip and the Rookie share the 30 names; the clip is scaled so its legs match the Rookie's, and the Rookie's bones are turned to the joints.
   - A clip that failed the gate shows "Held back" and nothing plays.
   - The move table (`MOTION_TABLE`) shows which move plays which clip and which move falls back to a pose built from bones.
6. **The one clock.** The pose is read from the simulator's tick (120 a second): clip time = tick / 120, clip frame = time x rate.
   - The slider is a tick; autoplay adds one tick at a time, so wall time only decides how many ticks to add.

## The clips
| Clip | Where it came from | Verdict |
|---|---|---|
| run, leap | CMU motion capture, shipped | passes |
| vault | measured from a London Parkour film, shipped | passes (soft: planted foot slides) |
| roll, crouch part | trimmed from the filmed jump roll | passes |
| roll, the whole film | the filmed jump roll, whole | **fails**: not on a falling arc in the air |
| wall run-up, sample a | a generated clip | **fails**: nothing holds the body for over a second |
| feet under the floor | the shipped run, every joint 8 cm down (made by us) | **fails**: feet stay above the floor |
| jump in place | the shipped run, 1.5 m forward in one frame (made by us) | **fails**: no sudden jumps in place |
| wrong clock | the shipped leap with 15 typed for 30 (made by us) | **fails**: a jump follows gravity |
| stretching arm | the shipped vault, left hand up to 25% away (made by us) | passes; soft rule reported |

## Overlaps with other Labs
- Signal processing: step 3 only shows the game's smoothing and its soft numbers; the filters, noise and trade-off are Signal processing's.
  - The gate code is Signal processing's TypeScript port (`src/lab/signal-lab.ts`).
- Inverse kinematics: the Rookie is posed by the game's bone solver; this Lab does not teach reaching.
- Camera and perspective: why a single photo gives no depth is Camera and perspective's; here the pose is already measured.

## How it was designed
- **The one question:** at which step can a filmed move go wrong, and what stops it before the character moves?
- **The choices and why those:**
  - Recorded clips only, so no model runs and the numbers are the ones the game ships with.
  - Two real failures (the whole roll, the wall clip) first, then four failures made by us, so each rule can be seen failing; the page says which is which.
  - The gate verdict is the first thing on the page, because the pipeline's rule is that no motion is shown before it passes.
- **Which real game code runs:** `parseClip` and `sampleClip` (`src/motion/clip.ts`), the gate (`runGate` in `src/lab/signal-lab.ts`), the smoothing (`gameSmoothing`), `legLength`, `clipToWorld`, `rookie.apply`, `MOTION_TABLE` and `TICKS_PER_SECOND`.
- **Lab code:** `src/labs/motion/motion-core.ts` (the broken clips, the lift-to-floor repair, the wording of each failure), `src/modes/lab-motion.ts`.
- **Which data is precomputed:** `public/assets/lab/motion-recorded.json`, the Python gate's raw and repaired numbers for the filmed roll (from `data/eval/motion-from-you/roll-lp/gate.json`); `public/assets/lab/motion/real/` (the pose finder's raw tracks of two rolls, recorded on a GPU at build time, never at runtime; trail in `data/eval/cc-133-lab13-pose/`; if it cannot load, the Lab keeps its other clips); the rest is computed in the page.
- **Order of the screen and why:** the pick, the frames and joints, smoothing, the gate (the long card), then the character and the clock, so the player sees what each step hands to the next.

## How we prove the lesson is right
- `tests/lab-motion.test.ts` pins:
  - every recorded good clip passes; the whole roll fails on `flight_is_ballistic`; the wall clip fails on `held_clips_are_held`;
  - the TypeScript gate's flight number on the roll is within 0.05 m/s2 of the Python gate's recorded number;
  - each clip we broke fails exactly the rule it was broken for (feet 8 cm down, hips over 12 m/s, half-speed clock gives a quarter of gravity);
  - the stretching arm breaks only a soft rule, and one length per bone fixes it;
  - lifting to the floor repairs the sunk feet, and no allowed repair rescues the jump in place or the wrong clock;
  - a clip with one lost name is refused by the game's reader, with its message;
  - a rate of 30 for 29.97 is 0.1% off, and 24 for 30 makes the gate refuse a good leap;
  - the pose at a tick depends on the tick only (tick / 120 s);
  - the retarget scale gives the character's leg length and keeps proportions;
  - every shipped clip named in `MOTION_TABLE` passes the gate.
- What would make the claim false: a shipped clip failing the gate, or the TypeScript gate drifting from the Python one (Signal processing's reference test also guards that).

## Limits
- The broken clips are made by us from shipped clips; only two failures are recorded ones.
- The gate in the page is the TypeScript port, not the Python gate; only the filmed roll's flight number is compared with the Python run here.
- No video frames are shown (the source films are not stored in the repo); step 1 draws the joints.
- The Rookie view needs a graphics-capable browser; the screenshot used a software renderer.
- The repair shown is only lift-to-floor; the other repairs (knees, knee limit, ballistic) are not run here.
- The pose and measurement steps (video to joints on a GPU) are described, not run.

## How to make the lesson better
1. Add the raw measurement of one more filmed clip, with its Python gate run, as a second recorded failure.
2. Run all four pipeline repairs in the page and show the gate before and after each.
3. Show the contacts step (which foot or hand touches what) between the pose and the gate.
4. Compare the TypeScript and Python gates on all ten clips in a test fixture.

## Longer explanations moved out of the page (CC-133)
- Video: each frame's time comes from the video's own rate (frame i at i divided by the rate).
  - We keep no pictures of the people; what follows the video is only the 30 joint positions per frame.
- Pose: the file keeps a list of names and, for each frame, one position per name.
  - The two lists must be the same length, always.
- Smooth: the game smooths with a light 1-2-3-2-1 triangle, then gives every bone one length.
  - How much to smooth, and what it costs in lag and flat peaks, is taught in Signal processing and is not repeated in Video to motion.
- Gate: no motion is shown before it passes.
  - The code is a TypeScript port of the Python gate, checked against it in Signal processing.
- Clip: the clip and the Rookie share the same 30 joint names.
  - The clip's person has other leg lengths, so every position is scaled so the legs match, and the Rookie's bones are turned to point where the joints are.
- Tick: the pose shown is read from the simulator's tick count, never from a timer.
- Where this Lab sits: stage 2 of 3, after the photo-to-course Labs and before running, recording and sharing a run.
- Clock: a typed-in rate is a second clock, and the gate finds it out because gravity is a clock too (shown on the shipped leap, a clean clip with a clear jump).
- Soft rules: the shipped CMU clips are not smoothed by Step 3 at all, and the filmed ones were smoothed when they were made, so on a clean clip the change is small.
  - On the clip with the stretching arm, one length per bone fixes the first column.
- Repairs: only small ones are allowed before the gate.
- The last four rows of the gate table are shipped clips changed in one way (so each rule can be seen failing); they are not recorded failures.
- Recorded run: the filmed jump roll went through the pipeline's own Python gate before it was ever played; both numbers were printed by that run, not by the page.
  - The repair lifted the sunk feet (5.4 cm to 0).
    - It cannot invent a falling arc, so the whole film stays held back, and only a trimmed piece (the crouch clip) was kept.
- Woven panels: Step 3 and Step 4 open Signal processing's panel (smoothing sliders, jitter and lag, gate table) and Step 5 opens Posing a character's panel (bone solver); both are the same modules the old Labs use (`src/labs/signal/panel.ts`, `src/labs/ik/panel.ts`).
  - The panel brings its own clips (Signal processing's and Posing a character's lists), not the clip picked at the top of Video to motion.
