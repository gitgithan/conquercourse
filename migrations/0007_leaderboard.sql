-- NOT YET APPLIED to the live database (CC-108): the product owner must say yes first. The code works without it.
-- nick: the optional three-letter tag the player typed, shown on the board. Never a real name; the server checks it again.
-- keys: now kept for every verified clear (0005 kept them only for flagged ones), so a board entry can be played as a ghost.
-- The index serves "the fastest verified runs on this course" without scanning the table.
ALTER TABLE course_clears ADD COLUMN nick TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS course_clears_board ON course_clears (course_key, course_hash, verified, ticks);
