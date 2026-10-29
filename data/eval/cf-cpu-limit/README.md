# Cloudflare Pages Functions CPU limit for replaying a run (CC-169)

## So what for the game
- A real clear is nowhere near the limit, so counting cleared runs by replaying them on the server works today, on the free plan.
- The longest real clears we have (27 s, about 3 300 ticks) were never cut, in 11 calls.
- A clear padded with idle ticks to the 2 minute cap (14 400 ticks) was never cut, in 6 calls.
- Cloudflare cut a request only when one call did 30 or more plays' worth of work (103 000 ticks and up), and always from 620 000 ticks.
- The cut is fuzzy: the same request passes in one try and fails in the next.
- The server cannot be made to do that much work with a legal log, because `MAX_CLEAR_TICKS` stops the replay at 14 400 ticks and the body is capped at 8 000 characters.
- Recommendation: keep the server replay for every clear (CC-149 as built); option 1 (count from the browser, replay only for record times) is not needed for CPU reasons, and the paid plan is not needed.
- Next step: none required; keep the two caps, and keep any future request that replays several runs under about 50 000 ticks in total.

## What was measured
- A test function replays a log with `verifyLog` like `/api/course-clear`, with no D1 access (copy in `cpu-test.function.ts.txt`; it was never merged).
- It was deployed only to preview branch `cf-limit-test` (`4bd686f1.conquercourse.pages.dev` and `422f24e4.conquercourse.pages.dev`); both deployments are deleted.
- Production `conquercourse.pages.dev`: the index and `/api/course-stats` gave the same bytes before and after (md5 `276ac56d...`).
- Note that `/api/course-stats` on production answers with the index page, so that function is not deployed there yet.
- Logs: each course's stored plan played once and encoded (`inputs/logs.json`); the longest are `demo/generated-1` (3 284 ticks, 27.4 s) and `demo/training` (3 233 ticks, 26.9 s).
- Callers: `run-remote.mjs` (the ordered tests), `probe.mjs` (more work), `spaced.mjs` (heavy calls 25 s apart, each followed by a normal clear).

| Case | Ticks in one request | Result (200 / cut) |
|---|---|---|
| 4 short courses (4.7 to 6.8 s) | 363 to 560 | 12 / 0 |
| Longest real clears | 3 233 and 3 284 | 11 / 0 |
| Idle ticks first, 40 s total | 4 800 | 3 / 0 |
| Idle ticks first, 80 s total | 9 600 | 3 / 0 |
| Idle ticks first, 120 s total (the cap) | 14 400 | 6 / 0 |
| 8 plays of the real clear in one request | 25 864 | 11 / 0 |
| 16 plays | 51 728 | 11 / 0 |
| 24 plays | 77 592 | 5 / 0 |
| 32 plays | 103 456 | 14 / 3 |
| 48 plays | 155 184 | 3 / 2 |
| 64 plays | 206 912 | 10 / 7 |
| 96 plays | 310 368 | 1 / 4 |
| 128 plays | 413 824 | 4 / 7 |
| 192 plays | 620 736 | 0 / 5 |
| 256 plays | 827 648 | 1 / 10 |
| 512 and 1024 plays | 1.7 M and 3.3 M | 0 / 11 |

- The 10 s and 20 s idle cases were shorter than the real clear, so they ran as the plain clear.
- "Idle first" means the runner stands still at the start for the extra ticks, then plays the real clear.
- Idle ticks are cheaper than running ticks: 14 400 padded ticks cost about 19 ms on the laptop, against 7.6 ms for the 3 233 running ticks of the clear.
- Plays were stacked by replaying the real clear again and again in one request, so the work is real simulation.
- The cut follows work done, not the length of the log: a legal log can never reach the work of the cut requests.

## The error
- Status 503, content type `text/html`, header `server: cloudflare`.
- Page title: "Worker exceeded resource limits | ...conquercourse.pages.dev | Cloudflare".
- Body: "Error 1102 ... Worker exceeded resource limits ... An unknown error occurred while rendering the page."
- Many cut answers came back in 35 to 60 ms, much sooner than the work would take, so a Worker already marked as over the limit seems to refuse the next heavy request at once.
- In `spaced.mjs` a normal clear sent right after a cut request always got 200.

## Does it look like 10 ms CPU?
- No.
- The 27 s clear costs about 7.6 ms on the laptop and the padded 120 s run about 19 ms; neither was ever cut, and 19 ms is already above 10 ms.
- The first cut came at 103 000 ticks, which is about 240 ms of laptop CPU; the cuts were routine from 200 000 ticks (about 480 ms).
- So the limit we hit is hundreds of milliseconds of CPU, or Cloudflare enforces the 10 ms loosely; the documented free limit is 10 ms.

## Cloudflare against laptop
- The clock inside a Worker only moves after I/O, so the `wallMs` in the raw results (2 to 17 ms) is not usable as CPU time.
- Round trip: 64 plays took about 290 ms more than a normal call on Cloudflare, and the laptop needs about 480 ms for them (2.3 µs a tick), so Cloudflare ran at about 0.6 to 1 times the laptop's time.
- The spec's 3.4 µs a tick was not reproduced here: this machine gave 2.0 to 2.3 µs a tick for running ticks.
- Take the ratio as "about the same speed as the laptop"; it is a rough number.

## Not verified
- Whether 1102 here means CPU or memory (the replay makes many short-lived objects); the tests cannot tell them apart.
- The exact threshold, which is fuzzy between 100 000 and 600 000 ticks.
- Behaviour under many players at once, or after Cloudflare changes its limits.
- `demo/cannon` does not clear from its recorded keys (the plan uses a bot-only input), so it was used only as a short timing.

## Files
- `inputs/logs.json`: encoded logs of every course that has a plan.
- `make-logs.ts` and `local-timing.ts`: the log builder and the laptop timing.
- `outputs/`: raw results; the `-deploy1` files come from the first deployment, whose clock showed 0 ms.
- `run.json`: the summary.
