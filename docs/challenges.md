# Challenges: the hard problems we already met, and the game's challenges

*Draft v0.1, 2026-10-27; knowledge from the practice project (docs/PRIOR-WORK.md).*
*Part A is the technical problems (solved or not); Part B is the game's obstacles and challenge modes; "Still open" points to the spec's risk table.*
*Related: [lessons.md](lessons.md) (the rules these taught), [pipelines.md](pipelines.md) (how each pipeline works), [experiments.md](experiments.md) (how we tested).*
*Every entry: symptom, root cause, what we tried (in order), fix or status, how to catch it early, cost where known.*
*Reference, not requirements: the spec decides; numbers are starting points to re-measure in this project.*

## Part A. Technical challenges

### A1. Motion data and time

#### Joint names one off
- **Symptom:** a clip measured from video drew knees bending backwards; the fit's error stayed around 12 cm however long it ran.
- **Root cause:** the body model's joint positions had no world root, but our list of names started with one, so every name sat on the next joint.
- **Tried:** more fitting steps (no change), then a joint-by-joint comparison, which showed the shift.
- **Fix:** assert that the names list and the joint array have the same length wherever they meet; handle older files by dropping the extra first name.
- **Catch it early:** a length assert at every boundary between two tools, and one rendered frame looked at by a person before any numbers are trusted.

#### The second clock
- **Symptom:** a clip played evenly spaced and at the wrong speed, with no error anywhere.
- **Root cause:** a typed-in frame rate replaced the real per-frame times measured from the video's dial.
- **Fix:** one clock per thing that has time, measured once and read everywhere; in the game, only the simulator's tick count.
- **Catch it early:** a test that every consumer (replay, ghost, recording, film) reads time from the same source.

#### Software-GPU video plays in slow motion
- **Symptom:** films from headless browsers looked like slow motion; timings judged from them were wrong.
- **Root cause:** software WebGPU renders a few frames a second, while the game clock runs on wall time.
- **Fix:** a stepped clock: replace the page's time function, advance it one frame per screenshot, encode at the game's frame rate; or retime by game time against wall time.
- **Catch it early:** stamp game time on every frame of a test film.

#### Stale reads of results files
- **Symptom:** a run's numbers came out identical to the previous run's, down to the seconds field, and led to a wrong conclusion that a fix did nothing.
- **Root cause:** the log line that signalled "done" was printed a few seconds before the results file was rewritten; the script read the old file.
- **Fix:** wait for the job to exit (or for the file's modification time to pass the job's start) before reading.
- **Catch it early:** print the results file's timestamp next to every summary.

### A2. Bodies, obstacles and Kimodo

#### The body passing through walls
- **Symptom:** in playtests the drawn character's body went into the curved wall.
- **Root cause:** the simulator's capsule collided correctly, but the drawn body was posed on the simulator's point and never checked; checking the skeleton alone would also have missed it, because the skin is centimetres outside the bones.
- **Tried:** measuring skeleton joints against boxes (misses the skin), then the skin itself.
- **Fix, three layers as games do:** poses that suit the surface (arms reach up on the steep part, the lean fades), push the whole drawn body out along the surface it entered, then re-plant the feet with two-bone IK; overlap on the wall went from 72.5 cm to 0.5 cm.
- **Catch it early:** a browser test that samples posed skin vertices every frame and reports the deepest one inside any obstacle.

#### Kimodo ignores edits to positions
- **Symptom:** hand and foot targets had no effect: results matched the prompt-only motion to the millimetre.
- **Root cause:** Kimodo carries its constraints through joint rotations and their hips; moving only the target joint's position gave it an impossible pose, which it ignored.
- **Tried in order:**
  1. moving the target joint alone (ignored);
  2. moving each joint's whole body separately (right side exact, left side 15-41 cm off, because each constraint carried different hips);
  3. moving the whole chain alone (ignored);
  4. one constraint per frame holding every joint pinned on that frame, the body moved by their mean offset, then each chain the rest of the way.
- **Fix:** the fourth, with the body shift eased over nearby frames.
- **Catch it early:** always run a prompt-only baseline in the same job; identical numbers mean the constraints did nothing.

#### Hips jumping at 20-25 m/s
- **Symptom:** the plausibility check flagged teleports on the frames where a contact began.
- **Root cause:** the body was shifted toward its contacts only on the pinned frames, so the hips jumped in and out.
- **Fix:** ease the shift in and out over 8 frames, smooth it, and move the hip path with it.

#### Kimodo has no idea obstacles exist
- **Symptom:** legs passed through the vault box (around 80-150 joint-frames inside) and limbs went into the tic-tac wall.
- **Root cause:** its inputs are text, the hip path and contact targets; nothing describes the scene.
- **Tried:** pushing hands and feet out between whole generations (helped a little, never reached knees and shins); then projection inside generation.
- **Fix (spike, 2026-10-27):** at each of the last 15 % of denoising steps, decode the prediction's joint positions, push joints and bone samples out of the obstacle boxes, write them back, continue; read the final pose from positions.
- **Result:** tic-tac 108 → 2-5 bones inside with contacts within 6 cm; kong vault 41 → 23.
- **Catch it early:** count bone-segment hits, not only joints, for every generated clip.

#### Reading positions skips Kimodo's foot clean-up
- **Symptom:** after projection the clips still failed the gate on foot slide, sinking, jitter and bone length.
- **Root cause:** the position block isn't passed through Kimodo's own rotation-side clean-up, which normally fixes feet and enforces constraints (the position block alone sits 16-30 cm off the targets).
- **Status:** our repairs (feet onto the floor, knee limits) cut the failures to three rules; their order matters (repairs first, contact IK last, or the repairs pull a wall foot 32 cm off).
- **Next:** rebuild bones at fixed lengths along the skeleton, smooth over time except on contact frames, lock feet while grounded.

#### The vault's hands out of reach
- **Symptom:** hands stayed 16-22 cm above the box top even after IK.
- **Root cause:** the text-made timing put the hand plant while the hips crossed the box; a clearance rule that raised the hips put the shoulders beyond arm's reach of the top.
- **Next:** clearance for legs and feet only, and the hand plant before the hips arrive, as in a real kong vault.

#### Other Kimodo limits (from the practice log)
- Text can't change gravity; the simulator owns the path.
- Constraints are soft during generation; dense keyframes plus its post-processing land them.
- Its floor is fixed where it was trained: keep landings on it.
- It never saw a 3.3 m rise: stretch a mid-range clip instead of generating extremes.
- Rolls barely turn over from text: build key poses by rotating the landing crouch a full turn.
- Hand targets crash unless constraints are built on the CPU and moved with `.to(device)`.
- Each model carries a 16 GB text-encoder copy: one model per GPU container.

### A3. Characters and rigging

#### Text gave a male-looking "female" character
- **Symptom:** the second rookie came out with a broad, muscular chest and a male face.
- **Root cause:** the prompt said "athlete" and never "woman"; Tripo's hidden concept image decided the look before we saw it.
- **Fix:** draw the reference image first (Muse Image, in the first character's style, reviewed for free), then image-to-model with texture alignment to the image and autofix off.
- **Cost:** one wasted generation (110 credits).

#### FBX instead of GLB
- **Symptom:** the rig script couldn't open Tripo's newer output.
- **Root cause:** Tripo's P2 model now returns FBX.
- **Fix:** import by file extension.

#### The wrong front
- **Symptom:** "front" renders showed the back of the head; the crouch bent knees backwards.
- **Root cause:** the automatic front check (toes ahead of ankles) misjudged both new meshes.
- **Fix:** a manual turn of 180°; check the front render first.

#### The shoulder 10 cm above the arm
- **Symptom:** raising the arms opened a gap between sleeve and arm.
- **Root cause:** the average-body skeleton was scaled to the character's height and only the arm stretched to the fingertips, so the shoulder pivot sat where an average body's is: 10 cm above this character's arm.
- **Tried:** smoothing weights by distance (hid the gap but blurred the joint); measuring joints from mesh vertices (put the shoulder in the neck, because the low-poly torso side has no vertices between big faces); measuring from surface samples (right).
- **Fix:** the shoulder at the armpit found from surface samples, elbow and wrist on one straight line through the arm's centre, the wrist at 7 % of the height from the fingertip (the thinnest-slab guess landed once inside the glove and once mid-forearm), no stretching; no weight smoothing needed.
- **Catch it early:** pose every new character on several real clips and look at the renders; weight-failure counts were low while the rig was wrong.

### A4. Photos, video and scale

#### SAM 3D Objects image build
- **Symptom:** the model's container wouldn't build or run on Modal.
- **Fixes, five:** NVIDIA's package index, the `wheel` package before pytorch3d, g++ instead of clang++ for C++ extensions, `CONDA_PREFIX` pointing at CUDA, and nvdiffrast.
- **Cost:** paid once; there was no hosted endpoint.

#### Size from one photo
- **Symptom:** shapes were right but sizes wrong (a bench a third of its real length); thin, stair-like objects came out as flat slabs.
- **Root cause:** one photo's depth doesn't fix scale; the mesh is upright in its own frame but tilted when placed with the camera's pitch.
- **Fix so far:** a typical height per object type; colour taken from the object's Gaussian splat; objects spaced about 7 m apart so a run can be timed.
- **Next:** a known-size object in the photo, or a metric depth model (the Apache-licensed MapAnything variant).

#### Video keypoints upside down and tilted ground
- **Symptom:** measured jumps leaned and their gravity came out at 23 and 5.7 m/s² instead of 9.81.
- **Root causes:** the body model's 2D keypoints are y-down; the camera looks down slightly; a clip starting on a wall top fooled the ground levelling (tilted 21°); the default focal length makes absolute size uncertain.
- **Fix:** level the ground between the first and last foot contact; rebuild the world from the camera (hip pixel position, smoothed depth, image up as up) when levelling fails; prefer still, side-on, normal-lens footage.

#### Monocular video scale
- **Status:** a measured wall came out 1.67 m; size needs a known object in frame or a fall check over a long enough flight.

### A5. Browser, tests and the dev loop

#### Headless WebGPU
- **Symptom:** `navigator.gpu` missing in headless Chromium; later, on another machine, the 3D canvas stayed blank.
- **Root causes:** WebGPU needs a secure context (only `http://localhost` pages); ANGLE's Vulkan backend couldn't start on one remote machine.
- **Fix:** test on localhost pages with SwiftShader flags; read the browser's debug output before blaming versions.

#### Vite reloading pages mid-test
- **Symptom:** browser tests failed at random while code was being edited.
- **Root cause:** Vite's hot reload restarts open pages when a source file changes.
- **Fix:** never edit source while the browser suite runs; give tests their own server.

#### Playwright wipes test results
- **Symptom:** films and screenshots from an earlier run disappeared.
- **Fix:** copy films out of `test-results/` before the next run, or write them elsewhere.

#### Rope browser tests after the honest catch
- **Symptom:** after the rope stopped flying to the hands (catch only within reach), the rope trial's browser tests failed: the run key was released too early after a late jump, so the ninja jumped straight up.
- **Root cause:** fixtures had relied on the old rule, and the ideal jumped too close to the pad's edge.
- **Status:** unresolved when tuning was paused; the lesson is that a "helpful" physics rule holds up every test and course built on it.

#### A guard test caught unchecked clips
- **What happened:** experiment clips placed among the game's motion files failed the "every shipped clip passes the gate" test.
- **Fix:** experiments live in their own folder; the guard test stays.

### A6. Machines, engines and services

#### Unity and Godot spikes
- **Unity (headless on a CPU VM):** first WebGL build with URP 12 min (shader variants), 5 min after any code change by default, 49 s with the "shorter build time" code optimisation and a warm editor; every cold editor start cost 25-40 s; the page was 63 MB.
- **Godot:** web build 10 s, page 41 MB (13 MB compressed), loaded in 9 s; C# can't export to the web; its browser editor is preliminary and needs special server headers.
- **Outcome:** blind tests rated both engines' looks the same; we stayed on three.js for load time, build speed and the HTML interface.
- **Lesson:** time the full feedback loop (edit to something the owner can see) before choosing a tool.

#### Safety checks on installs and uploads
- **Symptom:** the agent's permission checks refused installing a third-party editor plugin and creating a repository with a deploy key.
- **Status:** the product owner did those steps by hand; plan any install, upload or account step as an owner task.

#### Local RAM and remote machines
- **Laptop:** about 7 GB; a second browser run or a big model load forces the editor to reload; at most one browser suite at a time.
- **Codespace:** couldn't push (send code as a git bundle); a missing image tag silently gave an empty recovery container; rebuilds used its own checkout; it stops when a monthly limit is reached.
- **Modal:** the workspace caps at 10 GPUs; keep batches to 3 containers; long jobs run detached with a status script, because agent shells time out after about 30 s.

#### Model and data services
- **Muse Spark** reasons before answering and counts that against `max_tokens`: a 4,000 limit returned empty text; about 10,000 tokens and 40 s per target extraction.
- **Pexels** paused its API programme; downloading by script is against its terms, so clips are downloaded by hand.
- **YouTube's terms** forbid downloading, so it isn't a source.
- **Several web pages** (Tripo, some fan wikis) block automated reading; findings from search summaries are labelled as such.

#### Shell pitfalls
- `pkill -f <pattern>` killed the shell running it when the pattern appeared in its own command line.
- `cp` was an interactive alias that silently skipped an overwrite; use `\cp -f`.
- zsh doesn't split words like bash, so a loop over "a b c" strings passed one argument.
- The `!` prompt runs commands without a keyboard, so `read` can't take a pasted secret; use a file or a real terminal.
- A one-time login code is not a token: `claude setup-token` prints the real token after the code is pasted back.

## Part B. Game challenges (obstacles and modes)
*Earth gravity only; every saying from [sayings.md](sayings.md); fit to the new loop: Course (fast), Dojo (slow), Park (real world), Builder.*

| Challenge | What the player does | Sizes and design facts | Lesson and saying | Status | In the new loop |
|---|---|---|---|---|---|
| **Jump Lab** | Jump, change one knob, jump again | Flat pad; knobs launch speed, mass, landing squat | Flight fixed at take-off: "Once your feet leave the ground, the jump is already decided." | Kept | Dojo for the gap jump |
| **Drop & Splash** | Step off a tower and predict the fall time | Towers at 2, 4, 8, 16 m and a 27 m cliff dive into water | Falling and soft landings: "Soft knees, safe landing: the same stop, spread over more time." | Kept | Dojo; the soft-landing part joins the steps |
| **Curved Wall** | Sprint at a curve and grab a 4 m ledge | Run-up starts at 18, 8, 4.5 or 2 m; ledge about 4 m (M); grab when hands reach | Speed becomes height: "The wall can't lift you. It only spends the speed you bring." | Kept | Course obstacle and Dojo |
| **Trampoline** | Drop or run onto the mat and bounce to a far deck | Drops of 1, 2, 4 m; knobs spring count, stiffness, mass | Stored energy returns: "The harder you land, the higher it throws you." | Kept | Course obstacle and Dojo |
| **Rope Swing** | Run off the pad, catch where the hands meet the rope, swing, let go over water | 9 m rope, caught about 5.3 m down at the default; catch only within 0.35 m (0.5 m at its end); measured windows about 650-675 ms | Energy in a pendulum: "Let go too early and you fall short; too late and you fall back." | Kept | Course obstacle and Dojo |
| **Bike Ramp & Stop Line** | Jump a ramp, land, brake before a red line | Braking is grip × gravity (about 1.8 m from 6 m/s) | Grip limits stopping: "Your feet can only stop you as fast as they can grip." | Kept in the practice game | Not in v1 (no bike); the braking lesson moves to the sprint |
| **Mini Course** | One run: two gap jumps onto boxes, a trampoline with a pump, the rope, a curved wall | Seven graded drums, windows 108-267 ms; ideal chosen for flow (score about 88) | The whole course: "Speed gets you over the obstacle; speed also throws you off it." | Kept | The model for the v1 Course |
| **The Impossible Gap** | Time a run through two closing trucks | Gap open under a second; it ran itself on a traffic-light plan | Constant speed and timing | Hidden: "too difficult for a demo … as player i don't know how to engage" | Not in v1; would need the trucks shown moving first and a draggable plan |
| **Momentum challenges** | Four short primitive courses (standing wall step, gap carry, curved-ramp vault, spring to a high deck, soft drop) scored on speed carried | Completable from a standing start; score = clear + carried speed | Momentum and energy | Frozen | Ideas for Dojo drills |
| **Chase, Versus, Training, Pogo, Stamina** | A chaser, two-player push, body training, a pogo stick, an energy bar | — | Various | Frozen (off-camera, outside the course story) | Not in v1 |

### Combo Trials (timing as spacing)
- **Idea:** Street Fighter's combo trials (the moves are given, the timing isn't) plus Taiko's drum lane (the gap between notes is the time between presses).
- **Modes:** Timed (spacing is the ideal's timing), Order only (even spacing), Free.
- **The first run on a new obstacle is a lesson:** half speed, a one-line goal, the key's name under each drum; from the second run, full speed and no labels.
- **Honest drums:** a sensitivity pass nudges each drum by ±100 ms; a drum whose timing changes nothing is drawn hollow ("any time") and never graded (every final let-go, the trampoline's second jump).
- **Grades in words, never numbers:** Great, Good, Off, Miss; a clear in your own timing is "Your own line: it worked", never a failure.
- **Predict:** drag the drums, run the plan as a ghost, then play it; understanding and execution are scored separately; assist levels (Guided, Raw, Auto) protect understanding from slips.
- **For v1:** the drum lane becomes the Dojo's timing view and the Course's replay strip.

### Course sizes (XS to XXL)
- **Idea:** difficulty chosen like a shirt size before a run: gaps and walls grow, landing targets and holds shrink; M is competition standard (a curved wall around 4.3 m).
- **What broke at the extremes:**
  - XL fails only the Curved Wall (a 4.8 m wall is beyond a 9.5 m/s run);
  - XXL fails the wall, gap, rope and Mini Course;
  - XS made the trampoline-to-deck jump harder (the bounce must rise before it reaches the deck), so that distance stays fixed;
  - the Trampoline still clears at XXL and needs a second knob to get harder.
- **Lesson:** sizes need a clearing line searched per size, and a station with no line at a size must say so rather than offer a trial.
- **For v1:** later; the Builder's "how hard" score covers difficulty first.

### Playtest requests that shaped the design
- **A first-time player clears the experience within 3 minutes.**
- **Hide the Impossible Gap** (too hard, unclear how to engage).
- **Flat ground at station 7**, keys that follow the shown station buttons, "Landing squat" instead of "knee bend", gravity stops at zero, no steering in the air, faster braking and acceleration, a ledge catch instead of an instant splash, a camera switch.
- **Nudge after a Curved Wall miss:** the one knob that matters (Top speed) as buttons with a step, in words and no formula; a bot playing as a new player cleared the wall in at most four tries without opening the lab panel.

### Roadmap obstacles (not built)
- **Grand Course finale,** **Floating Platforms** (sink deeper under more mass), **Bar Ladder** (an arm obstacle), **Rolling Log**.
- Each must add one physics idea and get its saying before it's built.

## Still open
- Kong-vault motion, foot clean-up after projection, SAM 3.1 park photos (untested), monocular scale, Muse Spark latency, the rope trial tests, Tripo's commercial rights.
- Owners, mitigations and kill dates are in the spec's risk table ([spec §12](spec/SPEC.md)).
