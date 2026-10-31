-- CC-108: a run reaches the board only when the player clicks "Publish to Leaderboard".
-- published: 1 for a run the player sent with a tag; every other verified clear is only counted (no tag, no keys).
-- Rows that already had a tag and keys stay on the board.
ALTER TABLE course_clears ADD COLUMN published INTEGER NOT NULL DEFAULT 0;
UPDATE course_clears SET published = 1 WHERE nick != '' AND keys IS NOT NULL;
CREATE INDEX IF NOT EXISTS course_clears_published ON course_clears (published, id);
