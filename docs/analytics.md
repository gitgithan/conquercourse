# Analytics (CC-108)

## What this is for
- It answers three plain questions.
- Where did a visit come from?
- How far did visitors get?
- How long did a rented service make a player wait?

## What is recorded
- A short source tag for each visit, such as `reddit`, `linkedin` or `x`.
- The tag comes from `?ref=` in the link, or else from the site that sent the visit (one word, taken from its host only).
- A browser run by a robot is tagged `test`.
- Funnel steps: landed, start_run, cleared, used_slicer, used_editor, used_dojo, used_lab, shared_piece.
- One row per anonymous browser code, step and day.
- For each call to a rented service (outline finder, object lift, character maker, safety check): how long it took, whether it worked, and whether the machine was cold.
- Cold means no call to that service in the last 10 minutes.
- The time is for the call the website makes, so a job that is checked again later is not counted again.

## What is not recorded
- No name, email, address or full link.
- No photo, prompt or id of any job.
- No page text and no clicks inside a page.

## Where it is stored
- Column `ref` on `course_events` and one table, `analytics_events`, from `migrations/0019_analytics.sql`.
- Until the owner applies that file, every part skips quietly and the game works as before.

## The switch
- The flag `analytics` in the `flags` table turns recording off for everyone.
- A missing row means on.
- `?analytics=0` turns the page side off for one visit.

## How to read it
- Open the owner-only usage page and press "Show visits, funnel and waits".
- Sources: visitors, runs started and clears for each tag, last 14 days.
- Funnel: how many visitor-days reached each step, and from which tag.
- Waits: median and 90th percentile for each service, cold and warm apart.
- Automated runs are in the `test` row, so they never mix with real players.

## How to tag a link
- Add `?ref=` and a short word to the link, one word per post.
- Reddit post: `https://conquercourse.pages.dev/?ref=reddit-gamedev`
- LinkedIn post: `https://conquercourse.pages.dev/?ref=linkedin-launch`
- Apps and short links often hide the sender, so a tag is more reliable than the referrer.
- Use a new tag for each post to compare posts.
