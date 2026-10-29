-- One row per cleared run that the server played again with the simulator (CC-149).
-- No player id is kept here: a clear is a course, the course's hash, and the time the simulator says.
CREATE TABLE IF NOT EXISTS course_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  course_key TEXT NOT NULL,
  course_hash TEXT NOT NULL,
  ticks INTEGER NOT NULL,
  run_id TEXT NOT NULL UNIQUE,
  log_hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS course_clears_course ON course_clears (course_key, id);
