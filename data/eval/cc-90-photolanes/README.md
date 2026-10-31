# CC-90: street photo lanes in a short, spread-out place list

## So what
- The place list is now 15 places in 15 countries (was 29 in 13), each with a street-photo list.
- The test that matters is the person filter, not Mapillary coverage.
  - Raw coverage is dense in nearly every famous street.
  - The no-person rule throws away 90 percent or more of it in busy streets.
- One lane per country is not feasible for all countries with this method.
  - It is feasible for about half of the 29 countries tried, with 15 reaching 55 percent or more of the lane.
- Recommendation: keep the pin tool.
  - A custom slice has no offline person filter run, so it can never show street photos safely.
  - The result panel now says so, and offers the nearest prepared place.

## What was measured
- Audit: `scripts/photos_lane_audit.py` walks each lane every 10 m and counts non-panorama photos within 60 m of that point facing the lane within 60 degrees.
- Filter: `scripts/photos_people.py` (cover mode) tests the nearest facing photos at each 10 m step until 2 are kept or 12 are rejected, up to 150 tests per place.
  - A photo is rejected if the detector sees any person at score 0.4 or more.
- Share of lane = steps with at least one kept photo facing the lane, using the same 60 m rule as the game.
- Tables: `audit-existing.json`, `audit-new.json` (before the filter), `after-filter.json` (after).

## Commands
- New places: `npx tsx scripts/make-places.ts <slugs>` (the existing OSM builder with 18 new Specs added), then `npx tsx scripts/make-place-tiles.ts` and `npx tsx scripts/places-list.ts`.
- Audit: `python3 scripts/photos_lane_audit.py OUT.json [slugs]`.
- Filter on a VM: `python3 scripts/photos_people.py <slugs>`.
- After table: `npx tsx scripts/photos-live-share.ts data/eval/cc-90-photolanes/after-filter.json`.

## Results, after the filter
| Place | Country | Raw photos facing lane | Kept | Per 100 m of lane | Share of lane covered | Listed |
|---|---|---|---|---|---|---|
| Edinburgh Old Town | UK | 304 | 52 | 31 | 100% | yes |
| Dolores Park | USA | 155 | 10 | 12 | 100% | yes |
| La Boca (Caminito) | Argentina | 132 | 9 | 9 | 100% | yes |
| Bukchon | South Korea | 74 | 6 | 4 | 100% | yes |
| Park Guell | Spain | 198 | 11 | 10 | 100% | yes |
| Alfama | Portugal | 410 | 7 | 9 | 100% | yes |
| Stephansplatz | Austria | 265 | 6 | 6 | 100% | yes |
| Galata | Turkey | 237 | 7 | 5 | 94% | yes |
| Plaka | Greece | 69 | 5 | 6 | 89% | yes |
| Gamla Stan | Sweden | 92 | 2 | 3 | 83% | yes |
| Bryggen | Norway | 370 | 4 | 4 | 80% | yes |
| Speicherstadt | Germany | 522 | 10 | 4 | 72% | yes |
| Temple Bar | Ireland | 128 | 4 | 4 | 70% | yes |
| Main Square | Poland | 367 | 6 | 3 | 67% | yes |
| Castle Hill | Hungary | 245 | 6 | 3 | 67% | yes |
| Valletta Harbour | Malta | 25 | 3 | 7 | 60% | no (one place per small country, fewer photos) |
| Nyhavn | Denmark | 511 | 4 | 3 | 58% | no |
| Stradun | Croatia | 502 | 6 | 3 | 55% | no |
| Washington Square | USA | 1049 | 5 | 2 | 52% | no |
| Positano | Italy | 420 | 2 | 1 | 45% | no |
| Montmartre | France | 122 | 9 | 5 | 39% | no |
| Spanish Steps | Italy | 112 | 1 | 1 | 38% | no |
| Boston Common | USA | 254 | 3 | 1 | 36% | no |
| Eixample | Spain | 131 | 3 | 2 | 31% | no |
| Circular Quay | Australia | 44 | 3 | 3 | 25% | no |
| Gastown | Canada | 78 | 1 | 1 | 22% | no |
| Senate Square | Finland | 380 | 2 | 1 | 18% | no |
| Shibuya | Japan | 127 | 1 | 2 | 17% | no |
| Plaza Mayor | Spain | 75 | 2 | 1 | 10% | no |
| Covent Garden | UK | 225 | 1 | 1 | 50% | no |
| Jordaan, Grand-Place, Piazza San Marco | NL, BE, IT | 74, 156, 338 | 0 | 0 | 0% | no |
| Tallinn, Bo-Kaap (Cape Town), Zocalo | EE, ZA, MX | 22, 3, 406 | not filtered | | | no (thin raw coverage or too few buildings) |

- Not measured: Lombard Street, Union Square (Mapillary search errors on dense areas), Place des Vosges (0 photos), other places listed in the older audit.

## Is one lane per country feasible?
- Raw Mapillary coverage: yes in most of Europe, the Americas, Japan and Korea; thin in Cape Town (3) and Tallinn (22).
- After the person filter: about half of the places tried reach 55 percent of the lane; 7 reach the whole lane.
- Cost: 100 to 150 detector runs per place, about 4 to 8 minutes each on a busy 8-core VM, plus 1 to 3 Overpass calls.
  - For all countries: about 2 hours of VM time per 20 places, mostly waiting.
- A weaker rule (let small background people through) would raise coverage, but it is a safety call for the owner, so it was not changed.

## The pin tool
- Keep it: it is the only way to slice a place we have not prepared.
- It cannot have street photos, because the filter is offline-only.
- Players now see "Street photos: ..." or "Street photos are only prepared for the places in the list" with a nearest-place button.

## Not tested
- The live strip against the real Mapillary service at scale (the browser check uses a faked photo service).
- Pictures of the kept photos were not viewed one by one; the detector is the gate.
- Phones (out of scope by decision).
