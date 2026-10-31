# README audit, 2026-10-31

- Method: every concrete claim in `README.md` was checked against the code on `main` (commit `47b19cda`).
- Linked docs were checked where they repeat a README claim.
- Status words: true, fixed, unverified.

| Claim | Status | Evidence |
|---|---|---|
| Four features in one top bar | true | `FEATURES` in `src/ui/site-nav.ts` |
| 19 real objects | true | `public/assets/objects/index.json` has 19 objects |
| Pull-up frames 2.2 m and 2.05 m | true | `hang_m` in the object index |
| Ready courses in the editor | fixed | the third preset is "Coaster to a deck", not "Coaster to a bar" (`src/slice/presets.ts`) |
| A tag is three letters | fixed | tags are up to 12 characters (`src/share/nick.ts`); README and `docs/data-model.md` corrected |
| The board shows the ten fastest | fixed | `TOP = 100` in `functions/api/leaderboard.ts`; `docs/challenge.md` corrected |
| Board scrolls through the top 100, `?board=0` hides it | true | `boardOn` in `src/ui/leaderboard.ts` |
| Publish to Leaderboard, View Run, Race Ghost | true | `src/ui/leaderboard.ts`, `src/ui/run-view.ts`; the button is being renamed Chase Ghost in a branch not yet merged |
| Cannonballs and Two ways courses | fixed | added to the Courses list; text matches `src/ui/world-picker.ts` |
| Cannon beat 12 s, slide, climbable wall | fixed | added a primitives row; `src/sim/shots.ts`, `src/sim/slide.ts` |
| Slide key is tap S or down | true | `src/sim/slide.ts`, `src/modes/course.ts` |
| Welcome screen and growth strip | fixed | were missing; `?welcome=0` and `?growth=0` verified in `src/ui/welcome-flags.ts` and `src/ui/growth-strip.ts` |
| Keys B, H, I, K, X | true | `src/modes/course.ts` key handlers |
| Places cache of 30 days | true | `TTL` in `functions/api/places.ts` |
| Course Agent proved 40 of 40 runs in at most 3 steps | true | `data/eval/cc-126-course-agent/README.md` |
| Muse Wonder found 13 real bugs in 21 claims | true | `docs/hackathon.md` |
| `npm run test:quick`, `test:fast`, deploy scripts | true | `package.json` |
| Deploy policy is preview only | unverified | a team rule in `CLAUDE.md`; `docs/deploy.md` still describes `npm run deploy` as the way to publish |
| Characters: Rookies are Tripo, Muse Image made a reference for Rookie B | unverified | `docs/ASSETS.md` agrees; the README table row "Characters" still lists Muse Spark; a separate branch (`hanqi91/cc-char-muse`) corrects the wording, so it is left alone here to avoid a conflict |
| Community flow wording | unverified | README matches `main`; a branch not yet merged removes the Park screens and changes names (Segment Region, progress steps) |
| `docs/deploy.md` Park section (`?mode=park`) | unverified | still true on `main`; becomes false when the Community simplify branch merges |
| Ten Meta models and services | unverified | the table lists about eight distinct tools; count not reconciled |
| A lane in about a second after the first load | unverified | no timing test found |
| Which courses can be published | unverified | `KEY` allows any `demo/` or `experiments/osm/` course in the server; the in-page "listed" list is being widened to four courses in a branch not yet merged |
