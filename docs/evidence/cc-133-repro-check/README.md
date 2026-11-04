# CC-133: README steps checked on a fresh clone

*Checked 2026-11-04 on a fresh `git clone --depth 1` in an empty folder, Node 24, wrangler 4.153.0.*

## So what
- A stranger gets the plain game and the Cloudflare copy running in six commands, about 2 minutes of waiting.
- One doc bug found and fixed: `--d1 DB=conquercourse-feedback` opened a second, empty database ("no such table"); the flag is not needed.
- Photo to 3D, the cut-out finder, the character maker, Mapillary photos and street objects cannot work without the owner's keys; they answer JSON 503 and the page says they are switched off here.

## Steps and times
| Step | Command | Time |
|---|---|---|
| Clone | `git clone --depth 1 https://github.com/gitgithan/conquercourse.git` | 17 s |
| Install | `npm ci` | 12 s |
| Plain dev | `npm run dev -- --port 5481` | ready in under 1 s; headless page loaded with a canvas and no page errors |
| Build | `npm run build` | 42 s |
| Local database | `npx wrangler d1 migrations apply conquercourse-feedback --local` | 20 s, all migrations applied |
| Cloudflare copy | `npx wrangler pages dev dist --port 8788` | ready in about 15 s |

- No `.dev.vars` was needed; no secret of any kind was used.

## Answers from the local Cloudflare copy
| Request | Answer |
|---|---|
| `GET /api/object-lift` | 200 `{"perDay":3,"left":3}` |
| `GET /api/leaderboard?course=demo/a&hash=abc&window=day` | 200 empty board |
| `GET /api/community-items` | 200 `{"items":[],"next":null}` |
| `GET /api/world-stats`, `/api/daily-stats`, `/api/course-stats` | 200 zeros |
| `GET /api/turnstile-key` | 200 `{"siteKey":null}` (check skipped) |
| `POST /api/segment` | 503 `{"error":"off","message":"Suggestions are switched off right now..."}` |
| `POST /api/object-lift` | 503 `{"error":"not allowed"}` (page: "The 3D service is not switched on here.") |
| `POST /api/character` | 503 `{"error":"not configured",...}` |
| `GET /api/features`, `/api/photos` | 503 "not set up here" (need the Mapillary token) |
| `POST /api/submit` (v2 note) | 200 `{"ok":true}`; the row is in the local `feedback` table |

- The Community Make step with a sample photo says "The outline finder is switched off here, so nothing can be found right now."
- Pictures: [the game from the local copy](local-cloudflare-game.png) and [Community with the finder off](local-cloudflare-community-off.png).

## What was wrong
- `docs/deploy.md` told people to add `--d1 DB=conquercourse-feedback`: the database it opened had no tables.
- Fixed: the flag is gone and the doc says why; the `.dev.vars` step is now optional.
- "Feature switches" was the wrong name for `/api/features` (it is Mapillary street objects); reworded in the README and `docs/deploy.md`.
