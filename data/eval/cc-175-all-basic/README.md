# CC-175: the Training course holds every basic obstacle

- Serves the demo beat "Training: every move", the run that shows every basic move once.
- The warped wall was missing; it now comes early, so a player learns to hold E before the climb and the bars.
- The course now has 10 beats and an ideal run of 40.1 s (was 26.9 s).

## So what

- **For the game:** the all-moves course now has every basic physics obstacle the game has, in a learning order: simple before hard.
- **For the demo:** the ideal run (Shift+I) still takes the skip-bar-2 shortcut and still rolls twice; it also holds E on the wall, the climb and the bars.
- **Recommendation:** ship it; 40 s is under the 50 s limit.
- **Next step:** the product owner plays it once on desktop; a browser film was not made here because another browser test was running on the laptop (RAM limit).

## Order now

| # | Zone id (strip) | Obstacle | Where (x, m) |
|---|---|---|---|
| 1 | gap | 5 m gap jump | 20 to 34 |
| 2 | vault | box vault | 45 to 58 |
| 3 | step | half-metre step up (vault) | 64 to 74 |
| 4 | wall | warped wall, 4 m, hold E | 81 to 90 |
| 5 | climb | 2 m wall climb, hold E | 100 to 114 |
| 6 | plank | plank bridge, 9 m, sags but holds | 127 to 142 |
| 7 | lache | lache pair (second bar skippable) | 158 to 173 |
| 8 | rope | rope swing | 182 to 195 |
| 9 | trampoline | trampoline onto a high deck | 225 to 245 |
| 10 | drop | big drop and roll, the finish | 253 to 269 |

- The CC-161 block (lache pair, rope, trampoline, drop) is moved 99 m along and 6.5 m up as one piece.
  - Every deck, bar height (3.4 over its deck), the rope (anchor 4 m before its landing deck, 6.6 m over the old ground, length 9) and the far-deck depth keep their distances to each other.
- One change inside the block, forced by the climb leaving it: the long deck after the rope is flat (the old 2 m climb deck sat there), so the trampoline bed and everything after it dropped 2 m with it; the bed-to-deck relation is unchanged.
- A 22 m run-up joins the plank to the first bar, because a plank walk is slow and the bar jump needs full speed.

## Audit: which obstacle is basic

| Obstacle | Source | Class | Reason |
|---|---|---|---|
| gap | `zone-icons.ts`, `primitives.md` | BASIC, in | plain jump |
| step / curb | `zone-icons.ts` (`step`) | BASIC, in | plain rise, vaulted; was not in the course |
| vault | `vault.ts` | BASIC, in | already there |
| wall climb | `climb.ts` | BASIC, in | already there |
| warped wall | `wall.ts`, `course.wall` | BASIC, in | was missing: the finding of this issue |
| trampoline | `trampoline.ts` | BASIC, in | already there |
| lache bars | `holds.ts` | BASIC, in | already there |
| rope | `rope.ts` | BASIC, in | already there |
| drop and roll | `drop.ts`, `roll.ts` | BASIC, in | already there |
| plank / balance | `beam.ts`, `planks` | BASIC, in | plain walk on a beam, no machine and no photo piece; was not in the course |
| mound / ramp | `primitives.md` | out | a schema shape only; the simulator has no separate mound move (the warped wall is the ramp) |
| stack | `course.ts` (`stack`) | out | a drawn pattern, not a move |
| band | `band.ts` | FANCY, out | the course starts clipped to a post, so it cannot sit mid-course |
| launch bar | `trebuchet.ts`, `launch-window.ts` | FANCY, out | needs the trebuchet, a different vehicle; starts in the sling |
| recoil / air cannon | `recoil.ts` | FANCY, out | a launcher pad with a gun, special equipment |
| drone | `drone.ts` | FANCY, out | a ferry vehicle |
| coaster | `cart.ts` | FANCY, out | a cart on rails, a different vehicle |
| bench, rail, dome | SAM 3D photo pieces | FANCY, out | assets from photos, not basic physics |

- The owner order said "step/curb, plank, band, launch bar" may go where they teach best; band and launch bar are the exceptions here.
  - Both need the rider to start clipped to or thrown by a machine (`band`, `trebuchet` are start states), so they cannot sit in the middle of a chain.
  - They stay in their own demo courses (`band.course.json`, `launch-bar.course.json`).

## The ideal run

- The whole-course search gave no usable result for a course this long after a roll (CC-164), so `scripts/training-line.ts` searched both lines through the lache pair on the plan of the other obstacles.
- `scripts/training-windows.ts` then measured the press windows (the whole-course search normally stores them).

| Line | Ticks | Seconds |
|---|---|---|
| Skip bar 2 (the ideal run, kept) | 4814 | 40.1 |
| Bar to bar | 4957 | 41.3 |

- The shortcut `skip-bar-2` saves 1.19 s (was 1.28 s).
- Rolls: after the lache drop and at the end, as before; the rope landing is a plain squat.
- E is held in the air for the bar and on the ground for the climb; the wall holds it by itself in the ideal run; the wall catch margin is 0.026 m (the ideal run is at top speed, so a 4 m wall is close to the limit).
- The CC-168 "Hold E to grab" hint is generic for any course with a warped wall, so no new hint was added.

## Pictures

- `whole-course-side.png`: the course from the side with the ideal run.
- `warped-wall-catch.png`: the wall and the ideal run's catch at the top.
- Both are drawn by `scripts/training-side-picture.ts` from the course file and the simulator, not from the browser.

## What changed in the repo

- `scripts/make-training-course.ts`: new order and shapes.
- `scripts/training-line.ts`: base plan follows the new geometry.
- `scripts/training-windows.ts`, `scripts/training-side-picture.ts`: new.
- `public/assets/demo/training.course.json`: regenerated.
- `tests/training-course.test.ts`: new order, wall, plank and step cleared, the shortcut, both rolls.

## Known gaps

- No browser film or screenshot of the live page.
- The search and tests ran on the laptop (CPU only), not on the VM, because the VM has no repo checkout.
