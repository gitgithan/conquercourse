# Stages: from one move at a time to chains (CC-113)

Serves the player who finishes the first courses and wants more challenge, and the demo beat "it gets harder in a way you can feel".
Status: design only, written 2026-10-29 at the product owner's request.
Course names are the 14 courses in the menu after CC-97 (see docs/course-design.md).

## The idea

- A stage is a named list of courses with one unlock rule.
- Stage 1 teaches one move at a time.
- Stage 2 chains moves, so two hands and the legs work together (on the keyboard: two or three keys at once).
- Never grade technique: a stage unlocks by finishing, not by style.

## How difficulty rises

- Stage 1: one move per obstacle, a clear gap between obstacles, time to think.
- Stage 2: the next move starts before the last one ends.
- Chain length goes up: 2 moves, then 3, then 4.
- Timing windows get tighter, but the ideal run always proves the course can be done.
- A hidden limit is never the difficulty: battery, reach and energy are shown before the run (CC-101).

## Stage 1: one move or one idea at a time (the menu today)
- Training course (every move once, first in the menu)
- Real places: Montmartre, Sydney quay, San Francisco hill, Barcelona block until Edinburgh Old Town lands
- Real objects: Park rail run
- Contraptions, one each: Coaster (two courses), Trebuchet, Band, Drone ferry, Cannon, Stack demo, Plank bridge

Unlock rule: none; all open from the start.
Each course takes about 1 minute.

## Stage 2: chains that need coordination (about 6 courses)

- Hold E and steer: swing while pumping with the arrows, then let go into a jump.
- Band into climb: a band throws you up to a wall, grab with E and pull up.
- Cannon then roll: the air cannon lands you at speed; roll to survive the drop.
- Drone to hanging bar: ride the drone, then grab the bar in mid-air.
- Vault into band: keep the speed over the box so the band launches higher.
- Tool choice: pick two of four tools before the run (CC-101); the ideal run says which pair is best.

Unlock rule: finish the Training course and any 4 other stage 1 courses.
Stage 2 courses are about 1 to 2 minutes each.

## Not built, so not in a stage

- Salmon ladder and spider wall: need new hand moves.
- Kipping from standing: waits for the arms engine test courses (CC-44).

## What the product owner can check

- Play the Training course and stage 2 course 1 back to back: the second needs two keys at once.
- The ideal run clears every stage 2 course (checked by `ideal-all-check`).

## Next steps

- Build stage 2 as stored plans after the course redesign merges.
- Add the stage list to the course menu behind a feature switch.
- Show the stage and "4 of 5 finished" in the menu header.
