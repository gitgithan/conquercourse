# CC-186: today's merged changes, checked in the real game page

## So what
- The merged work holds up in the real page: the Training course clears on its stored line, the new report, share links, editor and music all work.
- One real defect, fixed here (CC-190): a first-time friend opening a challenge link saw the "Choose Your World" chooser over the challenge banner.
- One defect left open (CC-191): the onboarding card and the controls card sit on top of the run report, a hint bleeds through the panel, "Edit this course" shows twice.
- Next step: fix CC-191, then re-check the report picture by eye.

## Pass or fail
- Where: Vultr VM2, vite dev server, Chromium on software GL, 1280 x 720, stepped clock. No new films.
- Everything is also in `run.json`.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Training: stored ideal line clears start to finish | PASS | `training-finish.png`, `training-modes.log` |
| 1 | Strip shows 10 obstacles, all done at the end | PASS | `training-start.png` |
| 1 | Drum lane shows Space, V, E, X (and Release, Let go, Press) | PASS | `training-start.png` |
| 1 | Warped wall shows "Hold E to grab" | PASS | `training-hold-e-tip.png` |
| 1 | Lache grab: hands on the bar from the first frame (1/60 s steps) | PASS | `lache-grab-montage.png` |
| 1 | Missed wall: no fail toast, no panel (the runner keeps sliding back and can try again) | PASS | `missed-wall-or-fall.png`; my test expected an end state and was wrong |
| 2 | Ghost and runner both visible by default, N cycles Ideal run / Off | PASS | `ghost-run-ahead-1.png`; at exact overlap the two figures coincide, so only one shows |
| 3 | Fall report: gold "Hardest for you", legend, You and Ghost lines in two colours | PASS | `fall-panel.png` |
| 3 | Finished report: You and Ghost in two colours | PASS | `finished-report.png` |
| 4 | Fall panel "Copy link to this try", no "Share..." | PASS | `fall-panel.png` |
| 4 | Finished "Copy link to challenge a friend", no "Share..." | PASS | `finished-report.png` |
| 4 | Fall link in a fresh page: banner, "Friend's run" ghost, no chooser | PASS after fix (FAIL before) | `fall-link-fresh-page.png`, CC-190 |
| 4 | Finished link in a fresh page | PASS for ghost "Friend's run" and no chooser; banner not seen | `finished-link-fresh-page.png`; the banner removes itself after 14 s of wall time and the slow VM load outlived it |
| 5 | Editor: Fix menu, glossary, Fit, wheel zoom and pan move the camera (16 checks) | PASS | `scripts/editor-ux-check.mjs` output, run on the VM |
| 5 | Slice panel on a Ready place: slices, legend, "More" folded | PASS | `slicer-2-sliced.png` |
| 5 | Slice panel reason and fix buttons on a failing height | NOT TESTED | every height on the pinned place was crossable |
| 6 | Course screen loads `course.ogg` (200), loops, the audio clock passes the loop length with 0 ended events | PASS | `music-course.png`, `run.json` |

## Other findings
- Two `/api/course-event` 404s on every page load: the dev server has no API, so this is only in dev (not a defect).
- Music "console errors" were only WebGL and WebGPU warnings from software GL.
- CC-191: onboarding and controls cards cover the report; a hint shows through the panel; "Edit this course" twice.

## Could not verify
- Real sound (automated browsers stay silent); only the loop settings and the audio clock.
- Slice fix buttons (no failing height found).
- The finished-link banner (timing, see above).
- Speed: software GL is about 100 times slower than a laptop; the stepped clock keeps the physics honest.
