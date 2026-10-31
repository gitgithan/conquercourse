# Communities
- Serves the player who wants to put their own place into the game, and the demo beat "real world to browser".
- The page is called Communities; the tab in the top bar is called Community.
- Open it with `?mode=communities`.

## What a person can make
- **Wallpaper:** the photo hangs behind the lane like scenery.
  - It is for looks only: the course plays the same.
- **3D object:** one picked thing becomes a solid piece for the World Editor.
  - It uses the photo-to-object lift (CC-221) and is saved in the browser as "Mine: name".

## The four steps
- **Photo:** pick a photo; people in it are blurred and the photo is not kept on our side.
- **Pick:** click a suggested outline, or draw boxes by hand; a person never has to label anything.
  - Suggested outlines come from a server job (CC-248); until it is on, the page says so and the boxes are drawn by hand.
- **Choose:** two cards, each with a picture of what it would look like on a course.
- **Make:** give it a name and press the button.

## Keys on the picked boxes
- Ctrl+C copies, Ctrl+V pastes a copy a little to the side, Delete removes, Ctrl+Z undoes, Ctrl+A picks all.
- Arrow keys nudge a box; Shift makes the nudge bigger.
- The logic is in `src/ui/regions.ts` and is tested in `tests/regions.test.ts`.

## The top bar
- Courses, World Editor, World Slicer, Community: the same names on every page, with the current one marked.
- It is not drawn in films, bot runs, demos or with `?nav=0`.
- The Debug (B) button is gone from the screen; the B key still works.

## Known gaps
- Suggested outlines need the server job (CC-248).
- A saved wallpaper shows behind a course when the address has `?wallpaper=<id>` (CC-249, first piece, in the new flow only).
- Sharing with other players waits for the safety check and approval flow (CC-249).

## Suggested outlines (CC-248)
- After a photo is chosen, the page asks `/api/segment` for things worth picking.
- The server runs SAM 3 on a copy with people blurred, and sends back up to 12 outlines with a name each.
- Outlines show on the photo in blue; a click picks one, and a click on empty photo picks none.
- Drawing a box by hand still works at any time, and it is the fallback when suggestions are switched off.
- The route answers "switched off" until the Modal app and its two web addresses are set on the site.
- Tests: `tests/segment.test.ts` and `scripts/communities-check.mjs` (the suggestion is faked there).

## The new flow
- `?flow=1` opens one screen with a stepper: Photo, Mark, Segment, Choose, Make.
- See `docs/community-flow-guide.md`.
