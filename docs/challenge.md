# Challenge: a ghost to chase, and runs to share (CC-99)

*Product owner, 2026-10-29: "We need a challenge. Design a way for players to share their best runs. Start simple by just competing with the ideal run. Allow the user to turn on a ghost which the user can chase."*

## What the player gets
- A **Ghost** chip at the top of the Course and the key **N**.
- A see-through runner that replays another run on the same clock, so the player can chase it.
- One plain line next to it: "Ghost is 0.8 s ahead", "You are 0.3 s ahead" or "Level with the ghost".
- A small ghost mark on the obstacle strip, on the obstacle the ghost is at.
- At the end, one line that compares the times, and a button to chase again.
- It is a comparison, never a grade of technique.
- Nothing about it blocks a key, and nothing can touch the ghost.

## Parts
- **Part 1, the ideal ghost (built):** replays the line the simulator found (the plan stored with the course, or the workers' search).
- **Part 2, your best (next):** each cleared run is kept in the browser as its keys, and replayed as a second ghost choice.
- **Part 3, share without a server (after that):** a link carries the course, the build and the keys.
- **Part 4, a leaderboard (design only, below):** needs a server step and the owner's yes.

## How a run is replayed (`src/sim/replay.ts`)
- The simulator is deterministic at 120 Hz.
- So a run is its key presses: the same keys from the start give the same run.
- A ghost track is where the runner was at every tick (x and y), kept as two arrays.
- The ideal ghost is made by playing the plan once (`playPlan` with a trace hook).
- A contraption (coaster cart, drone, cannon) works the same way, because the world states are kept, not the keys.

## The gap in words
- For the place the player is at now, find when the ghost was there.
- If the player is later than the ghost's last tick there, the ghost is ahead by the difference.
- If the player is earlier than the ghost's first tick there, the player is ahead by the difference.
- If the ghost also stood still there (hanging on a wall), the gap is zero while the player is there at the same time.
- Tests: `tests/replay.test.ts`.

## Where it sits and what it must not do
- The chip sits at the top centre, between the progress bar and the obstacle strip, so it overlaps no card at 1280×720 or 1024×640 (`scripts/ghost-check.mjs`).
- It is off by default and remembered in the browser.
- It chases only a run that began at the start of the course (not a practice from a checkpoint, not a bot replay).
- In the first-person camera it hides while it is within about a metre of the eyes.
- Key N was free; the controls card lists it.

## Part 2: your best (design)
- Record the keys of every run from the start of the course, run-length encoded: one pair of (keys held, ticks) for each change.
- Only plain key presses are recorded (the bot's take-off speed and the cannon angle are not keys, so a bot run is never "a person's run").
- When a run clears, replay the recording once to check it gives the same time, then keep it if it is the fastest for that course.
- Stored in `localStorage` by course (a hash of the course, without its stored plan), with the time and the date.
- The Ghost chip cycles Off, Ideal, My best.

## Part 3: share without a server (design)
- "Copy link to challenge a friend" is the main share button on the end report (CC-181).
- "Download a video" is only a file the player can post anywhere; there is no phone share sheet any more.
- The link keeps the same address and adds `challenge=<version>.<course hash>.<nickname>.<keys>`.
- The keys are the run-length pairs as varints, deflated, then base64url.
- Size: a three-minute run is a few hundred bytes, well under 2 KB (tested on the demo courses).
- The nickname is optional, three letters, letters and digits only.
- The link holds no name, no time and no account.
- Opening it plays the keys on the course and takes the time the simulator gives.
- So a link cannot claim a time: a log that does not clear, that is cut short, longer than three minutes or damaged is refused with a plain message.
- A different build (version) or a changed course (hash) says the course has changed and offers the ideal ghost.

## Part 3b: a try that fell (CC-181)
- A link can also carry a try that did not finish, from the fall panel ("Copy link to this try").
- Its first field reads `1f` instead of `1`; a build that does not know it reads `Number("1f")` as not a number and refuses the link.
- Opening it plays the keys in the simulator; the ghost falls where the player fell, and the banner says how far it got.
- The keys must really end in a fall on that course: keys that finish, or stop before any fall, are refused as damaged.
- A fell try passed off as a finished run is refused ("does not reach the finish").
- It has no time, so it never feeds stats, a leaderboard or "course cleared"; opening it makes no server call.
- Same size limit as every link: at most 2000 characters.
- The Ghost chip (N) cycles Off, Ideal, Friend; the ghost is on by default (CC-180).
- Both figures are see-through: the player at 0.85, the ghost at 0.5 in amber with a dark rim, drawn behind the player so both read when they overlap.

## Part 3c: the short link (CC-219)
- The report's "Copy link" button asks the server to keep the run and gives back `https://<site>/?c=<id>`, ten characters whatever the run.
  - The id uses `a-z` and `2-9` without look-alikes.
  - The 2000-character limit no longer applies: a busy run or a bigger made course (up to 20 000 characters) fits.
- If the server does not answer in 4 seconds, says no, or has no table yet, the button gives the long link exactly as before.
- Old links keep working: `?challenge=` and the half-run links that start with `1f`, and they make no server call.
- Opening `?c=<id>` asks the server for the run, rebuilds the long form of the address in the browser (`history.replaceState`), and the page goes on as for a long link.
  - An id that is unknown, hidden or badly shaped says "This link is damaged".
- The switch: `?short=0` uses the long link for one visit; the build constant is `SHORT_ON`; the Pages variable `SHARE=off` makes the server answer 503.
- What the server checks before it stores a run:
  - A body of at most 32 000 characters, keys of at most 8000.
  - The same version and format rules as a long link, and a course it can find: a listed file, the starting course, or a made course sent with the request.
  - The course hash equals the one the keys were played on.
  - The cheap checks of `docs/run-checks.md` (too short, too long, too fast, key rate); a try that fell skips the finish-line speed check.
  - The same run shared twice keeps one id.
- It does not replay the keys.
  - Whoever opens the link replays them and takes the time from the simulator, so a link cannot claim a time.
- Not supported yet: `?generate=`, `?coaster=` and Park courses; those keep the long link.
- The tables, limits and plan behind it are in [data-model](data-model.md).
- The migration `migrations/0006_shares.sql` is written and waits for the owner.

## Part 4: a leaderboard (approved 2026-10-30; on by default on the Course and in the end report, `?board=0` hides it, CC-108)
- **Built:** `GET /api/leaderboard?course=<key>&hash=<hash>` returns the ten fastest verified runs with their tags; the end report shows them and your own best.
  - The board reads `course_clears` (migration 0007), not the `runs` table below, so it works before the bigger data model lands.
  - Tags are three letters the player chose, checked again on the server; no account and no name.
  - Your best time is kept in this browser only.
  - Tests: `tests/leaderboard.test.ts`.
- **What:** a best-time list for each course, and a daily challenge course made from a seed by the generator.
- **How a time gets in:** the page sends the course id, the hash and the keys.
  - A Cloudflare Pages Function plays the keys with the same simulator (it is plain TypeScript) and stores the time it computes.
  - The client never sends a time.
- **Storage:** the `runs` table in [data-model](data-model.md), with an index on (course hash, verified, ticks).
  - Migration: one new file in `migrations/`, applied with `npx wrangler d1 migrations apply conquercourse-feedback --remote`.
  - Keys are kept so a run can be replayed as a ghost for everyone.
- **Abuse limits:** kept in the private notes, not in this repo.
  - A nickname of three letters from a short word list filter, no free text.
- **Cost:** within the free tier of Pages Functions and D1 at hackathon volume (a run is about 1 KB; 10,000 runs is about 10 MB).
  - The compute is a few milliseconds per run.
- **Privacy:** no names, no accounts, no location; the nickname is optional.
- **Daily challenge:** the day's seed gives a generated course (`generateChecked`); every player gets the same course; times are compared the same way.
- **Decision for the owner:** whether to build this before 2026-11-04, and whether to show a leaderboard to the public at all (a list of nicknames is the only social feature in the game).

## Not in this change
- The ghost is a plain translucent capsule, not the Rookie.
  - Next step: reuse the Rookie actor with a ghost material.
- No sound for the ghost.
- No ghost in the Dojo or the editor.
