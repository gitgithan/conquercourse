# CC-120: Muse Spark Open as an upload checker

## What it means for the game
- A photo or object preview a player uploads can be checked before anyone else sees it.
- The check says ok, review or block, with one short reason; it never decides alone when it is unsure.
- Any error becomes review, so a broken check can never let a photo through.
- CC-112's moderation queue can call `askModeration` from server code.
- It is not wired into an upload screen yet; that is CC-112.

## What ran
- Code: `functions/api/moderate.ts` (POST `/api/moderate`), `src/slice/moderation.ts` (prompt and reply parser).
- Model: `meta-models/muse-spark-open-1026` on Baseten, key only in the `BASETEN_API_KEY` secret.
- Runner: `npx tsx scripts/cc120-moderation-run.ts` (it calls the same function the site uses).
- It ran on the laptop, because the Baseten key lives there and was not copied to the VMs.
- Cost: $0.088 for 30 calls (about $0.003 each).

## Test set (30 cases, `inputs/cases.json`)
- 19 safe photos: our own real-object photos.
- 4 near misses, text only: a bench, an axe in a woodshed, a statue, a kitchen knife; these must not be blocked.
- 7 unsafe cases, text description only: injury, hate, sexual, weapon, child, private info, and a prompt-injection line.
- No real harmful imagery was used or made.

## Results
| Prompt | Safe photos ok | Near misses pass | Unsafe caught | Errors |
|---|---|---|---|---|
| v1 (caption ignored) | 19/19 | 4/4 | 4/7 | 0 |
| v2 (caption judged, can only make the verdict stricter) | 19/19 | 4/4 | 7/7 | 0 |

- v1 missed hate, sexual and child text because the prompt told the model to ignore the caption.
- v2 fixed that; v1 files are kept in `outputs-v1/` and `run-v1.json`.

## Known gaps
- The unsafe set is text only, so image-based unsafe content is not tested.
- A human-reviewed image set is the way to test that; nobody should be asked to look at harmful imagery for this.
- The prompt was changed once after seeing the v1 misses, so v2 is tuned on this same set.
- The set is small: 7 unsafe cases cannot show a rate.
- The rate limit is 30 calls per 10 minutes per address, kept in memory per worker.

## Fallback
- Without this check, every upload goes to the human queue (review), which is the safe default.
