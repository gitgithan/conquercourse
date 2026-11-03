# CC-133: parkour parks as their own group of Ready places

## So what
- The World Editor list now has a "Parkour parks" group, one heading per region, sorted by country.
- Twelve real parks are in it, each tied to a real OpenStreetMap element.
- Five are visible at the editor zoom; seven are small patches and are flagged "small on the map", not hidden.
- A park where the simulator finds no lane stays listed, with a "no lane found yet" badge.

## How each park was checked
- Overpass API, queried by box around each park and by world tiles (parkour tags, name search), 2026-11-03.
- The area is the shoelace area of the mapped outline, in square metres.
- "Visible" means 1500 m2 or more (about 16 by 16 pixels at zoom 16).
- Public web pages were read for the owner's five (see below); no photo is stored.

## Places
| Park | Country | OpenStreetMap | Area m2 | What the element is | Visible |
|---|---|---|---|---|---|
| BGI akademiet Parkour Park | Denmark | way/100191425 | 203,784 | the school campus around the park | yes |
| Gerlev Parkour Park | Denmark | way/1274319354 | 90,840 | the sports school area (parkour track built 2007) | yes |
| FlowPark Brumunddal | Norway | way/607719660 | 2,317 | Mjosparken skate park, next to the parkour area | yes |
| Regent's Park Parkour Hub | United Kingdom | relation/1384127 | about 1,600,000 | the whole park | yes |
| Lakeside Garden SkatePark | Singapore | way/1159195814 | 15,029 | the skate park pitch (parkour pitch way/1159195817, 341 m2, inside) | yes |
| Axelsbergs Parkour, Stockholm | Sweden | way/818042918 | 1,146 | parkour pitch | no |
| Parkour at Zollverein, Essen | Germany | way/879920257 | 510 | parkour pitch | no |
| Calisthenics and Freerun Park | Netherlands | way/849453743 | 750 | parkour pitch | no |
| Plaza Parkour, Cochabamba | Bolivia | way/730118541 | 201 | parkour pitch | no |
| Parkour pitch, Bellingham | United States | way/895145811 | 333 | parkour pitch | no |
| Junction Street Plaza, Sydney | Australia | way/1415868149 | 295 | parkour pitch | no |
| Brahenpuisto parkour area, Kuopio | Finland | way/944150009 | 261 | parkour pitch | no |

## Not added, and why
- Regent's Park "parkour hub": the map has only the whole park, and no public page I found names a parkour hub there (the Royal Parks Hub is a pitch-sports site); listed with the park as the shape, flagged as unconfirmed.
- FlowPark Brumunddal: no page I found links the FlowPark brand to Brumunddal; Visit Norway lists a parkour area at Mjosparken, so the park is placed there, flagged as unconfirmed.
- BGI and Gerlev: mapped only as the school grounds, so the enclosing area is the shape.
- Africa: no parkour element with a clear mapped shape was found; one in Reunion (France) is tagged only "Parkour" with no name.
- KTR Family Action Sports Center (Chandler, US): an indoor sports centre, not an outdoor park.
- Parkour-Park Kolbermoor, Germany: 257 m2 and permit-only access.
- Turkish and Czech places named "parkur": false matches for a word that means something else.
- Dozens of single-point parkour nodes in France and Germany: a point has no area to show.
- Asia beyond Singapore, and most of Oceania: the Overpass servers did not answer the wide query in time; not checked, so not claimed.

## Limits
- Small parks (under 1500 m2) are tiny on the map; an enclosing park area was not fetched for them because the Overpass servers were overloaded.
- The Regent's Park area is the park outline (Wikipedia says 395 acres); the bounding box of the relation is 1186 by 1427 m.

## Files
- `run.json`: inputs, outputs and counts of this run.
- Raw Overpass answers stay out of git.
