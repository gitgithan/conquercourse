# CC-90: loosen the people filter (owner, 2026-11-01)

## So what
- Mapillary's own blur is the base standard for faces and plates.
- On top of it we reject a photo only when a person is large in the picture, so far-off figures pass.
- Limit 0.2 (tallest person over a fifth of the picture height) is the loosest limit that still stops close-ups, and it restores the crowd places.
- Coverage at 0.2 is 100% on 17 of 20 places, 95% at Piazza San Marco, 90% at Bryggen, 88% at Eixample and 72% at Montmartre.
- Evidence: `docs/evidence/cc-90-no-filter/` (strip and large view with the Mapillary mark at 1280 px, fake photo service, no real pictures stored).

## What was measured
- Share of the lane (a step every 10 real metres) that has a facing photo kept, at three limits.
- "Raw" is no filter at all; "strict before" is the old rule (any person rejects).
- Limit 0.1 loses coverage at Piazza San Marco, Temple Bar, Eixample, Plaka and Galata.
- Limit 0.35 gains almost nothing over 0.2 (Piazza San Marco 95% to 100%, Montmartre 72% to 67%) and lets in bigger people, so 0.2 is chosen.

| Place | Raw (no filter) | Strict before | Limit 0.1 | Limit 0.2 (chosen) | Limit 0.35 |
|---|---|---|---|---|---|
| alfama-lisbon | 100% | 100% | 100% | 100% | 100% |
| bryggen-bergen | 100% | 80% | 100% | 90% | 100% |
| bukchon-seoul | 100% | 100% | 100% | 100% | 100% |
| caminito-buenos-aires | 100% | 100% | 100% | 100% | 100% |
| castle-hill-budapest | 100% | 67% | 100% | 100% | 100% |
| dolores-park-san-francisco | 100% | 100% | 100% | 100% | 100% |
| edinburgh-old-town | 100% | 100% | 100% | 100% | 100% |
| eixample-barcelona | 88% | 31% | 69% | 88% | 88% |
| galata-istanbul | 100% | 94% | 94% | 100% | 100% |
| gamla-stan-stockholm | 100% | 83% | 100% | 100% | 100% |
| main-square-krakow | 100% | 67% | 100% | 100% | 100% |
| montmartre-paris | 100% | 39% | 72% | 72% | 67% |
| parc-guell-barcelona | 100% | 100% | 100% | 100% | 100% |
| piazza-san-marco-venice | 100% | 0% | 71% | 95% | 100% |
| plaka-athens | 100% | 89% | 89% | 100% | 100% |
| shibuya-tokyo | 100% | 17% | 100% | 100% | 100% |
| speicherstadt-hamburg | 100% | 72% | 100% | 100% | 100% |
| stephansplatz-vienna | 100% | 100% | 100% | 100% | 100% |
| temple-bar-dublin | 100% | 70% | 80% | 100% | 100% |
| valletta-harbour-malta | 100% | 60% | 100% | 100% | 100% |

## Findings
- Big Mapillary box searches silently return short results (Bryggen gave 739, 1206 or 1298 photos in different runs, against 4858 when tiled).
- `scripts/photos_pool.py` fetches in 50 m tiles and splits any tile that returns 600 or more.
- Older "strict before" numbers for some places came from short fetches, so they understate coverage.
- Montmartre stays at 72% because most photos near its stairs show large people; the cap of 150 detector tests per place is also reached there.
- The detector can miss people; Mapillary's blur is not a guarantee (see `docs/trust-and-safety.md`).

## How to rerun
- `python3 scripts/photos_pool.py <slug>...` then `POOLS=<dir> python3 scripts/photos_people.py <slug>... --sweep 0.1,0.2,0.35`.
- Final lists: `scripts/photos_people.py <slug>... --limit 0.2`.
- `run.json` holds the same numbers; pools and detector outputs stay out of git.
