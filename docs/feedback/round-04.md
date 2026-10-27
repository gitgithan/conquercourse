# Playtest feedback, round 4 (2026-10-27)

*Tracked in Linear as CC-34.*

## Answers
- R4-D1 (why a flat section on the Landing graph?):
  - The old picture drew the stop as a flat stretch along the ground, which meant nothing.
  - Now it plots speed against time: speed grows while you fall, then drops to zero over the time you spend bending your knees.
  - A steeper drop means a harder stop, so it hurts more; the guess is on an "ouch" gauge.
- R4-D2 (are the "On the course" values right?):
  - Some were typed into the text; now every number comes from the course in play.
  - The Course and the Park save their course data, and the Dojo works out the gaps, the wall, the trampoline and the biggest drop from it by trying the simulator.
  - A test changes the course and checks the numbers change.
- R4-D3 (dynamic Dojo):
  - Today the values follow the course and the layout stays.
  - Later an agent could write a lesson page for a new kind of obstacle, because a lesson is data (why, tries, shape words, rule, formula, what it means here).
- R4-D4 (interactive objects without making the prediction pointless):
  - Done: the guess locks when you run, a new prediction unlocks it, and a scrubber to replay the run appears only after the run.
  - Next options: drag the take-off point or the rope release on the picture before the run (the outcome stays hidden until the run).

## Changes
- R4-G1: C cycles side, 45 degrees and first person.
- R4-G2: the standing pose is now an upright frame (head level, arms down, feet together), picked by scoring every frame of the shipped clips.
- R4-G3: the ideal run only plans edges ahead of its start, so no warm-up jumps (tested).
