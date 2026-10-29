# CC-141: the share clip moves smoothly

## So what
- The clip no longer pulses: the runner stays in the picture and the motion has no stops in the run.
- The cause was in how the clip's pictures were drawn, not in the game's physics or the video encoder.
- The real test is still a clip made in the owner's own browser with a real graphics card.

## The cause
- The clip draws one picture for every 4 game ticks, on a stepped clock.
- Those pictures were drawn outside a real animation frame.
- The renderer refreshes some camera values only once per real frame, so the runner was drawn with a stale camera.
- The runner slid out of the picture about every 8 pictures, then snapped back; neighbouring pictures were nearly identical in between.
- The fix: each picture is drawn inside `requestAnimationFrame`.

## Ruled out (each measured)
- The clock: exactly 4 ticks a picture; runner and camera move evenly.
- The encoder: packet times are even; 3 and 5 Mbps look the same.
- The graphics backend: WebGPU and WebGL2 show the same pulsing.
- The runner's animation: the body is within 0.1 m of the simulated runner in every picture.
- Keyframes: the stops do not line up with them.

## Before and after (lache, 326 pictures, software graphics)
- The last 45 pictures are a still end card, so they repeat on purpose.
- Before (stale camera): 9 repeated pictures in the run, mean motion 7.05, stops to 0.00 about every 8 pictures.
- After: 1 repeated picture in the run, mean motion 4.50, no stops to zero apart from that one.
- Old sample from CC-129 (wide camera): 325 unique pictures, mean motion 1.11; it looked laggy because the runner was tiny.
- Other courses after the fix: climb has 4 repeated pictures in the run, drop has 2.
- Motion is the mean absolute pixel change between neighbouring pictures in the middle band (`motion.py`).

## Pictures
- `before-strip.png`: six pictures in a row; the runner slides out and snaps back.
- `after-strip.png`: the same six pictures after the fix.

## Still open
- A few exact repeat pictures appear at random places on software graphics; the capture timing may be the cause.
- Only software graphics was tested.
