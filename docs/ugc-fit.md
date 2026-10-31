# User-made characters and pieces: one skeleton, one rule set

## The rule
- We cannot design courses around characters we have never seen.
- So every character is fitted to the one skeleton the game already uses.
- The same idea covers pieces: every piece is scaled to a person.

## Does the mesh change what a runner can reach?
- No.
- Tested with the real simulator code.
- Reach comes from fixed numbers: a hold is grabbed with the hands 2.1 m up and a 0.15 m reach (`DEFAULT_HANG` in `src/sim/holds.ts`).
- `src/sim` and `src/course` import nothing from the renderer or the characters (a test checks it).
- The bones are the Rookie's in every character; the game aims them at the clip's joints.
- So a short-armed skin never makes a course harder or impossible.
- It is a look problem: the skin hand can stop short of the bar the bones are holding.

## How big was the look problem?
- Eight characters were made in the cc-char-muse experiment (Fox, Skater, Toy Robot, Cactus, Banana, Robo Cat, Jelly, Potato Blob).
- Measured against the Rookie's arm (0.78 m from shoulder to fingertip), seven of eight had arms 22 to 51 percent too short.
- Legs were 3 to 15 percent off.
- The old rig fit widened the whole body to hide this, which made torsos fat.

## What the fit does (`src/characters/fit.ts`)
- Runs at load, for every character, in the browser, from the character's own skin weights.
- Legs and torso: a height remap so the crotch meets the hip bones and the arm line meets the shoulders; the head takes the rest, so total height stays.
- Arms: each arm is stretched along its own bones so the fingertip lands on the fingertip bone.
- Clamps: arms 0.7 to 1.7, legs 0.8 to 1.4, torso 0.85 to 1.3, shoulder move at most 0.25 m.
- Before anything is stretched, the skin is turned to face the way the bones face (see Facing).
- Every fit returns a report: whether it was turned, the stretches, the hand gap before and after, the edge stretch, and a quality of good, stretched or extreme.

## Results on the eight
| Character | Quality | Hand gap before | Hand gap after |
|---|---|---|---|
| Fox | stretched | 0.28 | 0 |
| Skater | stretched | 0.33 | 0 |
| Toy Robot | good | 0.22 | 0 |
| Cactus | stretched | 0.22 | 0 |
| Banana | extreme | 0.38 | 0 |
| Robo Cat | stretched | 0.25 | 0 |
| Jelly | good | 0.02 | 0 |
| Potato Blob | extreme | 0.51 | 0.16 |
- All eight load on the Rookie skeleton and play run, leap, land and the captured vault clip (105 frames) with no errors; the mean edge stretch is 1.03 to 1.10.
- The vault picture is not kept: the test page's panel covers the runner, so the pass is the frame count and no errors.
- Gap is a share of the arm length.
- Pictures: `docs/evidence/cc-chars-eight/`.
- Run data: `data/eval/cc-chars-eight/`.

## Facing
- Owner report (2026-11-01): Skater, Potato Blob and Banana ran backwards, so their feet and joints looked wrong.
- The cause in plain words:
  - The game's skeleton always faces one way, and every character wears it.
  - A made character's skin has a front of its own, and nobody ever checked that it matched.
  - The maker straightens the 3D model by fitting a box around it (`widest_side_yaw` in `pipelines/ccpipe/objbake.py`).
  - A box has no front: it can only say "the body lies along this line", so the turn it picks is right or 180 degrees off.
  - Which of the two it picks is a coin flip.
  - It was written for objects, where front and back do not matter.
  - The recorded turns of the eight prove it: Skater 170.5, Banana 174.5 and Potato Blob 177.5 degrees (all close to a half turn); the other five 0 to 15 (`../conquercourse-assets/eval-full/cc-chars-eight/glb/rebuild.json`).
  - It is not the pictures: all eight were drawn facing the viewer in a T-pose.
  - It is not the skeleton: the foot bones of all eight point the same way (dot product 1.0 with the run direction).
- The fix runs at load, first of all, in `src/characters/facing.ts` (`measureFacing`) and `src/characters/fit.ts` (`faceForward`).
- The story for a reader new to 3D, with the numbers and pictures: [character-facing-bug.md](character-facing-bug.md).
- The rule (second round, 2026-11-01):
  - Five cues vote, each with a weight and a dead zone: shoe reach (1.0), shoe middle (0.7), shoe top (0.6), torso (0.3), hands (0.3).
  - The shoe cues measure along the foot bones' forward: how far the shoe reaches in front of the shin and how far behind.
  - The report is `{score, confidence, votes, verdict, turned}`.
  - Confidence is how much the cues agree out of how many could speak.
  - The skin is turned 180 degrees about the vertical axis through the hips only when confidence is 0.2 or more and the score is clear (0.1 or more away from zero).
  - Turning also swaps the left and right bone weights, so the arm that now lies on the left still follows the left bones.
  - When the cues cannot tell, the skin is left as made and the fit notes say "facing unclear"; the fit report says `facing.verdict: unclear`.
  - A per-character answer wins over the vote: `FACING_OVERRIDE` in `src/characters/facing.ts`, keyed by character id (`forward` or `back`); it is empty because no starter needs it.
  - The fit report says `facing.turned`, and its notes say "turned around".
- Checked against the real Course (2026-11-01): the first round was tested only in a side-view demo that assumed the run goes along +x, which players never see.
  - `data/eval/cc-chars-facing/scripts/probe-course.mjs` holds Right then Left in the real Course for the Rookie and all eight and records the heading the renderer gave, the toe bones and the skin lean.
  - `tests/character-facing-course.test.ts` reads that table; pictures are in `docs/evidence/cc-chars-facing2/`.
- Votes as made (`tests/character-facing.test.ts` pins them):

| Character | Verdict | Score | Confidence |
|---|---|---|---|
| Fox | forward | +0.95 | 0.73 |
| Skater | back | -0.69 | 0.42 |
| Toy Robot | forward | +1.00 | 0.65 |
| Cactus | forward | +0.83 | 0.54 |
| Banana | back | -1.00 | 0.65 |
| Robo Cat | forward | +0.64 | 0.56 |
| Jelly | unclear | -0.26 | 0.03 |
| Potato Blob | back | -0.64 | 0.64 |
- The same three are turned; Jelly stays as made.
- Numbers of the first round (shoe reach alone, `data/eval/cc-chars-facing/facing.json`):

| Character | Score as made | Verdict | Turned | Score after |
|---|---|---|---|---|
| Fox | +0.41 | forward | no | +0.41 |
| Skater | -0.13 | back | yes | +0.13 |
| Toy Robot | +0.32 | forward | no | +0.32 |
| Cactus | +0.28 | forward | no | +0.28 |
| Banana | -0.37 | back | yes | +0.37 |
| Robo Cat | +0.21 | forward | no | +0.21 |
| Jelly | -0.06 | unclear | no | -0.06 |
| Potato Blob | -0.36 | back | yes | +0.35 |
- Pictures (side view, 1280 px, before and after): `docs/evidence/cc-chars-facing/`.
- Limits:
  - Only the shoe cues carry real signal on the eight; the torso cue was wrong once and the hands cue mostly abstains on T-pose characters.
  - Jelly has no shoe, so it cannot be told; a jellyfish has no front, so it is left as made.
  - A character with no clear shoe (a blob with round feet) is left unclear and may face back; add its id to `FACING_OVERRIDE`.
  - Not tested: a person-made character from outside the eight, and a character whose feet point sideways.
  - No make-time check was added to the maker: the maker has no skeleton and no way to tell front from back (a box has no front), so the load-time fit is the only place that can judge.
