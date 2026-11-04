# Hackathon notes: models, judging criteria and prizes

- Moved here from the root README (CC-208); the short version stays in the README.

## Meta models: what each one does in the project
Blue-box diagrams for every pipeline are in [docs/meta-ai-pipelines.md](meta-ai-pipelines.md); recipes with exact settings are in [docs/pipelines.md](pipelines.md).

| Meta model or service | Feature it supports | Runs |
|---|---|---|
| **SAM 3 / SAM 3.1** | Cuts a real object out of a photo by name (also the glowing box in the demo film's real-to-course shot); blurs faces and people in video before any body is measured; SAM 3 open weights run on Modal for player photos (live job), SAM 3.1 on the Meta Model API cuts out characters (live) and segments video frames (build time) | Live on Modal (SAM 3), live on the Meta API (SAM 3.1 for characters), build time otherwise |
| **SAM 3D Objects** | Turns a photo and its mask into a 3D object: the 19 real objects in the editor (bench, low wall, hydrant, concrete pipe, canal railing and more) | Build time (Modal GPU) |
| **SAM 3D Body + MHR (Momentum Human Rig)** | Measures a person's body and pose from filmed parkour; the vault and climb clips (2 of the 12 shipped) and the custom-look body come from it; the other clips are CMU motion capture and Kimodo | Build time (Modal GPU) |
| **DINOv3** | Image encoder inside SAM 3D Body | Build time (inside SAM 3D Body) |
| **Meta-Llama-3-8B-Instruct** | Text encoder inside Kimodo (NVIDIA), which generated the roll and slide clips | Build time (Modal GPU) |
| **Muse Spark Open** (`meta-models/muse-spark-open-1026`, on Baseten) | The in-editor design partner ("Ask AI for ideas") (the Course Agent loop and its photo-to-course draft were dropped from the game on 2026-10-31: scope is photo to object only) | Live, through a server function (needs the `BASETEN_API_KEY` secret) |
| **Muse Spark Open**, photo and upload review (`askModeration` in `functions/api/moderate.ts`) | Looks at every uploaded photo before the outline step, the 3D lift, a character picture or Share in Community, and answers ok, review or block with one reason; errors stop the step (CC-120). It is a model, so the same photo can get different answers; the owner-only admin page lists the stopped photos with the reason | Live, through a server function (needs `BASETEN_API_KEY`); called by the moderation queue (CC-112) |
| **Muse Spark Open**, move tips (`/api/move-tips`) | Names the moves that could get past a cut-out object and gives one plain idea for the course; checked against our move list (CC-121) | Live, through a server function (needs `BASETEN_API_KEY`); feeds the object cards (CC-108) |
| **Muse Spark** (Meta Model API, `muse-spark-1.3`) | Vision calls in the video-ingest pipeline and contact targets from move descriptions (`pipelines/ccpipe/vision.py`) | Build time |
| **Muse Image** (Meta Model API) | Drew one style-reference picture for the second Rookie (build time; Tripo made both Rookie meshes); it is also step 1 of the community character maker, which draws a picture for each player's sentence (`docs/character-pipeline.md`) | Build time for Rookie B; live for the character maker, paid from the Meta credit |
| **MusicGen (Meta AudioCraft)** | Writes the original loop for each screen (Course, Map, Editor, Dojo, Report, Library) from a text prompt; no melody or recording goes in | Build time (Modal GPU); loops play by default, `?music=0` turns them off |
| **Mapillary** (owned by Meta) | Street photos along a built place, faces and plates blurred by Mapillary itself, and photos with a close-up or large person are rejected; never stored | Live, through a server proxy (token never in the browser) |

### What is not Meta, said plainly
- The full table, with who made each model, how we use it and whether it runs at build time or live, is in `README.md` under "Models that are not Meta's".
  - That table is the one source; this file does not repeat it.
- **Film tools:** Remotion (cuts, captions), Playwright and ffmpeg (capture and encode), and the CC0 track "Scaling Up" by Ruskerdax; see [docs/film-toolchain.md](film-toolchain.md).

## Meta tools in development (not game features)
- These helped us build the game; the game itself does not call them, and they are not counted as game features.
- **Muse Wonder** (`muse-wonder-1.0`, Meta Model API) reviewed the simulator code (CC-133, 2026-10-29).
  - It read 4 chunks of `src/sim` and made 21 claims.
  - We checked each one with a test or by reading the code: 13 real, 7 false alarms, 1 unclear.
  - None of the real ones breaks a shipped course; 2 were fixed at once, 11 are tracked in CC-140.
  - Cost: $2.38 for the run, about $0.18 per real bug.
  - It did well on the physics code and gave nothing useful on the contraptions chunk.
  - Details: [data/eval/cc-wonder-review/README.md](../data/eval/cc-wonder-review/README.md).
- **Muse Spark Open** (on Baseten) also helped as a dev aid: bulk course drafts (CC-122) and photo triage (CC-123).
- **Muse Wonder** and **Muse Spark Open** also judged photo cut-outs for a gate before the 3D lift (CC-145, 2026-10-29): bash.60 for 46 calls each way, and neither earned a place in the game; the free mask-edge check did the useful part.
  - Details: [data/eval/cc-145-triage-v2/README.md](../data/eval/cc-145-triage-v2/README.md).

## How it answers the judging criteria

### Impact (30%)
- **Real world in, real world out:** a player stands in a real park, sees it become a course, and learns what a real body does there.
- **Physics learned by doing:** each obstacle has one saying, found by playing it (Dojo lessons earn the formula as the last step; the Course never shows one).
- **Makers, not only players:** the editor, the Slicer (a course from real streets) and the photo-to-object tool let anyone build; worlds are shared only after the simulator proves them clearable.
- **Safe by design:** no sign-in, no real names, no footage of minors, people masked in photos, a photo is rejected when masking fails.
- **Not a coach:** the game never grades or coaches a person's technique.

### Use of Meta AI tooling (25%)
- Ten Meta models and services are in the table above (Muse Wonder, used only in development, is not counted); which credit pays for each call is in [docs/model-ledger.md](model-ledger.md); each does one job a judge can see or hear in the demo.
- MusicGen composes the music: original loops from text prompts, so the soundtrack has no licensed songs in it.
- The two live ones (Muse Spark Open, Mapillary) sit behind server functions, so keys never reach the browser.
- The models propose and the simulator decides: every layout from Muse Spark Open is run through the ideal-run search before it is offered.
- The design partner uses the simulator as the judge: the model proposes, the simulator checks (Make it easier and Find shortcut are pure simulator searches).
- Cost and speed were measured, not guessed (for example $0.164 for 14 photos through SAM 3 and SAM 3D Objects).

### Technical depth (20%)
- **Deterministic simulator:** 120 Hz, pure TypeScript, key presses replay to the same result; golden hashes guard it.
- **Ideal-run search:** finds the best line and any shortcut, and proves a course can be cleared.
- **Plausibility gate:** no motion is shown before it passes the checks (bone lengths, knees, foot sliding, ballistic flight).
- **Contact IK:** hands and feet are pinned to the obstacle.
- **One clock** for physics, motion and film; a stepped clock for films.
- **Failures reported:** PartLLM hang-point finding (2 of 9 parts, 11 false claims) and the two-stage wall climb are written up in [docs/lessons.md](lessons.md) and [docs/experiments.md](experiments.md).

### Demo (25%)
- Three-minute script: [docs/demo-script-v2.md](demo-script-v2.md).
- How the film is made, and how to render it again: [docs/film-toolchain.md](film-toolchain.md) (film camera, labels that stay on their part, Remotion project in `demo/`).
- Beats: a pin on the map becomes a world; a photo becomes an object; the design partner fixes an unclearable course; the lache pair swing, with the debug view showing why it worked.

## Bonus prizes
- **Most Viral:** every cleared run can be shared as a challenge link or a 15 second vertical clip (CC-126).
  - The link carries only the keys of the run; the simulator plays them, so the time cannot be faked.
  - The clip is made in the browser on a stepped clock; the plan is in [docs/viral-plan.md](viral-plan.md).
- **Best Build on Meta Open Weights:** SAM 3 open weights run on Modal for player photos, and Muse Spark Open (Meta's open model, hosted by Baseten) runs the design partner (see the table above and the README's open weights split).

### Best Agentic Use-Case: claimed, from a sentence
- **The loop:** Muse Spark Open proposes a layout from an idea in words, the simulator's ideal-run search tests it, the model repairs it from the plain-words answer, and the loop stops when the simulator proves a clear (step cap 6).
  - The model proposes; the simulator decides.
- **Measured (2026-11-04, no photo):** 40 of 44 runs proven (22 at the first test, 18 after one repair), never more than 2 steps ([report](../data/eval/cc-133-agent-text/README.md)).
  - Cost: $0.357 for 44 runs and 70 model calls, covered by the hackathon credits.
  - No clear came from deleting obstacles (18 of 18 repairs kept the obstacle count).
  - Honest catch: some clears eased a size the sentence asked for (a 3 m wall became 0.68 m), so "proven" means proven with sizes the simulator accepts.
  - The 4 failures: 2 empty courses (a rule of the tool) and 2 empty model answers.
- **Earlier, from a park photo:** 40 of 40 proven in at most 3 steps ([results](../data/eval/cc-126-course-agent/README.md)).
- **Where it lives:** `src/slice/course-agent.ts` and `/api/course-agent`.
  - On 2026-10-31 the scope was cut to photo to object only, so the photo input and the editor button were removed; the loop has no player entry today.
  - We claim the loop as measured code, not a button; the editor's design partner and the simulator-only Make it easier and Find shortcut are the player-facing parts (one model call then the simulator, and pure simulator searches).
- **History:** [docs/meta-ai-pipelines.md](meta-ai-pipelines.md), section 4c.

## Scorecard and proof numbers
- The judging scorecard, the proof numbers (about 3,150 tests, 7,525 cross-hardware runs), the honest limits and the open-weights split are in the root [README](../README.md).
- Cross-hardware method: [lessons-cross-hardware-testing.md](lessons-cross-hardware-testing.md).
- Viral challenge: [challenge.md](challenge.md).

## What is new, and what is not
- The repository starts on 2026-10-27; no code from the earlier practice project is used.
- Third-party material and licences: [docs/PRIOR-WORK.md](PRIOR-WORK.md).
- Every asset, its source and licence: [docs/ASSETS.md](ASSETS.md).
