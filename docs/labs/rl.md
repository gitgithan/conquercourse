# Lab 12: Reinforcement learning

## The question
- Can a game character learn to clear a course by trial and error, with points the player writes?
- How many tries does it need, how close does it get to the game's own best line, and how does a badly written reward go wrong?

## What the character is
- It plays the real simulator (`src/sim/world.ts`), the same one the game and the ideal-run search use.
- Its only moves are real inputs: run, jump, and wait (let go of run).
- It picks a move about every twentieth of a second while its feet are on the ground; after a jump it keeps running until it lands.
- It sees only where it is: a table with one row for each 0.25 m cell of the course.
- It learns the table with tabular Q-learning; nothing else is learned.
- The course is the Lab 1 trap course (`public/assets/lab/search-trap.course.json`): three gaps, and the farthest first jump strands the second.
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

## What is not tested
- Only one course; the learning speed on other courses is not measured.
- The state is the place only (not speed or height), so courses where the right move depends on speed are out of reach of this table.
- Only three moves (no vault, hang, roll or rope); the action set is kept to run, jump and wait on purpose.
- Function approximation (a small network) is not used.
- The ten-seed success rate above is not asserted by a test; the tests pin seed 7 (clears) and seed 1 with staying-alive points (does not clear).
- Phones and touch are out of scope (desktop 1280 px only).

## What to build next
- Add the unvisited-state "optimism" switch: start every move with a high value so the character tries each move once; show how it removes the need for random moves on this course.
- Add a "potential-based hint" preset next to the farmable one, to show a shaping bonus that cannot change the best policy.
- Put speed (a few cells of it) into the state, so the character can learn when a run-up matters.
- Learn on a second course from the menu and print the tries needed for each, with the same seeds.
- A ghost mode: train a character per course offline, ship the small table (under 300 KB, with a row in `docs/ASSETS.md`), and race it as a ghost that gets faster with each of the player's runs.
- Compare with Lab 1: the number of simulator runs the search needs against the number of tries the character needs, on the same course.
