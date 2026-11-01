# Player-made content: does the UI cope with too many?

*A review of every feature where players make things, written 2026-11-01 from the code; nothing here was load-tested.*

## So what
- Characters are the weak spot: a character is saved on the server and shown to everyone the moment it is made.
- There is no "keep it private" choice and no Publish step, so one eager player can fill the shared panel.
- Only the daily limits and the shared panel size (24 newest) hold it back today.
- The other makers already have a gate or a page size; they are fine for the demo and need paging later.
- Recommendation: give characters the same two-step shape as challenge courses (make, then Publish) before the site is opened widely.

## Where each thing is kept and who sees it
| Feature | Kept | Who sees it | Gate or friction | What happens with many |
|---|---|---|---|---|
| Characters (character maker) | Server database, by a one-way player code | Everyone, at once | Daily limits per player and per game, safety check on the words, repeat prompts reuse the first | The panel shows the 24 newest; older ones drop out of view |
| Your chosen character | This browser (`cc.character`) | Only you | None needed | One slot |
| Editor world | This browser (`cc.edit`, plus `cc.edit.hist` for undo) | Only you | None | One current world; a new one replaces it |
| Slicer place | Not kept; one place travels to the editor | Only you | None | One at a time; the last place name is remembered |
| Challenge courses | Server | Anyone with the link, in the Community list after another player clears it | Publish button, and a clear by someone else | Listed newest first |
| Ranked board runs | Server | Everyone | Only a run the player published counts, verified by replay | One best time per player |
| Community photo pieces | Server | Everyone once approved | Checker plus approval, size cap (about 340 KB) | The first page lists 60 for photo courses; items are paged with a Next cursor and name search |
| Share links | Server | Whoever has the link | Rate limits (kept in the private notes) | Not listed anywhere |

## Gaps found (all closed on 2026-11-01)
- Characters had no private mode: now a made character is private (only its maker sees it) until Publish.
- The panel had no paging or search: now it has Newest and Most picked, a name search and page buttons.
- Photo courses listed 60 with no paging: now a cursor ("Show older courses").
- No feature told a player how long a thing is kept: a private character says it is kept 30 days without use.

## What was built
- Make: the character is private (status `private`), with "Only you can see this".
- Publish: a button with the line "Everyone will see this and its name", then "Yes, publish".
- Keep time: private 30 days unused; published 14 days unpicked; a Keeper (10 picks) stays.
- Panel: Newest, Most picked, name search, page buttons.
- Limits: the screen shows "N of M left today".
- Photo courses: `GET /api/community?before=<id>` gives the next 60, `next` is the cursor.

## Database
- No schema change: the existing `status` column gets one new value, `private`.
- Live still needs migration 0015 (characters), which needs the product owner's approval.
