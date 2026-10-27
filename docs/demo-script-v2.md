# Demo script v2 (draft, 2026-10-28)

*Proposal after the arms marathon; the spec's section 10 stays the source of truth until the product owner picks.*
*Related: [spec](spec/SPEC.md), [world-slice](world-slice.md), [STATUS](STATUS.md).*

## The arc
- **One line:** "Pick a place on Earth, and the game builds you a course there, and teaches you the physics to beat it."
- **Meta models on screen:** SAM 3 (the mask), SAM 3D Objects (the object), SAM 3D Body and MHR (the body), Muse Spark Open (the design partner), and the map data we start from.

## Beats (about 3 minutes)
| Time | Beat | What to film | Needs |
|---|---|---|---|
| 0:00 | Hook: a gap in a park, "Can I make that?" | a photo, then the runner at the edge | done |
| 0:15 | The owner's story in two sentences | voiceover over the editor | voiceover |
| 0:30 | **Hero 1:** drop a pin on the map, the place becomes a world | `/?mode=map`, pin, Build, the editor with the shrunk buildings | CC-48 (merged) |
| 0:55 | A photo becomes an object: the skate rail, the bench, placed at real size beside a person | the editor, "From real photos" | done |
| 1:10 | The design partner and Fix it: "cannot clear", one click, a working layout | the helper window | needs the Baseten secret deployed |
| 1:30 | **Hero 2:** the lache pair: run, vault, grab, pump, let go; the front view window and the drum lane | `/?course=/assets/demo/lache.course.json` | done |
| 2:00 | Why it worked: the debug view shows the swing path and the let-go cue | press B on the bar | done |
| 2:15 | The Dojo: the swing lesson earns the saying "push with the swing and it grows" | `/?mode=dojo` | a swing lesson (not built) |
| 2:35 | Your own look: the MHR body from a photo plays the same run | `?look=custom` | a consented photo |
| 2:50 | What's next: community worlds, drone footage, more moves; "Train slow. Run fast." | title card | none |

## Risks to settle before filming
- **Overpass can be slow or down:** film the map beat from the saved answer if needed (`MAP_FIXTURE=1`).
- **The Baseten key** works only with the hackathon model and only once the secret is deployed.
- **The Dojo swing lesson** is the one beat with no code yet.
- **At least 85 % must be real product capture** (spec section 10).
