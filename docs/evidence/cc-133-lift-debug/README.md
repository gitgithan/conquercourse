# CC-133 lift debug: "The 3D service is not answering" on Segment (2026-11-04)

- `error.jpg`: a headless browser stops at Cloudflare's "Verify you are human" check before any outline job starts, so the Modal path cannot be driven without a person.
- `scripts/lift-debug-park03.mjs` logs every /api answer when a person can pass the check (PAID=1).
- Modal logs for `cc-photo-to-object` show only the two warm-up calls during the attempts, no submit.
- The wording came from a submit answer with no reason in it (a dropped connection or a bare server error), which the page turned into "down".
- Fix: ask again twice (3 s, 6 s) before giving up, wait about 16 s of missed polls instead of 8 s, say "waking up" meanwhile, name the outline finder not the 3D service, and the two routes always answer in JSON.
