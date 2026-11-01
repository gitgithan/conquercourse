# Data dictionary
- What every column in the live database (Cloudflare D1) is for.
- The diagram of how the tables connect is in `README.md`; the rules for what is kept and why are in `docs/data-model.md`.
- The tables are created by the files in `migrations/`; a column added later is marked with its migration number.
- No table keeps a name, an email, an address or a full link.
- A player is only an anonymous code made in the browser; never an account.
- Times are either text (`ts`, UTC, `YYYY-MM-DD HH:MM:SS` or ISO) or whole seconds since 1970 (`*_at`); each column says which.

## feedback (0001)
- One row per feedback form sent from the button at the bottom right.
- `id`: row number.
- `ts`: when it was sent.
- `round`: which round of questions was showing.
- `session`: the visitor code of the browser.
- `build`: the version of the game that sent it.
- `mode`: the screen it was sent from (course, editor, map, dojo and so on).
- `answers`: the answers as JSON, keyed by question id.
- `context`: a few facts about the moment, as JSON (never free personal text).

## community (0002)
- Photo courses shared in Community: a photo and the boxes drawn on it.
- `id`: row number.
- `ts`: when it was shared.
- `session`: the visitor code of the sharer, used for the daily limit.
- `status`: `pending` until approved, then shown in the gallery.
- `name`: the course name.
- `nick`: the optional tag the sharer typed.
- `width`, `height`: size of the photo in pixels.
- `boxes`: the drawn boxes as JSON; the course is rebuilt from them in the browser.
- `image`: the photo as text.
- `reports`: how many players reported it.

## community_reports (0002)
- One row per player report on a photo course.
- `course`: the `community.id` reported.
- `session`: who reported; one report per player per course.
- `ts`: when.

## course_events (0002, 0009, 0019)
- One row per event in a course attempt; the base of the picker numbers.
- `id`: row number.
- `ts`: when it happened.
- `session`: the visitor code.
- `build`: the game version.
- `mode`: the screen.
- `source`: where the course came from (a shipped course, one the player made, a slice and so on).
- `course_key`: a steady name for the course so runs can be grouped.
- `course_name`: the name shown to the player.
- `run_id`: one id per attempt; start, fail and success of one attempt share it.
- `event_type`: `start`, `fail` or `success`.
- `country`: the two-letter country the request came from (0009).
- `fail_at`: the id of the zone where a run failed (0009).
- `ref`: where the visit came from, a short tag such as `reddit` or the `?ref=` tag (0019).

## course_clears (0003 to 0012)
- One row per cleared run that the server played again with the simulator.
- `id`: row number.
- `ts`: when.
- `course_key`: which course.
- `course_hash`: a fingerprint of the course as played, so a changed course is a different board.
- `ticks`: the time the simulator measured, in steps of the game clock.
- `run_id`: the attempt; one clear per attempt.
- `log_hash`: a fingerprint of the key log; the same log is stored once.
- `verified`: 1 if the server saw the finish, 0 if it was kept without a replay (0004).
- `beats_ideal`: 1 if faster than the stored best line, for a human to look at (0004).
- `keys`: the encoded key log, kept so a board entry can play as a ghost (0005, 0007).
- `nick`: the optional three-letter tag shown on the board (0007).
- `player`: an anonymous code, so a board keeps one best time per player (0010).
- `published`: 1 only when the player pressed "Publish to Leaderboard" (0012).

## shares (0006)
- One row per shared run, behind a short link.
- `id`: the short link code.
- `created_at`: seconds since 1970.
- `sim_version`: the physics version of the recording; an old one is refused.
- `kind`: `done` or `fell`.
- `course_kind`: `asset` (shipped), `default` or `made` (carried inside the row).
- `course_key`: the course file for `asset`.
- `course_hash`: fingerprint of the course played.
- `query`: the kept words of the address, nothing else.
- `made`: the packed course for `made`.
- `nick`: the optional tag.
- `look`: which runner look was used.
- `ticks`: length of the key log (not a confirmed time).
- `keys`: the encoded key log.
- `content_hash`: fingerprint of the run, so sharing the same run twice keeps one link.
- `beats_ideal`: as above.
- `status`: `ok`, or `hidden` for a takedown (the link answers 404).

## upload_days (0008)
- Counts of paid photo-to-3D calls per day.
- `day`: the date.
- `player`: an anonymous code, or `*` for the whole game's total that day.
- `n`: how many slots are used.

## challenge_courses (0013)
- Courses a player changed and registered after the server proved their own run.
- `id`: the short code.
- `content_hash`: fingerprint of the cleaned course, so small tweaks of one course are one row.
- `board_hash`: the fingerprint the board and the clears use.
- `name`: the course name.
- `course`: the cleaned course as JSON.
- `author`: anonymous code of the maker.
- `author_ticks`: the time the server replay gave the maker's run.
- `created_at`: seconds since 1970.
- `promoted_at`: when another player first cleared it, empty until then.
- `expires_at`: when it goes away if nobody clears it; empty once promoted.

## community_items (0014)
- Finished pieces shared in Community.
- `id`: the item code.
- `owner`: anonymous code of the sharer.
- `kind`: `piece` (`wallpaper` rows are old and never listed).
- `name`: the piece name.
- `status`: `pending` (only the owner sees it), `approved` (everyone), `removed` (the owner deleted it; the files are emptied).
- `created_at`: seconds since 1970.
- `removed_at`: when it was removed.
- `thumb`: the preview picture as text.
- `glb`: the 3D file as text.
- `meta`: size and other facts as JSON.
- `moderation`: what the safety check said about it, kept as a short note.

## characters (0015)
- Characters players made.
- `id`: the code.
- `ts`: when.
- `kind`: `character` (the table can also hold objects).
- `status`: `private` (only the maker sees it; removed after 30 days unused) or `ok` (published).
- `owner`: anonymous code of the maker.
- `name`: shown name.
- `prompt`: the words the maker typed.
- `prompt_key`: the same words tidied, to spot repeats.
- `provider`, `route`: which service and which path made it.
- `bytes`: size of the 3D file.
- `faces`: how many faces the model has.
- `thumb`, `glb`: preview picture and 3D file as text.
- `picks`: how many times players chose it.
- `last_pick`: when it was last chosen; a private one unused for too long is removed.
- `reports`: how many players reported it.

## character_jobs (0015)
- One row per started character job.
- `id`: the job code.
- `ts`: when it started.
- `owner`: who started it; only they may ask about it.
- `day`: the day whose slot it used.
- `provider`: the service.
- `prompt`: the words typed.
- `state`: `running`, then `done` or `refunded`, changed once.

## usage_events (0016)
- What a day's paid calls cost, a rough estimate and not billing.
- `day`: the date.
- `category`: which service.
- `calls`: how many calls.
- `created`: how many results were made.
- `est_cents`: the estimated cost in cents.

## flags (0016)
- One row per feature switch, read on every request.
- `name`: the switch name.
- `on_`: 1 on, 0 off; a missing row means on.
- `note`: why it was changed.
- `changed_at`: seconds since 1970.

## lift_receipts (0017)
- One row per photo-to-3D job whose piece was shared, so one job can publish one piece.
- `id`: the job code.
- `used_at`: seconds since 1970.

## moderation_stops (0018)
- One row per photo the safety check stopped; no picture is kept.
- `id`: row number.
- `at`: seconds since 1970.
- `route`: which step stopped it.
- `owner`: anonymous code.
- `verdict`: the check's answer.
- `reason`: the check's reason, in plain words.

## analytics_events (0019)
- One table for two kinds of row, told apart by `kind`.
- `ts`: when.
- `day`: the date, used to count one row per visitor and day.
- `kind`: `step` (a funnel step) or `wait` (how long a rented service took).
- `name`: for `step`, the step; for `wait`, the service.
- `session`: the visitor code (steps only).
- `ref`: where the visit came from (steps only); `direct` if unknown.
- `country`: the two-letter country (steps only).
- `ms`: how long the call took in milliseconds (waits only).
- `ok`: 1 if the call worked (waits only).
- `cold`: 1 if the machine had to start up first (waits only).
- The steps, in the order a player meets them:
  - `landed`: opened the game.
  - `start_run`: started a run.
  - `cleared`: finished a course.
  - `used_slicer`, `used_editor`, `used_dojo`, `used_lab`: opened that screen.
  - `shared_piece`: shared a piece to Community.
- A visitor counts once per step per day.
