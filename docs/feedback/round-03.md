# Playtest feedback, round 3 (2026-10-27)

*Tracked in Linear as CC-32.*

## Answers
- R3-Q1 (is there an ideal run?):
  - Yes: `?bot=ideal` plays the whole course hands-free.
  - The "Ideal run (I)" button plays the ideal line for the obstacle you are at, from standing still.
- R3-G2 (how does the trampoline press change the formula?):
  - The press adds speed to the speed the spring gives back.
  - Height grows with the square of the total speed, so a small push at the right moment buys a lot of height.

## Changes
- R3-G1 (the trampoline):
  - Cause: the extra push worked only within 80 ms of the bottom, with no cue.
  - Now: the push is full near the bottom and fades gently, a press up to 8 ticks before landing counts, "Press Space now" shows, and a rough press about 70 ms late still clears (tested).
  - The far platform is 4.0 m up (was 4.3 m).
- R3-G3 (retry from the start):
  - "Try this obstacle again" (R) starts standing still just before the obstacle; "Start from the beginning" (Shift+R) is the other choice.
  - Every obstacle is clearable from standing still at its checkpoint (one test per checkpoint).
- R3-G4 (replay with diagnostics):
  - The replay runs at half speed and lists the numbers: speed when you jumped, the speed needed, where you pressed, the strip where a press would have worked, and for the wall, the trampoline and the rope what to change.
  - It draws the guides on the course: green strip, red post, your flight in orange, a flight that works in green.
