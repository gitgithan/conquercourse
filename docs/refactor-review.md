# Refactor review: what slows down adding features (CC-133)

## So what
- Adding one new obstacle today touches about 33 source files, 8 scripts, 4 tests plus 2 stored data files, and 15 docs.
  - Measured on the drone: `grep -rli drone` gives 33 files under `src/`, 8 under `scripts/`, 6 under `tests/` and 15 under `docs/`.
  - The band is the same shape: 31 source files.
- Most of that is not logic, it is the same "which mode is this" question asked again in a new file.
  - `.mode === '...'` appears 135 times in `src/`; `src/modes/course.ts` has 31, `src/sim/world.ts` 19, `src/sim/ideal.ts` 15, `src/sim/predict.ts` 13.
- The biggest drag is two giant closures, not the sim.
  - `startCourse` is one function of about 1,550 lines (`src/modes/course.ts:97` to the end); `startEditor` is about 1,365 lines (`src/modes/editor.ts:55`).
- Recommendation: do the cheap, test-covered items first (1, 3, 4, 5), then one obstacle registry (2), and leave the 120 Hz sim step alone.
- Next step: open the follow-up as a sub-task of CC-133 when the owner agrees; item 1 is the first one to pick.

## Ranking by payoff per hour
- Rank 1: one obstacle table for the UI side (item 2a, 6 h), because every new obstacle edits it.
- Rank 2: one place for URL switches (item 5, 3 h).
- Rank 3: one test helper file (item 6, 3 h).
- Rank 4: one `json`/error helper for the server routes (item 7, 2 h).
- Rank 5: split `startCourse` by feature (item 1, 16 h), biggest payoff but biggest cost.
- The numbers below are estimates for one careful person-day style of work, not measured.

## 1. Giant closures: `startCourse` and `startEditor`
- Evidence: the two largest files are `src/modes/course.ts` (1,650 lines) and `src/modes/editor.ts` (1,421 lines).
  - Next are `src/modes/map.ts` (692), `src/sim/ideal.ts` (643), `src/render/actor.ts` (606, locked), `src/modes/demo-captured-vault.ts` (538), `src/sim/world.ts` (492).
  - Python: `pipelines/ingest_video.py` (484), `pipelines/photo_to_object.py` (457), `scripts/triage_v2.py` (414).
- Evidence: `src/modes/course.ts` has 14 key checks (`e.code ===`) inside one `keydown` handler at line 628, plus toast, drum, report and ghost code in the same closure.
- Proposal: move the closure's state into a small `CourseSession` object and split by feature into `src/modes/course/` files (input, toasts and drums, report, ghost, shortcuts).
  - Each file gets the session and returns its `update(w)`; `startCourse` only wires them.
- Size: 16 h.
- Risk to tests: medium; many browser smoke checks read this file, so run them once on the VM.
- Risk to the sim: none if only UI code moves (the sim is imported, not edited).
- Payoff: high but slow; do it in slices of one feature per pull request.

## 2. Adding a new obstacle kind touches 30+ files
- Evidence (drone): `src/sim/world.ts` (32 mentions), `src/sim/drone.ts` (31), `src/modes/editor.ts` (28), `src/ui/drone-view.ts` (23), `src/modes/course.ts` (22), `src/sim/experiments.ts` (14), `src/sim/ideal.ts` (12), `src/modes/diagrams.ts` (11), `src/slice/drone-lane.ts`, `src/modes/lessons.ts`, `src/sim/predict.ts`, `src/ui/debug-view.ts`, `src/ui/zone-icons.ts`, `src/ui/run-report.ts`, `src/ui/editor-layout.ts`, `src/ui/onboarding.ts`, `src/ui/world-picker.ts`, `src/motion/actor-state.ts`, `src/sim/drums.ts`, `src/sim/replay.ts`, `src/sim/runner.ts`, `src/film/camera.ts`.
- Evidence: the mode union is declared once (`src/sim/world.ts:23`), but the same facts are then repeated by hand in:
  - the step dispatch (`src/sim/world.ts:127-138`), a long `if` chain of 12 modes;
  - the preview chain and "next press" label in `src/ui/debug-view.ts:87,130`;
  - the mode name table in `src/ui/debug-view.ts` (`MODE: Record<string, string>`);
  - the zone name (`src/ui/run-report.ts:96`, `if (c.drone) return 'drone'`);
  - the icon (`src/ui/zone-icons.ts`) and the tip text (`src/modes/course.ts:1096`);
  - the prediction (`src/sim/predict.ts`) and the drum lane (`src/sim/drums.ts:56`).
- Proposal in two parts.
  - 2a (UI, safe): one `ObstacleKind` table in `src/course/obstacles.ts` with `{ id, mode, icon, modeName, nextLabel, isMachine, reportName, tip }`; the UI files read from it instead of branching.
  - 2b (sim, careful): replace the `if` chain in `src/sim/world.ts` with a `Record<Mode, StepFn>`; the same functions are called in the same order, so output stays identical.
- Size: 2a 6 h, 2b 4 h.
- Risk to tests: low for 2a (type-checked, `strip-keys`, `run-report`, `zone` tests); medium for 2b.
- Risk to the sim: 2a none; 2b must keep bit-identical output, so run `tests/replay.test.ts`, `tests/golden-search.test.ts` and `tests/golden/` before and after.
- Done in this review: the two machine-mode chains in `src/ui/debug-view.ts` became `MACHINE_MODES` and `NEXT_LABEL` (see the end).

## 3. A new toast or key cue lives in three places
- Evidence: the toast kinds are a union plus a text table in `src/ui/approach-toast.ts:9-36`; which drum maps to which kind is a separate `if` chain at `src/ui/approach-toast.ts:12-26`.
  - Drum kinds come from `src/sim/drums.ts`, which has its own mode checks (10 of them).
  - Obstacle ids are matched by `id === k || id.startsWith(k + '-')`, a string convention with no type.
- Evidence: toast text for failures is a third copy, inline in `src/modes/course.ts:1096`.
- Proposal: put toast text, lead distance and the drum it follows on the obstacle table from item 2a, so a new obstacle adds one row.
- Size: 3 h after 2a.
- Risk to tests: low; `tests/strip-keys.test.ts` already walks every course and fails if a cue is missing.
- Risk to the sim: none (UI only).

## 4. A new course-JSON field must be added by hand in 4 to 5 places
- Evidence: `CourseData` (`src/course/course.ts:21-60`) has about 30 optional fields, and each new one so far also needed:
  - an allow or strip decision in `src/share/made-course.ts:11` (`LOOKS_ONLY` list);
  - `cleanCourse` (`src/share/made-course.ts:52`) which checks only version, name, start, finish, jump speed and platforms, so a bad `drone` or `band` value passes through to the sim unchecked;
  - a copy in each course builder (`src/slice/generator.ts:78`, `src/slice/slice.ts:191`, `src/slice/coaster.ts:24`, `src/park/fit.ts:113`), each building `version: 1` by hand;
  - the JSON pretty-print and `npm run plans` stored data.
- Proposal: one `src/course/schema.ts` with a field list (`name`, `kind: 'ground' | 'looks' | 'plan'`, `check(v)`), used by `cleanCourse`, `shareable` and a `makeCourse(partial)` builder.
- Size: 6 h.
- Risk to tests: medium; share and hash tests depend on key order ("the course hash depends on it"), so the builder must keep key order.
- Risk to the sim: none, but a wrong check could reject a good shared course; add a test that every file in `public/assets/demo/` still passes.

## 5. Feature switches are raw URL parameters
- Evidence: 81 distinct `?name=` words are read in 46 files (`grep` of `.get('x')`, `location.search`, `URLSearchParams`).
  - `src/main.ts` alone builds `new URLSearchParams(location.search)` 21 times in 62 lines, and picks the mode with a 9-way ternary on line 56.
  - The only list of known words is the `QUIET` set of 7 in `src/ui/onboarding-flags.ts:13`, so a new word can silently change what a first visit sees.
  - The most-read words: `mode` (11), `course` (7), `demo` (6), `slice2`, `generate`, `check`, `bot` (4, 4, 3, 3).
- Proposal: one `src/flags.ts` that parses once, lists every switch with `{ name, default, doc, quiet }`, and exports typed getters; `main.ts` uses a `Record<mode, loader>` instead of the ternary.
  - A test fails if a file outside `flags.ts` reads `location.search` (a ratchet, with an allow-list that only shrinks).
- Size: 3 h for `flags.ts` and `main.ts`; 1 more h per 10 files migrated.
- Risk to tests: low; behaviour stays the same.
- Risk to the sim: none.

## 6. Copy-pasted test helpers
- Evidence: the `load` course reader is defined again in 18 test files (19 copies, 5 different paths) (`const load = (f) => JSON.parse(readFileSync('public/assets/demo/...'))`); 72 test files read course JSON directly.
  - Other repeats: `world`, `mk`, `lane`, `box`, `deck` builders (13 `lane`, 13 `box`, 5 `deck`) and a `run` helper (11).
  - `tests/helpers/` does not exist; there is only `tests/fixtures/`.
- Proposal: `tests/helpers/{course.ts,world.ts,pieces.ts}` with `loadDemo(name)`, `runTicks(course, inputs)`, `deck()`, `bar()`, `box()`; migrate one test file per commit.
- Size: 3 h for the helpers and the 18 `load` copies; more for builders.
- Risk to tests: low per file, but do not change what a test asserts; a moved helper must give the same value.
- Risk to the sim: none (tests only read it).

## 7. Server routes repeat their plumbing
- Evidence: `functions/api/` has 19 route files and 837 lines in all; a `json(body, status)` helper is defined in 15 of them (`course-event.ts:5`, `community.ts:14`, `share.ts:39`, ...), with slightly different headers (`cache-control: no-store` only in `share.ts`).
  - `clip`/`text` clean-string helpers are repeated (`course-event.ts:4`, `community.ts:15`), and `Env` is declared per file.
  - Two different functions are both called `cleanCourse` (`functions/api/community.ts:18` and `src/share/made-course.ts:52`), which is a trap for imports.
- Proposal: `functions/_lib/http.ts` (`json`, `bad`, `readJson` with a size cap) and `functions/_lib/env.ts`; rename the community one to `cleanCommunityCourse`.
  - Pages ignores a folder starting with `_` as a route; confirm with a deploy preview.
- Size: 2 h.
- Risk to tests: low (`course-agent-api.test.ts`, `community.test.ts`, `share-*.test.ts` call the handlers directly).
- Risk to the sim: none.

## 8. Editor tools and course types have no seam
- Evidence: `src/modes/editor.ts` is 1,421 lines with 28 drone mentions and similar counts for band, trebuchet, plank and holds; its one `keydown` handler is at line 1372.
  - `src/slice/{drone,band,...}-lane.ts` and `fix*.ts` files repeat a "turn a piece into a lane" shape, and `src/ui/editor-layout.ts`, `src/ui/piece-browser.ts` and `src/slice/piece-info.ts` each list piece roles.
- Proposal: a `PieceTool` interface `{ role, icon, defaults, toLane(piece), fix(course) }` with one file per tool, registered in an array; the editor loops over the array.
  - Do it after item 2a, because the tool and the obstacle row describe the same thing.
- Size: 10 h.
- Risk to tests: medium; editor browser checks (`scripts/editor-check.mjs` and friends) must be run once on the VM.
- Risk to the sim: none (editor and slice code build courses, they do not step them).

## Sim determinism: what to run for any item
- Before and after, run `tests/replay.test.ts`, `tests/golden-search.test.ts` and everything under `tests/golden/`; these compare stored replays and search results, so any drift shows up as a failing diff.
- Do not touch `public/assets/motion/{vault,climb}.json` or clip playback in `src/render/actor.ts` (locked by the product owner).
- Keep sim files free of UI imports; items 1 to 8 are all outside `src/sim` except 2b, which is the only sim edit and is optional.

## What was done in this review
- One small refactor: `src/ui/debug-view.ts` had two copies of "which modes are machines" and "what is the next press" as long ternary chains.
  - They are now two tables, `MACHINE_MODES` and `NEXT_LABEL`, at the top of the file; the output strings are the same.
  - A new machine mode now adds one word to each table instead of editing the middle of `update`.
- Checks run: `tsc --noEmit` is clean; `tests/replay.test.ts`, `tests/golden-search.test.ts` and `tests/strip-keys.test.ts` pass (79 tests); the full suite was run on VM3.
