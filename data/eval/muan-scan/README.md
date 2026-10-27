# Video ingest: muan-scan

*Serves the Park beat: which other obstacles and moves in the first video could become recipes (CC-29). Run 2026-10-27.*

## So what
- **Result for the game:** the scan found 21 segments in the 4:36 video, and the salmon ladder (bar hops) is the obstacle that shows up most, in 5 segments with 3 clean side views.
- **Recommendation:** make a bar recipe from the salmon ladder next, because it would turn the proposed `bar` primitive into a confirmed one; see the CC-29 README for the ranking.
- **Next step:** run a normal ingest (not a scan) on 96-118 s and 124-132 s.
- **Limit:** the scan looks at one frame every 2 s, so the time ranges are good to about 2 s, and a segment with one frame only (marked below) has an unknown length.

## Source
- **Video:** [Amazing American Ninja Warrior Nation](https://www.youtube.com/watch?v=7soV521Xk1A) by Andrew Muan
- **Licence:** Creative Commons Attribution license (reuse allowed)
- **Range:** 0-276 s, 138 frames (one every 2 s)

## Safety
- **Text screen:** passed (no child words in the title, description or tags).
- **Faces:** pixelated on Modal before the vision model saw any frame.
- **Not done:** the scan has no adult check of its own, because it only lists times; the adult check runs when a segment is ingested.

## Segments found (Meta `muse-spark-1.3`, labels are the model's, not measured)
| Time (s) | Obstacle | Move | Side view | Note |
|---|---|---|---|---|
| 4 (one frame) | rope swing | swing on rope toward platform | yes | single replay frame labeled qualifying course; full times not clear |
| 8-10 | trampoline to hanging wheel | run and bounce off trampoline to grab first wheel | yes | launch into wheel obstacle |
| 10-22 | rolling wheels on overhead track | hang and swing transferring from wheel to wheel | yes | traverse across overhead rolling wheels |
| 24-28 | ring swing | swing on ring and jump to platform | yes | lands on platform |
| 32-46 | slider | hang and slide across rails | yes | continues sliding toward far end |
| 48-62 | slider | jump to rings and swing across to landing platform | yes | lands on platform at 62s |
| 78 (one frame) | floating steps | running across steps | yes | only single 78s frame shows action so full stretch unknown |
| 94 (one frame) | salmon ladder | climbing with bar | yes | only single 94s frame shows action so full stretch unknown |
| 96-118 | salmon ladder | hanging and hopping bar up rungs | yes | mix of side wide shots and rear close-ups, crowd inset at end |
| 120-121 | bar jump | swings through air and lands on platform | yes | wide shot; exact landing moment between labels |
| 124-132 | salmon ladder | climbs bar up rungs then jumps to platform | yes | close side views then wide dismount; gap 121s to 124s not shown |
| 148-166 | warped wall | run up ramp and climb over top | yes | reaches top; cutaways to crowd and hosts interrupt view |
| 170-172 | floating steps | running across angled steps | yes | starts standing then runs |
| 174 (one frame) | rope swing | swinging through air on rope | no | only one label shows mid-swing |
| 176-184 | salmon ladder | hanging and kipping on bar | yes | wide side view with crowd cutaway |
| 186-190 | salmon ladder | hopping bar up rungs | no | close-up from below/front |
| 192-198 | rope swing | swing and dismount to platform | no | lands on platform and grabs next handles |
| 198-214 | slider | hang and slide along track | yes | travels across gap on red handles |
| 216-218 | gap jump | jumping through air | yes | airborne in 216s frame; landing not visible so end time approximate |
| 222 (one frame) | floating steps | running across platform | yes | only single 222s frame shows action; times cannot be told precisely |
| 240-262 | trapeze swing | grabs overhead bar, swings off platform and falls into water | yes | crowd cutaways interspersed; close-ups then wide then water |

## Cost (actual)
- **Modal L4:** 137 container seconds, about $0.03
- **Meta vision:** about $0.09 (12 calls)
- **Total:** about $0.12 at list prices; expected was $0.86.
- **First attempt:** refused by the cost guard before any paid step; the guard counted all 8,280 frames instead of the 138 scan frames, and that is fixed in this branch.

## Files
- `scan.json` (the segments), `run.json`, `inputs/source.json`
