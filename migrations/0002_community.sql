-- Community obstacles: a photo and the boxes drawn on it (the course is rebuilt from the boxes in the browser).
-- Every course starts as 'pending' and only shows in the gallery after the owner approves it.
CREATE TABLE IF NOT EXISTS community (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  session TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  name TEXT NOT NULL,
  nick TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  boxes TEXT NOT NULL,
  image TEXT NOT NULL,
  reports INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS community_status ON community (status, id);
CREATE INDEX IF NOT EXISTS community_session ON community (session, ts);
CREATE TABLE IF NOT EXISTS community_reports (
  course INTEGER NOT NULL,
  session TEXT NOT NULL,
  ts TEXT NOT NULL,
  UNIQUE (course, session)
);
