# Playtest feedback, round 2 (2026-10-27)

*Tracked in Linear as CC-31; item ids never change.*
*Rule from the owner: fix everything at once; what cannot be fixed is documented with options.*

## Answers to questions
- R2-G3 (is the long run-up by design?):
  - Yes: it let the runner build up speed.
  - With the quicker start it is now 14 m, and the first gap needs only about 5 m/s.
- R2-G5 (why the big slow-down after jumps?):
  - A normal jump landed harder than the stumble limit, so every landing without the down arrow cost speed.
  - Fixed: only falls from height stumble now (about 2.5 m and more); the trampoline catches any fall.
- R2-D1 (is the gap formula right?):
  - It is exact for a jump that takes off and lands at the same height and ignores air resistance.
  - The wall formula is exact without friction (the game loses about 10 %).
  - The rope formula is exact for a stiff rope.
  - The trampoline one is an approximation and is shown with "≈".
  - Each formula now carries its caveat.

## Changes
- R2-G1: running left works (mirror of running right, tested).
- R2-G2: the Course has two jumps before the wall (a gap, then a raised block).
- R2-G4: the Dojo is one click (or the T key) away at any time and opens on the nearest obstacle.
- R2-G7: the squash effect resets on restart.
- R2-G8: the rope drawing now swings with the body.
- R2-L1, R2-L2:
  - No body-weight numbers.
  - A plain "ouch" scale from 0 (feather) to 10 (broken bones) in the Dojo.
  - On the Course only firm, hard and dangerous landings are mentioned, in words.
  - Normal jumps need no down arrow.
- R2-D2: each obstacle keeps its own place and runs; the steps are free to click; nothing is locked.
- R2-D3, R2-D4: a person is in every Dojo scene; the rope scene shows the beam, the rope hanging, the rope at the release angle with an arc and the word "angle".

## Not done yet (with options)
- R2-G6 (the real Rookie instead of the pill):
  - A VM agent is building a reusable Rookie actor for the Course (branch `cc-31-actor`).
  - Run, leap and land are ready; hang and swing load and pose.
  - The wall climb has no motion clip (CC-17): the actor composes one from run and reach; options are Kimodo with the simulator path as targets, or measured video motion.
- R2-D5 (labelled diagrams):
  - A VM agent is drawing original diagrams (branch `cc-31-diagrams`): a real obstacle with force arrows and an abstract principle diagram per obstacle.
  - They will go in step 1 of each lesson, in the space the plot uses later, with a toggle between the two.
  - The two example images are not ours to copy, so the art is original.
- R2-V1: animating the rope swing nicely is parked until the core features are done.
