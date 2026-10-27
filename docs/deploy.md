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

## Before you share the address
- **Licences:** the Park photos are CC0 or CC BY (credits are in `docs/ASSETS.md`); the Rookie models come from Tripo, whose commercial rights depend on your plan (still to confirm in `docs/STATUS.md`); add a Credits line if you want the CC BY names visible.
- **Park mode:** it works offline from saved results; the live photo upload is off, so no key is exposed.
- **Browsers:** WebGPU where available, WebGL 2 otherwise; very old phones may be slow.
- **Cost:** $0 on the free tier (the limits are generous for a feedback round).
