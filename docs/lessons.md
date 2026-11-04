# Lessons: what we know before we start, and why

*Knowledge from a practice project and from experiments during the event (see `docs/PRIOR-WORK.md`).*
*Each lesson is a rule plus the reason; none of it is code.*
*Draft v0.1, 2026-10-27.*
*Worked lessons with pictures: [move creation](lessons-move-creation.md), [obstacle creation](lessons-obstacle-creation.md), [moves meeting obstacles](lessons-move-obstacle-interactions.md), [test on a different machine](lessons-cross-hardware-testing.md).*
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
- **Monkey-bar arms (CC-133):** CMU trial set 01 has hangs and kips but no hand-over-hand (22 hang stretches, none pass the travel check), and Kimodo ignores hand pins at 2.2 m overhead (hands stay near 1.1 m, grip error about 1 m, 0 of 16 samples pass); the procedural `src/motion/bars-pose.ts` is the clip source until a filmed capture exists.
  - Details: `data/eval/bar-motion/README.md`.
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
- **Where each model is weak, with numbers and evidence:** see [model limits](model-limits.md).
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
  - Size still comes from a typed or typical height; thin or long things (a shadow strip, steps) fail as a good skin: the lift keeps only part of the object or a flat slab, though it can still be placed and given a simple box or bar for collision (`data/eval/cc-upload-hard-set/README.md`, `data/eval/demo-lifts/README.md`).
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

## A tool that searches live must not make the player wait for what we already know (CC-90, 2026-11-01)
- The Slicer ran a live search every time and often said "cannot find a path" on places we had already proved.
- The proved line was stored with the place, but the Slicer never read it.
- Rule: if an answer can be found ahead of time, find it ahead of time, replay it in a test, and open on it; run the live check only when the person changes something.

## Made characters faced backwards (CC-108)
- A rule that picks an axis must also pick a direction: the maker's box fit found the line a body lies along but not which end is the face, so 3 of 8 characters ran backwards (see [character-facing-bug.md](character-facing-bug.md)).
- Measure, do not eyeball, and test in the view the player sees: the first facing fix was checked in a side-view demo that assumed the run goes along +x, not in the Course that players see.

## Street photos and people (CC-90, owner decisions 2026-11-01)
- A no-person detector rule threw away 90 percent or more of the photos in busy streets, so most famous places had no usable lane.
  - Reason: in a pedestrian street nine in ten photos have a person somewhere in them, usually small and far.
- The product owner made Mapillary's own face and plate blur the base standard (see `CLAUDE.md` and `docs/trust-and-safety.md`) and loosened our rule to reject only close-up or large people.
  - Why it is acceptable: we show pictures live, never store or copy them, never un-blur them, and report unblurred faces to Mapillary.
  - What stays true: Mapillary's blur is not a guarantee and the detector can miss a person, so say so wherever the photos show.
- A big Mapillary search box can come back short without any error (a third of the photos, or more), so earlier coverage counts were too low.
  - Fix: fetch in tiles of about 50 m and split any tile that returns 600 or more (`scripts/photos_pool.py`); a VM's own fetch was also short, so pools are fetched on the laptop.
- **Cut height should raise the ground.** The start deck stood at the cut height, so a high first roof was unreachable at low cuts; starting on the first roof took one place from 13 to 28 solvable heights out of 30 (see `docs/cut-height.md`).

## Film frames draw 5 times faster with llvmpipe than SwiftShader (CC-209, 2026-11-01)
- Chromium's default software path (SwiftShader) took 55 s for 20 frames on the laptop and 120 s on a Modal L4.
- The flags `--use-gl=angle --use-angle=gl-egl` made the same Modal container use Mesa llvmpipe and finish in 10.5 s (about 17 fps live).
- A GPU card did not help: Chromium never used it, so the gain is the renderer, not the hardware.
- Rule: check `UNMASKED_RENDERER_WEBGL` before trusting a "GPU" run; a silent fall back to SwiftShader looks like a slow GPU.
- A pixel check on four pages found the same 3D picture and slightly different text edges, so draw a whole film on one renderer.
- Numbers, gaps and next steps: `data/eval/film-render-speed/README.md`.

## Film shot 2 v2: record the real Slicer, do not draw over it (CC-143, 2026-11-01)
- The real flight (top view, buildings rise, low side camera) already is the slicing story; our old overlay only added jumps and pointless lines.
- Record the real page with a stepped clock (one step per picture): the flight is smooth and at true speed even on a software GPU, and real waits run with no pictures taken.
- The flight takes about 7 s of stepped time here; the first try timed out because a 60 s real wait was too short at about 0.5 s per picture.
- Two hard cuts remain in the live page and were handled: the first place click jumps the map (start the clip after it), and the flight starts from a wider view (a short cross-fade over 7 pictures).
- The editor load shows one blank picture; it is replaced by its neighbour.

## Film shot 2 v3: show the editor slowly, not the side panel (CC-143, 2026-11-02)
- The side panel scroll was 9 s of little happening; v3 keeps the flight and a quick pass, then spends about 9 s in the real World Editor.
- The sliced course already holds 31 pieces and the editor stops at 30, so a click on a real object adds nothing; the film shows the Real objects list and its by-move view instead.
- The place click flies the map from the whole country: let it finish with the clock moving and no pictures taken, then start the clip.
- The editor's Fit zooms so far out on a city-sized course that the picture washes out; use eased mouse turns instead.
- A stepped-clock film cannot show the mouse, so a glide over a still list looks still; count on card previews and eased turns for motion.

## Film shot 2 waited for a lane that a live pin-drop did not give (CC-143, 2026-11-01)
- What happened:
  - The first recorder for shot 2 dropped a pin at the Eixample centre, clicked Slice, and polled up to 180 times for the slicer to report a lane the simulator clears.
  - No lane arrived, so there was nothing to animate and no clip.
  - The script printed nothing while it waited, so it looked like a hang.
- Likely cause (read from the script and the stored place data, not from the old run log):
  - A fresh pin-drop often finds no cleared lane.
  - Eixample has only 4 candidate lanes proven (`docs/cut-height.md`).
- What we did: open a ready place whose stored result is a clear lane (Piazza San Marco, Venice, 68 m) and click Slice there.
- How to prevent it:
  - Order by dependencies: a shot that needs a proved lane first checks `public/assets/places/slicer-defaults.json` for a place with `clear: true`.
  - Use a ready place for every film shot that needs a lane; a live pin-drop is for the product, not for a film.
  - Fail fast: a wait loop prints what it waits for every few seconds and stops after a short limit with the reason.
  - A recorder that ends with no lane says "no proved lane" and stops; it never spends a long cloud run on nothing.
  - A blocked shot gets a note in its Linear issue at once, so the next agent does not rediscover it.
- A second run failed for a plain reason: the place list shows name and city in separate elements, so a text match on "Piazza San Marco, Venice" found nothing.
  - Test the click and the state locally for a minute before any cloud run.
- A third run drew a line the slicer had not proved: the slicer says "clearable" for about 1.5 s and then "not-clearable" at Piazza San Marco.
  - The recorder now needs a steady "clearable" for 3 s and stops with a message after about 10 s of "not-clearable".
  - The stored place defaults did predate the roof-start rule; they were re-run under it on 2026-11-01 (CC-200), check version 2, 47 of 47 places clear.
  - `tests/slicer-default.test.ts` now turns roof start on, so a stored `clear: true` is checked by the rule the live Slicer uses (`DEFAULTS_ALL=1` replays every place).
- Parallel agents: they made this no worse, but they hid it.
  - The stall was written into a commit message and not into the issue.
  - The agent working on proved lanes was another agent, so the two facts never met.
  - One agent reading the stored place data first would have avoided it; so would the dependency check above.

## A measured field changed a course's fingerprint (CC-224, 2026-11-02)
- What happened:
  - `windows` was stored in the course file and hashed by accident, so a plan re-measure would have moved the board of 8 courses.
- What we did:
  - `courseHash()` now leaves `windows` out, next to `plan`, `routes` and `shortcuts`.
  - The rule and the better recipe are in `docs/hash-design.md`.
- How to prevent it: before adding a field to the course file, decide if it changes play; if not, leave it out of the hash and add a test.
- A slip in the clean-up:
  - The first old-fingerprint list was made before this change, so 6 of its 14 fingerprints are in use again after it.
  - Rule: decide the fingerprint recipe first, then list the stale ones.

## The same keys give the same result, but not the same digits on every V8 (CC-133, 2026-11-03)
- What happened:
  - `tests/sim-trace.test.ts` failed on a VM with Node 22 and passed on Node 24, for six courses.
- Why:
  - `x ** 3` and `Math.pow(x, 1.5)` round differently in V8 12.4 and 13.6; sin, cos, exp, atan2, sqrt and the rest are identical between those two Node versions.
  - In workerd (Cloudflare's runtime) sin, cos, tan, exp, log, atan and the inverse trig functions give other last digits than in Node (found 2026-11-03); sqrt and hypot match.
  - The CPU does not matter.
- What is guaranteed:
  - Tick count, outcome and end place are identical on Node 22, Node 24 and workerd in 7,525 runs.
  - After the fix below, the stored hash is exact on Node 22 and Node 24.
  - In workerd the hash is exact for plank and plank-two, but not where the tick uses sin, cos, tan or exp (drone, lache, lache-wide and training plans).
- What we did:
  - The owner chose the fix on 2026-11-03: every `**` and `Math.pow` in the sim became multiplication and `Math.sqrt` (the patch missed some sites, so all of `src` was searched).
  - `tests/sim-no-pow.test.ts` fails if a power comes back anywhere a tick, a replay or a fingerprint can reach.
  - `tests/sim-trace.test.ts` now compares the hash on every Node; 15 of its 100 stored entries changed, no outcome, tick count or course hash did.
  - All 7,525 runs and both recorded runs gave the same ticks, outcome and end place (6 decimals) before and after.
  - The ready-made editor course `coaster` builds its rails with the changed arithmetic, so its stored key in `src/slice/preset-plans.json` moved (verdict unchanged: not cleared); `npm run plans:presets` was rerun and no other entry changed.
- How to prevent it: use only `+ - * /` and `Math.sqrt` in the sim step when you can; avoid `**` and `Math.pow`.
- Still open: exact bits in workerd need our own sin, cos, tan and exp in the sim step (or a tolerance there).
- Details: `data/eval/trace-machines/README.md`.
- Worked lesson with a picture: [test on a different machine](lessons-cross-hardware-testing.md).


## The ideal run now takes the monkey bars (CC-133, 2026-11-03)
- What happened:
  - The search knew bars and ropes but not rungs, so "Race the ideal run" had no ghost on the two bars demo courses.
- What works:
  - Both demo courses clear from the search alone (about 15 to 20 s of work on the laptop).
  - Windows, in ms of game time: bars course: take-off 84, release after the last reach 350, narrowest reach 42; pull-up bar to bars: take-off 84, hang on the bar 450 (ticks 22 to 74, plan 48), release 467, narrowest reach 50.
  - "Hang before the first reach" is wide (over 2 s) because a hang only costs time, so the plan takes the early side of it.
- Why a kip chosen by "first that clears" fails:
  - It clears by one tick: the narrowest reach window was 8 ms (one tick) until the kip and release were picked by most clearing neighbours.
  - Rule: pick the middle of a plateau, not the first point that works.
- Why the hands stay off after the last bar:
  - The hands-up rule caught the bar just let go of, a second hang that was not in the plan.
- Still open: row after row (more than one row on a course) and a row that needs a different kip per rung are not searched; the window widths are one timing at a time with the others at their best.
- Details: `docs/bars.md`, `tests/ideal-bars.test.ts`.

## Photo dots on the Slicer map (CC-133)
- Mapillary gives a photo's spot as `geometry` and a corrected `computed_geometry` (both GeoJSON, longitude first), and the compass the same way (`compass_angle`, `computed_compass_angle`).
  - Use the corrected one first; the camera's own compass can be far off (14.9 against 343.8 for one Edinburgh photo).
- `license` is not a Graph API field; asking for it makes the whole request fail, so the licence text is fixed (CC BY-SA 4.0) in the game.
- The dots come from the person-checked allow-lists, never from a live search of the view.
  - Reason: a live search would show photos that were never checked for close-up or large people.
  - Cost: dots exist only at places that have a list.
- Details: `data/eval/cc-133-photo-dots/README.md`; switch `?photodots=1` (on by itself on this computer and the preview site, off on the real site).


## Keep the successful run, not only the verdict (2026-11-04)

- A search that returns a good edit but discards its successful plan forces Preview to repeat the most expensive work.
- Carry the complete proof with its exact course input and reuse it through Apply and Play.
- Drawing windows are incomplete search evidence: filtering to position-based markers drops bar and device timings.
- Preserve full timing metadata separately, so “hardest press” refers to the actual measured bottleneck.
- Cancellation needs worker termination and stale-result guards; checking a flag between long synchronous calls cannot stop the current call.
- Parallel completion order must not decide which edit wins when the product promises small edits first.
- Compare equally bundled one-worker and two-worker paths before claiming a parallel speedup.
- Prefix reuse needs full controller and world snapshots, plus the loop's event and stuck bookkeeping.
- Identical-course replay equivalence does not establish safe reuse across changed geometry.
- [Methods, before/after diagrams and evidence](easier-search.md).


## Name the action and its engine (2026-11-04)

- Find a repair searches for changes; Verify Suggestions would imply checking an existing proposal.
- Put Simulator or AI · Muse Spark Open beside the action, not only in a tooltip.
- A model badge above mixed tools wrongly credits simulator work to the model.
- Keep the model badge beside the AI input and edit provenance separate from the simulator verdict.
- Share action labels and explanations between the menu, glossary and underlying controls.
- [Current action names and flow diagram](editor-proof-flow.md).


## A disabled action needs visible work in progress (2026-11-04)

- The preview worker already reported search stages, but a no-op progress callback hid them from the designer.
- Show the current timing search and elapsed time where the user is waiting for Apply.
- Keep progress outside the scrolling list of edits so a long proposal cannot hide it.
- Obstacle counts describe a search pass, not time remaining or a guarantee that the course clears.
- Keep Stop and Retry independent of the model request so retrying a simulator check does not spend another model call.
- Clear timers and ignore old worker reports when a preview is cancelled or replaced.
- [Preview progress flow](editor-proof-flow.md).


## Video focus and applied summaries (2026-11-04)

- For future videos, use highlights on the original UI; do not add enlarged duplicate views (owner preference).
- Put each applied change on its own line, separately from the simulator verdict.
- Make it easier candidate cards show layout search, while an AI proposal uses a single-preview check; explain the distinction.

### Show the search task, not only a step count (2026-11-04)

- The worker already reported which obstacle it was testing; the main lane panel discarded that label and showed only a count.
- Name the movement timings and show the reported position on a fixed lane diagram.
- Put activity above the lane controls so progress is visible without scrolling.
- A fixed diagram explains where calculation is happening without pretending to show individual simulator trials.
- Share task descriptions between the main simulator and AI Preview so they explain the same worker messages consistently.

### Name both timing bottlenecks, and show the accepted move (2026-11-04)

- A larger minimum window does not prove that the same press remains the bottleneck.
- Show the measured movement and position on both sides of the comparison, followed by the exact object edit.
- Keep the comparison after Apply so the reason for the change is still readable.
- Animate only the drawing after the final course commits; do not create intermediate simulation inputs or extra undo steps.
- For social clips, widen the highlight area on the original UI and label both outlines; a larger region is not a zoomed duplicate view.

### Attribute each action's actual engines and name the next step (2026-11-04)

- Trace direct button handlers before crediting a model; a tool can be used by an agent elsewhere while a direct click bypasses that model.
- The editor's three search tools use simulation algorithms; Ask AI for ideas calls Muse Spark Open with the layout and simulator findings, then simulator Preview checks proposed edits.
- Stage-specific pills credit both suggestion and checking without implying that every search is a model call.
- A negative check should lead to a concrete action: Find a repair searches and previews changes.
- Generic advice to widen a gap points in the wrong direction for many blocked lanes; use the repair workflow instead.

### Shared panels can hide different operations (2026-11-04)

- Find a repair and Ask AI for ideas both opened Course help, which made them look like duplicate actions even though one ran a physics search and the other called Muse Spark Open.
- The owner chose to remove the standalone repair action; blocked-course guidance now points to Ask AI for ideas.
- Removing a proposal source does not remove verification: the simulator still checks the exact preview and hands its result through Apply.

### A passing start belongs to one place and one state (2026-11-04)

- A lane-cache key containing only height, shrink and selected indices can match a different place; clear it and stop old workers when the place changes.
- A saved proof applies to its exact cut height and physics settings; clamping the height or changing hills needs a new check.
- Disable handoff as soon as an input changes, including during the debounce before the next search starts.
- Verify both sides of a handoff: all 51 prepared starts were replayed in the Slicer and reconstructed as World Editor courses, with 107 checks passing.

### A new obstacle needs its drum and its toast on the same day (2026-11-04, CC-133)

- The fork's bulb lane starts with a standing pole, but no key on the drum lane and no toast named it; the product owner could not find the high path.
- The cause was in three places:
  - the drum search made no drum for the pole grab;
  - the fork kept only drums after the fork line, and the pole sits just before it;
  - the toast code joined drums of the two ways, so a bench jump borrowed a bar toast.
- The fix: a grab drum and a `pole` toast row, drums of one way only are neighbours, and `tests/obstacle-teaching.test.ts` fails when a shipped course uses an obstacle field with no toast or hint.
- The short messages (hint, toasts, dimmed older hints) moved from the middle of the picture to one band in the sky under the obstacle strip (`src/ui/toast-band.ts`); `tests/toast-band.test.ts` keeps it clear of the runner in several camera states.
- Follow-up (2026-11-04): the drum lane still showed only the fastest way unless `?fork=1` was on, so the high path had no drums at all in a plain run.
  - The lane now draws both ways whenever a course has a fork.
  - The pole drum carries its own words, "Hold E to climb the pole", on a small two-line card (a long sentence on a round drum does not fit, and a wide one hid its neighbours).
- Toasts are now "N-back with N = 2" (`src/ui/nback.ts`, pure, `tests/nback.test.ts`):
  - the message now sits in the main slot;
  - the 2 before it sit dimmed above it, the older the dimmer;
  - a new message dims the one on screen, moves it up a slot, drops the oldest and takes the main slot.
  - A toast takes the main slot over the hint, so nothing piles up below.
- A bug worth remembering: appending a node that is already in the page restarts its CSS animation, so the dimmed rows slid forever until they were only added once.
- Limit: the page draws the messages once per frame, so a message that comes and goes between two frames never reaches the history.

## Promo v2 craft (CC-133, 2026-11-05)

- A stepped `performance.now` is not enough for the course: its loop times itself on the animation-frame stamp.
  - On a slow software GPU the run raced ahead (the whole run was over in 2 s of film).
  - The fix: hand the loop the stepped clock too (`rafStep` in `scripts/promo-v2/lib.mjs`).
- A bot run is only 6.9 s of game time, so three camera angles in 12 s need slow motion.
  - Step the game clock by half a frame per picture; every picture is still taken, so it stays smooth.
- One flight or load that is fine at true speed can be the longest part of a segment; take marks (`marks.json`) so captions and credit tags follow the beats and not guessed seconds.
- Keep the music in bars: a longer slot loops the last bars with a short crossfade, so the drop still lands on its clip.
- Do not hard-code Lab numbers in a script (names only); read them from the page by their visible text and keep the text in the params file.
- The Design partner needs a model key; a capture machine without one answers the call with a stand-in in the live format, and the docs say so.
- After pulling the latest `origin/main`, reshoot the segments that show changed screens; the drums, toasts and hint band changed between two pulls on the same day.


## Course switching: retain the expensive runtime (2026-11-04)

- A fast HTML response does not mean a fast course transition.
- Measure the outgoing document, renderer initialization, asset loading and first draw separately; the largest observed wait was before the next document's scripts began.
- Pausing the simulator alone leaves the old 3D scene drawing behind its gallery.
- Share immutable character assets, but clone skeletons and materials so the ghost cannot change the player's pose or opacity.
- Reusing a renderer requires an explicit course lifetime: close keys, timers, observers, searches, worker waits, DOM and owned GPU resources together.
- Terminating a worker is insufficient if its callers still await a promise; reject those requests during pool closure.
- Keep a runtime facade for application callers, so they follow the active course rather than retaining the disposed first session.
- Keep cold-load and course-switch measurements separate; software-renderer timings are diagnostic observations, not hardware-GPU or CDN promises.
- Method, before/after flow and results: [course loading](../data/eval/course-loading/README.md).
