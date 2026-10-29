# ConquerCourse

*Train slow. Run fast.*

A ninja-warrior physics game where real parks, real streets and real objects become the course.
Built for the Meta Global AI Developer Hackathon (2026-10-26 to 2026-11-04), indie track.
Live: https://conquercourse.pages.dev/

## The problem we solve
Three needs, each with who feels it, why it hurts, and what the game does.
These are reasoned from how people learn and play; we have not run user research yet (our belief, not a measurement).

### 1. People skip physics because it arrives as symbols
- **Who:** anyone who met physics as a page of formulas and decided it was not for them.
- **Why it hurts:** a formula with no felt meaning cannot be remembered or reused, so the person stops trying.
- **What we do:** the player first feels the idea in their hands.
  - Every obstacle has one saying that is earned by playing it, for example how speed helps one move and hurts another.
  - Nothing on the Course shows a formula.
  - The Dojo adds the exact formula once, as the last step, after the person already knows the shape of the idea.
  - The Labs show equations for people who ask for them.
- **Why a game:** the simulator is the same on every run, so the same move always has the same result, and the person can test an idea again and again.

### 2. People know their own city and little beyond it
- **Who:** anyone who has only seen the parks and streets near home.
- **Why it hurts:** places stay abstract names on a map, and there is little reason to look closely at them.
- **What we do:** pick a place on Earth and its real buildings become a course.
  - The player runs along real streets and rooftops, and sees what is there.
  - Real street photos from Mapillary (CC BY-SA, credited, people removed) show what the place looks like.
  - A friend in another country opens the same course from a link.

### 3. Making a course is hard, and sharing an unfair one is worse
- **Who:** a player who wants to build or share a challenge.
- **Why it hurts:** a course that cannot be cleared wastes everyone's time.
- **What we do:** the simulator proves a course can be cleared before it is shared, and tells the maker in plain words what to change when it cannot.
  - Photos of real objects become obstacles.
  - A link lets a friend replay the exact run in the browser.

### What we do not do
- We do not grade or coach a person's technique.
- We do not use a chat tutor.
- The physics is Earth only.

### Who it is for
- Curious players, students who found physics dry, and teachers who want something to hand out.
- The ninja-warrior look is the hook; the real places and the felt physics are the reason to stay.

## What it is
- Pick a place on Earth, or a photo of a park, and the game builds a course there.
- Run, jump, vault, swing and climb it in a deterministic physics simulator.
- Learn the physics by trying: every obstacle has one saying, earned by playing it, never a formula on the Course.
- Share a world; the simulator proves it can be cleared before anyone else plays it.

## Features in the order a player meets them
- Diagram links point to [docs/meta-ai-pipelines.md](docs/meta-ai-pipelines.md) (called "pipelines" below) unless another file is named.
- "After pull" marks work that was still landing when this was written; if the switch does nothing, pull first.
- Keys: arrows or A/D run, Space jump, S squat, E hold, V vault, X roll, R retry, H key card.

### 1. Play the Course
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Deterministic physics | A runner that moves the same way every time | Always on | [pipelines 7](docs/meta-ai-pipelines.md#7-not-ai-but-the-core-of-the-game), [SPEC 8](docs/spec/SPEC.md) |
| Moves: run, jump, hold, vault, climb, roll | Captured vault and climb clips play by default | Keys above; `?clips=0` shows the built poses | [pipelines 2](docs/meta-ai-pipelines.md#2-video-to-motion-sam-3-sam-3d-body-mhr), [motion pipeline](docs/motion-pipeline.md) |
| Generated motion | Run, leap and hang motion from text, shown only after the plausibility check | Always on | [pipelines 3](docs/meta-ai-pipelines.md#3-generated-motion-kimodo-with-a-llama-3-encoder) |
| Obstacles with one saying each | The saying is earned by playing the obstacle; no formula | Always on | [sayings](docs/sayings.md), [stages](docs/stages.md) |
| Ideal run and shortcuts | A ghost line that shows the best way and any shortcut | `I` for one try, `Shift+I` for the whole course; `?bot=ideal` | [pipelines 7](docs/meta-ai-pipelines.md#7-not-ai-but-the-core-of-the-game), [world-slice](docs/world-slice.md#shortcut-discovery-cc-71) |
| Gauges and readable HUD | Bright text on dark panels for speed, time and hints | Always on; `?gauges=old` for the old look | [course design](docs/course-design.md) |
| Touch controls | On-screen buttons on a phone | Automatic; `?touch=1` or `?touch=0` | [onboarding](docs/onboarding.md) |
| First visit help | A short welcome and the Help chip | `?welcome` or `?onboarding` | [onboarding](docs/onboarding.md) |
| Welcome screen with a slow pan over a real 3D world and music (after pull) | A dimmed real place behind the start screen | Opens by default once it lands | [pipelines 6](docs/meta-ai-pipelines.md#6-real-places-and-photos-mapillary-masking) |

### 2. Learn
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Dojo lessons | Four steps: why it matters, try it, the shape, then the exact formula once, at the end | `T` or `?mode=dojo`; `?dojo=old` for the earlier layout | [learning design](docs/learning-design.md) |
| Course picker | Press `T` in the Dojo to pick a course | `T` | [onboarding](docs/onboarding.md) |
| University Labs | Equations are allowed here, nowhere else | `?labs=1` | [university labs](docs/university-labs.md) |
| Course cards with stats | Plays, simulator-verified clears, best verified time, difficulty | Always on; `?stats=0` hides them | [course stats](docs/course-stats.md) |

### 3. Make
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Editor with real objects | 19 real objects (bench, low wall, hydrant and more) to place on a lane | `?mode=editor` | [pipelines 1](docs/meta-ai-pipelines.md#1-photo-to-obstacle-sam-3-and-sam-3d-objects), [editor UI](docs/editor-ui.md) |
| Map and Slicer | Pin a place on Earth; its buildings become a course | `?mode=map` | [pipelines 6](docs/meta-ai-pipelines.md#6-real-places-and-photos-mapillary-masking), [world-slice](docs/world-slice.md#why-a-pin-is-slow-and-the-speed-up-cc-152) |
| Ready places | 18 parks that load at once | In Map mode | [world-slice](docs/world-slice.md#why-a-pin-is-slow-and-the-speed-up-cc-152) |
| Design partner and Fix it | A note on why a course cannot be cleared and one proved change | Editor buttons | [pipelines 4](docs/meta-ai-pipelines.md#4-course-design-partner-and-photo-to-course-draft-muse-spark-open) |
| Photo to course draft | A course drafted from one park photo | Editor, "Photo to course (labs)" | [pipelines 4](docs/meta-ai-pipelines.md#4-course-design-partner-and-photo-to-course-draft-muse-spark-open) |
| Course Agent | A list of steps: proposed, tested, repaired, done | `?agent=1` or `?labs=1`, then "Course Agent (labs)" | [pipelines 4c](docs/meta-ai-pipelines.md#4c-course-agent-propose-test-repair-stop-when-proven-muse-spark-open) |
| Upload check and move tips | An ok, review or block answer; moves that could pass a cut-out | On upload | [pipelines 4b](docs/meta-ai-pipelines.md#4b-upload-check-and-move-tips-muse-spark-open) |
| Generate a course | A course from a seed | `?generate=<seed>` | [world-slice](docs/world-slice.md#course-generator-v1-cc-47) |
| Characters | The Rookie and a second Rookie in the first one's style | Always on | [pipelines 5](docs/meta-ai-pipelines.md#5-characters-muse-image) |

### 4. Share
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Challenge link | A link whose keys the simulator replays, so the time cannot be faked | End report, "Copy challenge link"; `?share=0` hides it | [challenge](docs/challenge.md), [viral plan](docs/viral-plan.md) |
| Three-letter tag | An optional tag so a friend sees who to beat; never a real name | The "Tag" box in the end report | [challenge](docs/challenge.md) |
| Clip of a run | A 15 second vertical clip with about 20 m of course in view | End report, "Make a clip"; `?clipshape=wide` for 16:9 | [viral plan](docs/viral-plan.md) |
| Every try can be a clip | The fall panel offers a clip too | After a fall | [viral plan](docs/viral-plan.md) |
| Ghost | Your best run, or a friend's, beside you | `?ghost`; `N` cycles chips | [challenge](docs/challenge.md) |
| Community gallery | Courses made from real photos | `?mode=gallery` | [world-slice](docs/world-slice.md#the-courses-gallery-cc-89) |
| End report sections, restart chip (after pull) | Download and Copy first, a restart hint during a run | End of a run | [viral plan](docs/viral-plan.md) |

### 5. Sound and look
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Music | An original loop for each screen | On by default; `M` mutes; `?music=0` | [pipelines 5b](docs/meta-ai-pipelines.md#5b-music-musicgen-from-meta-audiocraft), [music](docs/music.md) |
| Live street photos | Photos along a built place, people masked | In Map mode | [pipelines 6](docs/meta-ai-pipelines.md#6-real-places-and-photos-mapillary-masking) |
| Drone and front view | A fly-over and a side view of the course | `C` camera, `F` front view | [drone](docs/drone.md) |
| Debug view | Why a swing worked | `B` | [world-slice](docs/world-slice.md#debug-view-fix-it-and-the-helper-window-2026-10-28) |

### 6. Under the hood
- The whole system: [pipelines, the whole system](docs/meta-ai-pipelines.md#the-whole-system).
- Recipes with exact settings: [docs/pipelines.md](docs/pipelines.md).
- What did not work: [pipelines, what we tried](docs/meta-ai-pipelines.md#what-we-tried-that-did-not-work).
- Architecture: [SPEC section 8](docs/spec/SPEC.md).
- Tests: [docs/testing.md](docs/testing.md).
- Checks on a submitted clear before and after the server replay: [docs/run-checks.md](docs/run-checks.md).
- Features with no diagram of their own: tag, ghost, gauges, touch controls, drone, debug view; each links to its doc instead.

## Input actions by obstacle
- Read from `src/modes/course.ts` (key card and key handler), `src/share/touch.ts` (button names) and the constants in `src/sim`.
- Touch buttons press the same keys: ◀ ▶ run, Jump (Space), Bend (↓), Hold (E), Vault (V), Roll (X), Restart (R); on a course with a cannon also Aim ▲ (↑) and Fire (K).
- A key pressed in a text box does nothing.

| Obstacle | Keys | Touch buttons | What happens | Explained in |
|---|---|---|---|---|
| Flat run | ← → or A D, held | ◀ ▶ | Speed builds up to 9 m/s and drops when you let go | [world-slice](docs/world-slice.md), [SPEC](docs/spec/SPEC.md) |
| Step or curb | Nothing up to 0.3 m; Space above that | Jump | The runner steps onto a curb up to 0.3 m without jumping | [world-slice](docs/world-slice.md) |
| Gap (water below) | Space at the edge, → held | Jump, ▶ | A ballistic jump; touching the water ends the run | [pipelines 7](docs/meta-ai-pipelines.md#7-not-ai-but-the-core-of-the-game) |
| Hard drop | ↓ or S held, or X as you land | Bend, Roll | Bending softens the landing; Roll must be held in the last 0.15 s and about a metre up | [world-slice](docs/world-slice.md#roll-and-survivable-drops-cc-56) |
| Vault box (top 0.35 to 1.3 m) | V while running at 3 m/s or more | Vault | A hand on top, over and on, keeping 92 % of the speed; a V up to 0.2 s early counts | [world-slice](docs/world-slice.md#the-speed-vault-cc-68) |
| Wall to climb (edge 1.0 to 2.83 m) | Hold E at the wall | Hold | Hands reach 0.9 m in front (0.6 m plus 0.3 m of tolerance) and an edge up to 2.45 m over the feet; a bright rim shows the ledge that answers to E; grab, hang 0.25 s, pull up, stand at 2 m/s; the run speed is lost and the cost is two jumps of energy | [world-slice](docs/world-slice.md#climb-cc-76) |
| Bar in the air (first grab within 0.6 m of the hands) | Hold E to grab, ← → to pump, let go of E to release | Hold, ◀ ▶ | A pendulum swing; where you let go sets the flight | [world-slice](docs/world-slice.md#the-lache-swing-pivot-at-the-bar-full-circles-a-real-release-cc-58) |
| Lache bars (a pair) | Hold E, pump, let go, hold E again at the second bar | Hold, ◀ ▶ | Regrab inside an ellipse 1.2 m across and 0.6 m high; the ideal run proves a pair | [world-slice](docs/world-slice.md#holds-and-the-lache-pair-cc-44-2026-10-28) |
| Warped wall | Run up the curve, hold E for the last 0.5 s | Hold | The hands must be on the edge when the feet reach the top; without E the body slides back (`?warpedE=0` brings the old rule back) | [inputs](docs/inputs.md) |
| Rope | Reach it; Space lets go | Jump | The catch is automatic where the hands meet the rope (0.35 m, 0.5 m near the end); a pendulum follows | [pipelines 7](docs/meta-ai-pipelines.md#7-not-ai-but-the-core-of-the-game) |
| Trampoline | Space at the bottom of the bounce | Jump | A press within about 0.05 s of the deepest point adds 2 m/s; it fades over 0.11 s | [world-slice](docs/world-slice.md) |
| Ramp or hill | → held; Space at the top | ▶, Jump | Runs on the curved ground; a coaster track adds ↓ or S to brake | [world-slice](docs/world-slice.md#running-and-jumping-on-curved-ground-fixed-2026-10-27) |
| Cannon (recoil) | K to fire; ↑ ↓ or W to tilt while loaded | Fire, Aim ▲ | The ball goes back and you go forward; dots show the landing | [world-slice](docs/world-slice.md#recoil-momentum-is-conserved-cc-66) |
| Trebuchet | → held, then Space, ↑ or W at the hint | ▶, Jump | Pull the pin, then let the rider go when the hint says so | [world-slice](docs/world-slice.md#the-trebuchet-cc-62) |
| Elastic band | ← held, then → held | ◀, ▶ | Stretch it, turn, and it throws you | [world-slice](docs/world-slice.md#elastic-band-cc-65) |
| Drone | E on the pad to board, ← → lean, ↑ ↓ climb or descend, release E to step off | Hold, ◀ ▶ | The drone flies where it leans; a landing above 2.5 m/s down or leaning over 0.35 rad crashes | [world-slice](docs/world-slice.md#the-drone-ferry-cc-87), [drone](docs/drone.md) |

### Not verified, and rows the code does not have
- Hold-E rules follow CC-168 and are listed in [inputs](docs/inputs.md): a 0.3 m forward and 0.25 m upward tolerance on wall ledges, none on bars or ropes, and E held on the warped wall.
- Keys A, D, S, W are read in the input line (`course.ts`); I did not run each one in a browser.
- The touch pad has no Up or Down button except Bend (↓) and, on a cannon course, Aim ▲ (↑).
- Whether the drone's climb (↑) can be done by touch is not shown by the code I read.
- The vault timing and the rope release (Space) were read from the key card text and constants, not traced in `src/sim/world.ts`.
- E is read as a held key (`handL` and `handR`), so letting go of E releases a bar.
- The warped wall (a curved run-up) is in `src/sim/wall.ts` and the Dojo; I found no course key for it, so it has no row.
- "Low bar or shimmy", "water as a swim" and "ramp keys" were asked for; the code has no shimmy, and water only ends the run, so they are not rows.
- Trampoline and band numbers are from `src/sim` constants, not measured in a run.

## What to playtest
- Tick these in a browser at http://localhost:5173 after `git pull --ff-only`.
- Say what looked wrong in one line; a screenshot helps.

### The Course
- [ ] Run the Training course; the run feels the same twice.
- [ ] Vault (`V`) over a bar: the hands land on the bar and the clip does not jump.
- [ ] Climb (`E` near a ledge): the hands reach the ledge.
- [ ] `?clips=0` still shows the built poses.
- [ ] Roll (`X`) after the second lache drop in the all-moves course.
- [ ] `I` shows the ideal run; `Shift+I` shows the whole course, with the shortcut on the all-moves course.
- [ ] The speed, time and hint text can be read on a bright and on a dark course.
- [ ] `R` retries; the restart hint is easy to see (after pull).

### Learn
- [ ] `T` opens the Dojo in a warm, light colour theme.
- [ ] A lesson has four steps, one graph, and the formula only on the last step.
- [ ] `T` inside the Dojo opens the course picker; there is no floating Courses pill.
- [ ] Course cards show plays, clears and difficulty; `?stats=0` hides them.

### Make
- [ ] Place a bench and a low wall in the editor; Play draws the real objects.
- [ ] Pin a ready park in Map mode; the course builds in a few seconds.
- [ ] Pin a street with no ready place and note how long it takes.
- [ ] "Fix it" on a course that cannot be cleared.
- [ ] `?agent=1`: run the Course Agent on a park photo and read the step list.
- [ ] Upload a photo: the check answers ok, review or block.

### Share
- [ ] Clear a course, type a tag, copy the challenge link, and open it in a private window.
- [ ] "Make a clip" gives about 20 m of course in view; `?clipshape=wide` gives 16:9.
- [ ] Download works on a built-in course, not only on an editor course.
- [ ] Fall, then make a clip from the fall panel.
- [ ] The end report has Download and Copy where you see them first (after pull).
- [ ] Open the Community gallery and play one course.

### Sound and the first visit
- [ ] Music plays on each screen; `M` mutes; `?music=0` is silent.
- [ ] `?welcome` shows the welcome screen with a slow pan over a real place (after pull).
- [ ] On a phone, the touch buttons work and the page does not scroll.

## Meta models: what each one does in the project
Blue-box diagrams for every pipeline are in [docs/meta-ai-pipelines.md](docs/meta-ai-pipelines.md); recipes with exact settings are in [docs/pipelines.md](docs/pipelines.md).

| Meta model or service | Feature it supports | Runs |
|---|---|---|
| **SAM 3 / SAM 3.1** | Cuts a real object out of a photo by name (also the glowing box in the demo film's real-to-course shot); blurs faces and people in video before any body is measured | Build time (Modal GPU) |
| **SAM 3D Objects** | Turns a photo and its mask into a 3D object: the 19 real objects in the editor (bench, low wall, hydrant, concrete pipe, canal railing and more) | Build time (Modal GPU) |
| **SAM 3D Body + MHR (Momentum Human Rig)** | Measures a person's body and pose from video; the motion clips and the custom-look body come from it | Build time (Modal GPU) |
| **DINOv3** | Image encoder inside SAM 3D Body | Build time (inside SAM 3D Body) |
| **Meta-Llama-3-8B-Instruct** | Text encoder inside Kimodo (NVIDIA), which generates the run, leap and hang motion | Build time (Modal GPU) |
| **Muse Spark Open** (`meta-models/muse-spark-open-1026`, on Baseten) | The Course Agent: from one photo it proposes a course, the simulator tests it, and it repairs the course from the simulator's report until it is proven clearable or the step cap is reached; also the in-editor design partner and "Fix it", and the one-shot photo-to-course draft | Live, through a server function (needs the `BASETEN_API_KEY` secret) |
| **Muse Spark Open**, upload check (`/api/moderate`) | Looks at an uploaded photo or object preview and answers ok, review or block with one reason; errors become review (CC-120) | Live, through a server function (needs `BASETEN_API_KEY`); called by the moderation queue (CC-112) |
| **Muse Spark Open**, move tips (`/api/move-tips`) | Names the moves that could get past a cut-out object and gives one plain idea for the course; checked against our move list (CC-121) | Live, through a server function (needs `BASETEN_API_KEY`); feeds the object cards (CC-108) |
| **Muse Spark** (Meta Model API) | Turns written descriptions into contact targets and character descriptions | Build time |
| **Muse Image** (Meta Model API) | Draws the second Rookie in the first one's style (concept reference) | Build time |
| **MusicGen (Meta AudioCraft)** | Writes the original loop for each screen (Course, Map, Editor, Dojo, Report, Library) from a text prompt; no melody or recording goes in | Build time (Modal GPU); loops play by default, `?music=0` turns them off |
| **Mapillary** (owned by Meta) | Street photos along a built place, masked for people before they are shown | Live, through a server proxy (token never in the browser) |

### What is not Meta, said plainly
- **NVIDIA:** Kimodo and the SOMA-X skeleton.
- **Microsoft:** MoGe 2 (depth).
- **Third parties:** Tripo (character mesh), TRELLIS.2, Pixal3D.
- **PyTorch / torchvision:** Mask R-CNN and Faster R-CNN find people for the photo mask; they are Meta-originated open-source tools but not a hackathon model, and SAM 3 is the possible upgrade.
- **Motion capture:** CMU Graphics Lab database, used under its licence.
- **Film tools:** Remotion (cuts, captions), Playwright and ffmpeg (capture and encode), and the CC0 track "Scaling Up" by Ruskerdax; see [docs/film-toolchain.md](docs/film-toolchain.md).

## Meta tools in development (not game features)
- These helped us build the game; the game itself does not call them, and they are not counted as game features.
- **Muse Wonder** (`muse-wonder-1.0`, Meta Model API) reviewed the simulator code (CC-133, 2026-10-29).
  - It read 4 chunks of `src/sim` and made 21 claims.
  - We checked each one with a test or by reading the code: 13 real, 7 false alarms, 1 unclear.
  - None of the real ones breaks a shipped course; 2 were fixed at once, 11 are tracked in CC-140.
  - Cost: $2.38 for the run, about $0.18 per real bug.
  - It did well on the physics code and gave nothing useful on the contraptions chunk.
  - Details: [data/eval/cc-wonder-review/README.md](data/eval/cc-wonder-review/README.md).
- **Muse Spark Open** (on Baseten) also helped as a dev aid: bulk course drafts (CC-122) and photo triage (CC-123); the same model is what the Course Agent uses in the game.
- **Muse Wonder** and **Muse Spark Open** also judged photo cut-outs for a gate before the 3D lift (CC-145, 2026-10-29): bash.60 for 46 calls each way, and neither earned a place in the game; the free mask-edge check did the useful part.
  - Details: [data/eval/cc-145-triage-v2/README.md](data/eval/cc-145-triage-v2/README.md).

## How it answers the judging criteria

### Impact (30%)
- **Real world in, real world out:** a player stands in a real park, sees it become a course, and learns what a real body does there.
- **Physics learned by doing:** each obstacle has one saying, found by playing it (Dojo lessons earn the formula as the last step; the Course never shows one).
- **Makers, not only players:** the editor, the Slicer (a course from real streets) and the photo-to-object tool let anyone build; worlds are shared only after the simulator proves them clearable.
- **Safe by design:** no sign-in, no real names, no footage of minors, people masked in photos, a photo is rejected when masking fails.
- **Not a coach:** the game never grades or coaches a person's technique.

### Use of Meta AI tooling (25%)
- Ten Meta models and services are in the table above; each does one job a judge can see or hear in the demo.
- MusicGen composes the music: original loops from text prompts, so the soundtrack has no licensed songs in it.
- The two live ones (Muse Spark Open, Mapillary) sit behind server functions, so keys never reach the browser.
- The models propose and the simulator decides: every layout from Muse Spark Open is run through the ideal-run search before it is offered.
- The Course Agent closes the loop: the model proposes, the simulator is its tool, and it repairs from the tool's report (see the agentic use-case section below).
- Cost and speed were measured, not guessed (for example $0.164 for 14 photos through SAM 3 and SAM 3D Objects).

### Technical depth (20%)
- **Deterministic simulator:** 120 Hz, pure TypeScript, key presses replay to the same result; golden hashes guard it.
- **Ideal-run search:** finds the best line and any shortcut, and proves a course can be cleared.
- **Plausibility gate:** no motion is shown before it passes the checks (bone lengths, knees, foot sliding, ballistic flight).
- **Contact IK:** hands and feet are pinned to the obstacle.
- **One clock** for physics, motion and film; a stepped clock for films.
- **Failures reported:** PartLLM hang-point finding (2 of 9 parts, 11 false claims) and the two-stage wall climb are written up in [docs/lessons.md](docs/lessons.md) and [docs/experiments.md](docs/experiments.md).

### Demo (25%)
- Three-minute script: [docs/demo-script-v2.md](docs/demo-script-v2.md).
- How the film is made, and how to render it again: [docs/film-toolchain.md](docs/film-toolchain.md) (film camera, labels that stay on their part, Remotion project in `demo/`).
- Beats: a pin on the map becomes a world; a photo becomes an object; the design partner fixes an unclearable course; the lache pair swing, with the debug view showing why it worked.

## Bonus prizes
- **Most Viral:** every cleared run can be shared as a challenge link or a 15 second vertical clip (CC-126).
  - The link carries only the keys of the run; the simulator plays them, so the time cannot be faked.
  - The clip is made in the browser on a stepped clock; the plan is in [docs/viral-plan.md](docs/viral-plan.md).
- **Best Build on Meta Open Weights:** Muse Spark Open runs the design partner (see the table above).

### Best Agentic Use-Case: the Course Agent
- **The task:** turn one park photo into a course that the simulator has proved can be cleared.
- **The loop:** Muse Spark Open proposes a layout; the simulator is its tool (can it be cleared, where does the best attempt stop, which single change is proved to clear it); the model repairs the layout from that report; it stops at the first proof or at 6 steps.
- **Autonomy:** no person is in the loop between the photo and the result; the player watches each step as a list (proposed, tested, repaired, tested, done).
- **Effectiveness:** measured on 10 photos, 20 runs each way; numbers and the honest caveats are in [data/eval/cc-126-course-agent/README.md](data/eval/cc-126-course-agent/README.md).
- **Honest when it fails:** at the cap it says it could not prove the course, and keeps the best attempt the simulator tested; it never offers a layout the simulator has not seen.
- **Turn it on:** `?agent=1` or `?labs=1` in the editor, then "Course Agent (labs)".
- **Diagram:** [docs/meta-ai-pipelines.md](docs/meta-ai-pipelines.md), section 4c.

## What is new, and what is not
- The repository starts on 2026-10-27; no code from the earlier practice project is used.
- Third-party material and licences: [docs/PRIOR-WORK.md](docs/PRIOR-WORK.md).
- Every asset, its source and licence: [docs/ASSETS.md](docs/ASSETS.md).

## Run it
- `npm ci`
- `node node_modules/vite/bin/vite.js` and open http://localhost:5173
- `npm run test:quick` runs the fast checks; `npm run test:fast` runs the full set.
- Deploying: [docs/deploy.md](docs/deploy.md).
- Keys live in private files outside the repo; none are committed.

## Where to read more
- Source of truth: [docs/spec/SPEC.md](docs/spec/SPEC.md)
- What we learned and why: [docs/lessons.md](docs/lessons.md)
- Pipelines with diagrams: [docs/meta-ai-pipelines.md](docs/meta-ai-pipelines.md)
- Stages and courses: [docs/stages.md](docs/stages.md), [docs/course-design.md](docs/course-design.md)
