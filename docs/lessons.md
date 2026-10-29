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
- **Decision (product owner, 2026-10-27): the game keeps motion capture for the Rookie for now.**
  - The run, leap, land, hang and swing clips are CMU motion capture, composed and blended to follow the simulator (the clip's progress follows the real flight, the body follows the arc, clips blend over 0.1 s, the hands reach the real ledge, the body gets ready before an obstacle).
  - Kimodo is reconsidered only when a move looks ugly and composing or blending clips cannot fix it; the Kimodo leap (`kimodo_leap.json`) stays in the repo, unused, for that day.
- **Kimodo cannot follow a hips path that rises more than about 2.5 m (CC-17 wall, 2026-10-27).**
  - Given the simulator's path and contact targets it tracked the run to within 5 cm but ended 2.4 m too low on a 4.3 m wall, in all 8 seeds; stronger constraint guidance made it worse.
  - So split a tall move into pieces that each stay inside that range, or track it with physics.
- **The simulator's wall grab is easier than a body can do:** at 7 m/s its grab tick has the hands 2.4 m from the hips, and an arm reaches 1.07 m.
- **A move check says what a clip shows; the gate only says a body could do it (CC-64).**
  - A front flip passed the gate as a "roll" until the check required a low body that keeps touching the ground.
  - Judge turning by the way the body faces, not the way it travels, or a backward somersault reads as forward.
- **CMU has no forward roll (CC-64):** its nearest takes are flips and a backward somersault; Kimodo text made 4 passing rolls in 18 samples (about $0.04), so a move with no source is a Kimodo job, not a dead end.
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
- **When an experiment fails, ask whether knowledge or tools were missing.**
  - Why: we tried to generate a wall run-up from text prompts alone and 0 of 36 samples worked.
    - We already knew the fix ("contacts need targets, not more words"); what was missing was the tools that supply the targets: a physics path for the body to follow and measured motion from real footage.
  - Rule: before an experiment, list the inputs it needs and check that each exists; if one doesn't, build it first or run the experiment in its strongest form.
  - A weakened experiment that fails is "not tested", not "failed"; report it that way so nobody drops a good idea.
  - Good plan order: the physics engine and measurement tools first, then the experiments that depend on them.

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

## Photos to 3D objects
- **A photo becomes a skin, never a collider, and colour must go in a texture.**
  - SAM 3D Objects gives a mesh that is upright in its own frame (z up) and a splat that holds the colour; keep both, drop the camera layout.
  - Vertex colours on 6,000 faces smeared a painted wall; a 1024 texture baked from the splat fixed it, and a wall that fills the frame needed padding to stop being lifted as a table.
  - Size still comes from a typed or typical height; thin or long things (a shadow strip, steps) fail.
  - Why: nine photos, three rounds, about $0.17 of GPU (`data/eval/cc-38-photo-to-3d/README.md`).

## Design
- **One rule with a tension carries the game:** "Speed gets you over the obstacle; speed also throws you off it."
- **Each obstacle has one physics saying,** earned by discovery, never a formula (`docs/sayings.md`).
- **A first-time player should clear a short course within 3 minutes.**
- **After a miss, one nudge (the one knob that matters, as buttons) beats a table of numbers.**
- **Hide obstacles too hard for the demo;** keep them documented, not deleted.

## Mobile work stopped (2026-10-29)

- Decision: the product owner stopped all testing and development for phones.
- Reason: the game needs many keys (E, V, X, C, Space, aim) and touch has too few controls.
- Reason: the hackathon timeline has no room for a second input design.
- The decision applies from commit `a6ebcb3` on `main` ("Obstacle strip keeps its id so the gold icons come back", Fixes CC-171), the last commit before the decision was written down.
- The last phone-width work before it: `3b28471` (CC-163, top-right buttons step below the time line) and `7367907` (CC-139, touch controls).
- That code stays in the game; nobody removes it and nobody tests it again.
- Phone behaviour that was already built stays: a challenge link opened on a phone says to play on a computer (CC-138, `35c0572`).
- Rule for agents: no 390 px screenshots, no narrow-screen fixes, no touch buttons in any issue.


## The ideal-run search: trial time caps and the route pair (CC-164, CC-176)
- The bar trials were cut at 25 s from the start of the run and the route trials at 40 s.
  - Once other obstacles came before the bars (Training: bars at 28 s), no trial reached them and the search did not clear at all.
  - The cap is now 25 s (40 s) after the time the runner needs to reach the obstacle (`lead` in `src/sim/ideal.ts`); a falling run stops at once, so this costs nothing for failures.
- The skip route changed the last press of the plan, whatever it belonged to.
  - It now changes the press that takes the runner to the first bar, and keeps the presses planned after the pair.
- Still true: the greedy search is behind a person's line on Training (4960 ticks against 4814 by hand).
  - A seed from the hand line, polished, gives 4784 (`scripts/seed-plan.ts`).
- A search result is not a limit; a seed that beats it is a finding.
- Checked on 2026-10-29: `tests/skip-route-later-edge.test.ts` as first written also passed on the old code, so it did not prove the fix.
  - It was rewritten so that it fails on the old code (see the test file).
- The table keeps only a hash of the keys, so a flagged human line could not be fetched back.
  - `migrations/0005_clear_keys.sql` adds a `keys` column for flagged runs only (not applied; needs the owner's yes).
