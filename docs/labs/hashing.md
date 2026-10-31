# Lab 11: Verification and hashing

*A run is its key presses, and the game plays them again to check them.*

## The question
- A recorded run is a list of keys, tick by tick.
- Which part of it do you hash, with which function, so that one changed tick shows up?

## How to open it
- `?mode=lab-hashing&labs=1` (behind the labs switch; new players never see it).
- Desktop keyboard and mouse at 1280 px only.

## The choices
- **What is hashed**
  - The key log: the run-length list of keys, as a shared link carries it.
  - The final state: tick, place, speed, energy and outcome at the end.
  - Every tick: the state at each tick, each hash feeding the next.
- **Which hash function**
  - FNV-1a, 32 bits: the loop the game uses for a course name in a link (`courseHash` in `src/sim/replay.ts`).
  - SHA-256 cut to 64 bits: what the golden files under `tests/golden` use (16 hex digits).
  - Sum of bytes, 16 bits: a checksum, not a hash, to show what mixing buys.
- **The change to the keys**
  - A tick, picked on a slider.
  - Flip one key for that tick, or delete the tick.

## What the outputs mean
- **The picture:** the original run (grey) and the changed run (teal), both played by the real simulator; the dot is the first tick where their states differ.
- **What happened:** the judge's answer for both runs (cleared or not, ticks, from `verifyLog`), the first tick that differs, both hashes, whether they differ and how many digest bits changed.
- **Does the hash see the change?:** all nine combinations of part and function for the same change.
  - A key that does nothing at that tick is seen in the key log and not in the states.
  - So hashing the keys sees more than hashing where the runner ended.
  - Hashing the final state alone says nothing about which tick went wrong; the per-tick chain does.
- **Avalanche:** every single bit of the key log is flipped in turn, and the bars show the average digest bits that change against half of the digest.
- **The maths:** why replay is a check (a deterministic step function), the birthday bound for collisions, the avalanche target, and the chain formula.
- **What the game hashes:** the real course name for this course, the packed size of its log, and the reason for each choice.

## What we chose and why
- A link carries a version, a short course hash, a nick and the key log; it carries no hash of the run.
- The game plays the keys again from the start, and the time it shows is the time the simulator got.
- The keys already decide every state because the simulator is deterministic, so a per-tick hash would add size and no information.
- The course name is only 32 bits: it only has to tell the few courses of one game apart.
- The golden files use SHA-256 because any one changed plan or window must change the digest.

## Code it runs
- `src/labs/hashing/core.ts`: the hash functions, the tamper, the per-tick chain, the avalanche count and the collision formula.
- `src/sim/replay.ts`: `verifyLog`, `recordPlan` and `courseHash`, the real code.
- `src/sim/world.ts`: `stepWorld`, the simulator.
- Course: `public/assets/demo/lache.course.json` with its stored line, recorded to keys.

## How it was designed
- **The one question:** which part of a recorded run do you hash, with which function, so that one changed tick shows up?
- **The choices and why those:**
  - Three scopes (key log, final state, every tick) because each catches a different kind of change.
  - Three functions (FNV-1a 32, SHA-256 cut to 64, a byte sum) because two are used in the project and the sum shows what mixing buys.
  - One tamper (flip or delete a tick) so the cause is a single known edit.
- **Which real game code runs:** `verifyLog`, `recordPlan` and `courseHash` from `src/sim/replay.ts`, and `stepWorld` from `src/sim/world.ts`.
  - The hash functions, the chain, the avalanche count and the tamper (`src/labs/hashing/core.ts`) are Lab code.
- **Which data is precomputed:** the course `public/assets/demo/lache.course.json` and its stored line; the log is recorded from it live.
- **Order of the screen and why compare comes last:** goal, choices, the two played runs, the nine-way table, avalanche, the maths on request, and "what the game hashes" last, so the player has seen what each part catches before reading why we chose as we did.
- **Scope:** this Lab is educational; it explains hashing and does not describe how a game defends itself.

## How we prove the lesson is right
- `tests/lab-hashing.test.ts` (14 tests):
  - Our SHA-256 equals the platform's on eight lengths, including the block edges 55, 56, 63, 64 and 65.
  - Our FNV-1a gives the same text as `courseHash` for the lache course.
  - Each digest has the width it claims.
  - SHA-256 changes between 45% and 55% of its bits for every single-bit flip of the log; FNV-1a changes over 30% of 32 bits; a byte sum under 25% of 16 bits.
  - Replaying the same keys gives equal states and digests every time, and agrees with the game's `verifyLog` (cleared, ticks, final x).
  - Run-length expand and compress are inverses.
  - Removing the first jump is caught by all three scopes.
  - A key that does nothing (aim up at tick 3) is caught by the log scope and not by the final-state or per-tick scopes.
  - The first tick where the per-tick chains differ is the first tick where the states differ.
  - A byte-sum cannot tell an order swap apart (digest equal for [1,2] and [2,1]).
  - The birthday bound: 32 bits and 100000 inputs gives a collision chance between 0.6 and 0.75; 64 bits gives under 1e-9.
- Browser smoke: `scripts/smoke-lab-hashing.mjs`, evidence `docs/evidence/lab-hashing-run.png`.
- What would make the Lab's claim false:
  - A tamper the game's judge accepts but that changes the log hash (the Lab would mislead about "caught").
  - A hash function whose measured bit change was far from its claim.

## Limits
- **One course, one run:** other courses, other plans and longer logs are not tested.
- **One tick per change:** a change that flips many ticks is not tested.
- **Unbacked sentences on the "what the game hashes" card:**
  - That the golden files use SHA-256 cut to 64 bits: no test reads `tests/golden` against this Lab.
  - That a shared link carries no hash of the run: not checked by a test in this Lab.
  - That the course name is only 32 bits: true of FNV-1a in `courseHash`, but the reason given ("only has to tell a few courses apart") is a design statement.
- **Pure-TypeScript SHA-256:** checked against the platform on eight lengths only.
- **Avalanche on one log:** the average is over the bits of the lache log, not over many logs.
- **Plain-words reading** by a 13-year-old of the goal text is not tested.
- Desktop keyboard and mouse at 1280 px only.

## How to make the lesson better
1. Add a test that compares the Lab's SHA-256 prefix with a real golden file, so the card is checked.
2. Add a second course and a longer log, and repeat the "what each part catches" table.
3. Let the player flip several ticks at once and see when the final state finally changes.
4. Add a plain-language read-through with a young reader and fix the goal text.
5. Show a collision hunt on the 16-bit sum so the birthday bound is seen, not read.
