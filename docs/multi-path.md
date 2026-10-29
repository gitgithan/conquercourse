# Multiple paths: forks with two ways through a stretch

Serves the player who wants to choose how to get through a stretch (CC-223).
Built as a thin slice in CC-224 and CC-225.

## So what
- The idea works in the game as it is, with no change to the physics.
- A fork is two ways through the same stretch; the way you took is read from the run itself.
- Both ways of the slice course "Two ways" are cleared by the ideal-run search, each with its own best time.
- The slice shows a weak spot honestly: the high way saves only 0.27 s and is much harder to hit.
- A fork only feels like a choice if the hard way pays back; today it does not.
- Recommendation: keep the fork, put it behind `?paths=1`, and tune the pay-back before the product owner sees it as a feature.
- Next step: make the high way pay more (wider bar windows, or a slower low way), then re-run the numbers in `data/eval/two-ways/run.json`.

## The player story
- You reach a fork.
- You can see two ways: up on the bars and rope, or down on the floor with gaps and a climb.
- The quick way over looks short, and it throws you off if your timing is a little late.
- The safe way is longer and forgives you.
- You pick, you run, and the end report says which way you took and what the best line on each way would have been.
- Like Hercules in the training montage, you try the other way next time and learn what each one asks of you.

## What a branch is
- A branch is a fork with two or three routes between a fork line and a join line.
- Routes rejoin at the join line, or could end at different finishes later.
- In the course JSON a branch holds: an id, a name, `forkX`, `joinX` and a list of routes.
- A route holds: a name, a height band, the stones or bars that belong only to it (`own`), its icons, and its stored best line.
- The band is the lowest height a runner reaches between the fork and the join.
- A runner high in the air is on the high way; a runner on the low floor is on the low way.
- A runner who never gets past the join has no way: a fall is not a way.

## What exists today, and what is missing
- Today a course has one line of zones and one best plan.
- The shortcut search (CC-71) already finds a skip that saves seconds, for example "skip the second bar".
- It treats the skip as a faster version of the same course, not as a choice the player is offered.
- Missing before this work: a name for each way, a time for each way, a strip that shows both, and a report that says which was taken.

## Design options
- **A. Branches in the course JSON (built).**
  - A branch lists parallel routes between a fork and a join.
  - The old fields stay, so old courses and golden hashes keep working.
  - The simulator is not changed.
  - Limit: the ground is single-valued, so two floors cannot overlap in x; the high way flies over the low floor.
- **B. A graph of zones.**
  - Zones become nodes with edges, so routes can split and end apart.
  - More flexible, and a bigger change to the strip, the editor and the checks.
  - Choose it when a course needs three or more forks.
- **C. Free lanes (upper and lower ground).**
  - Every platform gets a lane, and the player can step between lanes.
  - The most natural for real places with a bridge over a path.
  - It needs a simulator change (ground becomes lane-aware), so it is the deepest option.

## Recommendation
- Ship option A now, behind `?paths=1`, for one or two forks per course.
- Move to B only when a course needs more than two forks or routes that never rejoin.
- Plan C with the world slicer: a real place with a bridge over a path is two lanes on the same place.

## How it works in the slice
- The course `two-ways` has a fork at x 20 and a join at x 38.
- The high way uses two bars; the best line skips the second bar.
- The low way drops to a low floor, jumps a gap and climbs a short wall.
- `routeCourse` makes a copy of the course with the other way's stones and bars removed.
- The ideal-run search runs on that copy, so each way gets its own proven line.
- The stored plan of the course is the faster way's plan, so old code keeps working.
- The way taken is read from a run's path or its key log, by the lowest height between the fork and the join.

## Effects on each part of the game
- **Ideal-run search.**
  - One ideal per route, plus a best-of ideal for the "beat the ideal" check.
  - The best-of ideal is the smaller of the route times.
- **Run checks and server replay.**
  - The log is only keys, and the simulator is deterministic, so any route replays.
  - The way taken is read after the replay, not sent by the client.
- **Obstacle strip and drum lane.**
  - The strip shows the fork cell with a row of icons for each way.
  - The drum lane shows each way's drums in its own row, with dashed Fork and Join lines.
  - Drums before the fork and after the join are shared.
- **End report.**
  - It names the way you took and lists the best line on each way: time, effort, room for error.
  - It states facts, and never ranks or grades the player.
  - Next: route ghosts, one ghost per way.
- **Leaderboards.**
  - Keep one board per route and one overall board.
  - The overall board uses the best-of ideal as the bar.
- **Editor.**
  - To author a fork, mark a fork line and a join line, then draw the stones for each way.
  - The editor would store each way's stones as `own` and let the tool run the search.
- **Dojo sayings.**
  - Add risk-versus-reward sayings, earned by discovery and with no formulas on screen.
  - Example: "The quick way over throws you off if you are late."
  - Example: "The safe way costs more jumps and forgives your timing."
- **World slicer and real places.**
  - Two lanes on the same place become two routes of one branch.
  - Example: a bridge over a path gives a high way and a low way.

## Physics-honest examples
- **High way (bars and rope).**
  - A 12 m gap needs bars: a plain jump reaches about 9.8 m.
  - The fast line skips the second bar and needs one precise release.
- **Low way (gap and climb).**
  - Drop to the lower floor, jump the gap, climb a wall between 1.0 and 2.45 m.
  - Forgiving, and it costs more jumps.
- Different ways ask for different kinds of timing, so their times and failure rates differ.

## Numbers from the slice
Ideal times come from the search; clear shares come from `scripts/ways-numbers.ts`, a human-timed bot with press noise (300 seeds per level).

| Way | Ideal time | Effort | Narrowest window |
| --- | --- | --- | --- |
| High, skip the second bar | 9.15 s | 1 jump | 8 ms |
| High, bar to bar | 10.81 s | 1 jump | |
| Low | 9.42 s | 4 jumps' worth | 219 ms |

| Press noise (sigma) | High skip clears | High bar to bar clears | Low clears |
| --- | --- | --- | --- |
| 15 ms | 59% | 57% | 100% |
| 30 ms | 27% | 29% | 100% |
| 60 ms | 13% | 18% | 94% |
| 100 ms | 5% | 10% | 71% |

- Time gap between the two ways: 0.27 s, with the high skip faster.
- A runner who must retry the high way takes far longer in expectation (15 s to 147 s) than one on the low way (9 s to 12 s).
- No clear was read as the wrong way.

## Findings
- The reward for the high way is too small: a human will pick the low way.
- The ground is single-valued, so the two ways cannot be stacked in x with their own floors.
- The low way can jump over the drop from the high deck, so the geometry has to be checked after any change.

## Ranked next steps
1. Widen the bar windows or move the bars, so the high way is hard but fair.
2. Make the low way longer, for example with a roll and a second climb, so it costs real seconds.
3. Add route ghosts to the end report and a board per route.
4. Add a fork tool to the editor.
5. Add the risk-versus-reward sayings to `docs/sayings.md` once the pay-back is tuned.
6. Decide on option C when the world slicer needs two lanes on one place.
