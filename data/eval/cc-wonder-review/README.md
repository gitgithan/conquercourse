# Muse Wonder reviews src/sim (CC-133)

## So what
- Muse Wonder read the simulator and made 21 claims; 13 are real, 1 is unclear and 7 are false alarms.
- None of the real ones breaks a shipped course: five are latent (no shipped course reaches them) and the rest are small.
- Two were fixed at once (CC-133): the height after a failed wall, and a zero-grip NaN.
- The best find is a code-versus-comment mismatch in the search (the press window is too wide when it has a hole) and a bounce press that the search never tunes for the Training course (0.04 s).
- Cost: $2.38 for the whole run, about $0.18 per real bug.
- It is a development tool, not a game feature.

## What was sent
- Four chunks, line-numbered, at reasoning effort "high": body and world, moves, search and replay, contraptions.
- The contraptions chunk (cart, beam, drone, recoil, trebuchet, drums) returned two generic remarks, not code claims: that chunk found nothing.
- The first try of chunks b and d hit a five-minute header timeout; they were rerun with a longer limit (the first try cost nothing that we can see).

## How each claim was checked
- 11 by a failing test (`tests/wonder-review.test.ts`); 10 by reading the code and its comments.
- A test marked `it.fails` states the right behaviour and passes while the bug stands; when the bug is fixed it flips and the marker is removed.

## Files
- `verdicts.json`: every claim, its verdict and what was done.
- `run-*.json`: tokens, seconds and dollars per chunk.
- `raw/`: the prompt and the raw reply of each chunk.
- `scripts/wonder-review.mjs` reruns it (key read from the private env file, never printed).

## Not tested
- One run on one model at one setting: a second run might find other things.
- The claims Wonder did not make are not known to be absent.
