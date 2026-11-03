# Parts gallery: every move and obstacle, playing on its own

- Written for the demo (owner request, 2026-11-01): "a preview page of all move primitives and obstacle primitives, while showcasing our special obstacles".
- Open it at `?mode=parts`, or press the card "Parts: moves and obstacles" in the Courses picker.
- `?parts=0` hides the picker card; the page itself stays reachable.
- Related: [features](features.md), [sayings](sayings.md), [obstacle primitives](primitives.md), [input actions](obstacles.md).

## So what
- 33 parts: 12 special obstacles, 9 basic obstacles, 12 moves.
- 31 of the 33 play the real Course by themselves in a card (the stored best run, same simulator and renderer as the game).
- 2 open the real Course for the viewer to play with the keys (slide, pole vault), because the stored best run does not use them.
- Every card has a live scene of some kind; see "Gaps" for what is not automatic.
- In a demo the owner can say: "this course is these parts" (second view), then press any card to show that part alone.
- Honest gaps are listed at the end; none is hidden by the page.

## How the page works
- A card press loads the real Course in a frame with `?course=<one small course>&bot=ideal`; nothing is a mock-up.
- Only one frame lives at a time: pressing another card (or the same one) removes the old frame, so the graphics card draws one scene.
- A run that ends starts again after a short pause.
- "How a course is made" cuts a shipped course into the same cards in the order you meet them; a card press plays that part in the big frame above.
- Little courses for the basic parts are cut from the Training course (or made flat) by `scripts/make-parts-courses.ts` into `public/assets/parts/`; each carries its stored ideal run, and `tests/parts-gallery.test.ts` plays every one again.
- Special obstacles use the course that already ships for them (`public/assets/demo/`).
- Card pictures (`public/assets/parts-thumbs/`) are frames from the real runs, made by `node scripts/parts-gallery-smoke.mjs <base> <out> --thumbs`.
- No formulas, no grading, no chat tutor on the page.

## Special obstacles (shown first and larger)
- "Special" means an invention of ours with its own simulator file, or an obstacle tied to a physics saying and a lesson.

| Card id | Name | In plain words | Code | Course that uses it | Why special | Motion clip |
|---|---|---|---|---|---|---|
| `trebuchet` | Trebuchet | A falling weight throws you from a sling onto a tower | `src/sim/trebuchet.ts`, `src/ui/trebuchet-view.ts` | launch, launch-bar, launch-bar-hard | Own machine; saying about arm length and release | Built poses |
| `recoil` | Recoil launcher | The ball goes back, you go forward | `src/sim/recoil.ts`, `src/ui/recoil-view.ts` | recoil | Momentum law made visible; saying | Built poses |
| `cannon` | Cannon | Tilt the barrel, fire, roll out of the landing | `src/sim/recoil.ts` (big cannon), `src/ui/recoil-view.ts` | cannon | Aim angle lesson; saying | Built poses |
| `band` | Elastic band | Stretch it by running away, turn, be thrown | `src/sim/band.ts`, `src/ui/band-view.ts` | band | Own machine; saying | Built poses |
| `drone` | Drone ferry | Lean a cargo drone across a gap | `src/sim/drone.ts`, `src/ui/drone-view.ts` | drone | Own machine; saying (in sayings.md) | Built poses |
| `coaster` | Coaster | A cart on rails with no engine | `src/sim/cart.ts`, `src/slice/coaster.ts` | coaster, coaster-two-hills, coaster-sharp, coaster-low | Energy lesson; saying; own builder page | Built poses |
| `pole` | Pole vault | Plant the pole and hand your speed back as height | `src/sim/pole.ts`, `src/sim/pole-ride.ts`, `src/ui/pole-view.ts` | pole (experiments) | Newest machine; saying | Tried, not shown yet |
| `bars` | Monkey bars | Reach hand over hand along a row of rungs | `src/sim/bars.ts`, `src/sim/bars-world.ts` | bars (docs/bars.md) | Own machine; saying (in sayings.md) | Built poses |
| `plank` | Plank bridge | A plank sags under you and breaks if thin | `src/sim/beam.ts`, `src/render/plank.ts` | plank, plank-two, plank-thin, training | Saying about length; made in the editor | Built poses |
| `stack` | Cup stacks | Sport-stacking cups as stairs | `scene.stack` in `src/course/course.ts` | stack | Real sport object; saying | Built poses |
| `shots` | Timed balls | A cannon fires on a shared clock | `src/sim/shots.ts` | cannonballs, First course with `?balls=1` | Saying about beats (CC-240) | Slide clip |
| `lache` | Lache bars | Swing on one bar, catch the next | `src/sim/holds.ts` | lache, lache-wide, training, generated | Ninja-sport move; saying about pushing in step | `hang.json` |
| `forks` | Two ways (forks) | The course splits once | `src/sim/branches.ts` | two-ways | Two proved ways through; no saying yet | Built poses |

## Basic obstacles
| Card id | Name | In plain words | Code | Course that uses it | Saying | Motion clip |
|---|---|---|---|---|---|---|
| `gap` | Gap | Water below; jump at the edge | `src/sim/terrain.ts` | training, most courses | yes | `leap.json` |
| `step` | Step up | A step too tall to walk onto | `src/sim/runner.ts` (step-up limit), `src/sim/needs.ts` | generated courses | none yet | `leap.json` |
| `vaultbox` | Vault box | A box at waist height; V goes over | `src/sim/vault.ts` | training, park-run | yes | `vault.json` (captured, locked) |
| `warped` | Warped wall | A curved wall; run up, hold E | `src/sim/wall.ts` | training, cannonballs | yes | none |
| `tallwall` | Tall wall | Grab the edge and pull up | `src/sim/climb.ts` | climb, training | yes | `climb.json` (captured, locked) |
| `ropeswing` | Rope swing | Catch the rope, let go on the way up | `src/sim/rope.ts` | training, cannonballs, montmartre | yes | `swing.json` |
| `trampoline` | Trampoline | A springy bed; land hard, go high | `src/sim/trampoline.ts` | training, cannonballs | yes | none |
| `drop` | Big drop | A ledge high above the floor; bend and roll | `src/sim/drop.ts`, `src/sim/landing.ts`, `src/sim/roll.ts` | drop, climb, training | yes | `roll.json`, `land.json` |
| `objects` | Real objects | Benches, rails, stairs from a real park | `src/world/furniture.ts`, `scene` in `src/course/course.ts` | park-run, park-rail-run, lanes | none (each object keeps its own saying only when it is a part above) | none |

## Moves
| Card id | Name | Keys | Code | Shown in the card by | Motion clip |
|---|---|---|---|---|---|
| `run` | Run and brake | → or D, ← or A | `src/sim/runner.ts` | flat little course | `run.json` |
| `jump` | Jump | Space | `src/sim/runner.ts` | gap | `leap.json` |
| `bend` | Bend your knees | hold S or Down | `src/sim/landing.ts` | big drop (the bot holds the bend) | `land.json` |
| `slide` | Slide | tap S or Down at speed | `src/sim/slide.ts` | **no automatic run** (Cannonballs, by hand) | `slide.json` |
| `roll` | Roll | X | `src/sim/roll.ts` | big drop | `roll.json` |
| `vault` | Vault | V | `src/sim/vault.ts` | vault box | `vault.json` (captured, locked) |
| `climb` | Climb | hold E at a wall | `src/sim/climb.ts` | tall wall | `climb.json` (captured, locked) |
| `hang` | Hang and swing | hold E, pump, let go | `src/sim/holds.ts` | lache bars | `hang.json` |
| `ropegrab` | Catch the rope | hold E, Space | `src/sim/rope.ts` | rope | `swing.json` |
| `wallrun` | Run up the wall | run, hold E at the lip | `src/sim/wall.ts` | warped wall | none |
| `bounce` | Bounce | Space at the bottom | `src/sim/trampoline.ts` | trampoline | none |
| `ride` | Ride the cart | S brakes, Space jumps out | `src/sim/cart.ts` | two-hills coaster | none |
| (aim and fire) | Aim and fire | Up, Down, K | `src/sim/recoil.ts` | shown by the `recoil` and `cannon` cards | built poses |

- The input bits and world modes behind the moves are checked by the test: bits `run left jump squat roll handL handR vault aimUp aimDown up fire slide reachL reachR`; modes `run wall swing bounce hang bars vault cart launch plank climb band drone pole`.
- Aim, fire, fly (up) and the mode-only moves (launch, plank, band, pole) are covered by the special cards, not by a move card of their own.

## Gaps (honest list)
- `slide`: the stored best run never slides, so there is no automatic demo; the card opens Cannonballs for the viewer to play.
- `bars`: the ideal-run search does not know monkey bars, so the card opens the bars course for the viewer to play (a recorded run proves it clears).
- `pole`: the ideal-run search does not know the pole yet, so the card opens the pole course for the viewer to play; its motion clips are tried but not shown yet (CC-239).
- `forks`: no physics saying yet.
- `step`, `objects`: no saying.
- `warped`, `trampoline`, `bounce`, `ride`, `wallrun`, `band`, `drone`, `coaster`, `cannon`, `recoil`, `trebuchet`, `stack`, `plank`, `bars`: no recorded motion clip; the runner uses the built poses.
- Cards for a part that needs the Rookie's real motion (vault, climb) show the locked captured clips unchanged; this page never edits a clip.
- The Training course has no "Rope plus bar" hero cut; the Montmartre hero course is not split into cards (its parts show in "How a course is made").

## Link to the older primitive set
- The set in [primitives](primitives.md) is the shape list a photo or video becomes.
- It maps onto cards like this: `platform` and `gap` to `gap`; `wall` to `vaultbox`, `tallwall`; `ramp` (arc) to `warped`; `spring` to `trampoline`; `ropeAnchor` to `ropeswing`; `movingHazard` to `shots`; `water` is the floor under every gap; `bar` to `lache`.

## How to add a part
- Add the part to `PARTS` in `src/ui/parts-data.ts` (id, group, name, one line, keys, what it covers, and a live course).
- A new obstacle kind, course field, input bit or world mode without a card fails `tests/parts-gallery.test.ts`.
- If a little course is needed, add a cut to `scripts/make-parts-courses.ts` and run `npx tsx scripts/make-parts-courses.ts`.
- Add its saying to [sayings](sayings.md) first; a special card's saying must be in that file.
- Add a row here (the card id in backticks) and run `node scripts/parts-gallery-smoke.mjs <base> <out> --thumbs` for its picture.
- Add a row for the picture in [ASSETS](ASSETS.md).

## Evidence
- Screenshots at 1280 px are in `docs/evidence/parts-gallery/`.

## The demo runner (owner request, 2026-11-01)
- Every card of the page runs "the girl" (Juno, the Rookie B: violet top, bun, orange headband) by default, so a demo always starts from the same face.
- Before, a frame wore whatever the player had last picked on the Course (`cc.character` in the browser's storage, read by the same-origin frames), so a saved Banana ran in every card.
- The page has a "Runner" picker in its header, and `?char=<16 hex id>` picks one by address.
- A frame is opened with `&char=<id>&nosave=1`: `nosave=1` makes the Course wear the character without saving it as the player's own choice or counting a pick.
- Pictures (old frame address against the new one, with a Banana saved): `docs/evidence/cc-gallery-girl/`.
- `tests/parts-gallery.test.ts` checks the default, the frame address and that `wearCharacter` never saves under `nosave`.
