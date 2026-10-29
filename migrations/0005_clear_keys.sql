-- NOT YET APPLIED (CC-176): needs the owner's yes. The code works without it.
-- keys: the encoded key log of a verified clear that beat the stored best line (beats_ideal = 1), kept so the ideal-run search can be seeded from it (scripts/export-flagged-logs.ts).
-- Only flagged runs are kept, so the table stays small.
ALTER TABLE course_clears ADD COLUMN keys TEXT;
