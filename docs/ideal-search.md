# The ideal-run search: how the simulator uses it, and whether better methods exist

- Written 2026-11-03 for CC-133 from the code and the repo's own docs, tests and reports.
- Every number below comes from a repo file, or from the code itself (a count of trials a loop makes).
- Anything we did not measure says "not measured".

## Make it easier implementation update (2026-11-04)

- Make it easier now reuses complete exact-course proofs, retains the winner, evaluates candidates off the UI thread and supports cancellation.
- Optional candidate cards show the layouts being tried and their simulator verdicts.
- Candidate order follows the limiting measured obstacle, then edit cost.
- The [before/after and dependency diagrams](easier-search.md) explain what each change unblocks.
- The [local benchmark and prefix investigation](../data/eval/easier-search/README.md) compare candidate workers with the existing timing-trial pool.
- The investigation below is historical; its repeated-search findings describe the earlier implementation.

## Editor proof handoff update (2026-11-04)
- Preview and the main editor now share complete results for the same search input.
- Apply and Play reuse a preview's successful run without another ideal-run search.
- The shared builder includes only devices already added to the editor and their current settings.
- A changed search input requires a new result.
- See the [proof flow guide and diagrams](editor-proof-flow.md) for the current path.
- The original investigation below records the earlier repeated-search problem.

## So what (read this first)

- **What it means for the game:**
  - The ideal-run search is the one piece that answers "can this course be cleared, and how wide is each window?".
  - The ghost, the drum lane, the `I` key, the editor's lane check, the fix search (its `Fix it` button was removed on 2026-11-04; the code stays), the advice, the generator and the shortcut list all lean on it.
  - It is correct and deterministic, but it is expensive when a course has monkey bars (15 to 20 s of work on the laptop, from `docs/lessons.md`).
  - Today the same course can be searched again and again in one page visit, because the page keeps no shared result.
- **What it means for the demo:**
  - Ready-made courses are answered at once from stored plans, so the demo path does not wait.
  - An edited or new course with bars waits behind a progress panel, and the ghost and the drum lane can each start their own full search.
- **Recommendation:**
  - Do the cheap, safe things first: one shared result cache keyed by the course hash, and a real benchmark with a per-stage profile.
  - Then store the result with the course when it is saved, so a player never waits for a course someone already proved.
  - Do not swap the search for a cleverer one (Bayesian optimisation, CMA-ES, RRT, learned proposals, a search over raw input masks) before the benchmark says where the time goes.
  - Those methods do not fit our rules as well as the present grid search does, and nothing we measured says the grid is the problem.
- **Next step:** step 1 below (the shared result cache), about half a day, then the benchmark (half a day).

## Part 1. How it works now

### What a Plan is

- A `Plan` (`src/sim/ideal.ts`) is a short list of timings, not a list of key presses.
- The plan is played by `inputFor`, which turns the timings into the same input a person would give (`RunnerInput`), tick by tick, through the normal `stepWorld`.
- So a plan is always a real run: the simulator decides, and nothing is scored that the simulator did not play.
- Fields, grouped by obstacle:
  - Jumps and vaults: `jumpXs`, `vaultXs`, `climbXs` (press when the feet are on the ground at or past this x).
  - Rope and trampoline: `releaseAfter`, `bouncePress` (ticks).
  - Bars on a swing: `hands`, `hangTicks` (per bar), `airHands`, `noGrab` (a skip), `climbHands`.
  - Monkey bars (`docs/bars.md`): `barsStart`, `barsWait` (per reach), `barsKip`, `barsRelease`.
  - Launchers: `launchRelease` (trebuchet), `aim`, `fireXs`, `fireAfterJump` (cannon and recoil pad).
  - Machines: `droneBrakeX`, `droneDescendX`, `cartBrake`, `bandStretch`.
  - Start: `startDelay` (ticks to stand still, for courses with timed balls, `src/sim/shots.ts`).
- A `Window` says, per obstacle, the best value, the low and high end of the values that still clear, and `widthMs` (how long that window lasts in game time).

### The search, step by step

- **Shape:** `searchGen` is a generator.
  - It never plays the simulator itself.
  - It yields a `Batch` (a list of `Job`s, each a plan to play), and gets the scores back.
  - A score is `CLEARED` (1,000,000) if the run finished, otherwise how far along x it got (`maxX`).
- **Two drivers, same answer:**
  - `driveSync` plays the jobs one by one on the current thread (`searchIdealRun`, used by almost every caller).
  - `driveAsync` hands them to the worker pool (`src/sim/ideal-pool.ts`).
  - The plans and their order are the same, so the answer is the same; `tests/ideal-pool.test.ts` checks the pool against the golden hashes.
- **Greedy, one obstacle at a time (`searchGenBase`):**
  - It lists the take-off edges and the steps too tall to walk (`edges`, `risers`), sorted by x.
  - For each one in order it tries many values of that obstacle's timing with everything earlier fixed.
  - It keeps the longest run of values that reach farthest, takes the middle as the ideal, and records the ends as the window.
  - Then it moves to the next obstacle.
- **Trials per obstacle (read from the loops):**
  - A plain edge: the press on a 0.02 m grid over the 3 m before the edge, so 151 trials.
  - Window width: `(hi - lo + 0.02) / 7.4 m/s`, in milliseconds.
  - An edge near a swing bar: a 0.1 m grid times 13 hang times (0 to 360 ticks, step 30), so 31 times 13 trials.
  - Then each bar's hang time is tuned alone on a 6-tick grid (0 to 480 ticks, 50 ms steps), twice over.
  - An edge before the rope: 21 release times for every press, then the release alone on a 2-tick grid.
  - The trampoline press, tuned on a 1-tick grid.
  - Two bars close to an edge: a joint grid first (press on a 0.3 m grid times the hang times of the first two bars, 17 values each), then a finer grid around the best 8, and the first plan that clears ends it.
- **Monkey bars (`searchBarsGen`), the slow stage:**
  - A joint coarse grid: press (11 values), hang on the bar before (17, or 1 if none), kip (3 values), release (21 values).
  - That is up to 11 x 17 x 3 x 21 = 11,781 plans; it stops at the first that clears (`stopOnClear`).
  - A fine grid of kip (10) times release (61), and it takes the clearing cell with the most clearing neighbours (so the plan sits in the middle of room, not at an edge).
  - Then one timing at a time: the press (0.02 m), the hang on bar 1 (2-tick steps), the wait before the first reach (2 ticks), the release (2 ticks), and the wait before each reach (1 tick), the reach waits done twice because one wait moves the next.
  - The wait before the first reach is taken on its early side, 0.2 s inside the edge of its window, because a hang that only waits is lost time.
  - The window of the narrowest reach is reported (1 tick is about 8.3 ms).
- **Other obstacle searches:**
  - Trebuchet: release 20 to 360 ticks in steps of 6, times 17 hang times if there are bars (`searchLaunchGen`, batched).
  - Recoil pad, cannon, band, drone, coaster cart: written as loops that play on the calling thread (`searchRecoil`, `searchCannon`, `searchBand`, `searchDroneRun`, `searchCartRun`).
  - These do not go through batches, so the worker pool does not help them (they run on the page's thread when the pool is used).
  - How long they take: not measured here.
- **Timed balls (shots, start delay):**
  - The moves are found as if the balls were not there (`noShots`).
  - Then `startDelayFor` scans the start delay in 6-tick steps (up to 120 x 120 ticks) until the run passes between the balls with 12 ticks (0.1 s) to spare on both sides.
  - The scan plays on the calling thread.
- **Routes (`{ routes: true }`):** about 250 extra runs on the calling thread that compare bar to bar with a full pump and a flight over the second bar; the faster line is the plan, both are reported.
- **A run is cut short:**
  - Default cap: 9,600 ticks (80 s) per trial, shorter near an edge (`lead`).
  - A runner that stands still for 180 ticks (1.5 s) stops at once.
  - So a failing trial is cheap; a clearing or nearly-clearing one is not.
- **Second-best branch (CC-69):** if the greedy plan gets to the last edges and still does not clear, it retries with other presses at the last two take-off edges (5 shares each, so up to 10 extra searches) and keeps the first that clears.
  - Courses the greedy search already clears pay nothing extra, and their plans did not change (`tests/search-second-best.test.ts`, golden hashes).

### The worker pool and the panel

- `IdealPool` (`src/sim/ideal-pool.ts`):
  - The page makes `min(6, cores - 1)` workers (at least 1) in `src/modes/course/search.ts`.
  - Each worker gets the course once (`init`), then lists of jobs (`eval`), and answers with scores and the ticks it spent (`src/sim/ideal-eval.ts`).
  - The search itself (the generator) runs on the page side; only the trials go out, in small chunks handed to whichever worker is free.
  - A batch that stops at its first clear is asked for in rounds of `workers x 6` jobs, so a clear is found without playing the whole grid.
  - Cancel: `signal.cancelled = true` rejects at the next batch.
  - Budget: counted in simulated ticks, not milliseconds (`workSeconds`, 330,000 ticks per "work second" on the reference machine), so a slow machine gives the same answer, only later; when the budget is spent the promise rejects and the caller treats it as "no answer".
- `createSearch` (`src/modes/course/search.ts`):
  - One search at a time: each waits for the one before (`poolQueue`), because the workers hold one course.
  - `kind` is `ideal`, `ghost` or `drums` for a search the player should see (a panel opens), and nothing for a quiet background search.
  - Only the `I` and `Shift+I` search lets any key cancel; the ghost and drums run while the player plays, so only the Cancel button stops them.
  - With no workers it falls back to `searchIdealRun` on the page's thread.
- Progress panel (CC-133, `src/ui/search-panel.ts`, `src/modes/course/search-eta.ts`):
  - It shows "Looking at: <obstacle> (N of M)", a bar and a time left.
  - The time left is a guess from the finished steps; steps are uneven (a bars stage takes far longer than a step), so the guess blends the average of all steps with the latest ones, is smoothed, and is said in rounded words (`tests/search-eta.test.ts`).
  - `?searchpanel=0` hides it; "No way through" shows for 7 s when the search fails.
  - The panel reports where the search is; it does not change what the search does.

### Every caller, what it uses, and whether it is cached

Legend: "clear" = the yes/no; "plan" = the key timings; "windows" = how wide the good presses are.

| Caller | Where | Uses | Cached or stored? | Recomputed live? |
|---|---|---|---|---|
| Ghost to chase | `src/modes/course/ghost.ts` | plan | reads `idealCache` (by start x), then `course.plan`; else the shared search cache (CC-133) | one shared pool search (`kind: ghost`) if nothing is stored; joins a search already running |
| Drum lane | `src/modes/course/drums.ts`, `src/sim/drums.ts` | plan, clear | uses `course.plan` at once if present | otherwise the shared search cache (CC-133): joins the ghost's search or starts the one both use (`kind: drums`, 60 work-second budget) |
| Ideal run watch (`I`, `Shift+I`) | `src/modes/course/ideal.ts` | plan, clear | `idealCache` (per start x) and `course.plan` for the standing start | live search per checkpoint start, falling back to earlier checkpoints if one cannot clear |
| Take-off windows (fall tip) | `src/modes/course/ideal.ts` (`ensureWindows`) | windows | `course.windows` if stored; else the shared search cache (CC-133) | joins the shared search, quiet, no panel |
| Shortcuts list | `src/sim/shortcuts.ts`, `src/modes/course/shortcuts.ts` | clear, plan, windows | `course.shortcuts`, `course.plan`, `course.routes` | `findShortcuts`: the ideal run, then one search per variant (bars, wall, rope, vault, roll); about a minute in the worker for a course without stored shortcuts (`docs/world-slice.md`) |
| `?bot=ideal`, `?bot=shortcut` | `src/modes/course.ts` | plan | `course.plan` | `searchIdealRun` on the page thread (blocks) |
| Release window (trebuchet) | `src/sim/launch-window.ts` | plan, then windows by its own scan | none | one search, plus its own scan of releases |
| Fork (two routes) | `src/sim/fork.ts` | plan, clear, windows per route | none | one search per route |
| Editor lane check | `src/modes/editor/search.ts`, `src/sim/ideal-worker.ts`, `src/slice/preset-plans.ts` | clear, plan, windows (the `xWindows`) | ready-made courses: stored in `src/slice/preset-plans.json`, keyed by `courseHash`; edited: last result kept in the editor (`cachedSearch`), and `withProof` hands it to the Course | a worker per search for any other course |
| Slicer | `src/slice/slicer-core.ts`, `slicer-default.ts`, `slice.ts` | clear (the default also uses the plan) | none | one search per candidate lane |
| Generator | `src/slice/generator.ts`, `src/park/fit.ts` | clear, plan, windows | the sample course stores its plan (`course.plan`) | one search per generated course; the test proves with the full search, about 40 s (`docs/world-slice.md`) |
| Easier | `src/slice/easier.ts` | clear, windows (compares the narrowest) | none | one search for the base, one per tried change |
| Fix search (no button now), advice, proof answers | `src/slice/fixit.ts`, `fixbars.ts`, `advice.ts`, `proof-answer.ts` | clear | `clearedCached` in `src/sim/ideal.ts`: a map keyed by the whole course as JSON, 300 entries, a repeat still adds the first proof's ticks to the meter so budgets count the same | first call per course |
| Fix search for a recoil pad, band, drone, coaster, launcher | `fixrecoil.ts`, `fixband.ts`, `fixdrone.ts`, `fixcoaster.ts`, `fixcart.ts`, `fix-launch.ts`, `shortcut-close.ts` | clear (`fix-launch` also plan) | none (these call `searchIdealRun` directly, not `clearedCached`) | one search per tried setting |
| Roles / lane checks | `src/slice/roles.ts`, `course-agent-tools.ts` | clear, plan (agent tools also finish time) | none | one search each |
| Graph studio | `src/modes/graph-studio.ts`, `src/labs/gentest/core.ts` | plan, clear (the lab reads the farthest x reached and has a tick budget) | none | live; the lab walks the generator itself and stops at its budget |
| Coaster mode | `src/modes/coaster.ts` | clear | none | one search per layout |
| Tests and scripts | 76 test files import it (checked 2026-11-04); scripts such as `scripts/plans.ts`, `preset-plans.ts`, `bench-search.ts`, `bench-pool.ts` | clear, plan, windows | `tests/golden/search.json` (hashes), stored plans in `src/slice/preset-plans.json` and in demo course files | the tests re-run the search and compare to the golden hashes |

- **Stored versus live, in one line each:**
  - Stored: `course.plan`, `course.windows`, `course.routes`, `course.shortcuts` (course files and the hand-off from the editor), `src/slice/preset-plans.json` (ready-made editor courses), `tests/golden/search.json` (hashes only).
  - Remembered for one visit: `idealCache` (Course, per start x), `cachedSearch` (editor, the last course), `proved` (the fix search and the advice, by course JSON).
  - Recomputed live: everything else in the table.
- **One result cache for the Course (CC-133), none across screens:** the Course now has one cache for the visit, keyed by `courseHash` of the search input (the start x is part of it); the editor and the fix search still have their own small memories with their own keys.
  - The Course's old map by start x (`idealCache`) still exists for the `I` key and the ghost; the shared cache sits under every `runSearch` call.
  - The editor keys by `JSON.stringify(searchInput(course))`; the stored proofs key by `courseHash`; `clearedCached` keys by the whole course JSON.
  - They do not share, so a result found by one is not seen by the others.

### What it costs

The first list is numbers found in the repo; the last section was measured on 2026-11-03.

- Monkey bars stage: 15 to 20 s of work on the laptop (`docs/lessons.md`, `docs/world-slice.md`).
- A whole-course proof with a lache: about 38 s (`docs/world-slice.md`).
- The generated sample's full proof: about 40 s in a test (`docs/world-slice.md`).
- Stored plans, all eight demo courses: about 2 s each on the VM (`docs/world-slice.md`, `npm run plans`).
- A first shortcut look for a course without stored shortcuts: about a minute in the worker (`docs/world-slice.md`).
- Editor lane search for a new place: 25 to 126 s in a worker (`docs/world-slice.md`); on a software renderer the editor proof was about 40 s and "Play this lane" with bars about 5 minutes (`docs/refactor-review.md`, `docs/bars.md`).
- After CC-165, the searches of the ready-made courses end in under 5 s on the test machine (`docs/refactor-review.md`).
- Speed work (CC-69): the same answers 1.5 to 3 times faster on one thread and 5 to 14 times faster in a pool (`docs/world-slice.md`, details in `data/eval/cc-69-speed/README.md`).
- The fix search for a cannon: 10 to 60 s (`docs/world-slice.md`).
- Pool size: up to 6 workers in the page.
- Cannon: 1.6 s, all of it on the calling thread (measured 2026-11-03, below).
- Drone, cart, recoil, band, routes: not measured.
- Start delay: 0.13 s on `cannonballs` (measured 2026-11-03, below).
- Cost per trial: 190 to 240 thousand ticks per second on one thread of the benchmark machine; the budget unit (330,000 ticks per second) is the reference machine's number, not this one.

#### Measured 2026-11-03 (CC-133 step 2)

- Machine class: a 4 vCPU Vultr VM (Intel Xeon Skylake class, Node 24), nothing else of ours running; 3 runs per course, median reported; the answers were identical in every run and in the pool.
- Full tables, per-stage ticks and the script: `data/eval/search-bench/README.md`, `run.json`.
- Whole-course search, one thread / pool of 3 workers:
  - `lache`: 2.5 s / 0.47 s.
  - `cannon`: 1.6 s / 1.6 s (a loop on the calling thread, the pool does not help).
  - `launch-bar`: 5.8 s / 1.5 s.
  - `bars`: 9.7 s / 1.8 s.
  - `swing-to-bars`: 10.1 s / 2.4 s.
  - `cannonballs`: 36.7 s / 7.7 s.
  - `training`: 74.8 s / 15.9 s.
  - `fork-bench-bulb`: 131.1 s / 32.7 s.
- Per stage: the trials are 99.7% or more of the ticks on every course that goes through batches; the generator's own work and the start delay scan are under 0.2 s.
- The slow courses are the ones with many plain take-off edges (`training`, `fork-bench-bulb`, `cannonballs`), not the monkey-bars ones: a bars stage is about 10 s, a whole `training` is 75 s.
- Average trial: 1,100 ticks (`bars`) to 3,600 ticks (`training`), that is 9 to 30 s of game time, because a trial that fails still runs until it falls or sticks.
- The pool is 3.9 to 5.4 times faster than one thread with 3 workers.
- The page's pool size is `min(6, cores - 1)`, so 3 here; a player's machine will differ.

### Known limits (honest list)

- **Greedy:** each obstacle is chosen with the earlier ones fixed, and the middle of the best group is taken.
  - A choice that lands well can leave the next press no room.
  - The second-best branch repairs only the last two take-off edges, and only by trying 5 shares each.
- **One timing at a time:** after the joint grids, timings are tuned one at a time with the others held.
  - Timings that depend on each other (a swing and the next catch) are found well only where a joint grid exists (the first two bars, the bars stage).
- **Local optima:** a good line that lies between grid values, or in a narrow basin, is missed.
  - The code already shifts the hang grid by half a step and refines the best 8 starts because of this, which shows it happens.
- **"Cleared" means found one way, not the best way:** the first clearing plan (often at `stopOnClear`) ends the joint grid; the result is a proof of clearability, not of the fastest line.
  - The route comparison (bar to bar vs skip) and the shortcut search add some of "faster", but only for the cases they list.
- **A "no" is not a proof:** a course the search cannot clear may still be clearable; the panel says "no way through was found", which means "none found".
- **Several bar rows are not searched:** `searchBarsGen` uses the first row ahead of the edge to size `barsWait` (`rows[0]`); the plan has one `barsWait`, `barsKip` and `barsRelease`.
- **Windows are a lower bound (and sometimes a point):**
  - Each window is measured with every other timing held at its chosen value, so the true room of a person who can vary the others is at least that wide.
  - In the joint stages the take-off window is written as 0 ms (the joint grid does not measure it).
  - The hang-time window is the range of all good values, plus one step, and is not required to be one unbroken stretch (the bars stage uses `bestRun`, the unbroken stretch; the older hang tuner does not).
  - So "difficulty" numbers from windows are comparable between courses searched the same way, not absolute.
- **Double search (fixed by CC-133, step 1):** the ghost, the drum lane, the `I` key and the take-off windows now share one search and one panel per course per page visit (`src/modes/course/search-share.ts`).
  - The search still repeats across page visits; storing the result with the course (next step 4) is what removes that.
- **Machine-style searches do not use the workers:** drone, cart, recoil, band, cannon, the start delay and routes play on the calling thread (only the cannon's 1.6 s is measured).
- **Plan state is not saved between trials:** every trial replays from tick 0, so a trial for the 5th edge replays the first four.
  - This is deliberate for exactness (a plan is a real run), but it is where a state snapshot could save work; it is not measured how much.

## Part 2. Better methods?

### The rules any method has to meet

- Deterministic: the same course gives the same plan (golden hashes in `tests/golden/search.json`).
- "Models propose, the simulator decides": a learned or random guess is only a trial; the plan is accepted only if `stepWorld` plays it to the finish.
- We never grade or coach a person's technique: the search describes what the simulator allows (windows are facts about the course), it does not say how a person should move.
- Replay by input mask: a result must turn into the same inputs a player could give, so replays and ghosts stay exact.
- No formulas on screen in the Course.

### The options

| # | Option | What it is (one plain sentence) | What it would fix here | Cost and risk | Fit with our rules | Verdict |
|---|---|---|---|---|---|---|
| 1 | Shared result cache by course hash | Remember each search answer under `courseHash(searchInput(course))` and give it to anyone who asks later. | The double panel and double work (ghost, drums, `I`, windows); `idealCache` filled by every caller; the fix search and the editor see each other's answers. | Small. Risk: the key must include the start x, the budget (a cut-short answer must not stand in for a full one) and the build/physics version; a stale entry is wrong, so keep it in memory for the visit first. | Fine: it returns the exact stored result; replays and golden hashes are untouched. | Done for the Course (CC-133, 2026-11-03); the editor and Fix it keys are not joined yet |
| 2 | Precompute at save or publish time and store `course.plan` | Run the search once when a course is saved, and keep plan, windows, routes and shortcuts with the course. | No wait for players of a shared course; drums and ghost appear at once; the "clearable" label is ready for the course list. | Medium. A stored plan goes stale when physics or the course changes, so the key must carry a hash (as `src/slice/preset-plans.ts` already does for ready-made courses). | Fine: it stores what the simulator proved; a changed hash forces a new search. | Do now, after 1 |
| 3 | Incremental re-search of the changed segment | Save the simulator state at each obstacle and, when one part changes, search again only from that part on. | Editor edits late in a course (move the 4th obstacle: the first 3 need no search); faster fix loops (many small edits). | Medium to high. Needs a copyable world state and plan state at each take-off; a change early in the course invalidates everything after it; the saved prefix must be exactly what a fresh run would give. How much it saves: not measured, but the benchmark (2026-11-03) shows nearly all time is trials that each replay from tick 0 (1,100 to 3,600 ticks per trial), so the prefix replay is the biggest known waste. | Fine if it gives the same plan as a full search (a golden test can check this). | Promoted: prototype a saved start state for the edges stage and measure the saving, before beam search |
| 4 | Beam search / keep the top-k plans | At each obstacle keep several good choices (not just the middle of one), and carry them forward. | The greedy stranding case: a landing that leaves the next press no room, now patched by a second-best branch at the last two edges only. Also gives the best of several clearing plans (fastest, widest window). | Medium. Cost grows with k times the trials per obstacle; the plan would change for many courses, so the golden hashes are re-made on purpose. | Fine: still only simulator-played plans. | Later (a small k, only where greedy fails) |
| 5 | Joint tuning: coordinate descent, then random restarts | After the first plan, sweep each timing again with the others fixed, repeat until nothing improves, and restart from a few random values if it is stuck. | The "one timing at a time" limit; local optima; windows that are only lower bounds (a second sweep shows more room). | Low to medium. Extra passes cost the same as the passes now (the code already does two hang passes and two reach passes). Random restarts need a fixed seed to stay deterministic. | Fine with a seeded generator, same trials in the same order. | Do now for the reach and hang timings; later for the rest |
| 6 | Bayesian optimisation or CMA-ES over the Plan fields | A general optimiser that learns where good timings lie from the trials so far and picks the next ones. | Courses with many coupled timings, where a grid is too big. | High. Plan fields are mixed (x metres, ticks, flags, per-bar lists); a score that is 'how far you got' is flat until a plan clears; a new dependency; needs seeding to stay deterministic. No evidence that grid size is the limit. | Weak: results depend on the optimiser's random draws; hard to keep golden hashes. | Not worth it now |
| 7 | Search over the input mask directly (A*/DP over simulator states with a coarse state hash) | Treat each tick's key state as a move and search the tree of simulator states, merging states that look alike. | In principle finds lines no Plan can express (odd combinations of moves). | High. Branching per tick is large; a coarse hash is a guess about what 'alike' means and can wrongly merge states; memory; our Plan is the thing that keeps the answer small and readable for drums and ghosts. | Replay by mask fits perfectly, but the plan fields, windows and drums do not (a window is a statement about a timing). | Not worth it for the game; maybe as a research test for one tricky obstacle |
| 8 | Sampling-based planners (RRT-style) | Grow random branches of runs and keep those that reach new ground. | Hard discrete choices (which route, which move) where a grid has no natural axes. | High. The choices in our game are timings with narrow windows, which random sampling hits poorly; non-determinism unless seeded. | Weak. | Not worth it |
| 9 | Learned proposals (a model suggests timings, the simulator checks) | A small model guesses good starting timings for a new course, and the grid search runs around the guess. | Fewer trials for a new course if the guess is close; a good first plan for the editor's wait screen. | High for the benefit. Needs training data (the stored plans of many courses, which we do not have in volume), and a bad guess still falls back to the full search; we have no measure that the guess helps. | Fits the rule "models propose, the simulator decides" if the guess is only a starting point and rejected when wrong; must stay deterministic (fixed model, fixed seed). | Not worth it now; revisit after more stored plans exist |
| 10 | Time budget and anytime results | Report the best plan found so far while searching, so something can be shown before the end. | The waiting screen: the ghost could run the part of the course already planned; the panel could say "found up to obstacle 4 of 7"; cancel keeps the progress. | Low to medium. The greedy search already has a plan prefix after each obstacle; the batch callback needs to pass it out. A partial plan is not a proof, so it must be labelled so (no 'cleared' claim). | Fine: a prefix is a real set of timings played by the simulator. | Do now (small first version: show progress in the panel with the farthest x reached) |
| 11 | Run the search server-side on publish | When a course is published, a server job searches it and writes the result next to the course. | The player never searches; the course list can show "clearable" and a difficulty number; CI can re-check all published courses after a physics change. | Medium. Needs a runnable search on the server (the search is plain TypeScript and `src/sim/ideal-pool-node.ts` already runs it in Node worker threads); jobs, storage and a way to re-run after a physics change. Money steps need the amount stated first. | Fine, as long as the server runs the same code and writes the same hash. Any limits and identity rules stay in the private notes folder, not here. | Later, after 2 |
| 12 | Cheaper trials: a cheaper trial cap or an early stop for a run that cannot win | End a trial earlier when it has already fallen or gets stuck, and cap the time per edge. | Time on failing trials (already cut by the 1.5 s stuck rule and `lead`). | The benchmark shows trials are 99.7% or more of the ticks and the average trial is 9 to 30 s of game time, so the lever is real; how many ticks failing trials spend after the point where they could still pass is not measured. | Fine, if the answer is unchanged (golden hashes). | Promoted: measure the failing-trial ticks, then try an early stop |

### Who each option helps

| Option | Game developer | Player |
|---|---|---|
| 1 Shared cache | Faster editor loops; fewer duplicate searches in tests and scripts | One panel, not two; ghost and drums sooner on repeat |
| 2 Precompute at save | "Is this course clearable?" ready for any saved course; windows to read at once | No waiting for a saved or shared course; drums and ghost at once |
| 3 Incremental re-search | Editing one obstacle re-proves only the part after it | Not seen by the player |
| 4 Beam / top-k | A faster-vs-safer choice between plans; fewer false "no way through" | Better ghost on awkward courses |
| 5 Joint tuning | Wider, more honest windows ("room for error" numbers) | Hints that match the room the course really has |
| 6 BO / CMA-ES | None expected | None expected |
| 7 Input-mask search | Research only | None |
| 8 RRT | None expected | None |
| 9 Learned proposals | Maybe faster first proof of new courses | Maybe a shorter wait, not proven |
| 10 Anytime results | Progress is visible in the editor and in tests | A ghost that starts before the end; a panel that says something useful |
| 11 Server-side on publish | Regression checks over every published course; a list sorted by difficulty | No search at all for a published course |
| 12 Cheaper trials | Faster CI if the benchmark shows it | Shorter wait |

### What helps the game developer (a short list)

- Level validation in the editor: options 1, 2, 5 and 10 (a shared answer, a stored answer, honest windows, visible progress).
- Difficulty and room-for-error numbers: option 5 (windows that are not just lower bounds), and the reach windows already in `Window`.
- "Is this course clearable?": options 2 and 11 (answered before anyone asks), option 4 (fewer false "no").
- Regression tests: the golden hashes already do this; option 11 would extend it to every published course.
- Faster CI: options 1 and 12, and the pool (`scripts/bench-pool.ts`) in the test run; how much: not measured.

### What helps the player (a short list)

- Ghost sooner: options 1, 2 and 10.
- Drums: options 1 and 2 (the drum lane already shows at once for any course with `course.plan`).
- Hints (the fall tip reads `course.windows`): options 2 and 5.
- No waiting screen: option 2 first; option 10 makes the wait that is left useful.

## Recommended next steps (ranked, at most 5)

Sizes are in half-days (1 unit = about half a day). No Linear issues have been created; the titles below are suggestions.

1. **Shared search result cache by course hash** (1 unit).
   - **Done 2026-11-03 for the Course (CC-133).**
   - Memoise `runSearch` in `src/modes/course/search.ts` by `courseHash(searchInput(course))` plus start x, and share in-flight searches, so the ghost, drums and `I` use one answer.
   - Fill `idealCache` from every full result, and give the editor's `cachedSearch` and `clearedCached` the same key.
   - Keep a budget-cut result out of the cache as "complete".
   - Linear title: "One shared ideal-run result cache keyed by course hash (fixes the double search and the double panel)".
2. **Benchmark with a per-stage profile on a quiet machine** (1 unit).
   - **Done 2026-11-03 (4 vCPU VM); see the measured section.**
   - Run `scripts/bench-search.ts` and `scripts/bench-pool.ts`, add ticks per stage (greedy edges, bars stages, machine searches, routes, start delay) with the `meter`, and record seconds, ticks and the machine's conditions in `data/eval/`.
   - Result: option 12 and the prefix replay of option 3 are promoted; option 4 (beam) is unchanged, since a wider search multiplies the trial cost the benchmark shows to be the problem; option 6 and the other optimisers stay not worth it (the grid size is not the lever, the cost per trial is).
   - Linear title: "Ideal-run search benchmark with a per-stage tick profile (decides incremental re-search, beam, cheaper trials)".
3. **Anytime progress in the panel and the ghost** (2 units).
   - Pass the plan prefix and the farthest x out of the batch callback; the panel can say how far along the course it has got, and Cancel keeps it.
   - Label it as partial; never say "cleared" until the whole-course run clears.
   - Linear title: "Ideal-run search reports its best-so-far (panel and ghost show partial progress)".
4. **Store the result with the course when it is saved** (3 units).
   - On save or hand-off, write `plan`, `windows`, `routes` and `shortcuts` with a `courseHash` key, as `src/slice/preset-plans.ts` does for ready-made courses; a changed hash means search again.
   - Linear title: "Store the ideal-run result with every saved course, keyed by hash (no wait for a saved course)".
5. **Second sweep and room-for-error windows** (3 units).
   - A coordinate-descent pass over the hang and reach timings after the first plan, with a fixed order and no randomness, and a window measured with the neighbours free; re-make the golden hashes on purpose and say so in the pull request.
   - Linear title: "Ideal-run search: second sweep over coupled timings and honest room-for-error windows".

- **Later, if the benchmark says so:** incremental re-search from saved states (option 3), a small beam at the last edges (option 4), server-side search on publish (option 11; state the cost before any paid step).
- **Not worth it now:** Bayesian optimisation, CMA-ES, RRT, a search over raw input masks, and learned proposals; none has a measured problem to fix, and most weaken determinism or the plain-words plan.

## Gaps in this page

- The timings are from one 4 vCPU virtual machine, 3 runs each; the laptop and a player's machine were not measured.
- Not measured: the drone, cart, recoil, band and routes searches; the split of failing and clearing trial ticks; how much a state snapshot (option 3) or an early stop (option 12) would save; the cost of the second-best branch inside `fork-bench-bulb`.
- The shared cache lives for one page visit; it is not joined to the editor's `cachedSearch` or to `clearedCached`, and a budget-cut search gives no answer and is not stored (tested in `tests/search-share.test.ts`).
