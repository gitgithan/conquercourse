# Course design: fewer courses, each teaching one thing (CC-97)

*Product owner, 2026-10-29: "I don't want to flood the courses with so many items. Moves are great because they teach moves. Think what courses are already explained by other courses and remove them. Design so we teach efficiency. The stock course should demo all movements."*

## The rules
- A course earns a place in the menu only if it teaches something no other listed course teaches.
- A course that only repeats a move another course already shows is removed from the menu.
- Its file stays while a test or a script uses it; a file nothing uses is deleted with its plan and picture.
- Old links keep working: `?course=<removed path>` opens the course that took its place.
- Every course ends with a report that says, as facts, how the run compares with the best line the simulator found.

## How efficiency is measured
- Time: the seconds from the start to the finish line.
- Effort: the energy the moves spent, said in jumps' worth (one jump is the unit; a vault is under half a jump, a climb is two jumps).
- The best line is the stored plan, played again by the simulator (the same ideal run as Shift+I).
- The biggest change comes from the shortcut search (CC-71): a route the designer did not mark, with the seconds it saves.
- It is a fact, never a grade: there is no score, and the report never says a run was good or bad.

## The audit
| Course | What it teaches | Also taught by | Decision |
|---|---|---|---|
| Training course (new) | Every move in one chain: gap jump, vault, lache pair, rope, climb, trampoline, drop and roll; the second bar can be skipped with a full pump | none | Keep; first in the menu |
| Stock course (`/` with no course) | A gap, a warped wall, a rope and a trampoline | Training course | Remove from the menu; it stays what a bare `/` opens (the Dojo, the first-visit tour and 77 browser checks use it) |
| Lache demo | Vault, then swing two bars | Training course | Remove from the menu |
| Wide lache | A longer swing between far bars | Training course | Remove from the menu |
| Climb | Pull up a 2 m wall, then a big drop | Training course | Remove from the menu |
| Big drop | Run off a ledge and roll | Training course (the drop) and Climb | Remove from the menu |
| Montmartre | A real hill: steep roofs need the climb | none | Keep |
| Barcelona block | Flat city roofs | Edinburgh Old Town, when its course lands | Remove from the menu then; keep until then |
| Sydney quay | Wide gaps on a waterfront | none | Keep |
| San Francisco hill | The steepest real hill | Montmartre, partly | Keep (the real hill is the point) |
| Park rail run | Vault and jump, repeated, on real rails | Skate box and rail, Bench and stairs | Keep as the one real-objects course |
| Bench and stairs | Small steps up and down | Park rail run, Training course | Remove from the menu |
| Skate box and rail | A plaza line | Park rail run | Remove from the menu |
| Coaster: ride the hills | Energy: height turns into speed | none | Keep |
| Coaster: a sharp hilltop | Speed lets go of the rails; brake | none | Keep |
| Coaster: first hill too low | The cart cannot climb above where it started | Coaster: ride the hills (the same law) | Remove from the menu |
| Launch (trebuchet) | Let go at the right moment | Launch and catch | Remove from the menu |
| Launch and catch | Throw, then catch a bar in the air | none | Keep; listed as Trebuchet |
| Launch and catch: hard | The same, with a window under a quarter of a second | Launch and catch | Remove from the menu |
| Band | Stretch, turn round, be thrown | none | Keep |
| Drone ferry | Thrust against weight | none | Keep |
| Recoil | The light thing goes fast, the heavy thing slow | Cannon (the same push, aimed) | Remove from the menu |
| Cannon | Aim: the middle angle flies farthest; roll out of the landing | none | Keep |
| Stack demo | Cup pyramids as obstacles | none | Keep |
| Plank bridge: sags but holds | A plank bends and holds | none | Keep |
| Plank bridge: too thin | A thinner plank breaks | Plank bridge (the same idea) | Remove from the menu |
| Make me a new course | A random course the simulator proved | none | Keep |
| Build your own (editor) | Place pieces; the simulator checks | none | Keep |
| Map: search a place | Cut a course from real streets | none | Keep (labs) |
| Build your own coaster | Drag the track | none | Keep |

## What the menu holds after this change
- Start here: Training course.
- Real places: Montmartre, Barcelona block (until Edinburgh Old Town lands), Sydney quay, San Francisco hill.
- Real objects: Park rail run.
- Contraptions: Coaster (two courses), Trebuchet, Band, Drone ferry, Cannon, Stack demo, Plank bridge.
- Make your own: four entries.
- Total: 14 courses and 4 ways to make your own, down from 24 and 4 (and the stock course, which was listed apart).

## Old links
- No course file was deleted: every removed course is still used by a test or a script.
- So `?course=/assets/demo/lache.course.json` and the other old links still open that course, as before.
- Only the menu and the gallery changed; the pictures of the removed courses were deleted.

## How the Training course teaches efficiency
- The lache pair gap is wider than a jump, so the bars are needed.
- The second bar can be skipped: pump the first bar for about 1.8 s, let go, and fly past; it saves about a second.
- The vault is cheaper than a jump: under half the effort.
- The climb costs two jumps of effort and the run speed, so it is the slow beat.
- The trampoline only clears the high deck with a bounce.
- Each of these shows in the report as time and effort next to the best line, and the biggest change is named.

## Not done yet
- A merged Coaster with two sections, a merged Plank bridge with a thick and a thin plank, and a merged Park run built from the three park files are not built; the menu keeps the best of each instead.
- A bare `/` still opens the old stock course; moving it to the Training course means moving the checks and the first-visit tour that use it first.
- Edinburgh Old Town is not a course yet; Barcelona stays until it is.
- The contraption courses only compare with the best line when a plan is stored for them; the coaster courses have none.
