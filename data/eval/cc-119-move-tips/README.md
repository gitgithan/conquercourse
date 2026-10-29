# CC-121: Muse Spark Open move tips for real objects

## What it means for the game
- Given a cut-out object and its name, the model lists which of our moves could get past it and gives one short idea for how it shapes a course.
- It is a suggestion for CC-108's cards; the simulator and the product owner decide.
- The model's moves are checked against the fixed list in code; anything else is dropped.
- An idea that sounds like coaching, or has numbers or formulas, is dropped and the moves are kept.

## What ran
- Code: `functions/api/move-tips.ts` (POST `/api/move-tips`), `src/slice/move-tips.ts` (prompt, parser, move list).
- Model: `meta-models/muse-spark-open-1026` on Baseten.
- Runner: `npx tsx scripts/cc121-move-tips-run.ts`; each photo is cropped to the object box first.
- It ran on the laptop, because the Baseten key lives there.
- Cost: $0.188 for 19 objects (about $0.01 each; the model reasons at length first).
- Moves are the game's list: jump, climb, vault, hang, balance, duck.
- The task text said "swing" and "roll"; the game's names are hang, and roll is not an obstacle move.

## Results against the CC-110 move groups (`REAL_MOVE`)
| Prompt | Tips returned | Key move listed | Key move first |
|---|---|---|---|
| v1 | 18/19 | 12/19 | 7/19 |
| v2 | 19/19 | 13/19 | 13/19 |

- v1 returned nothing for the picnic table: the reasoning used all 4,000 tokens; the function now retries once with 8,000.
- v1 ideas were fluffy; v2 ideas are about the path the runner chooses.
- Misses are mostly debatable keys:
  - Both handrails: key balance, model vault.
  - Stairs: key climb, model vault and balance.
  - Concrete pipe: key climb, model jump and vault.
  - Spruce stump: key balance, model climb.
  - Skate box: key jump, model vault.

## Known gaps
- The prompt was tuned once on these same 19 objects, so 13/19 is optimistic; a held-out set is needed.
- The CC-110 key is one person's call, so a miss is a question, not an error.
- The model sees a photo, not a size, so tall versus short is a guess.

## Fallback
- The CC-110 move groups stay the source for the 19 real objects; tips are for new objects only.
