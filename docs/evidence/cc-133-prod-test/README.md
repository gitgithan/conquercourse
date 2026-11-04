# CC-133: read-only test of the live site and the preview site (2026-11-04)

## So what
- Nothing is broken for a player on production in the paths tested.
- One thing differs on purpose: street-photo dots in the Slicer are off on production (switch `photodots`, "off on the real site") and on in preview.
  - With `&photodots=1` on production the dots, the live photo panel and `/api/photos` all work (200).
- Not testable headless: the outline finder (`/api/segment`).
  - The page shows a Cloudflare Turnstile box ("Verify you are human"); no request reached `/api/segment`.
  - Marked "not testable headless", not "passed".
- Not tested by choice: paid GPU steps (outline finder, 3D lift, character making), feedback, leaderboard post, community post.
- Worth a look (not blockers):
  - The Fastest runs card is missing during a bot run and on the End screen (it shows when idle, top right).
    - Likely by design for bot runs; not checked with a human run.
  - Preview music: in 2 of 2 runs after a click, `data-music` was `none` on preview and `course` on production.
  - POST-only API routes answer a GET with the home page HTML and status 200 (not 405); harmless, but monitors would read it as healthy.
  - `/api/places?q=shibuya` answers 504 on both sites ("no map server answered"); the lat/lon form answers 200.
    - The Slicer used its ready places, so players did not see it.
  - A "Winner just set ..." chip overlaps the top buttons a little at 1280 px; the site tab bar overlaps the top of the Add pieces panel.

## Method
- Scripts: `scripts/prod-test-api.mjs`, `prod-test-1-course.mjs`, `prod-test-2-dojo-labs.mjs`, `prod-test-3-slicer-editor.mjs`, `prod-test-4-editor-community.mjs` (helpers in `prod-test-lib.mjs`).
- One headless Chromium at a time, 1280x720, SwiftShader; each page logs page errors, console errors, failed requests and 4xx/5xx (see the `*.json` files here).
- Real model call (Ask AI for ideas) made once per site; outline finder never reached.
- Pictures are 60% JPEG of the production run.

## Results
| Check | Production | Preview | Evidence |
|---|---|---|---|
| 1 Home loads | OK, no errors | same | `prod-home.jpg` |
| 1 Training run with `bot=ideal` to the End screen | OK, End screen ("You made it in 34.0 s") in 44-64 s | same (58 s) | `prod-end.jpg` |
| 1 Fastest runs card top right | Shown top right when idle (home and Training); gone during the bot run and on the End screen | same | `prod-home.jpg` |
| 1 Volume icon: click toggles aria-label and aria-pressed; M key | OK (`Sound` button bottom right left of Feedback, plus round music button bottom left; both toggle; M restores) | same | `prod-1-course.json` |
| 2 `?music=1` loads music (200), starts after a click | `course.ogg` 200, `data-music-path=autoplay`, `data-music=course` | `course.ogg` 200, but `data-music=none` after the click (2 of 2 runs) | `*-1-course.json` |
| 2 Stored `cc.music=0` wiped on load | Wiped (null), music started | Wiped (null) | same |
| 3 Dojo lesson and Try It slider | Gap jump loads, Try It shows two sliders; moving speed changes the page | same | `*-2-dojo-labs.json` |
| 3 Labs panel and Posing a character | `labs-open` opens; "How crouched" 0.60 to 0.10, label and picture change | same | `prod-lab-ik.jpg` |
| 3 One more Lab (`lab-search`) | Loads, 5 controls | same | same |
| 4 Slicer gallery, Shibuya, Slice this place | 24 ready places; lane "clearable"; tilt 0 before, 72 deg after the flight (default kept) | same | `*-3-slicer-editor.json` |
| 4 Street-photo dot opens panel | Not shown by default (switch off on the real site); with `&photodots=1`: panel opens, 1024 px photo, `/api/photos` 200 | Dots on; panel opens; `/api/photos` 200 | `prod-slicer-photo.jpg` |
| 4 Send to the World Editor | OK, 67 pieces, lane keys angle/offset/level | OK, 68 pieces | same |
| 5 Editor: Add pieces, Moves, Improve, Top plan | All open; Top plan toggles to "3D view" | same | `prod-editor-addpieces.jpg` |
| 5 Ask AI for ideas (once per site) | `/api/designer` 200, "suggested changes" shown | same | `prod-4-first-ai-run.json` |
| 6 Community Explore | Tabs Explore / Make your own, images load (6/6) | 5/5 images | `*-4-editor-community.json` |
| 6 Make your own, sample photo | Opens; 4 samples; picking one goes to step 2 | same | |
| 6 Outline finder (`/api/segment`) with a drawn box | NOT TESTABLE headless: Turnstile box appears, no request sent | same | `prod-community-segment.jpg` |
| 7 Courses overlay | Opens with stats, course cards (Training, Cannonballs, Two ways, First course, Cannon) | same | `*-1-course.json` |
| 7 Parts, Characters pages | Not covered by the browser scripts; `/api/character` answers 200 on both | same | API table |
| 7 Leaderboard read | Right call: `/api/leaderboard?course=default%2Ffirst&hash=rja576&window=day` is 200 with `{top:[],players:0,...}`; `?recent=1` is 200; bare call 400 `bad course` | same | API table |
| Page errors and failed requests | None from our site; map tiles aborted on navigation; Turnstile frames 401/DNS in headless | same | `*.json` |

Not run: Parts page and Characters page screens (only the API behind Characters was read), Slicer "Send" beyond the editor load, and any POST.

## API GET status (identical results on both sites except data)
| Route | Prod | Preview |
|---|---|---|
| turnstile-key | 200 | 200 |
| leaderboard (bare, or wrong course) | 400 bad course | 400 |
| leaderboard?recent=1 | 200 | 200 |
| course-stats, daily-stats, world-stats | 200 | 200 |
| places?q=shibuya | 504 (map servers did not answer) | 504 |
| places?lat=..&lon=.. | 200 | 200 |
| photos?lat=..&lon=..&r=60 | 200 | 200 |
| features?lat=..&lon=..&r=150 | 200 | 200 |
| community, community?list=1 | 200 (no courses) | 200 |
| community-items | 200 | 200 |
| challenge-course?list=1 / ?id=nope | 200 / 404 | 200 / 404 |
| leaderboard-run?id=nope | 400 bad id | 400 |
| admin-usage | 401 | 401 |
| character | 200 (0 items) | 200 (1+ items) |
| community-image | 404 | 404 |
| object-lift (GET) | 200 `{perDay:3,left:3}` | 200 |
| share/nope | 404 | 404 |
| community-report, course-clear, course-agent, course-event, design-partner, designer, funnel-event, moderate, move-tips, segment, submit | 200 with home-page HTML (POST-only routes) | same |

## Differences, production vs preview
- Street-photo dots: off on production, on in preview (by design).
- Music after click: `data-music` stays `none` on preview in 2 of 2 runs (production `course`); cause not found.
- Data differs: preview has older sample characters, other leaderboard and stats numbers.
- Everything else matched.

## Recommended
- If the owner wants the photo dots live, turn on `photodots` for production (verified working with `&photodots=1`).
- Look at the preview music state (`data-music`) before a deploy to production.
- Make POST-only routes answer GET with 405 so a health check cannot pass on a home page.
- Give `/api/places?q=` a clearer failure or retry; it is 504 on both sites right now.
- A human run is needed to check the Fastest runs card on the End screen and the Turnstile outline finder.
