-- NOT YET APPLIED to the live database (CC-103, CC-118): needs the owner's yes, each time.
-- usage_events: one row per day and kind of paid call, so the owner-only page can show what the day cost (a rough estimate, not billing).
-- flags: one row per feature switch; the paid routes read it on every request, so a switch flips at once without a deploy.
--   A missing row means "on". If this table cannot be read, the paid routes answer "off" (they fail closed).
CREATE TABLE IF NOT EXISTS usage_events (
  day TEXT NOT NULL,
  category TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT 0,
  est_cents REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, category)
);
CREATE TABLE IF NOT EXISTS flags (
  name TEXT PRIMARY KEY,
  on_ INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  changed_at INTEGER
);
