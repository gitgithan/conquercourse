# Lab 17: System design, build the whole game

*The finale: put every earlier Lab to work on one design (see [the series map](pipelines.md)).*
*From: [Lab 15, Collision from a 3D lift](collision.md).*
*Uses: Labs 1, 5, 8, 11, 13, 14 and 15.*
*Behind `?labs=1`. Open `?mode=lab-systemdesign&labs=1`. Serves the university Labs (`docs/university-labs.md`).*
*Evidence: [the Lab at 1280 px](../evidence/cc-133-pipeline-labs/lab-systemdesign.png).*

## When you open it
- It opens on a first try that has problems: a page, a browser game and two models with the key in the page.
- The meters and the seven checks already say what is wrong.
- Drag blocks from the left into the design (or press a block to add it); drag a chip to reorder it; press x to remove it.
- Pick a scenario at the top; the design stays.

## The question
- If you had to build this game from nothing, which pieces would you pick, and in which order?
- The answer the Lab shows: the order is the design (a safety check before the GPU, a mask before the model), and each rule comes from something that went wrong in the real project.

## What runs
- A rule engine (`src/labs/systemdesign/judge.ts`) with no randomness: the same blocks in the same order give the same answer.
- Four live meters: cost per 1,000 objects, time to first result (warm and cold), privacy risk and failure coverage.
- A pretend failure: pick a block that is down and watch the flow; a block with a fallback shows a result, a block without one shows a hanging player.
- One short comment from Muse Spark Open through a server function (`functions/api/design-partner.ts`), labelled as the partner's opinion; if it is not available, a recorded example is shown and labelled as recorded.
- A reveal that draws your design above the real game's and marks the differences.

## The scenarios
1. A photo with a face in it.
2. 10,000 players on a free budget.
3. The GPU model is down.
4. Pick the model for each job.

## Numbers
- Costs come from the recorded GPU rates (Modal L4 0.80 and L40S 1.95 dollars an hour) and the recorded seconds of each run.
- The cut-out costs about 0.00059 dollars a run and the lift about 0.00623 dollars; an always-on L40S is about 1,423 dollars a month.
- The cold start is 14 s for the cut-out and 46 s for the lift.

## How it was designed
- The rules are the lessons in `docs/lessons.md`, one rule each: keys stay on the server, blur before the model, a safety check before paid work, a cap before money is spent, the simulator decides, a fallback for every model, and so on.
- The judge wins on facts; the model comment never changes a score.
- One comment, not a chat: it gets block names and a note of up to 120 letters, never a photo or a name.
- The model reasons first and that counts against its token cap, so the cap is high (6,000) and the call is cut off after 24 s.
- The partner is limited to 6 asks in 10 minutes and shares the daily agent switch with the other model calls.
- It comments on the design, never on the person.

## How we prove the lesson is right
- `tests/lab-systemdesign.test.ts` (12): the default fails the key lesson; the real design clears all seven checks; the order matters; failure with no fallback hangs; meters equal the recorded numbers.
- `tests/design-partner.test.ts` (7): a fake model only; no paid call runs in a test.
- `scripts/lab-systemdesign-check.mjs`: a browser check with the model stubbed to fail; it drags blocks, reorders, breaks the order, plays a failure, checks the recorded label, the reveal and the Back to the game button.
- One manual live call confirmed the model answers; it costs well under one cent.

## Limits
- The costs are for the recorded runs, not a forecast for a different photo size.
- The safety check before the mask is a trade-off we chose: it sees the photo first, so the Lab says so.
- The recorded examples are written by hand for six common designs and are labelled as recorded.
- The model's opinion can be wrong; the judge's checks are the facts.
- It does not run any model on a photo.

## How to make the lesson better
- Let the player type a budget and see which blocks fit.
- Add a scenario about a second model host.
- Show the monthly cost of each block next to its name.
