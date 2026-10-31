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

## Fire meter (CC-240)
- Each launcher is drawn as a cannon with a charge bar above the barrel.
- A bright plunger travels from the tail to the muzzle over the gap, and the ball leaves when it arrives.
- The bar turns red in the last tenth, so a player sees the ball coming.
- The fill is `charge(shot, tick)`, derived from the tick, so it is the same for every replay.
- The first charge starts at tick 0.
- There is no sound cue: the game has no audio hook yet.
- Picture at 1280 px: `docs/evidence/cc-240-fire-meter-1280.webp` (made by `scripts/cannon-check.mjs`).

## Beat (owner, 2026-10-31: 20 s or less)
- Every launcher fires every 12 s, the shortest gap tried (12, 14, 16, 18, 20).
- `scripts/tune-fire-balls.ts` sweeps the gaps and the first shot of each launcher group on the Cannonballs course and on the First Course (`?balls=1`).
- Result on VM3: the 12 s beat clears the ideal run and every checkpoint start on both courses, so no fallback gap was needed.
- First shots: launcher at x 24 at 2 s, the pair at x 52 at 5 s, the high launcher at x 76 at 4 s.
- `searchGen` now plays its plain trial moves without the balls (`Job.noShots`), so the moves are found as if no ball were there and then the start delay is chosen.
- Without that, a checkpoint at x 19 failed in the test.

## Slide (CC-240)
- Tap Down or S while running to slide low under a head-high ball.
- Research (web, 2026-10-31): indie platformers give slides a short cooldown so they cannot be chained, and a lower hitbox; friction slowing the slide is the usual way to make it feel real.
- The slide here is plain physics in `src/sim/slide.ts`: a floor friction slows the body, it never speeds it up, and it ends at an edge, a wall, 0.9 s or when it has worn down.
- There is no slide in the air, no slide when slow, a 0.5 s cooldown, and a jump ends it.
- The body is 0.6 m high at most while sliding.
- Balls fly at two heights, so the slide and the jump both matter: a low ball is jumped, a head-high ball is slid under.
- The slide pose is the existing tuck pose; no new captured clip was added.

## Climbable wall (CC-240)
- A 2 m wall stands at x 40 on the Cannonballs course (a platform block under the 2.2 m stand-climb reach).
- Balls die at the wall face.
- At x 52 a low ball and a head-high ball leave together: neither a jump nor a slide gets past both.
- The only safe plan is to climb the wall and wait for the volley to pass.
- The ideal run uses one start delay, so it clears without waiting on the wall.

## Known gaps
- A ball does not stop at the ground; it flies on.
- The balls are off by default; `?balls=1` plays the First Course with them.
- The slide has no captured clip of its own.
- The ideal run never waits mid-run; only a player can wait on the wall.

## Cannonballs card (CC-240)
- The Courses gallery has a "Cannonballs" card under Start here.
- It is the First Course with the three launchers, built by `scripts/make-balls-course.ts`, with a stored plan that clears.
- The "Two ways" course has a card there too.
