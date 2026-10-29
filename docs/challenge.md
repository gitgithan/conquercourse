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
- **Part 2, your best (built):** each cleared run is kept in the browser as its keys, and replayed as a second ghost choice.
- **Part 3, share without a server (built):** a link carries the course, the build and the keys.
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

## Part 2: your best (built)
- Record the keys of every run from the start of the course, run-length encoded: one pair of (keys held, ticks) for each change.
- Only plain key presses are recorded (the bot's take-off speed and the cannon angle are not keys, so a bot run is never "a person's run").
- When a run clears, replay the recording once to check it gives the same time, then keep it if it is the fastest for that course.
- Stored in `localStorage` by course (a hash of the course, without its stored plan), with the time and the date.
- The Ghost chip and N cycle Off, Ideal, Your best, and a friend's run when a link was opened.
- A kept best is played again when the page loads: a changed course or a changed simulator drops it.
- Check: scripts/ghost-share-check.mjs.

## Part 3: share without a server (built)
- "Copy challenge link" on the end report.
- The link keeps the same address and adds `challenge=<version>.<course hash>.<nickname>.<keys>`.
- The keys are the run-length pairs as varints, deflated, then base64url.
- Size: the lache demo run makes a link of 141 characters; a three-minute run is a few hundred bytes, well under 2 KB (tested).
- The nickname is optional, three letters, letters and digits only.
- The link holds no name, no time and no account.
- Opening it plays the keys on the course and takes the time the simulator gives.
- So a link cannot claim a time: a log that does not clear, that is cut short, longer than three minutes or damaged is refused with a plain message.
- A different build (version) or a changed course (hash) says the course has changed and offers the ideal ghost.

## Part 4: a leaderboard (design only, for the owner to approve)
- **What:** a best-time list for each course, and a daily challenge course made from a seed by the generator.
- **How a time gets in:** the page sends the course id, the hash and the keys.
  - A Cloudflare Pages Function plays the keys with the same simulator (it is plain TypeScript) and stores the time it computes.
  - The client never sends a time.
- **Storage:** one D1 table, `runs(id, course, hash, nick, ticks, keys, created)`, with an index on (course, ticks).
  - Migration: one new file in `migrations/`, applied with `npx wrangler d1 migrations apply conquercourse-feedback --remote`.
  - Keys are kept so a run can be replayed as a ghost for everyone.
- **Abuse limits:**
  - A run must clear within three minutes of simulated time and at most 6000 pairs.
  - One submission per IP per 10 seconds, and 200 a day, using the existing rate-limit pattern.
  - A nickname of three letters from a short word list filter, no free text.
  - A run is only stored if it beats the existing best of that nickname and course, or ranks in the top 100.
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
