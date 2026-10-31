# Deploying the game for public feedback

*One always-on address, updated only when the owner decides, with structured feedback stored for later.*

## What it is
- **Hosting:** Cloudflare Pages (free tier, always on, a fixed address like `https://conquercourse.pages.dev`).
- **Updates (owner rule, 2026-10-31):** deploy to the preview address only (`npm run deploy:preview`); never deploy to production, and never delete previews.
  - `npm run deploy` publishes to production; do not run it unless the product owner says so in that session.
- **Feedback:** a Feedback button on every page asks the questions in `public/feedback-questions.json` and stores the answers in a Cloudflare D1 database through `functions/api/submit.ts`.
- **Privacy:**
  - No names, emails or IP addresses are stored.
  - The form says not to type personal information.
  - Where photos go and what each host keeps: [trust and safety](trust-and-safety.md).
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
- `git pull`, then `npm run deploy:preview` (a separate preview address).
- Production (`npm run deploy`) only on the product owner's explicit word.

## Collecting and reading feedback
- Change the questions by editing `public/feedback-questions.json` and bumping its `round` (for example `public-3`); deploy.
  - Question types: `text`, `scale`, `choice` (one chip) and `multi` (several chips; the answer is stored as the ticked options joined with a comma).
  - The database does not change: answers are JSON text keyed by question id (letters, digits, `_` or `-`, up to 40 characters), so any round fits the existing `feedback` table.
  - Round `public-3` keeps the ids `liked`, `confusing`, `world`, `explore` and `anything_else` from `public-2`, so the summaries can be compared; it adds `tried`, `surprise`, `learned` and `use`.
  - Each submission also records `where` (the mode and course the player was in) in its context.
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
- **What it is:** the gallery shows approved community courses (Explore, `?mode=communities`).
  - The Park upload screen is gone (CC-247): photos now give objects and wallpapers only, and courses come from World Slicing and the Editor.
  - The approval commands below still work on courses already shared.
  - A shared course is stored as `pending` in the same D1 database and shows in the gallery (`?mode=gallery`, or the "Community courses" link on the Course) only after you approve it.
  - The five starter photos are always in the gallery, so it is never empty.
- **One-time setup (once per database):** `npx wrangler d1 migrations apply conquercourse-feedback --remote`, then `npm run deploy:preview`.
- **Checking what people shared:**
  - `npm run community list` shows pending and recent approved courses.
  - `npm run community show 7` saves the photo of course 7 to `test-results/community/` and prints its boxes; look for faces, people and private places.
  - `npm run community approve 7` shows it in the gallery; `npm run community reject 7` hides it for good.
- **Reports:** the Report button on a card hides the course once 3 different sessions have flagged it.
- **Limits:** the photo is shrunk in the browser and its location data dropped; the numeric limits are in the private notes.

## Shared pieces and wallpapers (CC-247)
- **What it is:** players press Share in Community on a finished piece or wallpaper; it is stored in the D1 table `community_items` (`migrations/0014_community_items.sql`).
- **One-time setup per database:** run the file with `wrangler d1 execute <database> --remote --file migrations/0014_community_items.sql`; the preview database already has it, the live one does not (needs the product owner's yes).
- **Who sees it:** if the safety check (the same Baseten key as the upload check) says all clear, everyone; if it is unsure or the key is missing, only the player who shared it, until you approve it.
- **Review:** `node scripts/community-review.mjs items` lists them; `item-approve ID` shows one to everyone; `item-remove ID` takes it down and empties its files; add `DB=conquercourse-preview` to work on the preview database.
- **Delete by the player:** only the owner's browser code can; see the picture in `docs/community-flow-guide.md`.

## Before you share the address
- **Licences:** the Park photos are CC0 or CC BY (credits are in `docs/ASSETS.md`); the Rookie models come from Tripo, whose commercial rights depend on your plan (still to confirm in `docs/STATUS.md`); add a Credits line if you want the CC BY names visible.
- **Browsers:** WebGPU where available, WebGL 2 otherwise; very old phones may be slow.
- **Cost:** $0 on the free tier (the limits are generous for a feedback round).

## Course-design partner (Muse Spark Open on Baseten)
- **What it is:** `functions/api/designer.ts` answers the editor's design helper; the key never reaches the page.
- **Before deploy (the product owner runs this once):** `npx wrangler pages secret put BASETEN_API_KEY` and paste the hackathon key when asked; without it the function answers 503 and the editor hides the helper.
- **Locally:** `npm run dev` serves `/api/designer` by reading `BASETEN_API_KEY` from `~/.config/ninja/baseten.env` on the server side only (skipped silently if the file is absent).
- **Cost (all live Muse Spark Open features, paid from the Baseten credit; the full table is in [docs/model-ledger.md](model-ledger.md)):** about $1.25 per million input and $4.25 per million output tokens; one answer is about 1,000 to 1,500 tokens (it reasons first), so well under 1 cent; a light per-address limit guards the rest (numbers in the private notes).
