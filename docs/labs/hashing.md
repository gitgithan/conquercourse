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

## Tests
- `tests/lab-hashing.test.ts`:
  - our SHA-256 equals the platform's on edge lengths;
  - our FNV-1a equals `courseHash`;
  - SHA-256 flips about half of its bits per input bit; a byte sum flips few;
  - replaying gives the same states and digests every time, and agrees with `verifyLog`;
  - removing the first jump is seen by every part; a key that does nothing is seen in the log and not in the states;
  - the first tick where the hash chains differ is the first tick where the states differ;
  - the birthday bound for 32 and 64 bits.
- Browser smoke: `scripts/smoke-lab-hashing.mjs`, evidence `docs/evidence/lab-hashing-run.png`.

## Not tested
- Other courses than the one stored line (this Lab uses one course).
- A change that flips many ticks at once (one tick per change here).
- Plain-words reading by a 13-year-old of the goal text.
