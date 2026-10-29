# CC-157: every run can be downloaded

## What it means for the game
- Every try on a ready-made course can now become a clip, also a try that ended in a fall and also a try that began at a checkpoint.
- Before, only a run from the very start of a course that ended in a clear showed the buttons.
- More clips means more things to post, which is what the viral prize needs.

## The cause
- The ghost kept the keys of a run only when it began at the start of the course.
- After a fall, R starts again at the checkpoint, so that run kept no keys and the report had no share buttons.
- The fall panel never had a clip button at all.
- The editor course felt fine because its tries mostly began at the start.

## The fix
- `src/ui/ghost.ts`: every try keeps its keys and where it began; `myClip()` returns them; `myRun()` (for the link) still needs a start from the beginning.
- `src/modes/course.ts`: the clip is played again from the same starting place; the fall panel has "Make a clip of this try"; a cleared run from a checkpoint offers the clip without a link.
- `src/share/share-ui.ts`: the link buttons are left out when the run cannot be a link.
- A challenge link still needs a full run from the start, because the friend replays it from the start.

## Tests (VM2, `scripts/download-every-run-check.mjs`)
- Each course: play until the try ends, see the clip button; press R (a checkpoint start), play again, see it again.
- Training also made the clip and saved a 2.3 MB mp4 (`training-fall.mp4` is not committed: it is big; the size check is in the log).
- Courses: the default course, training, band, cannon, drop, launch, recoil, coaster, plank and drone (nine checked in both rounds, drone in the first only).
- 30 checks passed, none failed (`results.txt`).
- Pictures: `training-fall.png`, `cannon-fall.png`.

## Not tested
- A clear that began at a checkpoint, in the browser: it shares the code path of the fall, but no script plays a clean mid-course clear.
- Courses where holding right only stops at a wall (lache, climb) never ended a try in the script, so they were not checked there.
- Tries that used the cannon aim or other non-key input cannot be replayed, so they have no clip.
