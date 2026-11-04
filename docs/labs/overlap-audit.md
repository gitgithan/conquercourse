# Labs overlap audit

*Written for the product owner, who decides; nothing was deleted or changed in any Lab because of this page.*
*Method: read the "question", "what runs", "how it was designed" and "limits" parts of Labs 1 to 12, grepped the docs for repeated topics, and compared them with `docs/lessons*.md`, `docs/hash-design.md`, `docs/pipelines.md` and `docs/motion-pipeline.md`.*
*"Better copy" means the copy with a test behind it and the clearer words.*
*The new Labs (collision, lift, motion) are covered in the last section, as far as they had landed when this was written.*

## So what
- The twelve Labs overlap less than feared: most repeats are shared setting (one course, one seed, one worker), not repeated teaching.
- Four real overlaps matter:
  - Replay and determinism are taught in both Lab 6 and Lab 11.
  - Precision and recall are taught in both Lab 4 and Lab 10.
  - Search, optimization and learning (Labs 1, 2, 12, and in part 9) all score a candidate by the same `playPlan` run.
  - The "do not hash what you measured" rule and the cross-hardware hash story live in docs, not in the Labs that teach hashing.
- The one gap that matters for the series: no Lab teaches Bake, and none opens a real share link.

## The overlaps

### 1. Replay and determinism: Lab 6 and Lab 11 (and `lessons-cross-hardware-testing.md`)
- Lab 6 (integration) asks "does a replay at your step match the game's recording?".
- Lab 11 (hashing) asks "which part of a replay do you hash?".
- Both lean on one fact: the same keys and the same step rule give the same run, bit for bit.
- Lab 11 states the fact in its maths box ("why replay is a check"); Lab 6 shows it by changing the step.
- The cross-hardware lesson (Node 22 and 24 gave different hashes on six courses, fixed by one maths function) is the best proof of that fact and appears in neither Lab.
- **Better copy:** Lab 6 for why steps drift; Lab 11 for why a deterministic step makes replay a check.
- **Recommendation:** keep both; make Lab 11 link to Lab 6 for "why the step is exact", and add the Node 22 against 24 story to Lab 11's "What we found" as the real-life case.

### 2. Precision and recall: Lab 4 and Lab 10
- Lab 4 shows recall, precision and a free-response ROC point for a mask threshold.
- Lab 10 builds precision, recall and F1 from a 2 by 2 table of found, missed and made up.
- Same words, two different data sets (street photos with people; six park objects).
- **Better copy:** Lab 10, which earns the definitions from counts.
- **Recommendation:** keep both; in Lab 4 replace the definitions in the maths box with "see Lab 10 for what recall and precision mean". Lab 4 keeps the trade-off curve, which is its own lesson.

### 3. Scoring a candidate with `playPlan`: Labs 1, 2, 7, 9, 12
- Lab 1 scores a node, Lab 2 a settings cell, Lab 7 a jittered press, Lab 9 a proposed course, Lab 12 a learned run; all play the real simulator.
- Lab 1 and Lab 12 share the same trap course and stored line (`search-trap.course.json`); Lab 12 says so.
- Lab 1 (search methods) and Lab 12 (learn by trial and error) both answer "how many tries to find a clear run?", with different tools.
- Lab 2 and Lab 1 both count simulator runs as the cost.
- **Better copy:** Lab 1 for "how many runs"; Lab 2 for the map with peaks; Lab 12 for reward writing.
- **Recommendation:** keep all; this is a family.
  - The README could say "Labs 1, 2 and 12 are three answers to one question: how to find a good run".

### 4. Seeded randomness and "same choices, same numbers": Labs 1, 2, 7, 8, 9, 11, 12
- Seven docs state that the seed is fixed and a test runs the Lab twice.
- It is a shared rule, repeated as a proof bullet in each doc.
- **Recommendation:** leave the tests; shorten the doc bullets to one line linking to `docs/university-labs.md`.
  - Low value either way.

### 5. Press timing: Lab 7 and Lab 2
- Lab 2's "game's pick" card says the game centres the release in its window; Lab 7 measures the window itself.
- Not a duplicate: Lab 2 uses windows, Lab 7 teaches them.
- **Recommendation:** keep; add "see Lab 7 for what a window is" in Lab 2.

### 6. Smoothing and the plausibility gate: Lab 8 and `docs/motion-pipeline.md`, `docs/pipelines.md` section 4
- Lab 8 holds a TypeScript port of the Python gate, checked on 33 cases against the Python gate (the strongest check in any Lab).
- The pipeline docs describe the same gate in words and rules.
- **Better copy:** Lab 8 for the working version; the pipeline docs for the full rule list.
- **Recommendation:** keep both; Lab 8 should link the rule list instead of restating it.

### 7. Hash design: Lab 11 and `docs/hash-design.md`
- `hash-design.md` says "hash only what changes play; leave-in beats leave-out" and tells the CC-224 accident.
- Lab 11's "what the game hashes" card names the course hash and the golden files but not that rule.
- **Better copy:** `hash-design.md` (a real incident, a rule, tests).
- **Recommendation:** add a "What we learned the hard way" link from Lab 11 to `hash-design.md`; do not copy the text.

### 8. One photo cannot give depth: Lab 5 and the lift story in `lessons-obstacle-creation.md`
- Lab 5 proves with hand-made bodies that one front photo cannot fix depth.
- The obstacle lessons say a lift keeps only part of thin or long objects and that size comes from a typed height.
- Same cause (depth is a guess), told once in maths and once in outcomes.
- **Recommendation:** keep; the new lift Lab should link both.
  - See the last section.

### 9. People in photos: Lab 4 and the Mapillary carve-out in `CLAUDE.md`
- Lab 4's thresholds (score cut 0.3, 25 percent biggest box) restate rules from `scripts/photos_mask.py` and `scripts/photos_people.py`.
- The doc says the numbers are shown "on the page, with live numbers", so a change in the script can leave the doc stale.
- **Recommendation:** keep; a test that reads the constants from the script would end the risk (Lab 4's known limit already says its 125 against 131 count).

### 10. Posing, IK and neck rule: Lab 3 and `docs/character-pipeline.md`
- Lab 3 runs `ik2` and `settleNeck`; the character pipeline describes the same steps.
- **Recommendation:** keep; link only.

### 11. Both "Cut-out" Labs are not about cutting out
- The series map puts Labs 4 and 10 at "Cut-out" because they are the nearest.
- Lab 4 hides people; Lab 10 scores a recorded detector for holds.
- This is a gap, not a duplicate: no Lab cuts an object out of a photo (the lift Lab may start there).

## Smaller repeats
- Each Lab doc has "When you open it" with nearly the same two bullets; the README also states them.
  - Keep the doc line, drop nothing.
- Every Lab says "desktop keyboard and mouse at 1280 px only" and "behind the labs switch"; the rule is in `docs/university-labs.md`.
- The README "Reading the status of a Lab" restates the PR 420 story that `tests/no-conflict-markers.test.ts` already covers.
  - It can go to `docs/lessons.md`.

## The new Labs (read from the authors' working folders before they landed; re-check after merge)

### 12. Three Labs each say "Lab 13"
- The collision, lift and motion docs were each written as "Lab 13"; numbers come from the place in `src/ui/labs-series.ts`, so only one can be 13.
- Motion landed first and is Lab 13.
- **Recommendation:** whoever merges last fixes the title lines to the numbers the list gives (13, 14, 15 in merge order); the numbers are ids, so fix the titles and not the list.

### 13. Different words for "which stage": 4 of 8, 2 and 3 of 8, 2 of 3
- Collision calls itself "stage 4 of 8", lift "stages 2 and 3 of 8", motion "stage 2 of 3".
- The series map in `pipelines.md` has three pipelines with 6, 5 and 5 stages.
- **Recommendation:** use the stage names from the series map ("Photo to course object, stage 5: Collision") in all three titles.

### 14. Gate and smoothing: new motion Lab and Lab 8
- The motion Lab shows the same gate (it reuses Lab 8's TypeScript port) on ten clips, and the game's smoothing; Lab 8 shows the same gate on noisy clips.
- The motion Lab says plainly that the cost of smoothing is Lab 8's and links it, which is the right way.
- **Better copy:** Lab 8 for the filters and the Python cross-check; the motion Lab for the story of one filmed move.
- **Recommendation:** keep both; the gate rule list should live in one place (`pipelines.md` section 4) and both Labs link to it.

### 15. Posing the Rookie: the motion Lab (step 5) and Lab 3
- The motion Lab retargets a clip onto the Rookie; Lab 3 solves reach with the same bones.
- The motion Lab says it does not teach reaching.
  - No repeat.

### 16. Bake and the thin-bar lesson: the lift Lab, `pipelines.md` and `lessons-obstacle-creation.md`
- The seven bake steps and the typical-height table are written in `pipelines.md` step 4 and again in the lift Lab's code and doc; a test pins the Lab to the table, so a change in one fails the other.
- The thin-bar lesson (0.25 m gives 5.4 m) is also in the obstacle lessons.
- **Better copy:** the Lab (it is runnable and tested).
- **Recommendation:** keep; shorten the pipeline doc step to a link once the Lab is the reference.

### 17. Why depth is a guess: the lift Lab and Lab 5
- The lift Lab links Lab 5 for "one photo gives no depth" and does not repeat it.
  - No repeat.

### 18. Collision: the collision Lab and `docs/collision-from-3d.md`
- The nine steps (voxelise, close, biggest piece, top band, peaks, one spacing, the row, the simulator) appear in both.
- The Lab runs the real functions and has 27 tests; the doc explains in words.
- **Better copy:** the Lab for numbers; the doc for the reason each step exists.
- **Recommendation:** keep both and make the doc's step list say "run it in Lab N".

### 19. Replay in the collision Lab and Lab 11
- The collision Lab's last step plays recorded keys through `verifyLog` on the new course.
- Lab 11 teaches `verifyLog`.
- **Recommendation:** the collision Lab links Lab 11 for what the judge does.

### 20. Detector in the lift Lab
- The lift Lab says "after the object exists, is the part found right?" and links Lab 10.
  - No repeat.
