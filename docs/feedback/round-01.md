# Playtest feedback, round 1 (2026-10-27)

*The product owner played the Course and the Dojo.*
*Tracked in Linear as CC-30; item ids never change.*

## What works
- R1-OK1: the basic mechanics feel good.
- R1-OK2: the five obstacles are enough to show the physics ideas.
- R1-OK3: the replay after a fall is good.

## What was changed
- R1-G1 (wall teleport):
  - The runner now pulls up and over in 72 ticks instead of jumping to the deck.
  - A test checks no tick moves more than 8 cm.
- R1-G2 (too slow):
  - Top speed 9 m/s and acceleration 10 m/s².
  - The first gap is 4.5 m and the steps are 3.5 m apart.
- R1-G3 (speed visible):
  - A speed meter shows the speed, with a marker for the speed the next gap or the wall needs.
  - The needed speed is found by trying the simulator.
- R1-G4: the Dojo has a "Back to the Course" button.
- R1-L1, R1-L2, R1-L3:
  - Gap widths and the wall height are painted on the Course.
  - "Train the gap" opens the Dojo on the gap the player fell at, with its width, its needed speed and the speed the player left the edge at.
  - The fall tip names the speed.
- R1-T1, R1-T2: every obstacle has a six-step lesson (why, try it, the shape, a rule of thumb, the exact formula, on the Course).
- R1-T3: formulas appear only as step 5 of a Dojo lesson (rule updated in `CLAUDE.md`; to be confirmed by the owner).
- R1-W1, R1-W2: the climb height comes from energy only, and the wall is drawn as an orange curve.
- R1-P1, R1-P2: "Length above the grip", and the rope question is now "How far across will you land after you let go?".
- R1-V1: the last three runs stay on the picture; "Clear the old lines" resets them.
- R1-N1: landing shows "Soft landing" or "Hard landing" with the push in times the runner's weight, and the capsule squashes; the full picture needs the Rookie (CC-16).
- R1-X1: the agent works in its own git worktree.

## Still open
- R1-N1: the Rookie squatting on landing (CC-16).
- A second playtest to confirm every item.
