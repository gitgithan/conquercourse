# User-made characters and pieces: one skeleton, one rule set

## The rule
- We cannot design courses around characters we have never seen.
- So every character is fitted to the one skeleton the game already uses.
- The same idea covers pieces: every piece is scaled to a person.

## Does the mesh change what a runner can reach?
- No. Tested with the real simulator code.
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
- Every fit returns a report: the stretches, the hand gap before and after, the edge stretch, and a quality of good, stretched or extreme.

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

## Where it stops
- Banana: the torso wanted a 3.8 stretch; the clamp holds it, so the shoulders sit a little off.
- Potato Blob: it has almost no arms in the picture, so they were nearly lost in the cutout; the arm wanted 2.0 and is held at 1.7, so a gap stays.
- Fallbacks for such a character, in order:
  - Accept it clamped (what the game does now).
  - Tell the maker in plain words at make time that the arms are very different and may look off (`fitWords`).
  - Blend the skin towards a stock body (not built).
- Not tested: a person-made character from outside the eight, fingers and faces under heavy stretch, and a texture's look at 1.7.

## Pieces
- A piece is scaled by the person-for-scale rule, so its size is set by the game, not by the maker.
- Courses are proved clearable by the simulator, whatever skin the runner wears.
