-- One row per course attempt event. Stable course_key/source values keep new course types analyzable.
CREATE TABLE IF NOT EXISTS course_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  session TEXT NOT NULL,
  build TEXT NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL,
  course_key TEXT NOT NULL,
  course_name TEXT NOT NULL,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('start', 'fail', 'success')),
  UNIQUE (run_id, event_type)
);
CREATE INDEX IF NOT EXISTS course_events_course_ts ON course_events (course_key, ts);
CREATE INDEX IF NOT EXISTS course_events_type_course_ts ON course_events (event_type, course_key, ts);
CREATE INDEX IF NOT EXISTS course_events_session_ts ON course_events (session, ts);
