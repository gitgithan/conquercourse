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

## Gaps found
- Characters have no private mode, so "make just to play" quietly publishes; the player is never told.
- A made character is not lost from the browser: it lives on the server, and only its maker can delete it.
- The panel has no paging or search, so old characters cannot be found once 24 newer exist.
- Photo courses list 60 with no paging.
- No feature tells a player how long a thing is kept.

## Recommended shape
- Make: the character appears only for its maker, with the words "Only you can see this".
- Publish: a button, with a one-line check ("Everyone will see this and its name"), the same as challenge courses.
- Keep time: a private character stays for 30 days without use, and the screen says so.
- Panel: show "newest" and "most picked" and add a page button and name search like the community items already have.
- Limits: keep the daily numbers; add a visible "2 of 3 left today" so a refusal is not a surprise.
- Photo courses: add the same cursor paging as items.

## Not done yet
- No code was changed for this; it is the plan.
- The server stores every made character as public today, so the Publish step needs a status column or a new status value, which is a database change for live (needs the product owner's approval).
