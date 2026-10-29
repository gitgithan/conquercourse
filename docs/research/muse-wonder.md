# Muse Wonder: what it is, and whether we should use it (CC-125)

## So what
- Muse Wonder is not an image or video model; it is Meta's strongest coding and long-task text model.
- So it does not make our art; the art model is Muse Image, which we already use.
- Where it could help: building and reviewing the game (a coding aid through the Model API), not playing it.
- Recommendation: do not put it in the game; try it once as a code reviewer on the simulator if credit is left.
- Next step: only if the product owner wants it; one review run costs about $1 to $3.

## Facts (Meta Model API docs, read 2026-10-29)
- Model id: `muse-wonder-1.0`; our key lists it.
- Takes text, image, video, audio and PDF; returns text only.
- Context: 1,048,576 tokens; reasoning effort from "minimal" to "max".
- Status: preview.
- Price per 1M tokens: $4.00 input, $0.20 cached input, $20.00 output.
- No cheaper Contributor mode (Muse Spark has one, but it lets Meta train on the content).
- For comparison, Muse Spark 1.3: $1.25 input, $4.25 output.

## One test call (2026-10-29)
- Asked a question about why a greedy jump search can strand the next jump.
- Setting: reasoning effort "minimal"; 4.1 s; 41 prompt and 207 completion tokens (144 were reasoning).
- Cost: about $0.0043, paid from the Meta credit.
- The answer was correct: the greedy middle press can leave too little room for the next jump.

## Where it would fit
| Use | Fit | Why |
|---|---|---|
| Course design partner in the game | No | Muse Spark Open is cheaper and already checked by the simulator |
| Art | No | Wonder returns text only; Muse Image draws |
| Code review of the simulator | Maybe | Long context holds the whole `src/sim`; costs a few dollars |
| Second opinion on failed experiments | Maybe | Reads logs and video |

## Not done
- Code review: done on `src/sim` (CC-133, $2.38, 13 real of 21 claims); see `data/eval/cc-wonder-review/README.md`.
- Wonder is not in the README Meta table: nothing in the game uses it; it is listed under "Meta tools in development".
