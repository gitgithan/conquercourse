# ConquerCourse

*Train slow. Run fast.*

A ninja-warrior physics game where real parks, real streets and real objects become the course.
Built for the Meta Global AI Developer Hackathon (2026-10-26 to 2026-11-04), indie track.
Live: https://conquercourse.pages.dev/

## What it is
- Pick a place on Earth, or a photo of a park, and the game builds a course there.
- Run, jump, vault, swing and climb it in a deterministic physics simulator.
- Learn the physics by trying: every obstacle has one saying, earned by playing it, never a formula on the Course.
- Share a world; the simulator proves it can be cleared before anyone else plays it.

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
| **MusicGen (Meta AudioCraft)** | Writes the original loop for each screen (Course, Map, Editor, Dojo, Report) from a text prompt; no melody or recording goes in | Build time (Modal GPU); loops stay off until `?music=1` |
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
