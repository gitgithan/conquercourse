# CC-159: restarting is easy to find

## So what
- A key-cap chip "R Restart" now sits next to the time during every run, bright on dark.
- You can press R or click the chip: both start again.
- On phones the touch button now says "Restart" (it said "Retry").
- Recommendation: keep it.
- Next step: move the top-right buttons so they stop covering the time line on phones.

## Checks (`scripts/restart-chip-check.mjs`, 12 pass, 0 fail)
- Chip visible during the run.
- R sends the timer back to about 0 (4.5 s to 0.5 s).
- Chip click does the same (2.3 s to 0.8 s).
- R and the chip at the same moment: one clean restart.
- The ghost chip still works after restarts.
- Phone Restart button restarts (6.6 s to 0.8 s).
- `?touch=0` hides the touch buttons.
- No page errors.

## Pictures
- `chip-1280.png`: desktop.
- `chip-390.png`: phone; the Restart button is in the touch row.

## Not tested
- At 390 px the top-right buttons cover the chip (old overlap with the time line); the touch Restart button is the way there.
- Real finger taps on a real phone.
