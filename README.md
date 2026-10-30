# ConquerCourse

*Train slow. Run fast.*

A ninja-warrior physics game where real parks, real streets and real objects become the course.
Built for the Meta Global AI Developer Hackathon (2026-10-26 to 2026-11-04), indie track.
Live: https://conquercourse.pages.dev/

## The problem we solve
- Three needs, reasoned from how people learn and play; we have not run user research yet (our belief, not a measurement).
- **People skip physics because it arrives as symbols.**
  - The player first feels the idea in their hands; every obstacle has one saying, earned by playing it.
  - The Course never shows a formula; the Dojo adds it once, as the last step; the Labs show equations for people who ask.
  - The simulator is the same on every run, so a person can test an idea again and again.
- **People know their own city and little beyond it.**
  - Pick a place on Earth and its real buildings become a course, with real street photos (Mapillary, CC BY-SA, credited, people removed).
  - A friend in another country opens the same course from a link.
- **Making a course is hard, and sharing an unfair one is worse.**
  - The simulator proves a course can be cleared before it is shared, and says in plain words what to change when it cannot.
  - Photos of real objects become obstacles.
- We do not grade or coach a person's technique, use a chat tutor, or leave Earth's physics.

## Achievements at a glance
- **Deterministic simulator:** 120 Hz, pure TypeScript; key presses replay to the same result, guarded by golden hashes.
- **Ideal-run proof:** a search finds the best line and any shortcut, and proves a course can be cleared before anyone else plays it.
- **Real places:** 26 listed ready places load at once, and any pin on Earth slices into a course; people are masked in every street photo.
- **Real objects:** 19 objects lifted from photos with SAM 3 and SAM 3D Objects (bench, low wall, hydrant, pipe, railing and more); $0.164 for 14 photos.
- **Fifteen kinds of obstacle** from a flat run to a cannon, a trebuchet and a drone ferry, each with one earned saying ([obstacles](docs/obstacles.md)).
- **Captured and generated motion:** 11 motion clips, all shown only after the plausibility check.
- **Course Agent:** from one park photo, Muse Spark Open proposes and the simulator repairs; 40 of 40 runs were proven clearable in at most 3 steps (one-shot was 13 of 20).
- **Verified shares:** a challenge link carries only the keys, the simulator replays them, so a time cannot be faked ([run checks](docs/run-checks.md)).
- **Race the world:** a board of the fastest verified runs on each course, with a three-letter tag and your own best time; the server replays every run, so a time cannot be faked (try `?board=1`).
- **The world right now:** the course picker says how many people played in the last 24 hours and how many runs they made; a person is a random browser code, never an account.
- **Learn:** a four-step Dojo (the formula only on the last step) and university Labs that allow equations.
- **Sound and clips:** an original MusicGen loop for each of 6 screens, and a 15 second vertical clip of any run.
- **Tested:** 146 test files; physics-law tests come first.
- **Honest records:** failures are written up ([lessons](docs/lessons.md), [experiments](docs/experiments.md)); a Meta code review found 13 real bugs in 21 claims, each checked by us.

## Meta models we use
Diagrams are in [docs/meta-ai-pipelines.md](docs/meta-ai-pipelines.md); the full table, what is not Meta, and how each judging criterion is met are in [docs/hackathon.md](docs/hackathon.md).

| Meta model or service | What it does in the game | Runs |
|---|---|---|
| **SAM 3 / 3.1** | Cuts a real object out of a photo by name; blurs people in video | Build time |
| **SAM 3D Objects** | Photo and mask to a 3D object (the 19 editor objects) | Build time |
| **SAM 3D Body + MHR, DINOv3** | Measures body and pose from video; the motion clips come from it | Build time |
| **Meta-Llama-3-8B-Instruct** | Text encoder inside Kimodo (NVIDIA), which generates run, leap and hang motion | Build time |
| **Muse Spark Open** (Baseten) | Course Agent, design partner and Fix it, photo-to-course draft, upload check, move tips | Live, server function |
| **Muse Spark, Muse Image** | Contact targets and character descriptions; the second Rookie in the first one's style | Build time |
| **MusicGen (AudioCraft)** | The original loop for each screen | Build time |
| **Mapillary** (owned by Meta) | Street photos along a built place, masked for people | Live, server proxy |

- Keys never reach the browser; the models propose and the simulator decides.
- **Bonus prizes:** Most Viral (challenge link and clip, CC-126; [viral plan](docs/viral-plan.md)), Best Build on Meta Open Weights (Muse Spark Open), Best Agentic Use-Case (the Course Agent; [evaluation](data/eval/cc-126-course-agent/README.md)).
- **Demo:** three-minute script in [docs/demo-script-v2.md](docs/demo-script-v2.md); film tools in [docs/film-toolchain.md](docs/film-toolchain.md).

## Play it
- Keys: arrows or A/D run, Space jump, S squat, E hold, V vault, X roll, R retry, H key card.
- Modes: `?mode=dojo` or `T` (learn), `?mode=map`, `?mode=editor`, `?mode=gallery`; `?labs=1` for Labs; `I` shows the ideal run.
- Every feature, its switch and its doc: [docs/features.md](docs/features.md).
- Every obstacle, its keys and numbers: [docs/obstacles.md](docs/obstacles.md).
- What to tick when playtesting: [docs/playtest.md](docs/playtest.md).

## Run it
- `npm ci`
- `node node_modules/vite/bin/vite.js` and open http://localhost:5173
- `npm run test:quick` runs the fast checks; `npm run test:fast` runs the full set ([testing](docs/testing.md)).
- Deploying: [docs/deploy.md](docs/deploy.md).
- Keys live in private files outside the repo; none are committed.

## What is new, and what is not
- The repository starts on 2026-10-27; no code from the earlier practice project is used.
- Third-party material and licences: [docs/PRIOR-WORK.md](docs/PRIOR-WORK.md).
- Every asset, its source and licence: [docs/ASSETS.md](docs/ASSETS.md).

## Where to read more
- Source of truth: [docs/spec/SPEC.md](docs/spec/SPEC.md)
- What we learned and why: [docs/lessons.md](docs/lessons.md)
- Pipelines with diagrams: [docs/meta-ai-pipelines.md](docs/meta-ai-pipelines.md), recipes in [docs/pipelines.md](docs/pipelines.md)
- Stages and courses: [docs/stages.md](docs/stages.md), [docs/course-design.md](docs/course-design.md)
