# Graph Studio: drag the graph, see the verdict (CC-86)

- **So what:** the coaster builder is the most fun way to edit we have, so the same pattern now reaches the ground of any course, inside the Course, with no trip to the world editor.
- **Try it:** open any course, press Tab (or the "Edit the ground" chip that shows after a first fall, or `?edit=1`), drag a deck or a bar, watch the verdict, press "Play from here".
- **Plain words:** a graph you can drag, with a verdict that uses the Course's own physics.

## What makes the coaster builder work
- **One picture, handles on it:** the track is a line with dots; there is nothing to learn before you drag.
- **The verdict moves with the drag:** the cart is run on the same simulator the Course uses, so "it leaves the rails at 22 m" is a fact, not a guess.
- **Direct manipulation, small vocabulary:** drag moves, double-click adds, double-click on a dot takes it out.
- **Snapping and clamps:** a drag can never make something the simulator cannot read.
- **Instant play:** "Play it" is one click away, so edit and try become one loop.
- **A fix nearby:** "Fix it" is a button on the same page, not a different mode.

## The pattern
- **A graph:** a picture of one quantity against another (height against distance, speed against distance), drawn from the course data.
- **Handles:** the few numbers a person would change, each on the part of the graph it belongs to.
- **A live verdict:** the simulator's answer for the edited course, shown under the picture in plain words, with "working..." while it thinks and a new drag cancelling the old search.
- **Edits are changes to the course data:** a pure function `(course, handle, x, y) -> course`, clamped, never in place, with plain words for each change (the same sentences as the CC-63 preview).
- **Play from here:** the edited course carries on from the same checkpoint.
- **Never:** grading a person's technique; formulas on screen (a Dojo lesson may end with one).

## The candidates
| | The graph | The handles | The live verdict | Cost | Value for the demo |
|---|---|---|---|---|---|
| (a) The ground | Height of every deck against distance | Deck height, deck edges, bars | Does the ideal run still clear it, how long, the hardest gap | Built | High: every course can be reshaped in place |
| (b) The jump arc | The flight path of a jump | The apex and the landing spot | The speed and the press needed, from the jump physics | Low: the flight predictor exists | High: teaches the parabola and why speed matters |
| (c) The swing | Bars and the range a release reaches | Bar position and height, pump time | Which bars a release reaches, a skip or bar to bar | Medium: the release predictor exists | High: the skip-the-second-bar discovery |
| (d) The band | Pull against stretch | Stiffness, stretch | Launch speed and where it lands | Medium | Medium |
| (e) The trebuchet | Arm angle against release time | Release angle, counterweight | Where the throw lands | Medium | Medium |
| (f) The ideal run's speed | Speed against distance | A target speed at a point | What the run can reach | High: the search is not a model of speed targets | Low |
| (g) The plank bridge | Sag along the span | Span, thickness, support | Holds, sags or breaks | Low once the beam exists | Medium |
| (h) The cut height | Contours at a height | The cut height | The lane at that cut | In progress (the Slicer, CC-72) | High |

- **The best three, by value for the demo and cost:**
  - **(a) the ground:** built here, because every course gains from it.
  - **(b) the jump arc:** cheap, and it makes the key idea "speed carries you" something you can drag.
  - **(c) the swing range:** it turns the skip-the-second-bar finding into something a person can find by dragging.
- **Already moving elsewhere:** (h) is the Slicer; (d), (e) and (g) belong to their own builder pages once those pieces are settled.

## What is built (a): pause and drag the ground
- **Open:** Tab, or the "Edit the ground (Tab)" chip (after a first fall, or with `?edit=1`). The clock stops and the game hears no keys while it is open.
- **The picture:** the ground line of the course around the runner, decks as blocks, bars as short bars, water below, the start of the try as a green line.
- **Handles:**
  - A square on top of a deck: drag up or down to change its height (snaps to 0.1 m).
  - A circle on a deck's edge: drag along the run to change the gap (snaps to 0.25 m; decks never overlap, never get thinner than 0.8 m, and keep the start and the finish on the ground).
  - A bar: drag in both directions (bars keep 1 m apart).
  - Double-click a deck: cut a 2 m gap into it. Double-click a deck's edge: close the gap on that side.
  - Fixed decks (curved, trampoline, the wall, the trebuchet, the launcher, the rope anchor) show "fixed" and have no handles; their shapes belong to their own move.
- **The ghost:** the old outline stays as a grey dashed line, the new one is teal, and a teal arrow shows how far a deck moved (the same look as the CC-63 preview ghosts).
- **The verdict:** the Course's ideal-run search runs in a worker, from the checkpoint; it says "clears in 17.5 s, 1.2 s faster than before" or "finds no way through: the ideal run gets as far as 18 m". A quick line under it names the hardest gap and the speed a jump needs at its edge.
- **Words:** "Deck 2: raise it 1.8 m (now 1.8 m high)", "Gap 1: wider, 4.0 m to 5.0 m", "Bar 1: 1 m closer to the start".
- **Play from here:** the edited course is saved (it is what the Dojo and the next visit see) and the Course reloads at the same checkpoint on the edited ground. The edit list is kept with it.
- **Undo my edits** puts the course back as it was when the studio opened.

## Fallbacks and gaps
- **Real objects:** an edited course draws its real objects as plain blocks, because the pictures were placed on the old ground. The studio says so.
- **Source in the course data:** when the two-way editor work (CC-80) lands, the edits belong in `course.source`; until then they are stored with the course and the edit list.
- **The verdict is the ideal run,** which can take seconds on long courses; a new drag cancels the old search, and a step budget comes with the search-speed work (CC-69).
- **Only decks and bars** so far. The jump arc and the swing range band are designed above and not built.
- **A coaster** has its own builder (`?mode=coaster`), so the studio leaves it alone.

## Files
- **Maths (pure, tested):** `src/slice/ground-graph.ts`, `tests/ground-graph.test.ts`.
- **The studio:** `src/modes/graph-studio.ts` (one hook in `src/modes/course.ts`).
- **Browser check:** `scripts/graph-check.mjs`.
