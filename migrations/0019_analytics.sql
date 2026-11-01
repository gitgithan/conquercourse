-- NOT YET APPLIED to the live database (CC-108): needs the owner's yes, each time.
-- One new table and one new column; nothing here reads or stores a name, an address or a full link.
-- course_events.ref: where the visit came from, a short tag such as reddit or linkedin (or a tag the owner put in the link as ?ref=).
-- analytics_events: one table for two kinds of row.
--   kind 'step': a funnel step (landed, start_run, cleared, used_slicer, used_editor, used_dojo, used_lab, shared_piece); one row per visitor code, step and day.
--   kind 'wait': how long one call to a rented service took (ms), whether it worked (ok), and whether the machine was cold (cold).
-- If this file is not applied, every analytics path skips quietly and the game works as before.
ALTER TABLE course_events ADD COLUMN ref TEXT;
CREATE INDEX IF NOT EXISTS idx_course_events_ref ON course_events (ref);
CREATE TABLE IF NOT EXISTS analytics_events (
  ts TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  session TEXT,
  ref TEXT,
  country TEXT,
  ms INTEGER,
  ok INTEGER,
  cold INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_step_once ON analytics_events (day, session, name) WHERE kind = 'step';
CREATE INDEX IF NOT EXISTS idx_analytics_kind_day ON analytics_events (kind, day, name);
