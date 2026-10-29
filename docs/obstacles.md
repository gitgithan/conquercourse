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
| Vault box (top 0.35 to 1.3 m) | V while running at 3 m/s or more | Vault | A hand on top, over and on, keeping 92 % of the speed; a V up to 0.2 s early counts | [world-slice](world-slice.md#the-speed-vault-cc-68) |
| Wall to climb (edge 1.0 to 2.83 m) | Hold E at the wall | Hold | Hands reach 0.9 m in front (0.6 m plus 0.3 m of tolerance) and an edge up to 2.45 m over the feet; a bright rim shows the ledge that answers to E; grab, hang 0.25 s, pull up, stand at 2 m/s; the run speed is lost and the cost is two jumps of energy | [world-slice](world-slice.md#climb-cc-76) |
| Bar in the air (first grab: hands inside a circle of 0.35 m around the bar) | Hold E to grab, ← → to pump, let go of E to release | Hold, ◀ ▶ | A pendulum swing; where you let go sets the flight | [world-slice](world-slice.md#the-lache-swing-pivot-at-the-bar-full-circles-a-real-release-cc-58) |
| Lache bars (a pair) | Hold E, pump, let go, hold E again at the second bar | Hold, ◀ ▶ | Regrab inside an ellipse of 1.2 m along the run and 0.6 m up or down from the bar; the ideal run proves a pair | [world-slice](world-slice.md#holds-and-the-lache-pair-cc-44-2026-10-28) |
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
