# Data model: where runs, courses and shares live as the game grows (CC-218)

*Owner, 2026-10-30: "design the right database structure that does not get limited by 2000 characters in the URL, and prepare the database schema for scale and future feature development."*

- Every column of every table is explained in `docs/data-dictionary.md`.

## So what for the game
- A shared run needs a short link of ten characters, whatever the run or the course looks like.
  - Before CC-219 a link carried the keys and, for a course made in the editor, the whole course, so it had to fit in 2000 characters; that kind of link is gone.
  - A frantic minute of keys is about 1.1k characters, two minutes at the hand limit about 3.2k, and a made course is capped at 1.7k, so real runs and real courses already hit the wall.
- The recommendation: keep Cloudflare D1 as the one database and store the key log in the row; use R2 only for big files (photos, clips, large made courses).
  - A key log is small (see the sizes below), so a separate blob store buys nothing yet.
  - The code reads and writes through a small store interface, so moving the log to R2 later changes one file.
- Built now (CC-219): the `shares` table, `POST /api/share`, `GET /api/share/:id`, and the link `?c=<id>`; it is the only kind of link; the old long links are no longer made or opened (owner, 2026-10-31).
- Migration `0006_shares.sql` is applied on the production and preview databases (both `shares` tables hold 0 rows); no R2 bucket is needed for this step.
- Everything else in this document is the plan for later features; none of it is built, and each part says what it waits for.

## What is stored today
| Table | Migration | What it holds | Player id |
|---|---|---|---|
| `feedback` | 0001 | one row per feedback form | session id |
| `community`, `community_reports` | 0002 | a photo, boxes and a status for a shared Park course | session id |
| `community_items` | 0014 | a shared piece (old wallpaper rows are never listed): small picture, .glb for pieces, status (`pending`, `approved`, `removed`), owner as a one-way code | one-way code of the browser's random id |
| `course_events` | 0002 | start, fail, success per attempt | session id |
| `course_clears` | 0003, 0004, 0005, 0007 | a cleared run the server replayed: course, hash, ticks, verified, beats_ideal, keys of verified runs, the optional tag (up to twelve characters) | none (owner decision, 2026-10-29) |
| `challenge_courses` | 0013 | a challenge course (CC-108): cleaned course JSON by content hash, board hash, author code, created, promoted and expiry dates | drop the table; the clears stay in `course_clears` under `challenge/<id>` |

- Neither a clear nor a share stores an address, a name or an email.
- Every migration is now recorded in the live `d1_migrations` table (2026-10-30), so `wrangler d1 migrations apply conquercourse-feedback --remote` applies only the new files.
  - History: 0002 to 0004 had been run by hand, which left the table knowing only 0001; the rows were added by hand once, and `apply` was used for 0006 and 0009.
  - A new file that is not safe to run twice needs no special care: `apply` runs each file once.

## How big a run is (measured)
- A run is a list of (keys held, ticks) pairs, written as varints, deflated and encoded in base64url (`encodeLog`).
- The stored best lines (`npx tsx scripts/log-sizes.ts`) are tiny, because a plan holds the keys for long stretches.

| Course | Pairs | Ticks | Characters |
|---|---|---|---|
| plank | 1 | 708 | 5 |
| lache | 8 | 1127 | 29 |
| hero-montmartre-paris | 22 | 1740 | 64 |
| training | 31 | 4108 | 107 |

- A person presses more often than a plan, so the worst case matters more; random key changes (no repeats for the compressor to find) give these sizes.

| Run | Pairs | Characters |
|---|---|---|
| calm, 15 s | 60 | 139 |
| busy, 30 s | 240 | 456 |
| frantic, 60 s (5 changes a second) | 600 | 1089 |
| 2 min at the 15 changes a second limit | 1800 | 3195 |
| the 6000-pair cap | 6000 | 10 572 |

- So the key log fits in one D1 row with a wide margin: at most about 10.6 KB, against a row limit of about 2 MB.
- A made course is the other big part: capped at 20 KB packed in a share (the unpacked size cap of 60 000 characters stays).

## Entities and relations
- Built now are marked **now**; the rest are **next**, and each says what must happen first.
- Ids that people see are short slugs (10 characters, `a-z` and `2-9` without look-alikes, about 49 bits); ids inside the database are the same slugs, so no second key is needed.

### Players (next, needs an owner decision)
- `players(id, created_at, last_seen_day)`: an anonymous random id kept in the browser, nothing else.
- Owner decision, 2026-10-29: no player id is stored with a clear and no count of people is shown.
  - So the shares table has no player column today.
- What a player id would unlock: "my runs", a leaderboard row that is yours, deleting your own shares.
- Smaller step that needs no id: a `delete_token` handed to the sharer when a share is made (only its hash stored), so a sharer can remove a link without an account.

### Courses and versions (next)
- `courses(id, kind, key, name, created_at, parent_id, status, source)`: one row per course the game knows.
  - `kind`: `builtin`, `place` (made from a real map), `made` (editor), `community` (approved Park course), `generated` (seed).
  - `parent_id`: the course this one was made from (a remix).
- `course_versions(hash, course_id, sim_version, body_ref, path_proof, first_seen)`: one row for each hash a course has had.
  - `hash` is `courseHash()`; a changed course gets a new row, so old runs keep pointing at the exact course they were played on.
  - `body_ref`: the course JSON in R2 (key `courses/<hash>.json`) or inline when under 8 KB.
  - `path_proof`: the proven path record, that is the key log of one clear that the server replayed, stored as the same text as a share (so a made course is never offered without a way through).
- Why not only `course_key`: `course_clears.course_key` accepts only the listed demo and place files, so a made or community course cannot be counted today.

### Objects and where they came from (next)
- `course_objects(course_hash, idx, kind, height_m, height_source, asset_id, source_agent, source_ref)`.
  - `asset_id`: the photo the object was made from (a row in `assets`).
  - `source_agent`: which agent proposed it (the Muse Spark course agent, the Mapillary detector, the owner's own box).
  - `source_ref`: the other agent's JSON record, kept as written so it can be audited (R2 key `records/<sha256>.json`, or inline under 2 KB).
- `height_source`: `typed` (the maker typed it), `detected`, or `assumed`, so a course page can say how sure the size is.
- Waits for: the photo-to-object path (CC-38) writing a record at all.

### Assets (next)
- `assets(id, sha256, bytes, mime, kind, r2_key, created_at, status, licence)`.
  - `kind`: `photo`, `clip`, `thumbnail`, `texture`.
  - `status`: `pending` (not moderated), `ok`, `hidden`.
- Content-addressed: the R2 key is the SHA-256, so the same photo uploaded twice is one object.
- Today the community photo sits as a base64 string in `community.image` (about 340 KB); the move to R2 shrinks that table by two orders of magnitude.

### Runs and clears (next; `course_clears` stays until then)
- `runs(id, course_hash, sim_version, kind, ticks, verified, beats_ideal, log_hash, log, log_ref, day)`.
  - `kind`: `done` or `fell` (a half run, CC-181).
  - `log`: the key log text, inline up to 16 KB; `log_ref`: an R2 key when larger (never expected, see the sizes).
  - `day`: the date as a number, for retention and daily stats.
- It replaces `course_clears`: the same columns plus `kind`, `sim_version` and the log.
- No player and no address; a `player_id` column is added only after the owner decides.

### Shares (now)
- `shares(id, created_at, sim_version, kind, course_kind, course_key, course_hash, query, made, nick, look, ticks, keys, content_hash, beats_ideal, status)`, see `migrations/0006_shares.sql`.
- One share is one run plus the reference to its course: a listed file (`asset`), the course every visitor starts on (`default`), or a made course carried inside the row (`made`).
- `content_hash` is unique: the same run shared twice keeps one id.
- `status = 'hidden'` is a takedown; the link then answers 404.
- A share is not a record: the server does not replay it; the person who opens it replays it and takes the time from the simulator.
- A share may later point to a `runs` row (`run_id`); until then it holds its own copy of the keys, so the two tables never have to agree.

### Ghosts and the leaderboard (next)
- A ghost is a run played as a see-through runner; it needs no table of its own: it is a `runs` row (or a share) opened in the ghost player.
- `course_best(course_hash, rank, run_id, ticks)`: the best verified runs for a course version, rebuilt when a better run lands (top 100).
  - Only `verified = 1` rows can enter, as in `docs/run-checks.md`.
  - The `runs` index on (`course_hash`, `verified`, `ticks`) answers "top 10" without this table at hackathon volume; the table is for caching at larger volume.
- Leaderboard identity (a tag, not a name) stays the short tag (up to 12 characters) from the challenge doc.

### Challenge links (next)
- `challenges(id, share_id, course_hash, created_at, expires_at, kind, seed)`.
  - `kind`: `friend` (a share), `daily` (the day's generated course, same for everyone), `event`.
- Today a friend challenge is just a share; this table is for challenges with a lifetime or a prize.

### Community published courses (next)
- `community` stays as the moderation queue; an approved row gets a `courses` row (`kind = 'community'`) and `community.course_id` points to it.
- The photo moves to `assets`; `boxes` stay in the row (small).
- `community_reports` stays.

### Events and analytics (partly now)
- `course_events` stays for the live counters (plays and failures behind the course cards).
- Raw events older than 90 days are folded into `daily_stats(course_key, day, plays, fails, clears)` and deleted.
- A new event type needs no migration: the `event_type` check is the only fixed list.

### Motion clips from users (next, behind the plausibility gate)
- `motion_clips(id, asset_id, status, created_at, consent, plausibility, source)`.
  - `status`: `pending` until it passes the plausibility check (`CLAUDE.md`: no motion is shown before it does).
  - `consent`: a yes/no the uploader gave; the clip is deleted when the uploader asks.
- No footage of minors (a hard rule): upload needs a tick, and the review queue is the owner's.

### Feature flags (next)
- `flags(key, enabled, rollout_pct, updated_at, note)`: read by `/api/flags` and cached for a minute.
- Today a flag is a build constant plus a `?name=0` switch for one visit (`shareOn`, `shortOn`); the table is for turning a feature off for everyone without a deploy.
- The server-side kill switch for shares already exists as the Pages variable `SHARE=off`.

## Keys and indexes
| Table | Primary key | Other indexes | Serves |
|---|---|---|---|
| `shares` | `id` | unique `content_hash`; (`course_hash`, `kind`, `ticks`); (`created_at`) | open by id; dedupe; "best shares of a course"; hourly cap and retention |
| `runs` | `id` | unique `log_hash`; (`course_hash`, `verified`, `ticks`); (`day`) | duplicates; top N; pruning |
| `course_versions` | `hash` | (`course_id`) | all versions of a course |
| `course_objects` | (`course_hash`, `idx`) | (`asset_id`) | provenance of a photo |
| `assets` | `id` | unique `sha256` | one copy per file |

- Reads by id are one primary-key lookup; nothing scans a table.
- Every index costs a write on each insert, so a table gets only the indexes a query above needs.

## Size and cost at three scales
- A share row is about 150 bytes of fields plus the keys (a busy 30 s run is about 450 characters), so about 0.6 KB.
- A share of a made course adds up to 20 KB; assume 1 share in 20 does, so the average is about 1.6 KB.

| Runs shared | Share rows | With indexes (about 1.3x) | Storage cost |
|---|---|---|---|
| 1 000 | 1.6 MB | 2 MB | free tier |
| 100 000 | 160 MB | 210 MB | free tier (500 MB a database) |
| 1 000 000 | 1.6 GB | 2.1 GB | paid plan; still far below the 10 GB database limit |

- Writes: 1 million shares in a month is 0.4 a second on average; a viral peak of 100 times that is 40 a second.
- Reads: a share is opened more often than it is made (say 10 opens each); with `Cache-Control: public, max-age=86400` on `GET /api/share/:id` most opens never reach the database.

## D1 limits and when to move
- Figures are from Cloudflare's documentation as I know it; they change, so recheck before relying on one (not load-tested here).

| Limit | Value | What it means here |
|---|---|---|
| Database size | 500 MB free, 10 GB paid | 1 million shares fits on paid; plan the split before 5 GB |
| Row, string or blob | about 2 MB | a key log (10 KB) and a made course (20 KB) are far under |
| Bound parameters per query | 100 | the share insert uses 16 |
| Writes | one writer per database; roughly hundreds a second for small rows | 40 a second at a viral peak is fine |
| Free plan | 100 000 rows written and 5 million rows read a day | an insert with 2 indexes counts as 3 written rows, so about 33 000 shares a day on free |
| Worker CPU | 10 ms on free | the replay (11 ms for 27 s) is the real ceiling, not the database |

- **Move the log to R2 when:** a typical log passes 16 KB (it does not), or the shares table passes about 5 GB.
- **Move big made courses to R2 when:** the average share row passes 5 KB, or the free plan's database size is the limit.
- **Use a Durable Object when:** the game needs a live thing: a race room where two players see each other's ghosts as they run, an exact running count of plays, or a leaderboard that updates in the same second.
  - A Durable Object holds one room's state in memory with strong ordering; D1 is the record, the object is the room.
- **Use a queue or a scheduled Worker when:** the 90-day fold of `course_events`, the re-verification of old runs, or moderation need to run without a player waiting.

## Versioning: how an old log still replays
- Every run and share stores `sim_version` (`REPLAY_VERSION`, now 1) and the `course_hash`.
- The keys only mean something with the same simulator and the same course, so opening a link checks both.
  - A different version is refused in plain words and the ideal ghost is offered (built).
- When the simulator changes in a way that changes a run:
  - Bump `REPLAY_VERSION`; old rows stay.
  - Run a script on a VM that replays every `runs` row with the old keys on the new simulator; rows that still clear keep their time and get the new `sim_version`.
  - Rows that no longer clear get `status = 'stale'`: kept as a record, never offered as a ghost, never on a leaderboard.
- Alternative for later: keep each old simulator build at `/sim/v<n>/` and play an old run with the build that made it; costs a bundle per version, and the browser must load it.
- Courses: `course_versions` keeps every hash; a new hash starts a new leaderboard, as the course cards already do (only the newest hash counts).

## Retention
| Data | Kept | Then |
|---|---|---|
| shares that were opened in the last year | as long as opened | |
| shares never opened after 90 days | 90 days | deleted |
| shares of a try that fell | 90 days | deleted |
| `runs` that are verified | forever (small) | |
| `runs` that are unverified | 30 days | deleted unless re-verified |
| `course_events` | 90 days | folded into `daily_stats` |
| `feedback` | the round, plus a year | summary kept in `docs/feedback/` |
| photos and clips | until the owner or the uploader removes them | |

- "Opened" needs a last-opened day on the share; written at most once a day per share so a viral link does not become a write storm (not in the first slice).

## What each service keeps
*Read from the code on 2026-11-01. Baseten's terms and the caveat that we have not read a signed agreement are in [trust-and-safety](trust-and-safety.md).*

| Data | Where | What is kept | Until |
|---|---|---|---|
| Full photo for a piece or outline | sent by the browser to our Cloudflare function, then to the Modal job | not written to our D1; Modal's own retention of job inputs and results is not verified | unknown (Modal) |
| Small copy (thumbnail) for the safety check | sent to Baseten by `askModeration` | Baseten: no storage and no training, per its public terms (see trust-and-safety) | not kept (Baseten) |
| Caption or character sentence | same | same | not kept (Baseten) |
| Safety verdict | D1 `community_items.moderation` as `verdict:reason` | the word pair only | with the row |
| Shared piece | D1 `community_items`: owner code, name, thumbnail, glb, meta | text in the database (not R2) | until the owner deletes it; deleting empties thumb, glb and meta and keeps the row marked `removed` |
| Older community photos | D1 `community.image` | base64 photo and boxes, session id | no deletion rule written; see Retention above |
| Characters | D1 `characters`: prompt, thumbnail, glb, owner code | text in the database | no deletion rule written |
| Character jobs | D1 `character_jobs`: prompt, owner code, day, state | small rows | no deletion rule written |
| Masks | not stored by the web path; the Modal job returns them with the result | see first row | unknown (Modal) |
| People, faces, plates | blurred or pixelated in the Modal job before the lift | the privacy receipt holds counts only | with the result |
| Owner code | one-way code made from the browser's random id (or address for rate limits); never the address itself | | |

- Rows without a deletion rule are a gap; closing it is not part of this change.

## Privacy
- Never stored: a real name, an email, an age, an IP address, a location of a person.
- A share holds keys, a course reference, a tag of up to twelve characters and a look; the tag is optional and filtered (`src/share/nick.ts`).
- A run carries no time claimed by the browser: the time is what the simulator says on opening.
- Photos for objects drop their location data in the browser before upload (already true for the Park).
- Takedown: the owner can set `status = 'hidden'` on a share or an asset by id; the delete token (next) lets the sharer do it.
- No personal data is added to a shared run: the checks that mark a run `verified` and `beats_ideal` are unchanged and store no more than before.

## Migration plan from the current tables
- Rule: every step is additive, a new file in `migrations/`, applied with `wrangler d1 migrations apply`, with the old table kept until the new one has run for a week.

| Step | Migration | What changes | Undo |
|---|---|---|---|
| 1 (now) | 0006 | new `shares` | `DROP TABLE shares` |
| 1b (CC-108) | 0007, 0008 | `course_clears` gets `nick` and an index for the board and keeps keys of every verified run; new `upload_days` for the daily photo slots | the columns stay; drop `upload_days` |
| 2 | 0009 | `courses`, `course_versions`, `assets` | drop the three tables |
| 3 | 0010 | `runs`; the clear function writes to both `course_clears` and `runs` | stop writing; drop `runs` |
| 4 | after a week | the card stats read `runs`; `course_clears` becomes read-only | switch the read back |
| 5 | 0011 | `community.course_id`, photos copied to R2 and `assets` | the old `image` column is kept until the copy is checked |
| 6 | 0012 | `flags`, `daily_stats`, `challenges`, `motion_clips` | drop tables |

- The 0004 and 0005 columns (`verified`, `beats_ideal`, `keys`) are carried into `runs` as they are.
- Backfill of `runs` from `course_clears`: `log` stays empty (the old rows never stored keys), `sim_version = 1`, `kind = 'done'`.

## Object catalogue at scale
- Photos, objects and placements have separate ids, and similar uploads are matched before the expensive lift.
  - The plan is in `docs/object-catalogue.md`.

## Three alternatives
### A. D1 only, log in the row (recommended now)
- The log is a text or blob column in the row; the made course sits in the row too.
- For: one system, one transaction, one place to look, works with the local test database already used (`tests/helpers-d1.ts`), cheap.
- Against: a made course of 20 KB makes the row bigger than needed; the database fills sooner than with blobs outside.
- Fits while: logs stay under 16 KB and the database under 5 GB.

### B. D1 for the index, R2 for every log and course, content-addressed
- The row holds the SHA-256; the bytes are in R2 at `logs/<sha256>`.
- For: the database stays tiny (a row is about 150 bytes); the same log or course is stored once; R2 egress is free; archives are easy.
- Against: two systems to keep in step (a row without its blob, a blob without its row); every open is two requests; the tests need a fake bucket; the owner has to create a bucket.
- Pick it when: logs get large (longer courses, richer inputs), or the database passes about 5 GB.

### C. KV for shares, Durable Objects for courses and rooms
- A share is a key-value pair (`id` to JSON) in Workers KV; a Durable Object per course keeps its leaderboard.
- For: KV reads are the fastest at the edge; a Durable Object gives an exact live leaderboard and live rooms.
- Against: KV is eventually consistent (a new link can 404 for up to a minute in another region); no queries ("best shares of a course"), no uniqueness for dedupe; two kinds of storage with two kinds of tests.
- Pick it when: the game has live races; use it then for the room, with D1 still the record.

### Recommendation
- Start with A, behind the store interface in `src/share/server.ts`, so B is a change to one file.
- Add R2 for assets (photos, clips) when the first of those features lands, because those really are big.
- Add a Durable Object only for a live race room, if that feature is ever built.

## What waits for the owner
- Decide whether to add a player id (it would change the 2026-10-29 decision).
- Create an R2 bucket only when photos or clips move out of the database (not needed for shares).

## Known gaps
- The D1 limits above are from documentation, not from a load test.
- The shares table has no last-opened column yet, so the 90-day clean-up of unopened links is written down and not built.
- A share is stored without a server replay; a leaderboard time must still go through `/api/course-clear`.
- Generated (`?generate=`), coaster, editor and Park courses are stored inside the share as the packed course (up to 20 000 characters), not rebuilt from their words, so a later change to the generator cannot change an old link.
  - A course that cannot be cleaned or packs bigger than 20 000 characters gets no link; the button says "This course is too big for a link".
