# Timed balls

## So what
- The First Course now has launchers that fire balls across the map on a fixed beat.
- The beat is the simulator's tick, so it is the same for every player and every replay.
- A player cannot run too fast or too slow: either one meets the next ball.
- The ideal run still clears the course, with at least 2 m between a ball and the body.

## How it works
- A launcher has a place, a muzzle speed, a gap in seconds (`every`) and a first shot (`phase`).
- Shot k leaves at `phase + k * every` seconds.
- The ball's place at tick t is a formula (a straight line bent down by gravity), so nothing is stored.
- A ball touches the runner when it is closer to the body (a line from the knees to the head) than its radius plus the body's radius.
- A hit ends the try (outcome `hurt`, event `ball-hit`).
- The end report says "A ball hit you at the <obstacle>" and why waiting for a gap works.
- A course without `shots` plays exactly as before.

## Tests
- `tests/shots.test.ts`: the same ball at the same tick, shot k is shot 0 delayed, no hidden state, a ball ends after its life, a hit on the body and a miss above and below, replay gives the same end, an empty list changes nothing, shots change the course hash.
- `scripts/shots-check.mjs`: standing still at the start, the first ball ends the try (desktop 1280).

## How the beat was chosen
- `scripts/place-shots.ts` plays the ideal run without balls, then picks each launcher's `phase` so that run has the most room between two balls.
- The ideal-run search then runs again on the course with balls and clears it.

## Known gaps
- A ball does not stop at the ground; it flies on.
- A player cannot duck under a ball yet (the body is one height).
- The balls are off by default; `?balls=1` plays the First Course with them.
- Why off: no beat was found that clears the ideal run and also every checkpoint start (CC-240 sweep, 3 launchers, every 6 to 12 s).
- Next steps, ranked: wait for the reach and rope changes to land, then sweep again; try a slower ball at the third launcher; give each checkpoint its own wait.
