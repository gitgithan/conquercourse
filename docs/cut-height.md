# Cut height: what it means, and the roof-start change

*Written 2026-11-01 (CC-200). The idea is the product owner's; the measurements are from `scripts/roof-start-compare.ts`.*

## So what
- The cut height now means what a player expects: raise the ground, so shorter buildings sink out of sight and the gaps between roofs grow.
- The old rule broke that idea: the start deck always stood at the cut height, so a high first roof was out of reach at low cuts.
- Starting on the first roof fixes it: the first finished place went from 13 to 28 solvable cut heights out of 30.
- It is behind a switch (`setRoofStart`; off in tests and scripts, on in the browser, `?roofstart=0` turns it off).

## How it worked before
- Heights are measured from the cut: `y = height of the ground - cut height`.
- The start deck was always `{x0: -10, x1: 6, top: 0}`, so the player began at the cut height, not on a building.
- The first run was 3 m away at its own relative height, so a first roof higher than about 4.5 m above the cut could not be climbed.
- Ground deeper than the survivable drop below the cut counted as water, a real way to fail.
- Ground shallower than that stayed as walkable floor, so a low cut changed the course in ways nobody could see.
- That is why raising the water level in the Editor could turn "no solution" into "solution".

## The new rule (roof start)
- The start deck stands at the first roof: every height is measured from that roof, and holds move with it.
- Everything below the cut is hidden, strictly (`y < 0` is dropped).
- Water becomes decoration; the fall limit (`LANE_DROP`) still decides what a player can survive.
- A higher cut gradually hides the shorter buildings and widens the gaps between rooftop jumps.
- Still unsolvable when a rise is over about 4.5 m, a gap is over the jump, or a drop is too deep to survive.
- Second step, not built: let the player start from any roof.

## Measurements (full sweep, 2026-11-01)
- Method: 47 ready places at their stored shrink, a cut height every 3 m, roof start off and on, proved by the simulator (`scripts/lane-equal-sweep.ts`).
- Cut heights that clear: 349 of 588 with roof start off, 495 of 588 with it on.
- 38 places gain heights, 3 stay equal, 6 end with fewer.
- 29 places lose at least one height; the table lists them.
- Details and raw files: `data/eval/cc-200-lane-equal/README.md`.

## Do the Slicer and the Editor agree? (owner question)
- Yes: wherever the Slicer finds a path, the Editor finds one on the same lane.
- 844 cases where the Slicer says "a path exists": 0 verdict disagreements, 0 failed replays.
- The Slicer's own winning keys, played in the course the Editor builds, clear it every time.
- This holds with roof start on and off.
- Small gap: in 21 cases (roof start off) a few steps differ by 0.01 m because of a rounding tie; no verdict changed.
- Not covered: the Editor's "find a lane" button and a lane the player draws by hand.

## Why Eixample loses heights with roof start
- At 12 m and 15 m the lane the old rule proves reads the same and clears with roof start on.
- So the place is still solvable; the Slicer just did not look at that lane.
- The Slicer proves at most 4 candidate lanes per height, and roof start changes the order of the candidates.
- With 40 proofs allowed, a path shows up at both heights.
- The other 28 places with losses were not checked one by one; the same cause is the likely one.
- Fix to try: prove more candidates when the first few fail (costs time), or rank them by the roof-start heights.

## Table: solvable cut heights per place
| Place | Heights | Solvable roof start off | Solvable roof start on | Lost with roof start | Slicer vs editor disagree |
| --- | --- | --- | --- | --- | --- |
| alfama-lisbon | 19 | 12 | 18 | 57 m | 1 |
| bo-kaap-cape-town | 27 | 9 | 27 | none | 0 |
| boston-common-beacon-hill | 11 | 9 | 11 | none | 0 |
| bryant-park-new-york | 5 | 3 | 5 | none | 0 |
| bryggen-bergen | 13 | 10 | 8 | 18, 21, 24, 36, 39 m | 1 |
| bukchon-seoul | 10 | 7 | 9 | 18 m | 1 |
| caminito-buenos-aires | 6 | 4 | 6 | none | 0 |
| castle-hill-budapest | 14 | 4 | 13 | 42 m | 0 |
| circular-quay-sydney | 19 | 12 | 19 | none | 2 |
| ciutadella-barcelona | 5 | 3 | 4 | 15 m | 0 |
| covent-garden-london | 9 | 7 | 8 | 27 m | 1 |
| dolores-park-san-francisco | 13 | 10 | 13 | none | 6 |
| edinburgh-old-town | 12 | 6 | 11 | 36 m | 0 |
| eixample-barcelona | 14 | 10 | 8 | 12, 15 m | 0 |
| galata-istanbul | 20 | 16 | 18 | 57, 60 m | 1 |
| gamla-stan-stockholm | 9 | 5 | 9 | none | 1 |
| gas-works-park-seattle | 5 | 3 | 4 | 15 m | 0 |
| gastown-vancouver | 9 | 7 | 8 | 27 m | 1 |
| grand-place-brussels | 7 | 2 | 5 | none | 0 |
| jordaan-amsterdam | 8 | 3 | 2 | 9, 12 m | 0 |
| lombard-street-san-francisco | 27 | 14 | 25 | 72, 81 m | 1 |
| main-square-krakow | 11 | 8 | 8 | 12, 30, 33 m | 0 |
| montmartre-paris | 34 | 19 | 34 | none | 0 |
| nyhavn-copenhagen | 6 | 4 | 6 | none | 0 |
| old-town-square-prague | 7 | 4 | 7 | none | 1 |
| old-town-tallinn | 12 | 8 | 12 | none | 1 |
| parc-guell-barcelona | 23 | 16 | 13 | 42, 45, 51, 54, 60, 63, 66, 69 m | 2 |
| piazza-navona-rome | 7 | 4 | 6 | 21 m | 0 |
| piazza-san-marco-venice | 12 | 7 | 12 | none | 0 |
| place-des-vosges-paris | 6 | 3 | 5 | 12 m | 0 |
| plaka-athens | 12 | 10 | 9 | 30, 33, 36 m | 0 |
| plaza-mayor-madrid | 8 | 4 | 3 | 9, 18, 21, 24 m | 0 |
| positano-italy | 33 | 5 | 5 | 45, 48, 54, 57 m | 0 |
| retiro-park-madrid | 5 | 3 | 4 | 15 m | 0 |
| senate-square-helsinki | 14 | 9 | 14 | none | 0 |
| shibuya-tokyo | 16 | 10 | 15 | 48 m | 1 |
| spanish-steps-rome | 10 | 8 | 9 | 30 m | 0 |
| speicherstadt-hamburg | 10 | 9 | 9 | 30 m | 0 |
| stephansplatz-vienna | 13 | 10 | 12 | 39 m | 0 |
| stradun-dubrovnik | 13 | 8 | 12 | 39 m | 0 |
| temple-bar-dublin | 9 | 7 | 9 | none | 0 |
| trafalgar-square-london | 9 | 6 | 8 | 27 m | 0 |
| tuileries-paris | 6 | 3 | 4 | 15, 18 m | 0 |
| union-square-san-francisco | 12 | 10 | 12 | none | 0 |
| valletta-harbour-malta | 10 | 8 | 10 | none | 0 |
| washington-square-new-york | 12 | 6 | 12 | none | 0 |
| zocalo-mexico-city | 16 | 4 | 14 | 45, 48 m | 0 |

## Where it lives
- `src/slice/slice.ts`: `setRoofStart(on)`, `roofStartOn()`, `sliceProfile`, `laneToCourse`.
- `tests/roof-start.test.ts`: the start deck stands at the roof, and ground below the cut is hidden.
- `scripts/roof-start-compare.ts`: the early sweep; run it on a VM, one place per process.
- `scripts/lane-equal-sweep.ts`: Slicer against Editor, plus the roof-start table; `scripts/roof-start-why.ts` explains one lost height.

## Next
- Prove more candidate lanes under roof start, then run the sweep again.
- Wire the switch to a page setting, then to the Slicer and Editor.
- Relabel the Editor slider "Where the water starts (cut height)".
