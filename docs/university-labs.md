# University labs: design the game's own algorithms

*Product owner, 2026-10-29: "Let's have some advanced courses at university level, where the player supplies heuristics, makes choices, sets targets and sees outputs, as if designing this game themselves."*

## The index
- One row per Lab with its question, address, tests and biggest limit: [docs/labs/README.md](labs/README.md).
- Each Lab doc says how it was designed, how we prove it, its limits and how to make it better.

## The idea
- A Lab is a small workbench on top of something the game already does.
- The player changes one choice (a heuristic, a threshold, a target), runs it, and reads facts about the result.
- Every Lab ends by showing what we chose in the game and why.
- Labs are on by default since 2026-11-01 (product owner's decision).
- `?labs=0` hides them and the browser remembers it; `?labs=1` brings them back.

## Rules that stay in force
- No chat tutor: a Lab never talks; it shows numbers and pictures.
- No grading of a person's technique: a Lab reports facts about an algorithm (steps tried, seconds, seconds saved), never a mark for the player.
- Equations are allowed inside Labs (product owner, 2026-10-29: "They are university level"); they stay out of the Course and the Dojo rule is unchanged.
- Earth-only physics; game framing, never robotics framing (inverse kinematics is shown as posing a character).

## Lab format
- **Goal:** one question, such as "find a clear run in under 2000 steps".
- **Choices:** two or three controls (a method, a weight, a threshold).
- **Run:** the real code, in the browser or a worker, not a mock-up.
- **Output:** facts (steps tried, time, whether it cleared, how far from our best line).
- **Compare:** our own setting, shown last, with the reason we chose it.

## The subjects, best use first
| # | Subject | What the player changes | What the player sees | Code it uses |
|---|---|---|---|---|
| 1 | Search algorithms | Method (exhaustive, greedy, beam, A*), a heuristic mixed from distance-to-go, speed and height | Steps tried, time, cleared or stuck, the run played back | `src/sim/ideal.ts`, `src/sim/shortcuts.ts` |
| 2 | Optimization | Which settings to tune (drone brake and descent, rope release) and the search (grid, hill-climb, random) | A map of time over the settings, with local peaks and where each method stopped | drone and rope plans in `src/sim/ideal.ts` |
| 3 | Inverse kinematics | Drag a hand target; joint limits; the neck rule | The arm bend, the elbow flip, the point where the pose breaks | `src/motion/`, contact IK |
| 4 | Computer vision | Mask thresholds (share masked, person size) on a labelled photo set | Photos kept and people missed, as a trade-off curve | `scripts/photos_mask.py`, `scripts/photos_safe.py` |
| 5 | Camera and perspective | Field of view, height, angle for the front and side views | How a body looks from each view and why one photo cannot give depth | `src/render/`, video to motion |
| 6 | Numerical integration | Step size and method | Energy drift on the coaster, and whether a replay still matches | `src/sim/cart.ts`, `src/sim/energy.ts`, `src/sim/replay.ts` |
| 7 | Statistics of timing | How shaky the presses are | How often a run clears: the window width as a difficulty | `Window` in `src/sim/ideal.ts` |
| 8 | Signal processing | Smoothing strength on a captured clip | Jitter against lag, foot sliding | plausibility gate |
| 9 | Generate and test | What a design helper may propose | How many proposals the simulator throws out | `functions/api/designer.ts`, make-me-a-course |
| 10 | Evaluating a detector | A prompt or a threshold | Hits, misses and false claims on labelled parts (PartLLM: 2 of 9 found, 11 false claims) | `data/eval/partllm/` |
| 11 | Verification and hashing | Which parts of a run are hashed | Whether a tampered input log is caught | replay and golden hashes |
| 12 | Reinforcement learning | The points (progress, finish bonus, fall penalty, a hint), the learning rate and the exploration | A learning curve, how many tries to the first clear, the learned run played back, the game's own line and random moves beside it, and a reward the character farms instead of finishing | `src/lab/rl-lab.ts` on the real simulator, `src/sim/ideal.ts` for the comparison |

## Build order
- **Search:** first, because the simulator and the search already exist, it runs headless in a worker, and it has a real lesson already in the code (the greedy choice can strand a later jump).
- **Optimization:** next, on the same plans.
- **Inverse kinematics:** third, using the editor's side view.
- **The next eight Labs (Computer vision to Verification and hashing):** one issue each, only after Search is played.
- **Reinforcement learning:** after Search, because it uses the same trap course and the same stored line (`docs/labs/rl.md`).

## Search in detail: Search
- Course: a small chain where greedy fails on purpose (a jump that lands well but leaves the next press no room).
- Choices:
  - Method: exhaustive, greedy, beam (width 1 to 20), A*.
  - Heuristic: three sliders (how much to value distance gained, speed kept, height kept).
  - Budget: steps allowed.
- Output: cleared or not, steps tried, seconds, run time of the line found, gap to our best line, and the line played back.
- Compare: our ideal search, with one sentence on why it is greedy first and a repair pass second.
- Target-setting: the player sets a budget, and the Lab shows which methods fit inside it.

## Not decided
- Whether finished Labs unlock anything.
- Whether Labs count as "AI for education" for the hackathon; the answer is no while there is no tutor and no chatbot, and they stay game design workbenches.

## Every Lab opens already run (owner, 2026-11-01)
- Opening a Lab shows our setting already run, with every output filled, so a demo needs no click on Run.
- The label "Showing our setting, already run" says so; slow Labs say "Precomputed with the same code (seed N)".
- Rules for a new Lab: run live on open if it takes well under two seconds; otherwise precompute with the same code and a seed, ship a small file, and add a test that re-runs it.
- See [docs/labs/README.md](labs/README.md) for the list and `scripts/labs-default-smoke.mjs` for the check.
