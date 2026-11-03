# Inputs: what each key does on each obstacle

## Grab and climb

- Hold E is the hands key; it grabs only things the hands can reach.
- Every distance below is in metres, measured from the hands (2.1 m over the feet) or the feet.

| Thing                  | Keys                                   | Reach (hands)                                                                                                                     | Other conditions                                                                                                                                                                                              | Source                                |
| ---------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Wall top edge (ledge)  | hold E, then it pulls up by itself     | 0.9 m in front of the body (0.6 m reach + 0.3 m tolerance); the edge 1.0 to 2.45 m over the feet (2.2 m reach + 0.25 m tolerance) | the body rises no faster than 2 m/s; not moving back; the wall is no taller than the one-jump limit (2.83 m from the ground), unless the body is already higher than any plain jump goes (after a trampoline) | `src/sim/climb.ts`                    |
| Warped wall (top grab) | hold E for the last 0.13 s of the climb, when the hands are near the lip (CC-194, was 0.2 s; CC-182, was 0.5 s) | the hands must be on the edge when the feet reach the top                                                                         | without E the feet get up but the hands miss and the body slides back; `?warpedE=0` brings the old rule back                                                                                                  | `src/sim/world.ts`, `src/sim/wall.ts` |
| Bar (lache)            | hold E in the air                      | a circle of 0.35 m around the bar on the first grab (0.15 m on the Training course, `grabReach`, so the drawn hands touch the bar; CC-193); an ellipse 1.2 m along and 0.6 m up and down after a let-go                   | in the air; a short pause after a let-go                                                                                                                                                                      | `src/sim/holds.ts`                    |
| Monkey bars (rungs) | hold E in the air near a rung; Q and T reach the hands; arrows kip | a rung inside the forgiving first-grab zone of a bar; a reach needs the next rung within a straight arm of the shoulder (0.7 m) | the swing is going forward; hands alternate | `src/sim/bars.ts` |
| Rope                   | hold E in the air; let go of E to swing | 0.35 m from the rope (0.5 m near its end)                                                                                         | in the air                                                                                                                                                                                                    | `src/sim/rope.ts`                     |
| Drone pad              | hold E on the pad                      | on the pad                                                                                                                        | on the ground                                                                                                                                                                                                 | `src/sim/drone.ts`                    |

- The tolerance on the wall top edge is new (CC-168).
- A jump that falls a little short of a ledge, or reaches it a little low, is still caught while E is held.
- The warped wall now needs E held (CC-168), to teach the hands key; ideal runs hold it.
- Nothing is caught through a wall, from the wrong side, or from a long way off.
- A bright rim shows on the ledge that would answer to E; `?grabhint=0` hides it.
- "Hold E to grab" shows only for the last 0.2 s before the lip, until E is held (CC-194).

## Other keys

- Arrows or A, D: run.
- Space: jump (also the trampoline press and the let-go).
- S or Down: squat.
- V: vault.
- X: roll.
- E: hold (see above).
