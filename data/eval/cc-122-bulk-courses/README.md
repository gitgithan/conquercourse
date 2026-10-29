# Bulk course ideas from Muse Spark Open (CC-122)

## So what
- A pre-proven pool is worth building; live generation in the editor is not.
- One call takes a median 14.8 s and up to 38 s, too slow for a player to wait for.
- Of 100 asks, 95 gave a layout and 33 (33%) cleared in the simulator, 20 as drawn and 13 more after Fix it.
- Variety is thin: the 33 use only 3 move sets (16 gap jump + jump, 16 jump only, 1 with a swing); none uses a vault or a climb.
- So the pool is a fine source of easy gap-and-step courses, not yet of the whole move range.
- Recommendation: keep the pool as candidates, do not add to the menu yet; next, ask per move (vault, climb, bar) with the rules for that move spelled out.

## How the player meets this
- Kept layouts ship as a pre-proven pool that "Make me a new course" draws from instantly, with no model call.
- Nothing is generated live in the editor.
- Live generation, if any, is one layout at a time, started in the background while the player reads the report or plays, with a ready/not-ready state.
- A layout enters the pool only after the simulator has cleared it.
- Which of this the data supports:
  - Pool: supported. 33 of 100 cleared, 29 after dropping 4 near-duplicates, for about $1.6 of list-price calls.
  - Background one-at-a-time: supported on speed (median 14.8 s, worst 38 s fits a report screen) but only a third clear, so it needs two or three tries and a ready flag.
  - Instant live in the editor: not supported (latency, and 2 in 3 fail).
  - Variety: not supported yet (3 move sets).

## Numbers (run.json)
- Latency per call (seconds): median 14.8, 90th percentile 30.6, worst 38.1, best 4.2; 4 calls ran at a time.
- Tokens per call: median 3,239 completion and 452 prompt, most 10,460; 411,268 in all.
- Cost at Baseten list price: about $1.6.
- No readable JSON in 5 replies; 36 first replies were empty because reasoning used the whole 4,000 cap, so those were asked again with 12,000.
- By difficulty asked, kept: level 1 18 of 20, level 2 7, level 3 1, level 4 7, level 5 0.
- By theme, kept: wide gap 9 of 10, rising blocks 9, tall wall then drop 6, high platform then drop 5, rhythm blocks 1; vault-then-gap, bars, bar skip, mixed and unusual 0 each.

## Fallback and next steps
- Fallback: the hand-made courses and the simulator-proved random generator behind "Make me a new course"; they already cover every move.
- Ranked next steps:
  - 1. Ask per move with each move's rules in the prompt (vault, climb, bars), then score again.
  - 2. Check why vault and climb layouts never clear (rules in the prompt or in Fix it).
  - 3. Add the pool to "Make me a new course" behind a feature switch once it holds all moves.

## Files
- `outputs/NNN.json`: raw replies; `kept/NNN.json`: the 33 cleared layouts with their ideal-run plan; `results.json`: every row; `run.json`: summary.
- Scripts: `scripts/bulk-courses-ask.ts` (needs the Baseten key, run on the laptop), `scripts/bulk-courses-score.ts` (no key, run on a VM).
