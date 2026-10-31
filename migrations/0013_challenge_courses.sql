-- CC-108: challenge courses. A course the player changed (ground edit, World Editor, a slice) can be registered after its author's own run is proved by the server replay.
-- One row per course, found by the hash of its canonical JSON, so many tiny tweaks of one course are one entry (docs/challenge-courses.md).
-- Its board is the existing course_clears table, with course_key 'challenge/<id>' and course_hash the board hash below.
-- author is the one-way player code of docs/challenge.md (never a session id, name or address).
-- expires_at is set until another player clears the course; once promoted it is NULL and the course stays.
-- Apply to the preview database with: npx wrangler d1 execute conquercourse-preview --remote --file migrations/0013_challenge_courses.sql
-- Undo: DROP TABLE challenge_courses.
CREATE TABLE IF NOT EXISTS challenge_courses (
  id TEXT PRIMARY KEY,                   -- 10 characters, a-z and 2-9 without look-alikes (the same alphabet as a short link)
  content_hash TEXT NOT NULL UNIQUE,     -- sha-256 (first 32 hex) of the canonical course JSON
  board_hash TEXT NOT NULL,              -- courseHash() of that JSON: the hash the board and the clears use
  name TEXT NOT NULL,
  course TEXT NOT NULL,                  -- the cleaned course JSON, looks and stored plans removed; capped on the way in
  author TEXT NOT NULL,                  -- one-way code of the author's browser
  author_ticks INTEGER NOT NULL,         -- the time the server replay gave the author's own run
  created_at INTEGER NOT NULL,           -- unix seconds
  promoted_at INTEGER,                   -- unix seconds of the first verified clear by another player; NULL until then
  expires_at INTEGER                     -- unix seconds; NULL once promoted
);
CREATE INDEX IF NOT EXISTS challenge_courses_promoted ON challenge_courses (promoted_at);
CREATE INDEX IF NOT EXISTS challenge_courses_expiry ON challenge_courses (expires_at);
CREATE INDEX IF NOT EXISTS challenge_courses_author ON challenge_courses (author, created_at);
