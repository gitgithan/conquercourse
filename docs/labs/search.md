# Lab 1: Search

*University Lab 1 (see `docs/university-labs.md`).*
*Open it at `?mode=lab-search&labs=1`; without the labs switch it shows "Labs are switched off".*

## When you open it
- Live: it runs our setting (beam, width 8) on open in the worker, in about a second; the picture, facts and "what the game does" card are already filled.
- Beam 8 clears the trap in 77 simulator runs; greedy and beam 2 get stranded.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## The question
- How should a program look for a clear run, and what does each way of looking cost?
- Why can a choice that looks best at each step strand the next one?

## What the player sees and changes
- The goal line: find a clear run through three gaps; each gap needs one jump press.
- Method: greedy, beam (width 1 to 20), A* or exhaustive.
- Heuristic: three sliders (value distance gained, speed kept, height kept).
- Target: at most 20, 50, 100, 300, 1000 or 3000 simulator runs.
- Output: cleared or stuck, runs used, game seconds played, the run time of the line found, the gap to the stored line, and the line drawn and played back.
- The equations come last, after a run, and only on request.

## How it was designed
- **The one question:** can you find a clear run in a given number of simulator runs, and which method does it?
- **The choices and why those:**
  - The four methods are the standard teaching ladder: one path (greedy), a few paths (beam), best-first with a time guess (A*), everything (exhaustive).
  - The three heuristic sliders are the only things a player can say about "what looks good" (how far, how fast, how high at the landing).
  - The budget is counted in simulator runs, not seconds, so the answer is the same on a slow machine.
- **The course:** `public/assets/lab/search-trap.course.json`, four platforms, three gaps, finish at 29.4 m.
  - It was written by hand after a random search of small chains, so that the farthest first jump strands the second.
  - Its stored plan (presses at 6.72, 13.12 and 18.38 m) is the game's own ideal-run search result.
  - Lab 12 reuses this course and this stored line.
- **Which real game code runs:** `playPlan` and `edges` from `src/sim/ideal.ts`, which drive `src/sim/world.ts` (the same simulator the game plays).
  - The search itself (`src/lab/search-lab.ts`) is new Lab code, because the game's search is a generator tied to its own batching; the Lab's search is not the game's search.
  - A node is the list of presses so far; to judge it, the real simulator plays the run and we read where the runner lands after the last press.
  - Presses are tried every 0.25 m, up to 2.5 m before each edge.
  - Every line the Lab tries uses the same release time (60 ticks) and bounce press (8), so "cleared" means cleared with those two fixed.
- **Which data is precomputed:** only the course file and its stored plan; every number on the screen comes from a live run.
- **Order of the screen and why compare comes last:**
  - Choices on the left, the course picture and the facts on the right, a table of your runs so far.
  - "What the game does" appears only after the first run, so the player has a result of their own to compare it with.
  - The equations stay hidden until after a run, which keeps the rule that formulas are an earned last step.
- **Where the work runs:** a worker (`src/lab/search-lab-worker.ts`), with an inline fallback; the picture is canvas.

## How we prove the lesson is right
- `tests/lab-search.test.ts` (seven tests):
  - The stored line clears the trap course in the real simulator (`playPlan`).
  - Greedy by distance is stranded (`cleared` false, `stuck` true).
  - Exhaustive clears, and its line replays to a clear in the real simulator, within 0.1 s of the stored line.
  - A beam of width 2 does not clear and a beam of width 8 does.
  - A* clears and never spends more runs than exhaustive.
  - A budget of 20 stops at 20 runs, says the budget was hit and does not clear.
  - The same choices give byte-identical results twice, for all four methods.
  - Out-of-range choices are clamped.
- `scripts/lab-search-check.mjs`: browser run at 1280 px (labs off message, greedy stranded, A* clears, equations hidden before a run).
- The claim "greedy gets stranded" is backed by the real simulator, not by a model of it.
- What would make the Lab's claim false:
  - Greedy clearing the trap course with the default mix (the test fails).
  - A line the Lab calls a clear that the real simulator does not clear (the replay check fails).
  - A change to the simulator that makes the trap not a trap; the tests would then fail and the course would have to be rebuilt.

## Limits
- **Heuristic sliders are barely tested.**
  - The tests use the default mix (distance only) for the greedy and beam claims, and one mixed setting only for determinism.
  - Nothing proves that a speed or height mix helps or hurts on this course.
- **One course.**
  - The trap is made on purpose; the Lab does not show how often real courses have such a trap.
- **Two things are fixed for every line:** the release time and the bounce press, so the Lab searches only the jump presses.
- **"What the game does" is not the same search the Lab runs.**
  - The card says the game searches greedily first and repairs the last two take-off edges; that matches the comment and code in `src/sim/ideal.ts`.
  - The game's greedy takes the middle of the presses that reach farthest; the Lab's greedy keeps the single best-scoring press.
  - The repair only starts when the first pass got within 3 m of the last edge; the card leaves that out.
  - No test runs the game's search on this trap course.
- **Unbacked sentence:** "clears every course in the menu" is stated on the card and is not tested in this Lab.
- **Wall-clock time** shown in the facts is the browser's clock, so it differs between machines and is not tested.
- **Steps are runs, not cost:** a run on a long line plays more ticks than a short one; `simSeconds` reports that, but the tests do not pin it.

## How to make the lesson better
1. Add tests for the heuristic sliders: one mix where beam 2 clears, and one where A* spends more runs than with distance only.
2. Show the game's own search on the same course next to the player's, with its measured run count, so the card is data and not a sentence.
3. Add a second, non-trap course where greedy wins, so the lesson is "it depends" and not "greedy is bad".
4. Let the player also tune the release time, which turns the search into a bigger space (a bridge to Lab 2).
5. Plot runs used against methods for several budgets in one picture.
6. Put the test that the card's sentence is true into the suite (run the game's search on the trap).
