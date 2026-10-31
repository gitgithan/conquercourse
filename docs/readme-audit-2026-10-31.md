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
| Course Agent proved 40 of 40 runs in at most 3 steps | true for photo-in runs; the photo input was dropped 2026-10-31 and the claim is no longer made | `data/eval/cc-126-course-agent/README.md` |
| Muse Wonder found 13 real bugs in 21 claims | true | `docs/hackathon.md` |
| `npm run test:quick`, `test:fast`, deploy scripts | true | `package.json` |
| Deploy policy is preview only | unverified | a team rule in `CLAUDE.md`; `docs/deploy.md` still describes `npm run deploy` as the way to publish |
| Characters: Rookies are Tripo, Muse Image made a reference for Rookie B | unverified | `docs/ASSETS.md` agrees; the README table row "Characters" still lists Muse Spark; a separate branch (`hanqi91/cc-char-muse`) corrects the wording, so it is left alone here to avoid a conflict |
| Community flow wording | unverified | README matches `main`; a branch not yet merged removes the Park screens and changes names (Segment Region, progress steps) |
| `docs/deploy.md` Park section (`?mode=park`) | unverified | still true on `main`; becomes false when the Community simplify branch merges |
| Ten Meta models and services | unverified | the table lists about eight distinct tools; count not reconciled |
| A lane in about a second after the first load | unverified | no timing test found |
| Which courses can be published | unverified | `KEY` allows any `demo/` or `experiments/osm/` course in the server; the in-page "listed" list is being widened to four courses in a branch not yet merged |

## Re-run, 2026-10-31 (later the same day, `main` at `d37e60a6`)
- Method: every row marked unverified above was re-checked against `main`, plus every model and credit claim in the README, `docs/hackathon.md`, `docs/meta-ai-pipelines.md` and SPEC section 7.
- The full call-site list and the credit table are in [docs/model-ledger.md](model-ledger.md).

| Claim | Status | Evidence |
|---|---|---|
| Deploy policy is preview only | fixed | the rule is the product owner's instruction of 2026-10-31; it is not in `CLAUDE.md` (the earlier row said it was); `docs/deploy.md` now says preview only |
| Characters row (README) | fixed | `pipelines/charmaker/providers/route_a.py` calls Muse Image and SAM 3.1 on the Meta API for every character; the row now says so |
| Community flow wording | true | the Community simplify change is on `main` (CC-247); the README names no Park screens, and "Segment Region" is in `src/` |
| `docs/deploy.md` Park section (`?mode=park`) | true | the section says the Park upload screen is gone and the old addresses open Explore |
| Ten Meta models and services | fixed | the hackathon table has ten distinct entries; the README and the hackathon page now list them by name and say Muse Wonder is not counted |
| A lane in about a second after the first load | unverified | no timing test exists; the README now says a cached place takes a second or two and a new place is not timed |
| Which courses can be published | true | `src/share/board-courses.ts` lists four courses; the server accepts a wider key pattern (`KEY` in `functions/api/course-clear.ts`), which is deliberate |
| Race Ghost button | fixed | the button on `main` is "Chase Ghost" (`src/ui/leaderboard.ts`); README corrected |
| SPEC section 7: SAM 3.1 on the Meta API for photos | fixed | player photos use SAM 3 open weights on Modal; SPEC rows rewritten |
| SPEC section 7: Wonder agentic, Fireworks students, Baseten fallback | fixed | Wonder is a code reviewer only; Fireworks has no code; the fallback to the Meta API is not built; SPEC says so |
| `docs/meta-ai-pipelines.md`: checks "not yet called from a screen" | fixed | four server routes call the check; text updated |
| Upload check on real harmful images | unverified | only safe photos and text-only unsafe cases were tested (`data/eval/cc-119-moderation/README.md`) |
| Baseten data terms for player photos | unverified | not recorded anywhere in the repo |
| Whether the character maker is switched on in the preview or live site | unverified | the repo records the code and the secret names, not which secrets are set |

### Older branches
- All of these are obsolete and were left in place: `hanqi91/cc-char-muse`, `hanqi91/cc-208-truth-audit`, `hanqi91/cc-208-truth-audit-2`, `hanqi91/cc-208-readme`, `hanqi91/cc-208-readme-board`, `hanqi91/cc-208-readme-front-door`, `hanqi91/cc-readme-features`, `hanqi91/cc-readme-short`.
- Reason: they are old copies; the README on `main` is the reference (the ledger no longer lists them).

### Also noticed
- `docs/deploy.md` carried abuse-limit numbers (community uploads per day, the designer rate); they were replaced by a pointer to the private notes.
- `CLAUDE.md` does not state the preview-only deploy rule; adding one line there is the product owner's call.
