-- One row per photo the safety check stopped (CC-103): when, which step, an anonymous player code, and the check's verdict and reason. No picture is kept.
CREATE TABLE IF NOT EXISTS moderation_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  route TEXT NOT NULL,
  owner TEXT NOT NULL,
  verdict TEXT NOT NULL,
  reason TEXT NOT NULL
);
