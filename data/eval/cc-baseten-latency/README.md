# Baseten Spark Open: does it have cold starts? (CC-208)

## So what
- In 6 calls over 21 minutes we saw no cold start.
  - The slowest call took 2.9 s, and it was not the one after the longest wait.
  - A cold start of a model this size would be expected to show as many seconds or minutes; nothing like that appeared.
- For the game: a player's first designer or check call is unlikely to hang for a model-loading wait, at least on a quiet afternoon.
- What the data does not show:
  - Whether other users' calls kept the shared model warm; we cannot see that, and we only report what we measured.
  - Anything for idle gaps longer than 15 minutes (hours, overnight).
  - Anything under load, from many players at once, or on a busy day.
  - Calls with a photo or a long answer: these calls were tiny, and real calls take 3 to 40 s because the model reasons first.
- Next step if it matters: repeat after a 1-hour and an overnight gap from a deployed preview, once per gap.

## What was run
- Same URL, model name and header style as `functions/api/designer.ts`.
- Prompt: "Reply with the single word: ready" (152 tokens in with the system wrapper; answer "ready" every time).
- `max_tokens` 1500, because the model reasons first.
- Run from the laptop, one call at a time, on 2026-10-31.
- The gap is measured from the end of the previous call.

## Results

| Call | Idle before | Seconds | Tokens out | Note |
|---|---|---|---|---|
| 1 | not known (first call of the session) | 2.31 | 201 | first call |
| 2 | 0 s | 1.35 | 21 | back to back |
| 3 | about 1 min | 2.86 | 174 | |
| 4 | about 5 min | 2.79 | 36 | |
| 5 | about 15 min | 1.57 | 28 | first call after the longest gap |
| 6 | 0 s | 1.16 | 24 | back to back |

- Every call returned 200 and the right word.
- The first call after a gap (3, 4, 5) was not systematically slower than the back-to-back calls (2, 6): call 5 was faster than call 3.
- Time follows the number of tokens the model spent thinking (201 and 174 tokens out for the two slowest-looking calls), not the length of the gap.
- With 6 calls this is a sanity check, not a measurement of a distribution.

## Cost
- 912 tokens in and 484 out, at $1.25 and $4.25 per million: about $0.0032.
- Paid from the Baseten credit.

## Files
- [run.json](run.json): every call with time, status, tokens and timestamp.
- No key is stored; the key was read from a private file outside the repo.
