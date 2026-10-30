-- CC-108: one best time per player on a board. player is a one-way code of the browser's random session id (see functions/_lib/player.ts); nothing else about the player is kept.
ALTER TABLE course_clears ADD COLUMN player TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS course_clears_player ON course_clears (course_key, course_hash, player, ticks);
