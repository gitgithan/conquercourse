# ConquerCourse: product and build spec (v0.1, 2026-10-27)

*The source of truth for the hackathon build.*
*Agents build from this; anything it doesn't say is decided in an ADR (`docs/adr/`) and noted here.*
*Format rule: bullets, one idea each, every sentence starting on its own line.*

## 1. In one breath
- **One-liner:** a ninja-warrior obstacle game on real physics, where real parks and real moves become the course.
- **Tagline:** *Train slow. Run fast.*
- **The rule with a tension (the game's spine):** *Speed gets you over the obstacle; speed also throws you off it.*
- **Who:** students aged 13-18 learning mechanics (up to the A-level formula sheet); their teachers, who review sessions later; obstacle-course and parkour fans, who build and share courses.
- **Why:**
  - Physics is the most visible science: forces are felt directly, so it can be taught by intuition and demonstration instead of memorised formulas.
  - PE and science are taught apart; real obstacles are expensive or dangerous.
- **Impact:** measurable prediction gains, players moving more in the real world, an open library of real human motion in real places.
- **The product owner's story (opens the demo):** learning game design and wanting to join the real and virtual worlds; a fan of obstacle courses, of people building their bodies and overcoming mental and physical obstacles; physics formulas are better felt than memorised.

## 2. Hackathon constraints (non-negotiable)
- **Event:** Meta Global AI Developer Hackathon, 2026-10-26 to 2026-11-04 9 PM ET, indie track (creativity, technical ambition, whether it works).
- **Scoring:** Impact 30 %, Use of Meta AI tooling 25 %, Technical depth 20 %, Demo 25 %; judges mostly watch the 3-minute video.
- **Bonus prizes we aim at:** Most Viral (X, by Nov 8), Best Build on Meta Open Weights (Glimmer on a partner), Community Vote (gallery, Nov 16), Best Agentic Use-Case, Best Creative Build (Muse Image or Wonder).
- **New work only:** the demo may show only work built during the event, and judges must be able to tell what is new; this repo starts empty on 2026-10-27, no code is copied from the earlier practice project, and `docs/PRIOR-WORK.md` says what came from before.
  - Knowledge, measured numbers and lessons carry over through this spec.
  - Assets made during the event (the two rookie characters, 2026-10-27) are ours; third-party data keeps its licence and credit (CMU mocap, Pexels and Commons clips); every reused asset is listed in `docs/ASSETS.md` with source and licence.
- **Banned categories:** "AI for education" chatbots and "sports analyzers or coaches".
  - So: no chat tutor; the game never grades or coaches a person's technique; AI agents build courses and measure physics, they don't talk players through lessons.
- **Never:** formulas on screen; Moon or low-gravity scenarios; robotics framing; footage of minors; secrets or the product owner's name in the repo.
- **Public repo:** required at submission; kept private until reviewed for secrets and names.

## 3. The product
### 3.1 The loop: Train slow, run fast
| Part | Pace | What the player does | What it teaches |
|---|---|---|---|
| **Course** | Fast, one take | Run the whole course with the keyboard; no pausing | Doing it under pressure |
| **Dojo** | Slow, reflective | One obstacle at a time: change speed, timing or the obstacle; predict, then test; the replay shows the ghost and the line that would have made it | The physics of that obstacle |
| **Park** | Physical | Photograph a real place → a course with real sizes; film a safe real move → the game measures it and overlays its prediction | What your own body and the real world do |
| **Builder** | Creative | Build a course for a friend; the physics proves it can be cleared and scores how hard | Mastery (P2, after the core) |

- **After a fall on the Course:**
  - instant retry from the start of that obstacle (one key, under a second);
  - a skippable 2-second replay of the moment it went wrong, with the one nudge (the knob that matters);
  - a "Train this obstacle" button opens that obstacle's Dojo with the player's own run loaded: offered, never forced;
  - after three falls on the same obstacle the offer becomes prominent ("Stuck? Take it apart in the Dojo."), still a choice;
  - first play shows no Dojo prompts until the first clear or the third fall on one obstacle (protects the 3-minute first clear).
- **Story:** a rookie training for the Grand Course; obstacles unlock in their Dojo, then are proven on the Course.
- **Physics sayings** (`docs/sayings.md`): each obstacle has one; shown only after the player discovers it (their predictions for that obstacle get close); collected sayings form the trophy cabinet.
- **First-time player target:** clears a short course within 3 minutes of opening the page.

### 3.2 Obstacles for v1 (all Earth gravity, 9.81 m/s²)
- Sizes and timings start from human ranges (`docs/learning-design.md`) and are tuned by playtests; the list itself is the v1 scope.
| Obstacle | Mechanic | Lesson | Saying |
|---|---|---|---|
| Gap jump | Sprint, take off, fixed flight | Flight is decided at take-off | "Once your feet leave the ground, the jump is already decided." |
| Quintuple steps / precision blocks | Short hops between blocks of different heights | Timing and stride; landing | "Soft knees, safe landing: the same stop, spread over more time." |
| Warped Wall | Run up a curve, grab the top if hands reach it | Speed becomes height | "The wall can't lift you. It only spends the speed you bring." |
| Rope Swing | Catch where the hands meet the rope, swing, release | Energy in a pendulum; release timing | "Let go too early and you fall short; too late and you fall back." |
| Trampoline | Spring bounce | Stored energy returns | "The harder you land, the higher it throws you." |
- Water below every gap: falling in is failure (splash, retry).
- Each obstacle exposes 2-3 knobs in the Dojo (for example run-up speed, take-off point, rope length); every value is editable, no limits, except gravity ≥ 0.

### 3.3 Controls (keyboard)
- → hold to run (sprint toward Top speed), Space jump / release, ↓ squat on landing, R restart, C camera (side, chase, eyes).
- No steering in the air.

### 3.4 Look and characters
- Stylised, matte, flat colours; side-on 2.5D camera; the character about 100 px tall.
- Two rigged characters: Rookie A (orange) and Rookie B (violet), player's choice; files and rig notes in `docs/ASSETS.md` (`public/assets/characters/rookie-a.glb`, `rookie-b.glb`).

## 4. Physics (the exact simulator)
- **Numbers in this section are starting values from the practice project** (rope length, catch reach, hand reach, sizes); the laws are requirements, the values are re-tuned by playtests and recorded in an ADR.
- **The simulator is truth:** the body's centre of mass follows the simulator; animation never changes physics.
- Fixed step 1/120 s, deterministic, pure TypeScript, no rendering dependency; Rapier is used only for broad-phase queries if needed.
- **Laws, each with a test that compares the simulator to the closed form:**
  - Sprint: speed rises toward Top speed with time constant τ = top / acceleration; braking is grip × g (Coulomb friction), exact closed form.
  - Flight: ballistic from take-off (gravity only); range and peak match projectile formulas within 1 %.
  - Warped Wall: speed into the curve converts to height (energy minus friction losses); grab when hands reach the top (hip height + reach 2.1 m vs wall top).
  - Rope: pendulum about the anchor with the grip point where the hands caught it (rope 9 m, caught about 5.3 m down at the default); period matches 2π√(L/g) for small swings; catch only when the hands are within 0.35 m of the rope (0.5 m at its end).
  - Trampoline: linear spring with damping; rebound height matches energy return.
  - Landing: squat time spreads the stop (impulse); a hard landing past a threshold is a stumble.
- **One clock:** game time comes only from the simulator's tick count; recording, replay, ghosts and motion use it (lesson ADR from the practice project).
- **Ideal runs:** a search finds each obstacle's ideal input timing and its clearing window in milliseconds, which sets difficulty and the replay's "line that would have made it".

## 5. Motion (how the body looks)
- **Skeleton:** NVIDIA SOMA 30 joints (Kimodo's), names and arrays always the same length (assert it).
- **Library, pre-generated offline:** per obstacle type × phase × outcome (clean, short-but-caught, slide back, miss), about 60 clips; speeds and heights handled by time-warp plus a small contact IK at runtime (one mid clip covers 3-7 m/s within 4 cm, measured earlier).
- **Sources:** Kimodo on the simulator's path (preferred for leaps: the owner's blind test chose it 3/3 over mocap), CMU mocap for everyday moves, measured video for moves nobody recorded.
- **Obstacle-aware generation (proven 2026-10-27):** Kimodo's prediction is pushed out of obstacle boxes on the last 15 % of denoising steps and read from positions, then two-bone contact IK; tic-tac 108 → 2-5 bones inside, contacts within 6 cm.
  - Open: the kong vault (hands short), foot clean-up.
- **Plausibility gate:** every clip passes before it ships: knees forward, knee range ≤ 165°, bone lengths, feet don't sink or slide, ballistic flight, no teleport, no jitter; supported phases (hands on a box, hanging) are marked so they're not judged as free flight.
- **Runtime posing:** bones aim at the clip's joint positions; hips on the simulator's path; a skin-overlap check pushes limbs out of obstacles each frame.
- **Experiment clips that haven't passed the gate never go in the game's motion folders.**

## 6. The Park (real world in, the hero beat)
- **Photo → course:**
  1. SAM 3.1 (Meta Model API) segments objects from text prompts, one noun phrase per request ("bench", then "wall", "rail", "ledge", "steps"), up to 16 objects; masks come back as base85 text.
  2. Scale: a known-size object in the photo or MapAnything (its Apache-2.0 variant only; the main model is non-commercial) on Modal for metric depth; fallback: typical sizes per object type.
  3. Each object fits a primitive (box, wall, bar, ledge) with its role (stand, grab, vault, hazard); SAM 3D Objects mesh as the skin when available.
  4. The course is spaced so a run can be timed, and the simulator proves it's clearable.
  - **Fallback (must exist):** the photo as backdrop with editable boxes the player drags onto the objects.
- **Filmed move → measured:**
  1. Privacy first: faces and bystanders masked (SAM 3, our own open copy on Modal) before any other model sees a frame; adults only; the video is deleted after processing.
  2. SAM 3D Body (Modal) → 30-joint motion on the clip's own clock; contacts found; the gate runs.
  3. The game overlays its prediction on the footage in a strobe style (Marey's chronophotography): the simulator's arc over the real jump.
- **Never framed as coaching:** the overlay compares physics, not technique.

## 7. AI agents and Meta models
| Job | Model | Where |
|---|---|---|
| Player photo to object: mask and suggestions | SAM 3 (open weights, our copy) | Modal |
| Character cut-out and video-frame segmentation | SAM 3.1 | Meta Model API (video frames at build time; the character maker's cut-out is live) |
| Community character pictures (live), Rookie B reference and posters (build time) | Muse Image | Meta Model API (Meta credit) |
| Course-designer agent: idea → course → simulator proof (a photo-in version was planned and built, then dropped 2026-10-31: scope is photo to object only) → adjust until clearable but hard | Muse Spark Open (open weights, serverless on Baseten, Fireworks and Modal); Muse Glimmer needs a dedicated GPU | Baseten; the fallback to Muse Spark on the Meta API was planned and is not built (see [docs/model-ledger.md](../model-ledger.md)) |
| Coaching text → timed contact targets for new moves (offline) | Muse Spark | Meta Model API |
| Code review of the simulator (development only; an agentic prize entry on the Course Agent was planned and is not claimed since 2026-10-31) | Muse Wonder | Meta Model API |
| Simulated students with misconceptions (evidence) | Meta open weights | Fireworks (planned, P2; no code calls it yet) |
| Body measurement, motion generation, 3D objects | SAM 3D Body, Kimodo, SAM 3D Objects, MapAnything | Modal |
- Keys live only on the server side (a Cloudflare Worker proxy); never in the browser or the repo (the API allows browser calls, but its docs say keys must not ship in browser code).
- SAM 3D Body and SAM 3D Objects are gated open weights, not on the Meta Model API: they run on Modal.
- Never send private data (player photos, clips) to the cheaper "contributor" models: Meta may train on their inputs.
- Muse Spark reasons before answering and counts it against `max_tokens`: set it high (≥ 16k) and cache results; it is offline-only until latency is proven.

## 8. Architecture
- **Front end:** Vite + TypeScript + three.js WebGPU (falls back to WebGL 2), HTML/CSS overlays for all UI.
- **Modules (`src/`):** `sim/` (pure physics, no three.js), `course/` (data, primitives, editor), `motion/` (clips, posing, IK, collision), `render/` (scene, characters, camera), `modes/` (Course, Dojo, Park, Builder), `ui/` (HTML overlays, sayings), `park/` (photo and video clients).
- **Pipelines (`pipelines/`, Python):** Modal jobs (SAM 3D Body, Kimodo with obstacle guidance, SAM 3D Objects, MapAnything), the plausibility gate and repairs, contact IK; each writes an experiment trail (`data/eval/<exp>/inputs`, `outputs`, `run.json`).
- **Data formats:** course JSON (primitives with roles and sizes, versioned); clip JSON (30 names, parents, fps, frames, geometry, gate report).
- **Backend (day 2):** Cloudflare Workers (static site + API proxy), D1 (courses, votes), R2 (uploads, auto-deleted after a day).
- **Big files:** outside git in `../conquercourse-assets/` with a checksummed manifest.

## 9. Testing
- **Tiers:** unit (laws, data formats), mechanic (one obstacle switched on), integration (the full course), browser smoke (boot, first clear, Park fallback); browser tests run headless with WebGPU flags on the VM.
- **Gates:** `npm run test:quick` must pass before any merge; the plausibility gate must pass before any clip ships.
- **Visual evidence:** a UI or motion change is done only with a screenshot or clip saved under `test-results/` and linked in its issue; films use the stepped clock so they play at true speed.

## 10. Demo (3 minutes, judges watch it)
| Time | Beat |
|---|---|
| 0:00 | Hook: a real gap in a park; "Can I make that?" |
| 0:15 | The owner's story in two sentences |
| 0:30 | **Hero:** photo of the park → SAM 3.1 → a course with real sizes |
| 0:55 | Course run at full speed, a fall, the Dojo: predict, test, the saying is earned |
| 1:40 | The clear |
| 1:55 | The real person tries the safe move; the game's arc over the footage |
| 2:25 | How it works: Meta models at each step, the physics proof, agents building courses |
| 2:45 | What's next: the open motion library, community courses; "Train slow. Run fast." |
- **Capture:** at least 85 % real product capture (Playwright with the stepped clock, or OBS); Muse Image stills for titles; the owner's own voiceover; captions from Muse Voice Transcribe; edited with Remotion or a simple editor.
- **AI video generators:** Sora's API and Veo previews are closed; Meta's video model isn't released; free tiers are watermarked or non-commercial; use none for core shots.
- **Vertical cuts for X:** three 15-30 s clips (the park becomes a course; a fall and the clear; the arc over real footage).

## 11. Build plan for the first unattended run (7 hours, agents on the VM)
- **Milestones, in order; each is a Linear milestone with sub-issues (one testable outcome each):**
  - **M0 Repo skeleton (blocks all):** Vite + TS + three.js, test runner, lint, CI script, folder layout, `docs/ASSETS.md`, the quick-test gate, the merge script.
  - **M1 Simulator (blocks M2, M3, M4):** sprint, flight, landing, gap, steps, warped wall, rope, trampoline, water; each law with its test; ideal-run search.
  - **M2 Course and Dojo (needs M1):** a 5-obstacle course, keyboard controls, the Dojo with knobs, predict and test, ghost and ideal line, sayings earned and shown, the first-clear target.
  - **M3 Characters and motion (needs M0; joins M2):** load the rigged rookies, pose from clips, the starter clip set (run, leap, land, hang, swing, wall run-up and grab), contact IK, skin-overlap push-out.
  - **M4 Park (needs M1; can start in parallel):** photo → course with SAM 3.1 and the editable-boxes fallback; the strobe overlay of the simulator's arc on a filmed jump (start from the openly licensed clips in `docs/ASSETS.md`).
  - **M5 Demo capture (needs M2-M4):** scripted films of each demo beat with the stepped clock.
- **Lanes (parallel agents):** sim, gameplay/UI, motion/characters, park, test and review; each in its own git worktree and branch; a single merge script rebases, runs the quick tests and fast-forwards `main`.
- **Commits:** one logical change per commit, one issue per commit, magic words in every message ("Part of CC-12", "Fixes CC-12" only on the finishing commit).

## 12. Uncertainties, what blocks what, and mitigations
| Risk | Blocks | Mitigation | Kill or switch date |
|---|---|---|---|
| SAM 3.1 API shape and quality for park photos | Hero beat | Test day 1 on 10 photos; editable-boxes fallback built anyway | Day 2: fallback becomes the demo path |
| Real-world scale from one photo | Park sizes | Known-size object in frame; typical sizes per type | Day 3 |
| Obstacle motion quality (vault, foot clean-up) | Looks on obstacles | Pre-generated library checked offline; mocap + IK fallback; fewer moves | Day 3: ship only moves that pass |
| Muse Spark latency (40 s with reasoning) | Live agent features | Offline and cached; Glimmer on Baseten for live use | Day 2 |
| Partner credits (Baseten, Fireworks) not granted | Open-weights prize, bot students | Muse Spark fallback; Modal for Glimmer | When the answers arrive |
| WebGPU on school devices | Reach | WebGL 2 fallback; test on a low-end laptop | Day 4 |
| Backend not built | Sharing, vote, uploads | Cloudflare from day 2; local-only until then | Day 4 |
| Scope creep | Everything | Must/Should/Could per milestone; the demo uses only what's proven by day 5 | Day 5 freeze |
| Agents' usage limits during unattended runs | Build speed | The loop sleeps and resumes; small tasks; tests as gates | Each run |

## 13. Data we may not find online, and how the owner can collect it
- **Footage we can use today:** four Pexels clips (static camera, adults): jump over an obstacle, precision jumps between blocks, monkey bars, over a brick wall; credit each creator and link Pexels.
- **Likely gaps:** tic-tac, cat leap and climb-up, warped-wall run-up, rope swing, trampoline, soft landing, a filmed real gap for the hero beat.
- **Self-filming (the product owner, an adult), safe low versions only:**
  - Phone on a tripod, landscape, side-on, 3-5 m away, whole body and the ground in frame, normal lens (not ultra-wide), 60 fps if possible.
  - A known-size object in frame (a 1 m stick or a box of known height) for scale.
  - Clothes that contrast with the background; no bystanders, no minors in frame.
  - Moves: standing jump, running jump across chalk lines, step-up and drop from a low box with soft knees, a precision jump between two low blocks, a low vault, a roll on grass, a hang on a bar with a small swing; 3 takes each.
  - File names `move_take_YYYYMMDD.mp4`; the owner consents in writing in `docs/ASSETS.md` for their own clips.
  - The hero beat needs one real park gap filmed both as a photo (for the course) and as a video of the safe attempt.

## 14. Open decisions (product owner)
- Make the repo public: at the first reviewed checkpoint, before submission.
- The motion dataset licence and the age policy for uploads (proposed: players 13+, uploaders 18+, raw video never kept unless opted in).
- Tripo commercial rights for the rookies (check the plan); the rookies were made on 2026-10-27, inside the event.
