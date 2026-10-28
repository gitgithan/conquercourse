# The drone (CC-87)

## So what
- A drone is the best small machine we have for teaching how things fly: it has a weight, a push (thrust), a battery and a brain.
- Every one of those is a number the player can change and then see, so each lesson is a discovery, not a lecture.
- The first build is a ferry: a cargo drone that carries the character across a gap too wide for any jump.
- It is cheap to build because the game already has the pieces: world modes, the ideal-run proof, the debug preview, the Dojo.

## What a drone teaches, and where it shows in play
- **Thrust against weight (hover).**
  - A drone hovers when its push upward equals its weight.
  - More push than weight and it climbs; less and it sinks.
  - In play: the Hover lesson in the Dojo, and the climb and sink you feel on the Course.
- **Tilting to move.**
  - A drone moves sideways by leaning, so part of its push goes sideways.
  - That leaves less push for holding it up, so a leaning drone sinks unless it pushes harder.
  - In play: the left and right arrows lean the drone; the drone adds push by itself to hold its height, and you can see the push number rise.
- **The payload limit.**
  - The push has a top value.
  - A heavier rider leaves less spare push, so the drone can lean less before it runs out of lift.
  - Too heavy and it cannot lift off at all.
  - In play: the editor's payload knob and the "Fix it" advice (a lighter payload).
- **Battery energy and range.**
  - A battery holds a fixed amount of energy, and the drone spends it at a rate called power.
  - Energy used equals power times time, so a drone that hovers for a long time runs flat.
  - Hovering costs more the heavier the drone is (the power grows faster than the weight).
  - In play: the battery bar on the screen, the battery knob in the editor, and a drone that falls when the bar hits zero.
- **Drag and wind.**
  - Air pushes back harder the faster the drone goes, so it never speeds up forever.
  - A gust of wind is a push from the side.
  - In play: the speed settles at a top value, and the windy variant pushes the drone off its line.
- **Control and overshoot.**
  - A drone with no brain reacts late: you lean to go left, and by the time it turns it has gone too far.
  - A small controller (a stabiliser) watches the drone and corrects it many times a second, which is why real drones are easy to fly.
  - In play: the Course drone has a stabiliser on; the Hover lesson turns it off so the learner feels the difference.
- **Rotors and torque.**
  - Each spinning rotor pushes the drone round the other way (a twist, called torque).
  - A quadcopter has four rotors in two pairs spinning opposite ways, so the twists cancel.
  - In play: the drawn drone shows rotors spinning in pairs, and the Notebook entry explains it (later).
- **Mapping with a camera.**
  - A drone that flies a grid and takes overlapping photos can be turned into a 3D model of a place.
  - In play: the Atlas (CC-72) will use a scouting drone to look at a real place before the player builds a course from it.

## Three ways to play it
- **A. The ferry (recommended, built first).**
  - The character boards a cargo drone on a pad, flies across a gap, and gets off over the far deck.
  - The lesson shows in every part: lift, lean, battery, drag, wind.
  - It needs only one new world mode and uses the existing proof.
- **B. The scout.**
  - The player flies a small drone over the course first and looks down on it.
  - It teaches planning and the camera, but it adds no obstacle, so it is a tool more than a challenge.
  - Good for the Atlas later.
- **C. The delivery drone with a swinging load.**
  - The character hangs below the drone on a rope, so the load swings.
  - It joins the drone with the swing physics we already have, and teaches why sudden moves make a load swing.
  - It is the hardest to control and the hardest to prove, so it comes after the ferry.
- **Recommendation:** build A now, add C as a harder variant, use B inside the Atlas.

## What stays out
- No weapons, and no drone that hurts people.
- No footage of people; the drone is drawn by the game.
- No robot-building framing: the drone is a vehicle the player flies, not a robot the player programs.
- Earth gravity only.
- No grading or coaching of how well the player flies; messages say what happened and what would have worked.

## The honest numbers (the ferry)
- The drone frame, rotors and battery weigh 85 kg and the rider 70 kg, so the total is 155 kg and the weight is about 1,520 N.
- The most the rotors can push is 3,100 N, a little over twice the weight.
- Eight rotors, each 1.4 m across, give a total disk area of about 12.3 m².
- Hover power from the standard rotor law is the thrust to the power 1.5, divided by the square root of 2 × air density × disk area: about 10.8 kW for an ideal rotor.
- A real rotor is about 65% as good as the ideal one, so the electric power is about 16.6 kW, plus 0.3 kW for the electronics: about 17 kW.
- Real person-carrying drones carry roughly 10 kWh and fly 15 to 25 minutes.
- Our demo pack is a short-hop pack of 50 Wh (180 kJ), which hovers for about 10 seconds, so a wasted manoeuvre can empty it; the editor's battery knob goes up to 1 kWh.
- Leaning to 0.5 rad (29 degrees) while holding height needs 14% more push than hovering, and costs about 21% more power.
- The drone leans with a short delay (about 0.25 s), which is the controller's reaction time.

## The three cheapest builds before 2026-11-04
- **1.
  - The ferry on the Course** (this issue): mode, drawn drone, demo, debug path, proof, hints.
- **2.
  - The Hover lesson in the Dojo** (this issue): thrust against weight with a payload knob; the formula is the last step.
- **3.
  - The editor piece and Fix it** (this issue): pad, payload and battery knobs, and "a bigger battery or a lighter payload" advice.
- After these: the windy variant, the stabiliser-off feel lesson, the swinging payload (C), and the scouting drone for the Atlas.

## Controls on the Course
- Run onto the drone's pad and hold E to board; the drone lifts a little way off the ground.
- Left and right arrows lean the drone; up and down arrows climb and descend.
- Let go of E over the far deck to step off, or land softly on a deck and the drone sets you down.
- Battery empty: the rotors stop and the drone falls; a hard landing ends the run, as for any fall, and X rolls.

## Fallbacks and gaps
- 2D side-view flight only, like the rest of the game.
- The stabiliser is a fixed control law; the Hover lesson shows raw thrust but the Course always has the stabiliser on.
- The rider is drawn standing on the skids in the running pose; a harness pose goes to the motion pipeline (CC-64).
