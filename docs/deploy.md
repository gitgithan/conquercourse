# Deploying the game for public feedback

*One always-on address, updated only when the owner decides, with structured feedback stored for later.*

## What it is
- **Hosting:** Cloudflare Pages (free tier, always on, a fixed address like `https://conquercourse.pages.dev`).
- **Updates:** `npm run deploy` publishes the current `main` build to that same address; nothing changes until you run it.
- **Feedback:** a Feedback button on every page asks the questions in `public/feedback-questions.json` and stores the answers in a Cloudflare D1 database through `functions/api/submit.ts`.
- **Privacy:**
  - No names, emails or IP addresses are stored.
  - The form says not to type personal information.
  - Each browser gets a random session id.
  - The build id and a few play counters (falls, clears, Dojo opens) travel with the answers.

## One-time setup (about 10 minutes; needs your Cloudflare login)
1. Make a free Cloudflare account at cloudflare.com (no card needed for the free tier).
2. In this folder run `npx wrangler login`; a browser window opens; approve it.
3. Create the database: `npx wrangler d1 create conquercourse-feedback`; copy the `database_id` it prints into `wrangler.toml`.
4. Create the table: `npx wrangler d1 migrations apply conquercourse-feedback --remote`.
5. First publish: `npm run deploy`; when asked, create the Pages project named `conquercourse` with production branch `main`.
6. Open the address it prints.
  - Send that address to testers.
7. In the Cloudflare dashboard, Pages, `conquercourse`, Settings, Functions, check the D1 binding `DB` points at `conquercourse-feedback` (the `wrangler.toml` already declares it).

## Every update
- `git pull`, then `npm run deploy`.
- Want to try a change privately first: `npm run deploy:preview` gives a separate preview address.

## Collecting and reading feedback
- Change the questions by editing `public/feedback-questions.json` and bumping its `round` (for example `public-2`); deploy.
- Read the results: `node scripts/feedback-summary.mjs`; it writes `docs/feedback/public-<round>-<date>.md` (averages, counts, written answers).
- Raw rows stay in the database; only the summary goes in the repo.
- Turn the summary into a Linear issue the same way as the playtest rounds (CC-30, CC-31, CC-32): numbered items `P1-...`, fix at once, document what cannot be fixed.

## Looking at the feedback database
- The database is a Cloudflare D1 database named `conquercourse-feedback`, in your Cloudflare account; the site writes to it through `functions/api/submit.ts`.
- In the dashboard: Storage and databases, then D1, then `conquercourse-feedback`, then the Explore data tab, then the `feedback` table.
- From the terminal (after `npx wrangler login`):
  - `npm run feedback:rows` prints the newest ten submissions.
  - `npm run feedback` writes a summary of the current round into `docs/feedback/`.
- The binding in `wrangler.toml` must be called `DB` (the function reads `env.DB`); the name Cloudflare suggests in its wizard is not used.
- The "website" field in the form is a trap for bots: it is hidden off the screen, a person never fills it, and a submission that has it filled is dropped silently.

## Community obstacles (CC-37)
- **What it is:** anyone can upload a photo in the Park (`?mode=park`), draw boxes round real obstacles, type their real heights, see the simulator's proof, and share the course.
  - A shared course is stored as `pending` in the same D1 database and shows in the gallery (`?mode=gallery`, or the "Community courses" link on the Course) only after you approve it.
  - The five starter photos are always in the gallery, so it is never empty.
- **One-time setup (once per database):** `npx wrangler d1 migrations apply conquercourse-feedback --remote`, then `npm run deploy`.
- **Checking what people shared:**
  - `npm run community list` shows pending and recent approved courses.
  - `npm run community show 7` saves the photo of course 7 to `test-results/community/` and prints its boxes; look for faces, people and private places.
  - `npm run community approve 7` shows it in the gallery; `npm run community reject 7` hides it for good.
- **Reports:** the Report button on a card hides the course once 3 different sessions have flagged it.
- **Limits:** 3 courses per session per day, a jpeg of at most about 340 KB (the browser shrinks the photo and drops its location data), 12 boxes, and only the Park's kinds of obstacle.
- **Test it locally before deploying:** `npm run build`, then `node scripts/community-check.mjs` (it starts the site with a local database and walks the whole path).

## Before you share the address
- **Licences:** the Park photos are CC0 or CC BY (credits are in `docs/ASSETS.md`); the Rookie models come from Tripo, whose commercial rights depend on your plan (still to confirm in `docs/STATUS.md`); add a Credits line if you want the CC BY names visible.
- **Park mode:** it works offline from saved results; the live photo upload is off, so no key is exposed.
- **Browsers:** WebGPU where available, WebGL 2 otherwise; very old phones may be slow.
- **Cost:** $0 on the free tier (the limits are generous for a feedback round).

## Photo skins (CC-39)
- **What it does:** a course made in the Park paints each box's part of the photo on the front of its obstacle in the game, so a painted wall shows its painting.
  - It is looks only: the obstacle's collision is still its box, and the bot still clears the course.
  - The Park has a "Paint the photo on the obstacles" switch (on by default); the gallery always paints.
- **Check it:** `npm run build`, then `node scripts/community-check.mjs` (it draws a striped "mural", shares it, approves it, plays it and checks the picture was painted).
- **Not yet:** the 3D lift (CC-38) will replace the flat picture with a real 3D object once it is ready.
