# Owner usage page and feature switches

*One private page to see what the paid parts of the game are doing today, and to turn any of them off at once.*

## What it shows
- **Where:** `/admin/` on the site; it is not linked from anywhere and tells search engines to stay away.
- **Today and the last 14 days, per kind of paid call:**
  - Calls made, pieces shared or created, and a rough cost.
  - The cost is an estimate from fixed per-call prices in `functions/_lib/usage.ts`; it is not billing, and the provider pages hold the real numbers.
  - A row turns red when it reaches 70% of its daily limit.
- **One on/off switch per kind of paid call**, with a confirm before it flips.
  - A switch works on the next request; no deploy is needed.
  - A job that already started still finishes; only new starts are refused.
  - A player sees a plain "switched off for now" message.

## How it works
- Counts live in the table `usage_events` and switches in `flags` (`migrations/0016_usage_and_flags.sql`).
- Every paid route reads its switch on each request.
  - If the switch table cannot be read, the route answers "off" (it fails closed).
  - A kind with no row in `flags` is on.
- **The migration needs the owner's yes each time it goes to a live database;** until it is applied, the paid routes of that site stay off.
- Numbers for the daily limits are read from the environment, not from the repo (`ADMIN_CAPS`, a JSON text with one number per kind).

## Set the token (owner runs it)
- Run `! scripts/set-admin-token.sh` in the Claude Code prompt, or `scripts/set-admin-token.sh` in a terminal.
  - It makes a random 48-character token, stores it as the Pages secret `ADMIN_TOKEN` for the preview site, and prints it once.
  - It also saves a copy in `~/.config/ninja/admin.env` (mode 600); read it later with `cat`.
- Deploy once so the running site sees the new secret.
- Open `/admin/`, paste the token when asked; the tab keeps it until it closes.
- With no `ADMIN_TOKEN` and no Access setup, the page and its API answer a plain 404.

## Put Cloudflare Access in front (optional, stronger)
- In the Cloudflare dashboard open Zero Trust (the free plan is enough).
- Add a self-hosted application for the paths `/admin*` and `/api/admin-usage` on the site.
- Add one policy: allow only the owner's email, login by one-time PIN.
- Copy the application's audience tag into the Pages variable `ACCESS_AUD`, and the team name into `ACCESS_TEAM`.
- The API then also accepts the Access header after checking its signature, audience and dates against the team's published keys.
  - The page itself still asks for the token, since the browser page sends the token header.
  - With Access in front, a stranger never reaches the page at all.

## Tests
- `tests/admin-usage.test.ts`: one 503 per switch, usage counted once per call, a broken counter never breaks a request, a many-player simulation, sign-in checks.

## Bot check (Turnstile)
- It guards "Make a character" and "Make a piece from a photo".
- It is off until the two keys are set, so nothing changes by itself.
- Put `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` in `~/.config/ninja/turnstile.env`.
- Run `scripts/set-turnstile-keys.sh`, then `npm run deploy:preview`.
- With the keys set, a missing or wrong check is refused before any paid call.
