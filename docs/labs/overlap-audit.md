# Labs overlap audit

*Written for the product owner, who decides; nothing was deleted or changed in any Lab because of this page.*
*Method: read the "question", "what runs", "how it was designed" and "limits" parts of the twelve first Labs, grepped the docs for repeated topics, and compared them with `docs/lessons*.md`, `docs/hash-design.md`, `docs/pipelines.md` and `docs/motion-pipeline.md`.*
*"Better copy" means the copy with a test behind it and the clearer words.*
*The new Labs (collision, lift, motion) are covered in the last section, as far as they had landed when this was written.*

## So what
- The twelve Labs overlap less than feared: most repeats are shared setting (one course, one seed, one worker), not repeated teaching.
- Four real overlaps matter:
  - Replay and determinism are taught in both Numerical integration and Verification and hashing.
  - Precision and recall are taught in both Computer vision and Evaluating a detector.
  - Search, optimization and learning (Search, Optimization, Reinforcement learning, and in part Generate and test) all score a candidate by the same `playPlan` run.
  - The "do not hash what you measured" rule and the cross-hardware hash story live in docs, not in the Labs that teach hashing.
- The one gap that matters for the series: no Lab teaches Bake, and none opens a real share link.

## The overlaps

### 1. Replay and determinism: Numerical integration and Verification and hashing (and `lessons-cross-hardware-testing.md`)
- Numerical integration asks "does a replay at your step match the game's recording?".
- Verification and hashing asks "which part of a replay do you hash?".
- Both lean on one fact: the same keys and the same step rule give the same run, bit for bit.
- Verification and hashing states the fact in its maths box ("why replay is a check"); Numerical integration shows it by changing the step.
- The cross-hardware lesson (Node 22 and 24 gave different hashes on six courses, fixed by one maths function) is the best proof of that fact and appears in neither Lab.
- **Better copy:** Numerical integration for why steps drift; Verification and hashing for why a deterministic step makes replay a check.
- **Recommendation:** keep both; make Verification and hashing link to Numerical integration for "why the step is exact", and add the Node 22 against 24 story to Verification and hashing's "What we found" as the real-life case.

### 2. Precision and recall: Computer vision and Evaluating a detector
- Computer vision shows recall, precision and a free-response ROC point for a mask threshold.
- Evaluating a detector builds precision, recall and F1 from a 2 by 2 table of found, missed and made up.
- Same words, two different data sets (street photos with people; six park objects).
- **Better copy:** Evaluating a detector, which earns the definitions from counts.
- **Recommendation:** keep both; in Computer vision replace the definitions in the maths box with "see Evaluating a detector for what recall and precision mean". Computer vision keeps the trade-off curve, which is its own lesson.

### 3. Scoring a candidate with `playPlan`: Search, Optimization, Statistics of timing, Generate and test, Reinforcement learning
- Search scores a node, Optimization a settings cell, Statistics of timing a jittered press, Generate and test a proposed course, Reinforcement learning a learned run; all play the real simulator.
- Search and Reinforcement learning share the same trap course and stored line (`search-trap.course.json`); Reinforcement learning says so.
- Search (search methods) and Reinforcement learning (learn by trial and error) both answer "how many tries to find a clear run?", with different tools.
- Optimization and Search both count simulator runs as the cost.
- **Better copy:** Search for "how many runs"; Optimization for the map with peaks; Reinforcement learning for reward writing.
- **Recommendation:** keep all; this is a family.
  - The README could say "Search, Optimization and Reinforcement learning are three answers to one question: how to find a good run".

### 4. Seeded randomness and "same choices, same numbers": Search, Optimization, Statistics of timing, Signal processing, Generate and test, Verification and hashing, Reinforcement learning
- Seven docs state that the seed is fixed and a test runs the Lab twice.
- It is a shared rule, repeated as a proof bullet in each doc.
- **Recommendation:** leave the tests; shorten the doc bullets to one line linking to `docs/university-labs.md`.
  - Low value either way.

### 5. Press timing: Statistics of timing and Optimization
- Optimization's "game's pick" card says the game centres the release in its window; Statistics of timing measures the window itself.
- Not a duplicate: Optimization uses windows, Statistics of timing teaches them.
- **Recommendation:** keep; add "see Statistics of timing for what a window is" in Optimization.

### 6. Smoothing and the plausibility gate: Signal processing and `docs/motion-pipeline.md`, `docs/pipelines.md` section 4
- Signal processing holds a TypeScript port of the Python gate, checked on 33 cases against the Python gate (the strongest check in any Lab).
- The pipeline docs describe the same gate in words and rules.
- **Better copy:** Signal processing for the working version; the pipeline docs for the full rule list.
- **Recommendation:** keep both; Signal processing should link the rule list instead of restating it.

### 7. Hash design: Verification and hashing and `docs/hash-design.md`
- `hash-design.md` says "hash only what changes play; leave-in beats leave-out" and tells the CC-224 accident.
- Verification and hashing's "what the game hashes" card names the course hash and the golden files but not that rule.
- **Better copy:** `hash-design.md` (a real incident, a rule, tests).
- **Recommendation:** add a "What we learned the hard way" link from Verification and hashing to `hash-design.md`; do not copy the text.

### 8. One photo cannot give depth: Camera and perspective and the lift story in `lessons-obstacle-creation.md`
- Camera and perspective proves with hand-made bodies that one front photo cannot fix depth.
- The obstacle lessons say a lift keeps only part of thin or long objects and that size comes from a typed height.
- Same cause (depth is a guess), told once in maths and once in outcomes.
- **Recommendation:** keep; the new lift Lab should link both.
  - See the last section.

### 9. People in photos: Computer vision and the Mapillary carve-out in `CLAUDE.md`
- Computer vision's thresholds (score cut 0.3, 25 percent biggest box) restate rules from `scripts/photos_mask.py` and `scripts/photos_people.py`.
- The doc says the numbers are shown "on the page, with live numbers", so a change in the script can leave the doc stale.
- **Recommendation:** keep; a test that reads the constants from the script would end the risk (Computer vision's known limit already says its 125 against 131 count).

### 10. Posing, IK and neck rule: Posing a character and `docs/character-pipeline.md`
- Posing a character runs `ik2` and `settleNeck`; the character pipeline describes the same steps.
- **Recommendation:** keep; link only.

### 11. Both "Cut-out" Labs are not about cutting out
- The series map puts Computer vision and Evaluating a detector at "Cut-out" because they are the nearest.
- Computer vision hides people; Evaluating a detector scores a recorded detector for holds.
- This is a gap, not a duplicate: no Lab cuts an object out of a photo (the lift Lab may start there).

## Smaller repeats
- Each Lab doc has "When you open it" with nearly the same two bullets; the README also states them.
  - Keep the doc line, drop nothing.
- Every Lab says "desktop keyboard and mouse at 1280 px only" and "behind the labs switch"; the rule is in `docs/university-labs.md`.
- The README "Reading the status of a Lab" restates the PR 420 story that `tests/no-conflict-markers.test.ts` already covers.
  - It can go to `docs/lessons.md`.

## The new Labs (read from the authors' working folders before they landed; re-check after merge)

### 12. Three Labs once claimed the same number (settled: Labs are known by name only)
- The collision, lift and motion docs were each written with the same Lab number; since the numbers were removed, each Lab is named by its own title.
- Motion landed first and is Video to motion; lift is Cut-out, lift and bake; collision is Collision from a 3D lift.

### 13. Different words for "which stage": 4 of 8, 2 and 3 of 8, 2 of 3
- The three docs first said "stage 4 of 8", "stages 2 and 3 of 8" and "stage 2 of 3"; the top lines now use the series map's stages.
- The series map in `pipelines.md` has three pipelines with 6, 5 and 5 stages.
- Fixed in the same change as this audit; kept so the next Lab uses the same wording.

### 14. Gate and smoothing: new motion Lab and Signal processing
- The motion Lab shows the same gate (it reuses Signal processing's TypeScript port) on ten clips, and the game's smoothing; Signal processing shows the same gate on noisy clips.
- The motion Lab says plainly that the cost of smoothing is Signal processing's and links it, which is the right way.
- **Better copy:** Signal processing for the filters and the Python cross-check; the motion Lab for the story of one filmed move.
- **Recommendation:** keep both; the gate rule list should live in one place (`pipelines.md` section 4) and both Labs link to it.

### 15. Posing the Rookie: the motion Lab (step 5) and Posing a character
- The motion Lab retargets a clip onto the Rookie; Posing a character solves reach with the same bones.
- The motion Lab says it does not teach reaching.
  - No repeat.

### 16. Bake and the thin-bar lesson: the lift Lab, `pipelines.md` and `lessons-obstacle-creation.md`
- The seven bake steps and the typical-height table are written in `pipelines.md` step 4 and again in the lift Lab's code and doc; a test pins the Lab to the table, so a change in one fails the other.
- The thin-bar lesson (0.25 m gives 5.4 m) is also in the obstacle lessons.
- **Better copy:** the Lab (it is runnable and tested).
- **Recommendation:** keep; shorten the pipeline doc step to a link once the Lab is the reference.

### 17. Why depth is a guess: the lift Lab and Camera and perspective
- The lift Lab links Camera and perspective for "one photo gives no depth" and does not repeat it.
  - No repeat.

### 18. Collision: the collision Lab and `docs/collision-from-3d.md`
- The nine steps (voxelise, close, biggest piece, top band, peaks, one spacing, the row, the simulator) appear in both.
- The Lab runs the real functions and has 27 tests; the doc explains in words.
- **Better copy:** the Lab for numbers; the doc for the reason each step exists.
- **Recommendation:** keep both and make the doc's step list say "run it in Lab N".

### 19. Replay in the collision Lab and Verification and hashing
- The collision Lab's last step plays recorded keys through `verifyLog` on the new course.
- Verification and hashing teaches `verifyLog`.
- **Recommendation:** the collision Lab links Verification and hashing for what the judge does.

### 20. Detector in the lift Lab
- The lift Lab says "after the object exists, is the part found right?" and links Evaluating a detector.
  - No repeat.

## Cross-links added (CC-133)
- A "see also" chip row at the top of a Lab, from `SEE_ALSO` in `src/ui/labs-series.ts`, by mode name, both ways.
- Done:
  - Precision and recall (overlap 2): computer vision and detector.
  - Replay and determinism (overlap 1): integration and hashing.
  - Search, learning and optimization (overlap 3): search with learning, and search with optimization.
  - Press timing (overlap 5): optimization and timing.
  - Depth is a guess (overlaps 8 and 17): camera and lift.
  - Replay in the collision Lab (overlap 19): collision and hashing.
- Already linked: the gate (14) and the detector in the lift Lab (20), through the "uses" chips.
- Still text only (docs, not Labs): 6, 7, 9, 10, 16, 18.
