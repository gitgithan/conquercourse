# CC-179: slicing screen, fewer words, a legend, why-no-path with fixes, preview equals build

## So what for the game and the demo
- The "path found, then no path" bug was real and was ours, not physics.
- Cause 1: "Build this world" sent the cut height in real metres, but the editor reads it in shrunk metres.
  - At shrink 0.2 a 12 m cut reached the editor as 12 m instead of 2.4 m.
  - Of 74 preview-clear cuts on the 18 ready places, only 5 still cleared when built.
- Cause 2: the preview read the lane from one big mesh, the editor from one rounded piece per building.
  - A 3-cell landing sliver (0.3 m) flipped the answer on Eixample at cut 19.
- Fix: both now use the same pieces, the same lane reader and the same search.
  - After the fix 74 of 74 preview-clear cuts also clear when built.
- Failing screens now say why in one line and offer up to 3 ranked fixes.
  - 47 of 67 failing cases (70 %) have at least one offered fix that clears.
- Recommendation: ship behind the default; `?slicewords=old` brings the old panel back.
- Next step: one-click buttons are already in; watch the owner try three places and tune the wording.

## Why rules, not an LLM
- Rules answer at once, offline and the same every time.
- An LLM adds a wait and can invent controls that do not exist (a "bridge" button, a "jump height" slider).
- The reasons come from lane facts already computed in CC-92 (widest gap, tallest step, deepest fall).
- An optional "say it in friendlier words" LLM pass is only worth it later.
  - It would add words, which is the opposite of this issue.
  - It could only reword the one-line reason, never the buttons.
- Not built.

## What "cut" means (the owner's question)
- The cut height is the level where the runner's lane starts.
- It is not how much the buildings are shrunk.
- A low cut keeps the street as the floor.
  - Every building wall is then a huge step, taller than the 2.8 m the runner can climb.
- A high cut keeps only roofs near that height.
  - The streets between become gaps, but roofs of similar height are often close enough to jump.
- Shrink is the control that makes every gap and wall smaller.
- Real data, 18 ready places, 6 cuts each, preview result:

| Cut band (third of the height range) | Cuts tried | Cuts with a path |
| --- | --- | --- |
| Lowest third | 36 | 10 |
| Middle third | 36 | 29 |
| Highest third | 36 | 35 |

- So the UI was right: higher cuts do have more solutions, and the reason is the walls, not the gaps.
- The wording was the problem: "narrower gaps there" is no longer used; the fix now says "this lane can be crossed".

## The consistency bug in detail
- Files: `before/` (old behaviour, 18 places) and `after/` (new, 18 places), shrink 0.2, 6 cuts per place.
- Before: 74 preview clears, 63 built clear with the right (shrunk) level, 5 with the level the old hand-over sent.
- After: 74 preview clears, 74 built clear.
- Cause 1 (units) fix: `handoverLane` in `src/slice/slicer.ts` multiplies by the shrink.
- Cause 2 (two lane readers) fix: `src/slice/slicer-core.ts` reads the proof lane from `piecesFrom` pieces through `laneProfile`, the editor's own reader.
- The extra "needs more than 8.5 speed" gate in the custom-lane preview was removed so the editor and the preview use the same check.
- Not causes: seed, start and finish, runner parameters, the E-hold rule (CC-168).
- Test: `tests/slice-preview-built.test.ts`, 6 places, two cuts each, preview result must equal built result.

## Suggestions: before and after
- `suggestions.json`: 67 failing cases on 8 places (complete run) (shrink 0.2 and 0.4, all or half the buildings picked, several cuts).
- Each case runs the rules, applies each suggestion, and re-runs the proof.
- 47 of 67 have at least one suggestion that clears.
- Examples:

| Place | Shrink | Cut | Reason shown | First fix | Clears |
| --- | --- | --- | --- | --- | --- |
| Tuileries, Paris | 0.2 | 2 | Widest gap, over about 8 m | Cut higher | yes |
| Bryant Park, New York | 0.2 | 4.5 | Widest gap 15.6 m | Cut higher, then shrink to 0.08 | yes |
| Circular Quay, Sydney | 0.2 | 7.5 | Widest gap | Shrink | yes |
| Eixample, Barcelona | 0.2 | 31.5 | Widest gap | Shrink | yes |
| Montmartre, Paris | 0.2 | 7.5 | Widest gap | Cut higher | yes |
| Shibuya, Tokyo | 0.2 | 5.5 | Widest gap | Cut higher | yes |
| Edinburgh | 0.2 | 3.5 | Hardest jump 5 m wide, far side 1.2 m higher | none of the three | no |

- The 20 cases with no clearing fix now end the reason with "No cut or shrink helps here, pick another place." when the rules offer only the drag tip.
- Cases where the rules offer a fix that does not clear still show the fixes; the screen cannot know that before trying.
- The drag tip is not auto-tested.

## Words and legend
- Short labels; long help sits behind "More".
- The legend lists every colour the slicer draws: lane, ground at this height, cut buildings, above the cut, strip green, amber and red, and the slope tint.
- Screenshot: `shots/slicer-why.png` (desktop, Montmartre).

## Unverified
- The suggestions run covers 8 of the 18 places.
- The drag-the-dots tip is not measured.
- Only desktop 1280 px; no phone checks by order of the owner.
- No LLM variant was built or compared.
