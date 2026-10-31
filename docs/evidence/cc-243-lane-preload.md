# CC-243: the lane check and the Course no longer freeze the page

## So what
- The ready-made editor courses are checked once, ahead of time, and the answer ships with the game.
- The editor shows the verdict and the Course starts with the stored ideal run, so nothing is searched on the page.
- The Course after a visit to the Dojo no longer searches on the page's thread either.

## What was wrong (measured on a VM, in Node)
- The default editor course (hang bar and Lache) takes about 2 minutes for one core to search (122 s, then 351 s on a busy VM).
- The editor's lane check searched it in a worker, then threw the plan away.
- "Play this lane" built a slightly different course (it adds `source`), missed the check's cache and searched a second time.
- The Course then searched a third time on the page's thread, because the hand-off carried no plan.
- Coming back from the Dojo hit the same page-thread search (the saved course had no plan).

## What changed
- `npm run plans:presets` (`scripts/preset-plans.ts`) searches each ready-made course with the worker pool and stores the plan, the windows, the routes and the shortcuts in `src/slice/preset-plans.json`, keyed by a hash of the pieces.
- `tests/preset-plans.test.ts` fails when a stored plan is stale (the key no longer matches) and when a stored plan does not replay to a clear.
- The editor looks the course up by that key first, so the verdict is instant, and hands the stored plan to the Course.
- An edited course is searched in a worker (as before), and the plan it finds now goes along to the Course too.
- The Course no longer searches on the page's thread: a course with a plan shows its drums at once, any other is searched in the worker pool.

## Timings (software-GPU VM, 1280 px, `scripts/lane-timing.mjs`)
- "Verdict" is from the editor opening to the sentence on the screen; it includes the 800 ms typing pause and loading the 3D objects, not a search.
- "Course ready" is from "Play this lane" to the first running tick.
- "Longest block" is the longest browser long task in the first 4 s of the Course.

| Ready-made course | Proof | Verdict | Course ready | Longest block |
|---|---|---|---|---|
| Hang bar and Lache | stored | 2.3 s | 1.3 s | 0.58 s |
| Park run | stored | 1.6 s | 1.0 s | 0.43 s |
| Coaster to a bar | stored | 0.7 s | 1.1 s | 0.58 s |
| Broken park (cannot clear) | stored | 1.1 s | n/a | n/a |

- Before: the first course took about 2 minutes of search in the editor, then froze the Course for as long again.
- Course after the Dojo: 12.4 s to ready with a 10.5 s block before; 3.1 s and 0.48 s now (CPU profile showed `searchIdealRun` on the page's thread).
- Picture: `docs/evidence/cc-243-lane-swing-course.png`.

## Not tested
- A real GPU (the VM draws in software).
- An edited course with a long search (it runs in a worker and can still take minutes; the page stays usable, but there is no cancel button yet).
- The 800 ms typing pause is still in front of the verdict; skipping it for stored proofs would bring the verdict under 1 s everywhere.

## Progress line and Cancel (lane check)
- While an edited lane is searched, the panel shows "Searching for a way through: step N of M, S seconds so far", a bar, Cancel and Play anyway.
- Cancel ends the worker at once; the lane is marked "not checked" and nothing restarts by itself.
- Every edit drops the old verdict; the next search starts after the edit pause.
- The search is stopped after 3 minutes with "Timed out".
- Pictures: `cc-243-lane-searching.png`, `cc-243-lane-stopped.png`.
- Check: `scripts/lane-cancel-check.mjs`; unit tests: `tests/lane-check.test.ts`.
