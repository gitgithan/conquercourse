-- Structured feedback: one row per submission; answers are JSON keyed by question id. No names, no emails, no IP addresses.
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  round TEXT NOT NULL,
  session TEXT NOT NULL,
  build TEXT NOT NULL,
  mode TEXT NOT NULL,
  answers TEXT NOT NULL,
  context TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_round_ts ON feedback (round, ts);
CREATE INDEX IF NOT EXISTS feedback_session ON feedback (session, ts);
