-- NOT YET APPLIED (CC-174): the product owner must say yes first. The code works without it.
-- verified: 1 = the server played the keys and saw the finish (every old row); 0 = kept without a replay (the replay was cut or skipped).
-- beats_ideal: 1 = faster than the stored best line by more than the margin; for a human to look at. It may count as a record only once verified = 1.
-- Undo: the two columns cannot be dropped cheaply on D1; leave them, or rebuild the table.
ALTER TABLE course_clears ADD COLUMN verified INTEGER NOT NULL DEFAULT 1;
ALTER TABLE course_clears ADD COLUMN beats_ideal INTEGER NOT NULL DEFAULT 0;
