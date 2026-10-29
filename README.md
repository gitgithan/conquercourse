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
| **SAM 3 / SAM 3.1** | Cuts a real object out of a photo by name; blurs faces and people in video before any body is measured | Build time (Modal GPU) |
| **SAM 3D Objects** | Turns a photo and its mask into a 3D object: the 19 real objects in the editor (bench, low wall, hydrant, concrete pipe, canal railing and more) | Build time (Modal GPU) |
| **SAM 3D Body + MHR (Momentum Human Rig)** | Measures a person's body and pose from video; the motion clips and the custom-look body come from it | Build time (Modal GPU) |
| **DINOv3** | Image encoder inside SAM 3D Body | Build time (inside SAM 3D Body) |
| **Meta-Llama-3-8B-Instruct** | Text encoder inside Kimodo (NVIDIA), which generates the run, leap and hang motion | Build time (Modal GPU) |
| **Muse Spark Open** (`meta-models/muse-spark-open-1026`, on Baseten) | The in-editor course-design partner and "Fix it", and the photo-to-course draft; the simulator checks everything it suggests | Live, through a server function (needs the `BASETEN_API_KEY` secret) |
| **Muse Spark Open**, upload check (`/api/moderate`) | Looks at an uploaded photo or object preview and answers ok, review or block with one reason; errors become review (CC-120) | Live, through a server function (needs `BASETEN_API_KEY`); called by the moderation queue (CC-112) |
| **Muse Spark** (Meta Model API) | Turns written descriptions into contact targets and character descriptions | Build time |
| **Muse Image** (Meta Model API) | Draws the second Rookie in the first one's style (concept reference) | Build time |
| **Mapillary** (owned by Meta) | Street photos along a built place, masked for people before they are shown | Live, through a server proxy (token never in the browser) |

### What is not Meta, said plainly
- **NVIDIA:** Kimodo and the SOMA-X skeleton.
- **Microsoft:** MoGe 2 (depth).
- **Third parties:** Tripo (character mesh), TRELLIS.2, Pixal3D.
- **PyTorch / torchvision:** Mask R-CNN and Faster R-CNN find people for the photo mask; they are Meta-originated open-source tools but not a hackathon model, and SAM 3 is the possible upgrade.
- **Motion capture:** CMU Graphics Lab database, used under its licence.

## How it answers the judging criteria

### Impact (30%)
- **Real world in, real world out:** a player stands in a real park, sees it become a course, and learns what a real body does there.
- **Physics learned by doing:** each obstacle has one saying, found by playing it (Dojo lessons earn the formula as the last step; the Course never shows one).
- **Makers, not only players:** the editor, the Slicer (a course from real streets) and the photo-to-object tool let anyone build; worlds are shared only after the simulator proves them clearable.
- **Safe by design:** no sign-in, no real names, no footage of minors, people masked in photos, a photo is rejected when masking fails.
- **Not a coach:** the game never grades or coaches a person's technique.

### Use of Meta AI tooling (25%)
- Nine Meta models and services are in the table above; each does one job a judge can see in the demo.
- The two live ones (Muse Spark Open, Mapillary) sit behind server functions, so keys never reach the browser.
- The models propose and the simulator decides: every layout from Muse Spark Open is run through the ideal-run search before it is offered.
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
- Beats: a pin on the map becomes a world; a photo becomes an object; the design partner fixes an unclearable course; the lache pair swing, with the debug view showing why it worked.

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
