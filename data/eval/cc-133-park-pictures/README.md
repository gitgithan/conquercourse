# CC-133: cover photos for the parkour parks

## So what
- Five parks now show a real, free-licence photo on their card: Gerlev, Lakeside Garden, Regent's Park, Zollverein and Plaza Parkour Cochabamba.
- None of the five photos shows the parkour course itself, because Wikimedia Commons has none; each shows the site or building next to the park.
- The card says so: "Photo of the area nearby: author, licence", and the hover text says what the picture shows.
- Seven parks were removed from the game (owner, 2026-11-04) because no free photo was found; they can come back when one exists.
- Four of the five photos are CC BY-SA: demo only, swap before a sale (rows in `docs/ASSETS.md`).

## Method
- Commons API: geosearch around each park (400 m, then 1000 m) and name searches, 2026-11-03 and 2026-11-04, a slow client with back-off.
- Only CC0, CC BY and CC BY-SA were accepted.
- Every candidate was looked at; any person close-up, identifiable face or young-looking person meant rejection.
- Picked photos are cropped to 320 by 180 by `scripts/make-parkour-thumbs.py`.

## Removed: no free photo found
| Park | Country | OpenStreetMap | Reason |
|---|---|---|---|
| BGI akademiet Parkour Park | Denmark | way/100191425 | no free photo found |
| FlowPark Brumunddal | Norway | way/607719660 | no free photo found |
| Axelsbergs Parkour, Stockholm | Sweden | way/818042918 | no free photo found |
| Calisthenics and Freerun Park | Netherlands | way/849453743 | no free photo found |
| Parkour pitch, Bellingham | United States | way/895145811 | no free photo found |
| Junction Street Plaza, Sydney | Australia | way/1415868149 | no free photo found |
| Brahenpuisto parkour area, Kuopio | Finland | way/944150009 | no free photo found |

## Where the detail is
- `run.json`: the picked photos, the rejected ones with reasons, and the removed parks with their coordinates.
- Evidence picture: `docs/evidence/cc-133-park-pictures/editor-place-list.png`.
