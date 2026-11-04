# Lab 13: Video to motion

*Pipeline stage 2 of 3: video, then pose, then smoothing and the plausibility gate, then a clip on the character.*
*Before it: the photo-to-course Labs ([Lab 5, Camera](camera.md), [Lab 3, Posing a character](ik.md)).*
*After it: running, recording and sharing a run ([Lab 11, Hashing](hashing.md)).*
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
   - The price of smoothing (lag, flat peaks, jitter against lag) is Lab 8 ([signal.md](signal.md)); it is not repeated.
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
- Lab 8 (Signal processing): step 3 only shows the game's smoothing and its soft numbers; the filters, noise and trade-off are Lab 8's. The gate code is Lab 8's TypeScript port (`src/lab/signal-lab.ts`).
- Lab 3 (Inverse kinematics): the Rookie is posed by the game's bone solver; this Lab does not teach reaching.
- Lab 5 (Camera): why a single photo gives no depth is Lab 5's; here the pose is already measured.

## How it was designed
- **The one question:** at which step can a filmed move go wrong, and what stops it before the character moves?
- **The choices and why those:**
  - Recorded clips only, so no model runs and the numbers are the ones the game ships with.
  - Two real failures (the whole roll, the wall clip) first, then four failures made by us, so each rule can be seen failing; the page says which is which.
  - The gate verdict is the first thing on the page, because the pipeline's rule is that no motion is shown before it passes.
- **Which real game code runs:** `parseClip` and `sampleClip` (`src/motion/clip.ts`), the gate (`runGate` in `src/lab/signal-lab.ts`), the smoothing (`gameSmoothing`), `legLength`, `clipToWorld`, `rookie.apply`, `MOTION_TABLE` and `TICKS_PER_SECOND`.
- **Lab code:** `src/labs/motion/motion-core.ts` (the broken clips, the lift-to-floor repair, the wording of each failure), `src/modes/lab-motion.ts`.
- **Which data is precomputed:** `public/assets/lab/motion-recorded.json`, the Python gate's raw and repaired numbers for the filmed roll (from `data/eval/motion-from-you/roll-lp/gate.json`); the rest is computed in the page.
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
- What would make the claim false: a shipped clip failing the gate, or the TypeScript gate drifting from the Python one (Lab 8's reference test also guards that).

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
