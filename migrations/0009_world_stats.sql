-- Applied to the preview database on 2026-11-01 (CC-108). The live database needs the owner's yes; the code works without it.
-- country: the two-letter country Cloudflare reports for the request, so the picker can say "played from 14 countries". No address is kept.
-- fail_at: the id of the zone where a run failed, so the picker can name the hardest obstacle of the week.
ALTER TABLE course_events ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE course_events ADD COLUMN fail_at TEXT NOT NULL DEFAULT '';
