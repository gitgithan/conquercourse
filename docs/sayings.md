# Physics sayings: one tension per obstacle

*Product owner, 2026-10-27, on "Speed gets you over the obstacle; speed also throws you off it": "I love this!!! our game should have more of such sayings. It expresses beauty of forces." And: "Really great sayings we must save them."*
*Related: [spec](spec/SPEC.md).*

## The rule
- Every obstacle gets one saying, and every principle a player can discover gets at least one.
- A saying holds one tension: the same force helps and hurts, or a choice wins one thing and loses another.
- Under about 12 words; no numbers and no formulas (the game never shows formulas).
- It must be literally true of the game's physics; the simulator's law tests are what make it true, so a saying the physics can't back doesn't ship.

## The sayings

| Obstacle | Saying | The physics underneath |
|---|---|---|
| The whole course | *"Speed gets you over the obstacle; speed also throws you off it."* | Momentum is both your resource and your risk |
| Gap jump | *"Once your feet leave the ground, the jump is already decided."* | The flight path is fixed at take-off; nothing in the air changes it |
| Gap jump | *"Jump higher and you fly longer, but not further."* | Too steep a take-off angle wastes range |
| Warped Wall | *"The wall can't lift you. It only spends the speed you bring."* | Kinetic energy becomes height on the curve |
| Rope Swing | *"Fall to rise: the rope gives back every bit of height you give it."* | Energy is conserved through the swing |
| Rope Swing | *"Let go too early and you fall short; too late and you fall back."* | Release timing sets the launch direction |
| Rope Swing | *"A longer rope is slower, but carries you further."* | A pendulum's period grows with its length |
| Trampoline | *"The harder you land, the higher it throws you."* | A spring returns the energy stored in it |
| Landing | *"Soft knees, safe landing: the same stop, spread over more time."* | Impulse: a longer stop means a smaller force |
| Braking and sprint | *"Your feet can only stop you as fast as they can grip."* | Friction limits deceleration |
| Rolling Log | *"Stay still and it spins you off; move with it and it carries you."* | Rotation and reaction force |
| Hang obstacles | *"Swing your legs to move your hands."* | Moving the centre of mass and transferring momentum |
| Lache pair (bars) | *"Push with the swing and it grows; push against it and it fades."* | A pendulum gains energy when the push is in step with its motion, and loses it when out of step |
| Vault | *"A jump buys height with speed; a vault keeps the speed but needs a hand on the obstacle."* | A jump loses speed at take-off; a vault moves on with a hand as the pivot |
| Coaster | *"A coaster has no engine: it climbs no higher than where it started."* | Energy is conserved: height is stored speed |
| Elastic band | *"A soft band pulled far outthrows a stiff one pulled little."* | The legs can only pull so hard, so a softer band stretches farther and stores more energy, which it gives back as speed |
| Coaster | *"Over a sharp hilltop, speed lets go of the rails."* | A crest that bends away faster than gravity can follow lets the cart leave the track |
| Elastic band | *"A soft band pulled far outthrows a stiff one pulled little."* | The legs can only pull so hard, so a softer band stretches farther and stores more energy, which it gives back as speed |
| The roll | *"Turn your fall into a roll and the ground forgives you."* | Downward speed turned into rotation |
| The trebuchet | *"A long arm gets you far; letting go late gets you thrown into the ground."* | The moment (weight times distance from the pivot) turns the arm, a longer arm moves its tip faster, and the release moment decides the flight |
| Plank bridge | *"A plank that is twice as long sags eight times as much."* | A longer plank bends far more, and a thicker one bends far less; a post in the middle makes two short planks |
| Cup stacks | *"Speed climbs the cups, and speed carries you off the top."* | A step up needs speed, but the narrow flat top is crossed in a blink at that speed |
| Recoil | *"The heavy thing goes slow, the light thing fast, and both carry the same."* | Momentum is conserved: the ball carries a push away backward and the runner carries the same push forward |
| Climb | *"Speed gets you to the wall; arms get you over it."* | The run speed is gone at the wall: the arms pull the body up on their own strength, so a taller wall costs more time and effort than it costs speed |
| Cannon | *"Aim between high and flat: the middle angle flies farthest."* | The push is split by the angle into a forward part and an upward part; level ground is won at about 45 degrees, and a steep shot lands harder |

## Where they appear
- **A law the player earns:** shown only after the player has discovered that principle in the Dojo (for example, their rope predictions get close); collected sayings fill the trophy cabinet.
- **After a fall on the Course:** one line beside the replay, never a lesson.
- **On course select:** one saying under each obstacle, as its personality.
- **In the demo video and posts:** short and quotable.

## Adding one
- Name the obstacle and the single tension it teaches.
- Check that the simulator's physics produces it (a law test or a measured run).
- Keep the wording plain enough for a 13-year-old.
