# System design, build the whole game

*The finale: put every earlier Lab to work on one design (see [the series map](pipelines.md)).*
*From: [Collision from a 3D lift](collision.md).*
*Uses: Computer vision, Camera and perspective, Evaluating a detector, Cut-out, lift and bake, Hide the wait, Numerical integration and Collision from a 3D lift.*
*Behind `?labs=1`. Open `?mode=lab-systemdesign&labs=1`. Serves the university Labs (`docs/university-labs.md`).*
*Evidence at 1280 px: [the starter](../evidence/cc-133-pipeline-labs/lab-systemdesign.png), [a misfit with its hints](../evidence/cc-133-pipeline-labs/lab-systemdesign-misfit.png), [a passing design](../evidence/cc-133-pipeline-labs/lab-systemdesign-cleared.png).*

## When you open it
- You see our real pipeline drawn as nine connected cards: the picture, find the object, lift to 3D, when the models run, the waiting, the collider, the simulator, the search and the share.
- Each card holds three blocks that could fit there; the one in the slot is highlighted.
- The starter design runs, but it has problems on purpose.
- Press a block, or drag it onto its card, then press **Run**.
- Eight meters show what the design does: first result, same run every time, cost per 1,000 objects, privacy and law, page stays alive, plays like the real thing, works offline, any new place works.
- Two briefs change which meters count: "Any new photo, online" and "A park kiosk, no internet".
- **Reset to the starter** starts again; **What would the partner say?** asks the Design partner about your current choices.

## The question
- Which block fits each step of our pipeline, and why does a better one fit?
- Nothing is told: a misfit makes a meter red, the card that caused it turns red, and a three-step hint ladder opens on that card:
  - Hint 1 says which meter is red.
  - Hint 2 gives the lesson from an earlier Lab, with a chip that opens that Lab (the name and number come from `src/ui/labs-series.ts`).
  - Hint 3 says why a better block fits.
- There is often more than one good design.
  - When your design clears the brief, the Lab names a different good design and what it trades (for example, a blurred copy or a live link for the picture).

## What runs
- A pure scoring function (`score()` in `src/labs/systemdesign/pipeline.ts`): the same nine choices and the same brief always give the same meters.
  - No model, no clock, no randomness.
- The cut-out and lift seconds, prices and cold starts are the Lab's recorded data (`blocks.ts`, from `docs/model-limits.md`).
  - Any number we never recorded is marked "est." on its block.
- The first result counts the first visitor of the day: a sleeping GPU adds its wake-up time unless an early wake-up is chosen (or the models ran at build time).
- A run walks the nine cards once, then the meters fill.
- The partner pop-up is unchanged in kind: one short comment from Muse Spark Open through `functions/api/design-partner.ts`.
  - It now receives the nine chosen blocks and the simulated meters.
  - If it is not available, a recorded comment made from your meters is shown and labelled as recorded.
- The older rule engine (`blocks.ts`, `judge.ts`) is kept: it still answers the older request shape and its tests still pass.

## The nine slots and their blocks
| Slot | Blocks |
|---|---|
| The picture | store every photo; link the live street photo; keep a blurred small copy |
| Find the object | colour and edge rule; cut-out model; ask a chat model |
| Lift to 3D | flat picture; lift model that wakes per job; GPU kept on all month |
| When the models run | when asked; once at build time; pre-run common places only |
| The waiting | freeze the page; progress bar and a worker; progress plus an early wake-up |
| The collider | raw skin mesh; convex hull; fitted box row |
| The simulator | step by frame time; fixed step; ask a model if it clears |
| The search | try every key press; hash the states and drop repeats; a learned player |
| Share a run | share the key presses; upload a screen video; send the whole 3D object |

## How it was designed
- The first version was one line of blocks to put in order; the product owner found it boring and too hard to learn from.
- The board gives the same lessons (keys, privacy, the simulator decides, hide the wait) as choices with trade-offs, so there is something to discover in every card.
- A hint is earned: it opens only on a card the meters showed was wrong, one step at a time.
- The partner is limited to 6 asks in 10 minutes and shares the daily agent switch with the other model calls.
  - It gets block names and a note of up to 120 letters, never a photo or a name, and comments on the design, never on the person.

## How we prove the lesson is right
- `tests/lab-systemdesign-board.test.ts` (19): scoring is pure and deterministic; every slot has at least 3 blocks; every misfit block has a 3-step ladder; every hint chip points at a real Lab; at least two distinct designs clear each brief; a passing design gets a different good design with its trade-off; the partner takes the current choices.
- `tests/lab-systemdesign.test.ts` (12) and `tests/design-partner.test.ts` (7): the older judge and the partner, unchanged.
- `scripts/lab-systemdesign-check.mjs`: a browser check at 1280 px with the model stubbed to fail: it runs the starter, opens the three hints, drops blocks in by drag and by press, clears the brief, switches brief, resets and checks the recorded label.
- One manual live call confirmed the model answers; it costs well under one cent.

## Limits
- Costs and seconds are for the recorded runs; blocks marked "est." are our estimates, not measurements.
- The brief thresholds (30 seconds, 15 dollars per 1,000) are a teaching choice.
- The model's opinion can be wrong; the meters are the facts.
- No model runs on any photo here.

## How to make the lesson better
- Let the player type their own limits and see which blocks still fit.
- Add a brief about a second model host.
- Show the monthly price on each block when the volume changes.
