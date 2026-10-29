# CC-170: pad and retry for photos that touch the edge

## So what
- The player-facing part is built: a box dragged to the photo edge now shows a short plain note instead of a reject.
- The test is weak: only 1 of the 5 photo pairs that finished had a mask touching the edge.
- That one photo (bollard) was usable before and after, so nothing was rescued and nothing got worse.
- This does not show that padding fails; it shows the test set had too few real edge cases.
- Recommendation: keep the switch on by default (padding never made a result worse here), and rerun on photos whose object is cut by the frame.
- Next step: build the edge photos by cropping the object so the mask itself runs off the photo, then rerun.

## Numbers
- 12 photos were planned; 5 finished before and after (the others lost the Modal connection).
- Mask touches the edge: 1 of 5 (bollard, border share 0.38).
- Usable before: 4 of 5; usable after: 4 of 5; rescued: 0; made worse: 0.
- Still bad: barrel-oak-edge (width to height 1.45 against a 0.72 reference), and it does not touch the edge, so padding does not apply.
- Usable means the mesh keeps the same width to height as the whole-photo lift within a factor of 1.43, with tilt under 10 degrees.

## Fallback
- Today's lift without padding, plus the manual `--pad` option.
- Its quality here: the same as the padded result on every finished pair.

## Ranked next steps
- Make tighter crops so the mask really touches the edge, then rerun the pairs.
- Find why the Modal mask call drops the connection (below).
- Add the player note for the "still bad after one retry" case in the lift result, not only the box check.

## Known gaps
- Modal mask call: `StreamTerminatedError: Connection lost` on hydrant, bar-black, picnic-table, gabion-wall, log-driftwood and railing-red in some runs.
- Retries, a bigger scale-down window and a GPU change did not fix it; the cause is not known.
- log-driftwood and railing-red have no whole-photo reference, so they were not scored.
- Stump, bar-green, gabion-wall and bar-black have no complete before and after pair.
- The raw lifts are large; they live in `../conquercourse-assets/cc-170-pad-retry/` (hashes in `raw-npz.SHA256SUMS`).

## Cost
- About 0.012 dollars per photo lift plus model loads; roughly a few dollars with all retries on Modal.
