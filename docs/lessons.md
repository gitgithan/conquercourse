# Lessons: what we know before we start, and why

*Knowledge from a practice project and from experiments during the event (see `docs/PRIOR-WORK.md`).*
*Each lesson is a rule plus the reason; none of it is code.*
*Draft v0.1, 2026-10-27.*
*Reference, not requirements: the spec decides; numbers are starting points to re-measure in this project.*

## Physics and time
- **One clock.** Game time comes only from the simulator's tick count; replays, ghosts, recordings, motion and films all read it.
  - Why: a second clock (a typed-in frame rate) once replaced the real per-frame times and made a clip play at the wrong speed without any error.
- **The simulator is truth; looks never change physics.** The body's centre of mass follows the simulator; animation is drawn on top.
- **Every law has a test against its closed form** (projectile range and peak, pendulum period, sprint time constant, braking distance), written before the feature.
- **"Helpful" rules in the physics are dangerous.** A rule that flew the rope to the player's hands once held up a whole course design; honest catches (hands within reach) needed the course rebuilt.
- **Real limits feel right:** braking is limited by grip, flights are fixed at take-off, there's no steering in the air; players accepted all three.

## Motion
- **Names and arrays must have the same length; assert it.** An off-by-one joint list shifted every joint by one and drew a body bending the wrong way.
- **Nothing is shown before a plausibility check:** knees bend forward, knee range at most 165°, bones keep their length, feet don't sink or slide, flight is ballistic, no teleport, no jitter; hand-supported and hanging phases are marked so they aren't judged as free flight.
- **Experiments live apart from shipped clips,** so a guard test can require every shipped clip to pass.
- **Kimodo (NVIDIA's motion model) facts:**
  - It follows the simulator's path closely when given keyframes and a ground path; text alone can't produce unusual gravity.
  - Its constraints act through joint rotations: editing positions alone is ignored.
  - A hand or foot constraint pins that whole chain and the hips; use one constraint per frame for all joints pinned on it, with the body shift eased over nearby frames (a shift on single frames made the hips jump).
  - It has no idea obstacles exist: push its prediction out of obstacle boxes on the last 15 % of denoising steps and read the result from positions; then snap contacts with two-bone IK.
  - Build its constraint objects on the CPU and move them to the GPU with `.to()`.
- **Blind tests decide, not opinions:** in a blind A/B test the product owner chose Kimodo's leaps over real motion capture three times out of three ("mocap jumps look weak").
- **One mid-speed clip, time-warped, covers a whole human speed range** (3-7 m/s within 4 cm); add clips for new moves and outcomes, not new speeds.

## Characters and rigging
- **Measure joints from the mesh.** An average-body skeleton put a stylised character's shoulder 10 cm above its arm and opened a gap at the shoulder when the arms rose.
- **Sample the surface, not the vertices:** a low-poly torso side is a few big faces with no vertices between them.
- **Keep the upper arm straight and don't stretch bones;** the game only rotates bones, so limbs keep their length.
- **Check which way the model faces;** a wrong front bends knees backwards in every pose.
- **Judge a rig by its renders in several poses, not by its weight counts.**
- **Make the second character from an image, not text,** when it must match the first one's style (text gave a male-looking "female" character).

## The body and obstacles
- **Checking the skeleton misses the skin.** Measure how deep the drawn skin goes into each obstacle every frame, push it out, and re-plant feet with IK.

## Testing and filming
- **Headless WebGPU works only on `localhost` pages** (a secure context), with SwiftShader flags.
- **Software-GPU video plays in slow motion;** film with a stepped clock (advance game time one frame per screenshot) so clips play at true speed.
- **Playwright clears `test-results/` on every run;** copy films out first.
- **Vite reloads open pages when source files change;** don't edit source while browser tests run.
- **Tests written by the reviewer catch more than tests written by the agent that wrote the code.**

## Process
- **Test with one real person early,** watching over their shoulder, before building more: the practice project skipped it and called it its biggest gap.
- **The run log is the single source** for ghosts, the data table, the replay timeline, teacher review and any AI input: one record, many views, never a second copy.
- **Spike the riskiest model call on day 1** (SAM 3.1 on park photos, Muse Spark latency) and cut what isn't integral after the first playtest.

## Agents and the shell
- **One git worktree and branch per agent; one merge path that runs the quick tests.**
- **`pkill -f <pattern>` can kill the shell that runs it** when the pattern appears in its own command line.
- **`cp` may be an interactive alias that silently skips on overwrite;** use `\cp -f`.
- **zsh doesn't split words the way bash does;** pass arguments explicitly.
- **Run tests, commit and push as separate commands** (a guard checks the state before a command runs).
- **Long GPU jobs run in the background** with a log and a status check, never in a blocking call.

## Models and services
- **Muse Spark reasons before answering and counts that against `max_tokens`;** a small limit returns an empty answer.
- **Muse Image edits** (`/images/edits`) keep a style when given a reference image.
- **Meta API "contributor" models are cheaper but Meta may train on the inputs;** never send private data to them.
- **SAM 3.1 takes one noun phrase per request** and returns masks as base85 text.
- **Tripo P2 costs about 110 credits per character, from text or image, and now returns FBX.**
- **Keys stay out of the browser and out of the repo;** read them from private env files.

## Privacy and footage
- **Mask faces and bystanders before any model sees a frame;** keep only the motion.
- **Adults only in footage;** when unsure of age, skip the clip.
- **Openly licensed footage only:** Pexels by hand (no scripts), Commons, public-domain archives; never download from YouTube.
- **Usable clips have a still camera, a side or three-quarter view, the whole body and the ground in frame, and a normal lens.**
- **Scrub workspace names and home paths from committed logs.**

## Design
- **One rule with a tension carries the game:** "Speed gets you over the obstacle; speed also throws you off it."
- **Each obstacle has one physics saying,** earned by discovery, never a formula (`docs/sayings.md`).
- **A first-time player should clear a short course within 3 minutes.**
- **After a miss, one nudge (the one knob that matters, as buttons) beats a table of numbers.**
- **Hide obstacles too hard for the demo;** keep them documented, not deleted.
