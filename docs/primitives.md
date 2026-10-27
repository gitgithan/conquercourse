# Obstacle primitives: the one set of shapes every course is built from

*Draft v0.1, 2026-10-27; schema `course/primitives.schema.json` (version 0.1.0).*
*Knowledge from the practice project's set (`docs/learning-design.md`); written new from the spec, no code copied.*

## So what
- **Yes, we have a primitive structure,** and it now exists as a versioned schema that the Builder, the Park and the video ingest all share.
- **Why it matters for the demo:** a photo, a filmed run and a hand-built course all end up as the same few shapes with sizes in metres, so one simulator and one motion library cover them all.
- **Recommendation:** keep the 8 canonical primitives, add the curved ramp (profile `arc`, with `radius` and `height`) now, and hold `bar` as "proposed" until a ninja video confirms it.
- **Next step:** CC-29's ingest writes these shapes with a scale source and an uncertainty for every size (`data/eval/<id>/primitives.json`).

## The set
| Type | Roles | The one relationship it teaches | Editable sizes (metres) |
|---|---|---|---|
| `platform` | stand | stopping and starting on a deck | length, width, height |
| `gap` | hazard | flight is decided at take-off | span, drop |
| `wall` | vault, grab | height is spent from speed or reach | height, width, thickness, topEdge (`flat` or `ledge`) |
| `ramp` | stand, grab | speed becomes height (the curve) | height, run, width, profile (`line` or `arc`), radius (arc), topLedge |
| `spring` | stand | stored energy returns | width, restHeight, travel, stiffness (N/m) |
| `ropeAnchor` | grab | a pendulum swaps height and speed | anchorHeight, ropeLength |
| `movingHazard` | hazard | timing and relative motion | size, speed (m/s), travel |
| `water` | hazard | failure is cheap | length, width, depth |
| `bar` (proposed) | grab | hanging and swinging from the hands | height, length, diameter, orientation |

## Roles
- **stand:** feet can rest on it (a deck, a ramp surface, a spring).
- **grab:** hands can hold it (a rope, a bar, a ledge on top of a wall).
- **vault:** hands push off it to go over (a wall or box a body passes over).
- **hazard:** touching it is failure (water, a moving thing, a gap).
- A primitive may have several roles (a warped wall is `stand` and `grab`); the schema needs at least one.

## What changed from the practice set, and why
- **`ramp` is also the curved wall:** `profile: "arc"` needs a `radius`; `height` is the top edge above the floor and `run` the distance from the foot of the curve to the top; `topLedge` is the flat top the hands grab.
  - Reason: the Warped Wall is in the spec (§3.2) and in the videos; a straight ramp alone cannot say "speed becomes height".
- **`wall.topEdge`:** `ledge` means a lip the hands can hook over; reason: CC-26's brick wall and the spec's "grab the top" need to tell a flat top from a hookable one.
- **`bar` (proposed, not canonical yet):** the monkey bars in CC-26 and the "bar" in the Park's primitive list (spec §6) are grab points that are not a rope and not a wall.
  - It stays `proposed` until a ninja video in CC-29 shows a bar used for a move we want to teach.
- **Everything has a scale block when it came from a photo or video:** `source` is one of `known-height`, `body-height`, `contact-height`, `typical-size`, `depth-model`, `player-entered`, plus a relative uncertainty.

## Scale sources (how metres are found, best first)
| Source | How | Typical uncertainty |
|---|---|---|
| `known-height` | an object of known size in the shot (the Warped Wall's top is 4.3 m on the show) | 3-5 % |
| `contact-height` | the measured height of a hand or foot on the obstacle (the body model gives metres) | 10-15 % today (CC-26 found vertical scale weak) |
| `body-height` | pixels per metre from the athlete's standing height in the picture | 8-15 % (adult height 1.75 m ± 0.1; depth of the obstacle vs the athlete) |
| `depth-model` | a metric depth model (MapAnything) | not measured yet |
| `typical-size` | a table by type (a bench seat is 0.45 m) | 25-40 % |
| `player-entered` | the player dragged the box | the player's choice |

## How a video fit works
1. SAM 3.1 gives masks for noun phrases (wall, curved wall, ramp, platform, bar, rope, ledge, box, ...).
2. The phrase picks the primitive type; the mask's box gives width and height in pixels.
3. A scale source turns pixels into metres; the contacts from the motion pass check it (a hand on the top of the wall must be near the wall's top).
4. The fit keeps the phrase, score, box and mask size, so a person can see and fix a mistake.
- **Honest limits:** a side view gives height and run well but not width or thickness (those fall back to typical values and say so); the fit never invents a role the pictures don't show.

## Not primitives (yet)
- Poles, ladders, nets and slides are not in the set; if a video needs one, it is proposed here first.
