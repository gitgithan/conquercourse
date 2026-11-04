# Reinforcement learning

## When you open it
- Precomputed: the honest points, learning rate 0.2, exploring 0.2 and shrinking, 2000 tries, seed 7, trained ahead of time with the same code (`scripts/labs-default-precompute.ts`); a test re-runs it and compares.
- Curve, learned run and facts are filled; "time to compute" is the time on the machine that made the file.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## The question
- Can a game character learn to clear a course by trial and error, with points the player writes?
- How many tries does it need, how close does it get to the game's own best line, and how does a badly written reward go wrong?

## What the character is
- It plays the real simulator (`src/sim/world.ts`), the same one the game and the ideal-run search use.
- Its only moves are real inputs: run, jump, and wait (let go of run).
- It picks a move about every twentieth of a second while its feet are on the ground; after a jump it keeps running until it lands.
- It sees only where it is: a table with one row for each 0.25 m cell of the course.
- It learns the table with tabular Q-learning; nothing else is learned.
- The course is the Search trap course (`public/assets/lab/search-trap.course.json`): three gaps, and the farthest first jump strands the second.
- The same choices and the same seed give the same curve; the only randomness is a seeded generator, and there is no clock.

## The controls
- Points presets: Honest, Pays for staying alive, Pays for nearing a gap, Pays only for the finish.
- Five point sliders: per metre forward, finish bonus, fall penalty, bonus for each moment still playing, hint bonus for being near a gap.
- Learning rate, exploration, "explore less as it learns", number of tries (episodes) and the seed.
- The code is `src/lab/rl-lab.ts` (the environment and the learner), `src/lab/rl-lab-worker.ts` (runs it off the page's thread) and `src/modes/lab-rl.ts` (the page, `?mode=lab-rl&labs=1`).

## What each output means
- **Learning curve:** points per try (teal, average of each block of tries), share of tries that cleared (amber), and the points the game's own line earns under the same rules (grey, dashed).
- **Tries until the first clear:** the first try that reached the finish, while still making random moves.
- **Tries until its best guess clears:** the first time the table's best move at every place (no random moves) cleared; checked every 10 tries.
- **Learned run:** the best-guess run at the end, drawn on the course and played back; its time against the stored line of the ideal-run search.
- **Policy strip:** the best move at every cell it has visited.
- **Random moves:** 200 tries with uniformly random moves.
- **No exploring at all:** the same training with exploration set to zero.
- **Points: learned run and game's own line:** both counted under your rules; when the learned run scores more without clearing, the page says so as a fact.
- **The maths** (after a run): return, the Q-update, epsilon-greedy and why a hint bonus can be farmed (potential-based shaping, Ng, Harada and Russell, 1999).

## What we saw (seed 7 unless stated; run `tests/lab-rl.test.ts` to reproduce)
- Honest points: the character clears; the first clear comes within a few dozen tries; the learned run is slower than the stored line and often jumps more than needed.
- Random moves: no clear in 200 tries, about a third of the course on average.
- No exploring (Honest points): it never learns to jump the last gap and stops at 80% of the course.
- Pays for staying alive (seed 1): the character stays near the start; it collects about 200 points against 86 for the game's own clear.
- Pays for nearing a gap: it sometimes farms the hint and sometimes clears; the outcome depends on the seed, which is itself a lesson about reward design.
- Pays only for the finish: no points on the way, so the table learns nothing from a lucky clear; it rarely finds the run.
- Over ten seeds with the Honest defaults the final policy cleared about 9 times in 10 (a sweep done while building, not a test).

## What we chose in the game, and why
- The game proves a course clearable with a search of the same simulator (`src/sim/ideal.ts`).
- A search that finds a clear is a proof, it gives the same line every time, and it finds the fastest line it can within its budget.
- A learned character only samples: if it never clears, that shows nothing about the course, and the answer depends on the seed and on the points.
- Learning also needs a reward the designer must get right, and this Lab shows how easily it is wrong.
- Where learning would help: a ghost that gets better with every race, because a ghost needs a plausible run, not a proof.
- No learned policy is used anywhere in the game, and the Lab calls no outside service.

## How it was designed
- **The one question:** can a character learn to clear the course by trial and error with points the player writes, and how does a badly written reward go wrong?
- **The choices and why those:**
  - Tabular Q-learning, because the table can be shown on screen and nothing hidden is learned.
  - Three moves (run, jump, wait) and a place-only state, so the whole policy fits in a strip the player can read.
  - Five point sliders and four presets, because reward writing is the lesson and the presets show the classic failures.
  - A seeded generator and no clock, so a result can be reproduced.
- **Which real game code runs:** the real simulator `src/sim/world.ts`, and `playPlan` from `src/sim/ideal.ts` for the game's own line.
  - The environment and learner (`src/lab/rl-lab.ts`) are Lab code, run in a worker (`src/lab/rl-lab-worker.ts`).
- **Which data is precomputed:** only the Search trap course and its stored plan (`public/assets/lab/search-trap.course.json`).
- **Order of the screen and why compare comes last:** points and learning choices, the learning curve, the facts, the learned run, the baselines (random, no exploring), the points of the game's line, and the choice we made in the game last, so the player has seen what learning cannot promise before reading why we use a search.

## How we prove the lesson is right
- `tests/lab-rl.test.ts` (11 tests):
  - The points follow the written rules (for example, a clear of 0.1 m pays 10.1 under Honest points).
  - The seeded generator repeats and an episode is deterministic.
  - Running into the first gap splashes; waiting goes nowhere.
  - The same choices and seed give identical numbers, and another seed gives different ones.
  - Honest points, seed 7: the character clears, finds a first clear and a first policy clear, is not faster than the game's search line (within 0.1 s) and is not marked as a hack.
  - The learning curve improves: the last three blocks collect more than the first three.
  - Random moves do not clear in 150 tries (clear rate 0, mean progress under 0.6).
  - A character that never explores (400 tries) has clear rate 0.
  - Staying-alive points, seed 1: it does not finish, is marked a hack, scores more than the game's line, and gets under half of the course.
  - The game's own line scores between 30 and 45 under Honest points.
  - Out-of-range choices are clamped.
- `scripts/lab-rl-check.mjs`: browser run at 1280 px, ten checks; evidence `docs/evidence/lab-rl-honest-top.png`, `docs/evidence/lab-rl-honest-facts.png` and `docs/evidence/lab-rl-alive-hack.png`.
- Backed claims: honest learning works on this course, random moves and no exploring fail, a staying-alive reward is farmed.
- What would make the Lab's claim false:
  - The staying-alive character clearing the course on seed 1, or Honest points failing on seed 7.
  - A learned line faster than the stored search line by more than 0.1 s (the search would not be the floor).
- Claims in "What we saw" that no test pins:
  - "The first clear comes within a few dozen tries" (the test only requires a first clear exists).
  - "Pays for nearing a gap" farming on some seeds, and "pays only for the finish" rarely finding the run.
  - "About a third of the course" for random moves (the test pins under 0.6).
  - "Stops at 80 % of the course" with no exploring (the test pins only no clear).
  - The ten-seed 9 in 10 sweep.

## Limits
- **One course,** and learning speed on others is not measured.
- **The state is the place only** (not speed or height), so courses where the right move depends on speed are out of reach.
- **Three moves only:** no vault, hang, roll or rope.
- **One seed per claim:** the tests pin seeds 7 and 1; other seeds can differ, which the Lab says but does not test.
- **No function approximation** (no network), so this is not how a modern game agent is trained.
- **The maths box** is not checked by a test beyond being present.
- Phones and touch are out of scope (desktop 1280 px only).

## How to make the lesson better
1. Add tests for the unpinned claims (first-clear tries, the two other presets, the ten-seed rate with a fixed list of seeds).
2. Add the "optimism" switch (start every move high) and show it removes the need for random moves on this course.
3. Add a potential-based hint preset next to the farmable one, and test that it cannot change the best policy.
4. Put speed (a few cells of it) into the state so run-ups can be learned.
5. Learn on a second course and print the tries needed with the same seeds.
6. A ghost mode: train a character per course offline, ship the small table (under 300 KB, with a row in `docs/ASSETS.md`), and race it.
7. Compare with Search: simulator runs the search needs against the tries the character needs, on the same course.
