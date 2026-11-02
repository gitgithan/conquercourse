# Status: where the build stands, and what to do next

*Kept current by whoever works; a new session reads `CLAUDE.md` first, then this.*
*Last rewritten 2026-11-02; the older marathon logs are in the git history.*

## Where we are (2026-11-02)
- The hackathon runs 2026-10-26 to 2026-11-04 (9 PM ET); judging is Nov 4 to 8.
- The game is live at `https://conquercourse.pages.dev/`; the preview site is `https://preview.conquercourse.pages.dev`.
- Playable on `main`:
  - The Course (play, replay, share a run, leaderboard).
  - The Dojo (lessons with knobs, predict and test).
  - The World Slicer (a real place becomes a lane).
  - The World Editor (pieces to a proved course, Fix it, the design partner).
  - Community (photo to object, characters and pieces players share).
  - The Labs (equations allowed there only).
  - The owner-only admin page (usage, analytics, moderation).
- Tests: `npm run test:quick` is green (236 files, 2,362 tests at the last full run).

## Deploys
- Default: preview only (`npm run deploy:preview`); production only when the product owner says so.
- Not on production yet (preview only):
  - The admin analytics table with the Landed column.
  - The two Two ways and Cannonballs course changes.
  - The Tripo stub removal.
  - The course fingerprint that ignores `windows` (`docs/hash-design.md`).
- Production database changes need the product owner's approval each time.

## Open work (details are in Linear)
- Films: draft cuts exist; start and end cards to confirm; chosen MusicGen clips need `docs/ASSETS.md` rows ("swap before a sale", they are CC BY-NC).
- Before the repo goes public: GitHub secret scanning and push protection check; `node scripts/check-personal.mjs`.
- Leaderboard rows under old course fingerprints were cleaned on 2026-11-02; six fingerprints came back into use afterwards (see `docs/lessons.md`).
- Optional after the deadline: split `src/modes/course.ts` and `src/modes/editor.ts` (`docs/refactor-review.md`).

## Waiting on the product owner
- A real character run on each site to confirm the Meta key in the Modal job (`docs/model-ledger.md`).
- Confirm Tripo's commercial rights for the two Rookies.
- Say when to deploy the items above to production.

## Machines and access
- **Laptop:** main work and the dev server (`http://localhost:5173`); at most one browser test run at a time.
- **Cloud machines (Vultr VMs, a Codespace, Modal GPUs):** extra compute for long tests, renders and model jobs; addresses and keys are kept outside the repo (`docs/dev-setup.md`).
- **Linear:** team ConquerCourse (`CC`), project `conquercourse`; the issue limit is nearly reached, so extend existing issues.
- **GitHub:** `gitgithan/conquercourse`, private until reviewed for secrets and names, public before submission.
