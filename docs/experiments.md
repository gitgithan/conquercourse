# Experiments: how to design them, what they taught, and how to set up and test

*Draft v0.1, 2026-10-27; knowledge from the practice project (docs/PRIOR-WORK.md).*
*How each pipeline works is in `docs/pipelines.md`; this doc is about running experiments and tests, and what each experiment changed.*
*Reference, not requirements: the spec decides; numbers are starting points to re-measure in this project.*

## 1. Patterns that worked
### Blind A/B tests with the key held back
- Show two versions of the same thing with labels hidden and the order shuffled; ask "which looks better?" and "which is the real one?"; keep the key in a file the tester never sees; reveal only after the answers are in.
- **Came from:** the motion blind test (Kimodo vs motion capture on the same character, same viewer, same camera: Kimodo chosen 3 out of 3, and the real person was spotted 3 out of 3 as "weak, not explosive") and the engine test (Unity vs Godot on the same warped-wall slice: "Same" twice).
- **Why it matters:** both results overturned a confident prediction (that mocap would win; that the engine mattered for looks).
- **Design rules:**
  - Everything identical except the thing being judged: same body, same camera, same lighting, same clip length window.
  - Clip length can give the answer away; trim to the action window.
  - Check nothing on screen names the source (a HUD, a watermark, a file name).
  - Run the physics check first; people only judge clips that already pass it.

### A baseline and a treatment in the same run
- Every treatment run also produces the untreated version from the same seed and inputs, so the difference is the treatment's effect, not noise.
- **Came from:** "prompt only" vs "with targets" (contact errors 27-195 cm → 0-15 cm), "no guidance" vs "guided" collision projection (bones inside obstacles 108 → 0-5), "Kimodo alone" vs "on the simulator's path" in the obstacle blind clips.
- **Rule:** report both columns in the results table; a number without its baseline can't be read.

### One change per round, with a written hypothesis
- Write before running: "if X, then metric M moves from A to B, because C".
- **Came from:** the book-moves rounds (5 runs, one change each: move the whole pose per target, use the simulator's own wall run, lower the hips in the wall phase, keyframe every 2 frames) and the collision spike (3 rounds: decode from positions; protect pinned joints and bias the push upward; lift hips over low boxes).
- **Why:** when two changes go in together and the result moves, nobody knows which one did it; the spike's round 2 only made sense because round 1 had isolated "rotations ignore edited positions".

### Pass criteria fixed before running
- The plan states the pass line ("bone hits zero or 90 % fewer", "contacts under 10 cm", "GPU under 60 s per move") before any result exists.
- **Came from:** the collision spike plan and the stretch experiments (`beyond-training`).
- **Why:** after the fact, any result can be talked into a pass; a fixed line keeps "close" honest (the vault was reported as a fail, not "nearly").

### Grids for coverage
- When the question is "how many clips do we need?", generate a small grid across the parameter (six jump speeds, 3-8 m/s) and measure each one against its neighbours after time-warping.
- **Came from:** the library-size grid: one mid-speed clip, stretched, covered 3-7 m/s within 4 cm (about 2 pixels at game zoom); Kimodo's own variation between runs (3-4 cm) was the floor; the 8 m/s clip failed the check.
- **Decision it changed:** the motion library grows by move and outcome, not by speed or height.

### Measure error in the unit that matters
- Centimetres for contacts and paths, milliseconds for timing windows, joint-frames (or frame × bone pairs) for collisions, degrees for knees, m/s² for fitted gravity.
- A proxy that sounds right can hide the failure: a heat-weight count said the rig was fine while the renders showed a shoulder gap.
- **Rule:** pick the unit a player would notice, and also look at the frames.

### An experiment trail per run
- Each run saves `data/eval/<experiment>/inputs/` (exactly what was sent, never keys), `outputs/`, `run.json` (commit, model versions, seed, GPU, timings, cost) and a README with the command, the result table and the verdict.
- Big outputs (motions, meshes, videos) go outside git with a `SHA256SUMS` manifest; the README points to them.
- **Why:** several later questions ("which Kimodo commit?", "what did the request look like?") were answered from these files in minutes.

### Cost and GPU time recorded
- Every run states its GPU type, minutes and estimated cost; every paid generation states credits before and after.
- **Typical numbers:** a Kimodo generation 5-20 s on an L4 (model load about 7 s); a six-clip grid 34 s; SAM 3D Body on a short clip 8-20 GPU minutes; a Tripo P2 character 110 credits; a Muse Spark target extraction about 10,000 tokens and 40 s.

### Stop rules and kill dates
- Each line of experiments has a stop rule ("stop at 'close' if the remaining error is only visible up close") and a date to switch to the fallback.
- **Came from:** the book moves (stopped at 11-30 cm because the move that matters, the wall grab, already reached the ledge) and the decision to keep the curved-wall grab rather than chase a perfect vault.

## 2. Catalogue: experiments whose lessons change decisions
| Question | Setup | Metric | Result | Verdict | Design lesson |
|---|---|---|---|---|---|
| Can Kimodo follow the simulator's path with no text? | NVIDIA's leap as pose source; simulator arc; keyframes at take-off/landing, then every 8 and every 4 frames; 3 seeds; L4 | Off our arc (cm), fitted gravity, feet off in flight | Sparse keys glide or wobble; every 4 frames: 0.5-2.2 cm off, gravity fitted exactly, feet off 100 % | Pass | Dense keyframes from the simulator replace the text's "leap" idea |
| Do one leap's poses fit very different arcs? | Same method on a hop, a big jump, several gravities, a 4 m drop | Off our arc, fitted gravity | Jumps within 3 cm in every gravity; the drop drifted 7-14 cm | Pass for jumps, fail for drops | A new phase (falling) needs its own pose source |
| How many clips does a jump need? | Six speeds 3-8 m/s, time-warped neighbours compared | Body-pose RMS (cm) | One 5 m/s clip covers 3-7 m/s within 4 cm; 8 m/s jitters | One clip per move | Grow the library by move and outcome; stretch for extremes |
| Can text add gravity? | Prompts "on the Moon", "astronaut hops", plain jump; 3 seeds | Fitted gravity | 6.4-11.1 m/s² whatever the words | No | Text picks the move; the simulator supplies the physics |
| Which text moves are usable as a pose source? | Six parkour prompts, text only | Watched frame by frame | Wall run and roll usable; cat leap partly; vault, precision jump, tic-tac not | Mixed | Contacts need targets, not more words |
| Do hand and foot targets work? | Rope grip, vault, cat leap with targets | Target error (cm), joints inside | Cat-leap hang 6 cm (pass); vault hands 0 cm but legs through the box; rope still 155 cm off | Mixed | A target nudges a pose, it can't create one; Kimodo has no idea obstacles exist |
| Does the guidance weight matter? | Text/constraint weights [1,2] to [4,2] with every air frame pinned | Hip error, feet-first share | Identical | No effect | Once constraints pin everything, they decide |
| Do body proportions break motion? | Legs ×1.3, chibi, head and arms alone (CPU) | Floor contact, gravity | Feet sink or float 21-25 cm; fixed by feet on the floor on ground frames | Fixed | Retargeting needs a floor pass |
| Can the six book moves be finished? | Five rounds, one change each | Target error, joints inside | Roll pass (414° turn from rotated key poses); others "close" at 11-30 cm | Stopped by the stop rule | Move the whole pose per target; make key poses when text can't |
| Do obstacle clips look right on the simulator's run? | Blind pages per obstacle: on-the-path vs Kimodo alone vs held pose | Hips off the path; watched | Hips 0.0 cm everywhere; drop, trampoline and rope looked wrong | Mixed | Hips are easy; contacts and phases are the hard part |
| Why did the body go through the warped wall? | Skin-vertex overlap measured per frame in four scenarios | Deepest skin depth (cm) | 72.5 cm → 0.5 cm after poses-for-surface, push-out and foot IK | Fixed | Check the skin, not the skeleton; three layers, as games do |
| Mocap or Kimodo for leaps? | Blind A/B, three pairs, same character | Owner's picks | Kimodo 3/3 | Kimodo | Lab mocap is too gentle for "explosive" game leaps |
| Does the engine change the look? | The same slice in Unity and Godot, blind | Owner's picks | "Same" twice | No | Choose the engine by workflow, load time and team speed |
| Can Kimodo avoid obstacles with no retraining? | Push its prediction out of boxes inside the denoising loop; 3 rounds | Bone hits, contact error, GPU s | Tic-tac 108 → 2-5 bone hits, contacts ≤ 6 cm; vault 41 → 23, hands short | Partial pass | Late projection read from positions works; constraints live in rotations |
| Can coaching text become contact targets? | Wikibooks / Wikipedia text → Muse Spark → timed targets | Target plausibility, then Kimodo error | Sensible targets in 40 s; wall foot at 1.15 m vs 0.77 m measured from video | Works, not accurate | Use video as the outside judge that calibrates text |
| Can video give contact targets? | Public-domain tutorial; masking; SAM 3D Body; contact detection | Target error after Kimodo | 3-14 cm, but 331 joint-frames inside the wall | Contacts yes, collisions no | Monocular scale is uncertain (a wall measured 1.67 m) |
| Does V-JEPA 2 "surprise" flag impossible physics? | Possible vs impossible clip pairs (gravity flip, teleport, speed-up, pass-through) | Peak predictor error | 2.02-2.06 for both, no separation | No signal | Don't build a physics judge on it; the simulator is the judge |
| Can Muse Glimmer plus SAM 3 find affordances in a photo? | Playground photo, questions like "somewhere safe to land" | Masks proposed vs kept by the check | 7-9 masks proposed, 0 kept | Fail as wired | Validate each stage alone before chaining (the check, not the planner, was the bottleneck) |
| Does a new character rig correctly? | Two Tripo characters; renders in T-pose, arms up, crouch; then nine real clips | Renders, not counts | Front reversed (knees backwards); shoulder 10 cm above the arm; fixed by turning and measuring joints | Fixed | Judge rigs by renders in many poses |
| Which stock clips are usable? | Seven Pexels clips, contact sheets | Camera, view, age | 4 usable (still camera, side view, adult); 3 rejected | 4/7 | Moving or wide-angle cameras break scale and ground; skip when age is unsure |

## 3. Setup tips
### Modal (GPU jobs)
- Start long jobs detached (`modal run --detach`), in the background, with a log file and a separate status check; never in a call that blocks for minutes.
- Keep at most 3 containers at once (the workspace caps at 10 GPUs, and batches over-subscribe easily).
- Put the Hugging Face token (gated Llama 3 text encoder) in a Modal secret; weights in a named volume so each run doesn't download them again.
- One model per function: two models each carrying a 16 GB text encoder in one warm container ran out of memory.
- Write results to the local machine from the local entrypoint, not to the container's `/tmp` (a run once saved its rotations where they never came back).
- Image builds for 3D research code needed: the NVIDIA package index, `wheel` installed before pytorch3d, g++ instead of clang++, `CONDA_PREFIX` pointing at CUDA, and nvdiffrast; read the build log every time.
- A results file can be written seconds after the job prints its last line: wait for the file's timestamp to change before reading it.

### The Vultr VM (extra compute)
- Claude Code logs in once (`ssh -t <vm> claude`); the login survives reboots but not a new VM.
- A deploy key that can push only to this repo; keys copied as private files (mode 600), never echoed.
- Hand it self-contained tasks on their own branches; pull, review and merge on the laptop.
- A stopped VM still bills its disk; delete what you stop using.

### Remote machines in general
- Set PATH in the environment config, not in `.bashrc`, so non-login shells see the same tools.
- Know whether a box rebuilds from git, from an upload or from a cached checkout.
- Move code without credentials (a git bundle) when the box shouldn't hold a token.
- Know the memory budget before scheduling: about 7 GB on the laptop (one browser at a time), 32 GB on the VM, 3 GPU containers on Modal.

### Blender headless
- Run Blender as a Python package from its own environment; FBX and GLB both import.
- Workbench and Eevee need EGL, which WSL lacks: render check images with Cycles on the CPU.
- Generated meshes arrive split at texture seams and at odd scales: merge duplicate vertices and rescale before weighting.

### Headless WebGPU and true-speed filming
- Pages must be served from `localhost` (secure context), with SwiftShader Vulkan and an ANGLE backend the box supports; when the canvas is blank, read the browser's GPU log first.
- Software rendering is slow, so live recordings play in slow motion: replace `performance.now` with a stepped value in an init script, advance one frame per screenshot, then encode at the game's frame rate.
- Faking the whole clock (Playwright's clock API) also freezes screenshots; fake only the timer the game reads.

## 4. Testing tips
- **Tiers:** unit (no simulation), mechanic (one mechanic switched on), integration (everything), browser smoke (boot checks only, about a minute), feature browser tests, full browser suite (before pushing); keep smoke small, it creeps.
- **Physics-law tests first:** the simulator is deterministic, so laws are tested without a page in milliseconds; the browser tests only what needs a page.
- **Feature-filtered runs:** every test carries a feature tag; a map from feature to tests lets one feature's tests run in seconds; a test fails if any test lacks a tag.
- **`vitest related <file>`** runs only tests that import a changed file.
- **Guard tests:** every shipped motion clip passes the plausibility check (it caught experiment clips placed among game assets); every declared knob or feature exists; the demo profile names real features.
- **Flaky causes:**
  - Vite reloads the page when a source file changes mid-test: don't edit source while browser tests run.
  - Playwright empties `test-results/` at the start of every run: copy films out first.
  - Software-GPU recordings play slowly: film with the stepped clock, retime by game time.
- **Tests written by the reviewer catch more than tests written by the agent that wrote the code;** for delegated work, give exact test cases in the task.
- **Evidence:** a UI or motion change is done when a screenshot or clip shows it; for motion, contact sheets at fixed moments (25, 50, 75 % of the clip) across several clips and bodies.

## 5. Mistakes not to repeat
- **Reading a results file before the job finished writing it:** a "no change" result was really the previous run's file; check timestamps.
- **Trusting counts over renders:** 36 failed weights looked fine; the renders showed reversed knees and a shoulder gap.
- **Moving one joint to meet a target:** gives the model an impossible body (30-108 cm misses); move the whole pose.
- **A second clock:** a typed frame rate replaced real per-frame times; one clock only.
- **Name lists one longer than the data:** shifted every joint; assert equal lengths.
- **`pkill -f <pattern>` killing its own shell** when the pattern is in its command line.
- **`cp` as an interactive alias** that waits for an answer and then skips the copy; use `\cp -f`.
- **zsh word splitting:** a loop that splits a string into arguments in bash passes it as one argument in zsh.
- **Long blocking calls:** foreground waits time out; start in the background and poll.
- **Faking the browser's whole clock:** screenshots hang.
- **Moving camera or ultra-wide footage:** breaks ground and scale for body measurement.
- **Putting experiments next to shipped assets:** the guard test fails, rightly; experiments get their own folder.
