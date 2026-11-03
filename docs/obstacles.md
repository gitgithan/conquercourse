# Input actions by obstacle

- Moved here from the root README (CC-208).
- For Hold-E reach values, [inputs](inputs.md) is newer and wins where the two differ.
- Read from `src/modes/course.ts` (key card and key handler), `src/share/touch.ts` (button names) and the constants in `src/sim`.
- Touch buttons press the same keys: ◀ ▶ run, Jump (Space), Bend (↓), Hold (E), Vault (V), Roll (X), Restart (R); on a course with a cannon also Aim ▲ (↑) and Fire (K).
- A key pressed in a text box does nothing.

| Obstacle | Keys | Touch buttons | What happens | Explained in |
|---|---|---|---|---|
| Flat run | ← → or A D, held | ◀ ▶ | Speed builds up to 9 m/s and drops when you let go | [world-slice](world-slice.md), [SPEC](spec/SPEC.md) |
| Step or curb | Nothing up to 0.3 m; Space above that | Jump | The runner steps onto a curb up to 0.3 m without jumping | [world-slice](world-slice.md) |
| Gap (water below) | Space at the edge, → held | Jump, ▶ | A ballistic jump; touching the water ends the run | [pipelines 7](meta-ai-pipelines.md#7-not-ai-but-the-core-of-the-game) |
| Hard drop | ↓ or S held, or X as you land | Bend, Roll | Bending softens the landing; Roll must be held in the last 0.15 s and no more than 1.2 m up | [world-slice](world-slice.md#roll-and-survivable-drops-cc-56) |
| Timed balls (Cannonballs, or First Course with ?balls=1) | S or ↓ tapped while running to slide; Space to jump; E at a wall to climb and wait | Bend, Jump, Hold | Each cannon shows a plunger sliding from its tail to its muzzle; the ball leaves when it arrives; a slide passes under a head-high ball, a jump over a knee-high one, a climbed wall waits out a double volley | [timed-balls](timed-balls.md) |
| Slide | S or ↓ tapped, on the ground, at 4 m/s or more | Bend | The body drops to 0.6 m high and slides; friction (0.45 x g) takes speed away, it ends after 0.9 s or at 1.5 m/s, then 0.5 s before the next; a jump ends it; no slide in the air | [timed-balls](timed-balls.md) |
| Vault box (top 0.35 to 1.3 m) | V while running at 3 m/s or more | Vault | A hand on top, over and on, keeping 92 % of the speed; a V up to 0.2 s early counts | [world-slice](world-slice.md#the-speed-vault-cc-68) |
| Wall to climb (edge 1.0 to 2.83 m) | Hold E at the wall | Hold | Hands reach 0.9 m in front (0.6 m plus 0.3 m of tolerance) and an edge up to 2.45 m over the feet; a bright rim shows the ledge that answers to E; grab, hang 0.25 s, pull up, stand at 2 m/s; the run speed is lost and the cost is two jumps of energy | [world-slice](world-slice.md#climb-cc-76) |
| Bar in the air (first grab: hands inside an ellipse of about 0.68 m along the run and 0.5 m up or down around the bar; hold E early and it catches as the hands come near) | Hold E to grab, ← → to pump, let go of E to release | Hold, ◀ ▶ | A pendulum swing; where you let go sets the flight | [world-slice](world-slice.md#the-lache-swing-pivot-at-the-bar-full-circles-a-real-release-cc-58) |
| Lache bars (a pair) | Hold E, pump, let go, hold E again at the second bar | Hold, ◀ ▶ | Regrab inside an ellipse of 1.2 m along the run and 0.6 m up or down from the bar; the ideal run proves a pair | [world-slice](world-slice.md#holds-and-the-lache-pair-cc-44-2026-10-28) |
| Monkey bars (a row of rungs, 0.3 to 1.0 m apart; `?bars=1` shows the editor piece) | Hold E, Q and T reach the hands in turn, arrows kip | Hold, Q, T, ◀ ▶ | A pendulum swing where the arm length decides each gap; a stall never drops you | [bars](bars.md) |
| Warped wall | Run up the curve, hold E for the last 0.13 s before the hands reach the lip | Hold | The hands must be on the edge when the feet reach the top; without E the body slides back with no fall (`?warpedE=0` brings the old rule back) | [inputs](inputs.md) |
| Rope | Reach it; Space lets go | Jump | The catch is automatic where the hands are within 0.35 m of the rope (0.5 m near the end); a pendulum follows | [pipelines 7](meta-ai-pipelines.md#7-not-ai-but-the-core-of-the-game) |
| Trampoline | Space at the bottom of the bounce | Jump | A press within about 0.05 s of the deepest point adds 2 m/s; it fades over 0.11 s | [world-slice](world-slice.md) |
| Ramp or hill | → held; Space at the top | ▶, Jump | Runs on the curved ground; a coaster track adds ↓ or S to brake | [world-slice](world-slice.md#running-and-jumping-on-curved-ground-fixed-2026-10-27) |
| Cannon (recoil) | K to fire; ↑ ↓ or W to tilt while loaded | Fire, Aim ▲ | The ball goes back and you go forward; dots show the landing | [world-slice](world-slice.md#recoil-momentum-is-conserved-cc-66) |
| Trebuchet | → held, then Space, ↑ or W at the hint | ▶, Jump | Pull the pin, then let the rider go when the hint says so | [world-slice](world-slice.md#the-trebuchet-cc-62) |
| Elastic band | ← held, then → held | ◀, ▶ | Stretch it, turn, and it throws you | [world-slice](world-slice.md#elastic-band-cc-65) |
| Drone | E on the pad to board, ← → lean, ↑ ↓ climb or descend, release E to step off | Hold, ◀ ▶ | The drone flies where it leans; a landing above 2.5 m/s down or leaning over 0.35 rad crashes | [world-slice](world-slice.md#the-drone-ferry-cc-87), [drone](drone.md) |

## Not verified, and rows the code does not have
- Hold-E rules follow CC-168 and are listed in [inputs](inputs.md): a 0.3 m forward and 0.25 m upward tolerance on wall ledges, no tolerance on ropes beyond their catch circle, and E held for the last 0.13 s on the warped wall (CC-194).
- Each Hold-E value in this file was re-checked against `src/sim` on 2026-10-30 (CC-214).
- Keys A, D, S, W are read in the input line (`course.ts`); I did not run each one in a browser.
- The touch pad has no Up or Down button except Bend (↓) and, on a cannon course, Aim ▲ (↑).
- Whether the drone's climb (↑) can be done by touch is not shown by the code I read.
- The vault timing and the rope release (Space) were read from the key card text and constants, not traced in `src/sim/world.ts`.
- E is read as a held key (`handL` and `handR`), so letting go of E releases a bar.
- The warped wall (a curved run-up) is in `src/sim/wall.ts` and the Dojo; I found no course key for it, so it has no row.
- "Low bar or shimmy", "water as a swim" and "ramp keys" were asked for; the code has no shimmy, and water only ends the run, so they are not rows.
- Trampoline and band numbers are from `src/sim` constants, not measured in a run.

## Coaster and swing bars in the editor (CC-244, 2026-10-31)
- The ride is drawn as a gentle curve through its dots, the same curve the cart follows.
- The "Gentle wave" shape is a long smooth ride with small hills.
- Reaching the end of the last rail is not the finish line when more course follows.
- The rider flies off the end and carries on: grabs the next bar or lands on the next platform.
- The ideal run for such a course rides first, then plays on from where the rider lands.
- A 3D object can take the role "Swing bar": it becomes a bar to hang from at its top, not a block to stand on.
- The "Height off the ground" slider goes up to 8 m for bars.
- Space (or Up, or W) while riding jumps the rider out of the cart at once, at any moment.
- The rider leaves with the cart's speed at that moment plus the jump, and the body does not jump in place.
- The cart stays behind as its own object: it rolls on or rests by itself and never joins the body again.
- The rails do not catch the rider again after a jump out.
- The "Coaster to a deck" course in the editor has no bar: the old bar sat 2.5 m past the rail end and nobody used it.
- The editor opens a coaster with its dots showing; double-click the side view to add a dot, drag a dot to move it.
- Both coaster screens (the builder and the editor) show the same boxed "how to" card.
- Pictures: `docs/evidence/cc-244-coaster-howto-builder-1280.png`, `docs/evidence/cc-244-coaster-howto-editor-1280.png`.
- Law tests: `tests/coaster-flow.test.ts`, `tests/cart-jump-off.test.ts`.

## Hang bars: where the rod is (CC-243, 2026-10-31)
- The green hang bar has its crossbar 2.2 m up; the black one has it 2.05 m up (`hang_m` in `public/assets/objects/index.json`).
- Adding one in the editor puts down two pieces: the frame (scenery, never ground) and a separate "Bar" piece at the crossbar height.
- The Bar piece is the rod the runner grabs: it becomes a hold in the course, so E grabs it and the swing works like the Lache.
- The rod is now amber in the editor and in the Course (it was pale grey and easy to miss); the ring beside it marks the grab spot.
- Two ready-made courses test it: "Green hang bar (clears)" and "Black hang bar (clears)", a 9 m gap with the rod in the middle.
- Law tests: `tests/hang-bars.test.ts` (the ideal run clears and goes through swing or hang mode).
- Picking a ready-made course now fits the camera to its pieces, so the new objects are on the screen.
- Picture: `docs/evidence/cc-243-hang-bar-rod.png`.
- The default course of the World Editor is now "Hang bar and Lache": three decks, a real green hang bar, then the two Lache bars.
- The game also finds a green or black hang-bar object as a rod on its own, even with no separate bar piece beside it.
- Picking a course in the list clears every object first, drops any hand-off from the Course and loads the new course.
- A test shows the simulator's ideal run grabs and swings at least twice on it (`tests/hang-bars.test.ts`).
- The first catch is wide on purpose (owner, 2026-10-31): holding E before the hands reach the bar, or just past the bar, still attaches.
- The ideal run tries a stand-climb (hold E at the foot of a step up to 2.2 m) before it jumps, so the Training course no longer jumps just before the E.
- Picture: `docs/evidence/cc-243-default-swing-course.png`.
