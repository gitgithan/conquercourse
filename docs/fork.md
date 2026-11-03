# The fork with one gate: bench lane or bulb lane (CC-133)

Serves the demo beat for demo photo 1 (a dance floor with two benches and a pole with a string of bulbs): one picture, two ways through it.

## So what
- **Yes: the existing branch model carries the fork.
  - No new lane physics is needed.**
  - A fork is two sets of floor, bars and poles that belong to one lane each, over the same x range, joining again at the end.
  - The bench lane is floor pieces with benches on them; the bulb lane is the pole and a row of bars flying over a gap.
  - The lane is told apart by the lowest height between the fork and the join, as in `docs/multi-path.md`.
- **Cost: small.**
  - One new move (the pole climb, `src/sim/pole-climb.ts`), one new mode in the world loop, one builder and prover (`src/sim/fork.ts`).
  - Old courses and their golden hashes do not change: a course with no `climbPoles` never reaches the new code.
- **Both lanes are proved by the ideal-run search and replay exactly.**
  - Bench lane: 5.84 s, narrowest room 43 ms, about 2 jumps of effort.
  - Bulb lane: 11.72 s, narrowest room 325 ms, about 1.7 jumps of effort.
  - A server replay of the keys clears either lane in exactly the stored time, and reads which lane was taken.
- **The choice is real and the pay-back is clear.**
  - The bench lane is quick and tight.
  - The bulb lane is long and forgiving (nearly eight times the room).
  - This is the opposite of the old "two ways" finding, where the bars were slower than the ground and the gap stayed small; here the gap is the point.
- **Recommendation:** ship the fork behind `?fork=1`, use `public/assets/demo/fork-bench-bulb.course.json` for the demo film, and replace the three placeholder shapes with real lifts.
- **Next step:** the bar row becomes `src/sim/bars.ts` (hand over hand) when that lands; the pole's top hand-over already points at "the first bar of the row" by index, so only that index is touched.
- No fallback ("two short courses") was needed.
- It stays the plan if the bars agent changes the hang interface in a way that breaks the hand-over; the cost then is two courses and a menu, no physics.

## How the gate works
- One gate: the pole stands on the shared run-up, 0.3 m before the fork line.
- Run on without E: the pole does nothing, the runner reaches the first bench.
  - That is the bench lane.
- Hold E within 0.6 m of the pole: the hands close and the body climbs.
  - That is the bulb lane.
- Let go of E on the pole and the body slides down to the run-up, so the choice can be made again.
- No higher jump: the bars hang 4.3 m up, above the hands' reach from a jump off the ground or off a bench (test: no jump from any x on the bench lane grabs a bar).
- If you fall off the bars you splash: under the bars there is no floor in the bulb lane (the bench floor belongs to the other lane, and is not under the bars' span in the proof).

## Does the ideal run and the proof still work?
- `routeCourse` closes the other lane (removes its floor pieces, bars and poles), so the usual search proves each lane alone.
- The bench lane uses the unchanged search (`searchIdealRun`).
- The bulb lane uses `searchBulbLane` in `src/sim/fork.ts`: hold E at the pole, then choose how long to hang on each bar.
- The unchanged search is tied to take-off edges and cannot start a plan with a pole.
- Each line is then replayed on the whole course and the lane is read from the track (`routeOfTrack`).
- Proof of clear on the server needs nothing new: the log is only keys, the simulator is deterministic, and the pole mode uses no state that is not made from keys.

## The pole climb
- Hold E next to a pole: the hands close and the feet rise at a fixed 1 m/s.
  - The key sets the direction, never the speed.
- Reach spent as height: each metre climbed spends 0.045 of the energy store; an empty store stops the climb and the hands still hold.
- Let go of E: a slide with the hands brushing the pole, speeding up at 4 m/s squared to at most 3 m/s.
  - It cannot hurt.
- E again while sliding takes the pole up again.
- At the top with E held, the hands pass to the first bar (the bar row); the hands ease the last bit sideways, so nothing jumps.
- `E` is the only key.
- It is the same press-and-hold as the rope and the wall.

## Files
- `src/sim/pole-climb.ts`: the climb as pure functions.
- `src/sim/fork.ts`: the course builder, the bulb-lane search, `proveFork`.
- `scripts/demo-fork-course.mjs`: builds the demo course from lifted-object GLB paths (`bench=…glb pole=…glb bulbs=…glb`), proves both lanes, records `data/eval/fork/run.json`.
- Shared files touched (small): `src/sim/world.ts` (one mode, one entry block, one step function), `src/sim/ideal.ts` (3 lines: hold E while climbing the pole), `src/sim/branches.ts` (poles in `own`), `src/course/{course,schema,modes}.ts`, `src/motion/actor-state.ts` (a pole climber uses the hanging pose for now), `src/ui/paths.ts` (`fork=1` turns on the same fork display as `paths=1`).

## Honest limits
- The editor cannot draw two lanes yet; the fork course is built by script.
  - The strip, the drums and the end report already show a fork (`CC-225`).
- The pole climber is drawn with the bar-hanging pose; a climbing pose needs its own clip.
- Bars are the existing swinging bars.
  - When hand-over-hand bars arrive the bulb lane's time and window must be proved again with `node scripts/demo-fork-course.mjs`.
- The three objects are placeholder shapes (boxes) until real lifts replace them.
