# Design partner loop (propose, check, fix)

*A design partner proposes a course; the simulator checks it and says in plain words what to change; Fix it repairs it.*
*The loop is about the course, never about the person: no chat tutor, no grading of technique.*
*Open it at `?mode=lab-partner&labs=1`.*
*The number is the slot in the list today; if the Design partner loop slicer lands first, this Lab becomes System design.*

## What the player does
- Pick a brief and a recorded answer from the partner: good, too hard, impossible, or malformed.
- Walk the five gates: Partner, Reader, Rules, Simulator, Shown.
- Move or resize a piece (drag it, or use the slider), or swap a piece between Gap, Block and Bar.
- Press Fix it to run the repair code on the course and see the cleared run.
- Solve four challenges, each judged by the real simulator (a visible pass or fail).
- Open "What we did" to see how the game handles the same loop.

## How it was designed
- The loop is the one the game uses: the reader (`parseLayout`), the rules (at most 10 pieces), the simulator (`testLayout`), and only then the show.
  - The Lab calls the game's own code; it copies none of it.
- Every answer is recorded, so the Lab makes no model call and costs nothing to open.
  - Real answers: the Muse Spark Open proposals of [Generate and test](gentest.md), and one real model repair trace (`i02`) from the CC-133 text test.
  - Written by us, and labelled so: the malformed answers (not JSON, wrong shape, a reply cut off) and the answer with 12 pieces.
- The simulator's reports for the six readable answers are computed ahead of time (`scripts/lab-partner-precompute.ts`), so the Lab opens already run.
  - A piece you change is sent to the same simulator in a worker, about a third of a second after you stop.
- Fix it applies the single easing that the simulator has already proved, for example "lowered to 0.68 m".
  - It then runs the simulator again, so a repair is only shown if it clears.
- The picture is a side view on one lane: pieces, the best run, a red box where it stopped, a grey dashed ghost of the piece before the fix.
- The plain-words reason is the game's own `reportWords`.
- Order of the screen and why: the five gates first (where it stopped), the picture next, the reason after, the guard rails last.

## How we prove the lesson is right
- `tests/lab-partner.test.ts` (13 tests) pins:
  - the reader decides which answers are courses, and the rules gate catches the 12-piece answer.
  - the recorded layouts survive the reader unchanged.
  - the shipped reports sort answers into good, too hard and not provable, and a fresh run of the simulator equals them.
  - Fix it changes exactly one piece and then clears, for three too-hard answers.
  - the recorded model repair equals the change Fix it makes.
  - the four challenge judges, and that a 3 m wall cannot be cleared.
- What would make the Lab's claim false: a Fix it that changes more than one piece, or a "cleared" that the simulator does not clear.
- Browser check: `scripts/lab-partner-check.mjs` (14 checks, no page errors).
- Picture: [the Lab at 1280 px](../evidence/cc-133-pipeline-labs/lab-partner.png).

## Guard rails, shown honestly
- The partner only sends words; the Lab never sends it a picture or a name.
- A reply that is not a course stops at the Reader; a course with more than 10 pieces stops at the Rules.
- Only a course the simulator clears is shown.
- The [safety check](../trust-and-safety.md) covers uploaded photos; this Lab takes words only.

## What we saw
- "Proven" means proven at the sizes the simulator accepts: a 3 m wall asked for became about 0.68 m.
- Some too-hard answers cannot be eased by one change; the Lab says so and shows no repair.
- A thinking model can spend its whole answer budget thinking and send a cut-off reply, which the Reader refuses.

## Overlap with other Labs
- [Generate and test](gentest.md) shows the same recorded proposals as a tally and eases one piece; this Lab shows one answer through the gates, with the repair.
- [Search](search.md) explains the search behind the proof; this Lab only uses its result.
- Nothing was removed; this Lab links to both.

## Limits
- Fix it applies the proved easing; it does not use the editor's own Fix it (`fixLayout`), which works on pieces with a search.
- The run trail is a sketch, not the physics path.
- The recorded answers are few: the real ones are from one model, and the failed ones are written by us.
- One lane, three piece types.
- "Cleared" means the search found a run; it says nothing about whether the course is fun.

## How to make the lesson better
1. Use the editor's `fixLayout` so the Lab shows more than one kind of repair.
2. Record more real answers, including real malformed ones.
3. Draw the real path of the best run instead of a sketch.
4. Let the player type a brief and call the partner live, behind a switch and with the cost stated.
5. Show the repair and the person's own edit side by side.
