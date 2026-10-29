-- NOT YET APPLIED (CC-219): the product owner must say yes first. The code works without it (the game then sends the long link as before).
-- One row per shared run: a short id stands for the run and the course it was played on, so a link no longer has to carry the keys (CC-218, docs/data-model.md).
-- No name, no email, no address, no player id: only the run, the course reference and the optional three-letter tag.
-- Do NOT use `wrangler d1 migrations apply` on the live database (0002 to 0004 were applied by hand); run this file with `wrangler d1 execute --file`.
-- Undo: DROP TABLE shares.
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,                         -- 10 characters, a-z and 2-9 without look-alikes
  created_at INTEGER NOT NULL,                 -- unix seconds
  sim_version INTEGER NOT NULL,                -- REPLAY_VERSION when the keys were recorded; an old one is refused on open, never replayed wrongly
  kind TEXT NOT NULL CHECK (kind IN ('done', 'fell')),
  course_kind TEXT NOT NULL CHECK (course_kind IN ('asset', 'default', 'made')),
  course_key TEXT NOT NULL DEFAULT '',         -- the course file for 'asset' (e.g. demo/lache), empty otherwise
  course_hash TEXT NOT NULL,                   -- courseHash() of the course the keys were played on
  query TEXT NOT NULL DEFAULT '',              -- the kept words of the address (course=...), nothing else
  made TEXT,                                   -- the packed course for 'made' (up to 20000 characters; moves to R2 when it grows)
  nick TEXT NOT NULL DEFAULT '',
  look TEXT NOT NULL DEFAULT 'a',
  ticks INTEGER NOT NULL,                      -- length of the keys, not a time the simulator confirmed
  keys TEXT NOT NULL,                          -- encodeLog() text: run-length pairs, deflated, base64url
  content_hash TEXT NOT NULL UNIQUE,           -- sha-256 (first 32 hex) of everything above that identifies the run: the same run shared twice keeps one id
  beats_ideal INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'hidden'))  -- 'hidden' is a takedown: the link answers 404
);
CREATE INDEX IF NOT EXISTS shares_course ON shares (course_hash, kind, ticks);
CREATE INDEX IF NOT EXISTS shares_created ON shares (created_at);
