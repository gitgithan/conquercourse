# World Editor layout (CC-94)

The editor had about forty buttons on screen at once.
The owner called it scattered and found a button in the Moves pane squeezed into an unreadable sliver.
This note says where each control lives now, and the rule for adding a new one.

## Before and after (visible buttons, nothing open)
- Before: 40 buttons (44 controls) at 1280x720, 1024x640 and 1920x1080; 46 with the Design partner open.
- After: 11 buttons (15 controls); 17 with the Design partner open.
- Top bar: 8 controls (was 6 in the first row plus a second row of 30 add buttons).
- The numbers come from `scripts/editor-layout-check.mjs`; screenshots are in `data/eval/cc-94-editor-ui/before` and `after`.

## Where things live
- Top bar, left to right: Back to the Course, Add piece, Undo and Redo (one joined control), Top plan or 3D view, Moves, Design partner, More (the three dots).
- Add piece menu: the add browser (see below), a featured picture and a grid of picture cards under six sections (Ground, Swing, Contraptions, Real objects, Stacks, Tools).
- More menu: Search actions, Reset to the starter scene, Photo to course (labs).
- Docked card on the picture: Moves (the Design partner no longer shares it).
- Design partner (CC-243): a panel that slides in from the right edge, 340 px wide, from under the top bars to the bottom of the page.
- A slim "Design partner" tab on the right edge, the top-bar button, and the ✕ open and close it; Esc closes it while the cursor is inside it.
- It starts closed; open or closed is remembered in the browser.
- Inside: Suggest Fix, the "Move only the chosen pieces" checkbox, a tall answer area, and a multi-line ask box with Ask pinned at the bottom.
- `scripts/design-partner-panel-check.mjs` checks all of it at 1280x720; pictures: `docs/evidence/cc-243-design-partner-open.jpg` and `-closed.jpg`.
- Right column, top to bottom: the lane and its Play button, machine settings (only while a machine is in the world), the chosen piece's controls.
- The right column scrolls inside itself; the page never scrolls.

## The rules for a new control
- A new "add this" button goes into the Add piece menu under a heading; do not put it on the bar.
- A knob for a machine goes into the machine settings panel.
- A rare action goes into the More menu.
- Every button keeps its id so tests and the command palette find it.
- Buttons are one line; a button that needs a long label goes in a panel, not the bar.

## Command palette
- Press `/` (when not typing) or Ctrl+K to open it.
- Type part of an action's name, use the arrow keys, press Enter.
- It lists every button that exists, including the ones inside closed menus, and shows shortcuts (Ctrl+Z, Ctrl+Y, Del, D).
- Choosing an action in a closed card opens the card first.

## The Moves rows
- Each row has a status dot, the move and what it needs, and a button on the right that never shrinks.
- A green tick means the world has the move, a plus means it is missing and can be added, an arrow means it is built somewhere else.
- The old layout put the button in a 20 pixel column; that was the squeezed pill.

## Checks
- `scripts/editor-layout-check.mjs` opens the editor at three window sizes in nine states (nothing open, Moves, Design partner, Add menu, More menu, a chosen piece, a machine, the palette, running an action from the palette).
- It fails on cards that overlap, cards off the screen, a scrolling page, and button text that is clipped, squeezed or wrapped to more than two lines.
- `scripts/editor-check.mjs` walks the whole editor; `adviceOffered` and `partnerAnswers` are known to fail on the VMs (advice needs a single shift to fix the lane; the design partner needs the Baseten key that only the laptop has).

## Known gaps
- The chosen piece's buttons (delete, scale, crop) stay in the right column; they are not on the 3D picture yet.
- The Courses gallery button (CC-89) is added to the bar by the picker work; the bar has room for one more control at 1024 pixels.

## The add browser (CC-96)
- The Add piece menu is a picture browser: a big featured view on top, section tabs and a search box, and a grid of small picture cards below.
- Pointing at a card, focusing it with the keyboard or tapping it shows that piece in the featured view: its name, what it does and where it came from.
- Pointing at a section tab shows that section's cards; arrow keys move between tabs and between cards; Esc closes the browser.
- A click on a card presses the editor's own add button (hidden in the menu, ids unchanged), so adding, undo and the preview work as before.
- The words for every piece live in `src/slice/piece-info.ts`; the pictures are made by `npm run piece-icons` into `public/assets/pieces/`.
- A test fails when a piece has no words or no picture, and when the words contain a height or a size.
- To add a piece: add its button as before, then add its words to `piece-info.ts` and run `npm run piece-icons -- <id>`.
- The Swing section holds the bar, the lache pair and the rope swing (a post whose top is the rope anchor); only bars hang overhead.
- The dome piece was removed: it was one more low bump.
  An old saved world with a dome gets a block in its place.

## Numbers
- Heights and sizes are gone from buttons, the Moves rows and the plan labels: the simulator says whether a lane clears, not a number on a card.
- The chosen piece's real size, height and lift sit inside a folded "Size and height" section of its panel.

## The person for scale (CC-96)
- A chip in the bottom left corner of the 3D picture shows the person, finds them and hides them.
- The first time someone opens the editor the person is already standing beside the start of the lane.
- The person has a bright ring on the ground and a label that says "You, a person for scale", so they are easy to see from far away.
- "Find the person" moves the camera to them and sends out a growing ring.
- "Hide" removes them; the choice is remembered in the browser (`cc.person`), and a saved world that has the person keeps them.
- Where they stand is `personStart` in `src/slice/person-ref.ts`: a little before the first piece, beside the lane's middle line.
- `scripts/person-check.mjs` walks first visit, find, hide, reload and show again.

## Use my own photo (CC-96)
- The Tools section has an optional "Use my own photo" card; it opens a file picker for a JPEG or PNG.
- The photo is shrunk to a small picture in the browser and sent to `/api/photo-course`, which asks the design partner (Muse Spark through Baseten) for a first layout; nothing is stored.
- The simulator then checks the draft and Fix it repairs it, as in the labs flow of CC-52.
- It needs the `BASETEN_API_KEY` secret on the site; without it the design partner card says "the photo helper is not switched on here".
- Each call is one paid model request from the owner's Baseten credit, and the function allows 6 a minute per address.
- The card asks people not to use photos with people or children in them.
- The "Photo to course (labs)" button in the More menu still shows with `?labs=1`.


## Button levels, the Fix menu, the glossary and Fit (CC-177)
- The full list of buttons, grouped, with when to click each: `docs/editor-buttons.md`.
- Three levels: primary (filled green: Fix, Play this lane), secondary (outlined: Fit, Top plan, Moves, Design partner), quiet (plain: Back, Undo and Redo, Add pieces, ?, more).
- The side-view designer has a green frame, a title tag and more height; it is the editor's shaping tool.
- One Fix menu holds Fix it, Make it easier, Look for routes you did not plan and What should I change?, each with "when" and "what to expect".
- The Fix button shows a red dot when the check says the lane cannot be cleared, and a tick when it can.
- The "What these buttons do" card is open on the first visit; Hide or the ? button toggles it; the choice is in `localStorage` key `cc.editor.glossary` (read and written inside try/catch).
- Fit (key F) frames every piece with a short smooth move; the flat plan jumps to the right zoom.
- Camera: the wheel zooms toward the cursor, right-drag or middle-drag slides the view, left-drag on empty ground turns it.
- The Design partner card now starts closed; open, it covered the right half of the picture and ate the wheel and the drags there.
- `?editorui=old` keeps the CC-94 look; the older check scripts use it.
- Check: `node scripts/editor-ux-check.mjs` (wheel, pan, Fit, Fix menu, glossary memory, old layout); pictures in `data/eval/cc-editor-ux/`.

## The Design partner card, one fixed place (CC-198, CC-199)
- The card is fixed to the bottom right of the window, above the Feedback button.
- It is 292 px wide, so it sits over the right column and not over the 3D picture.
- Its height is capped (`max(220px, 100vh - 470px)`), and the reply inside scrolls on its own.
- Nothing pushes it down, and it sits above the glossary card and the right column.
- Inside, the title and the two repair buttons sit in a header, the reply has its own scroll, and the question box and Ask sit at the bottom.
- Preview rows are a checkbox and a wrapping line, so a long place name wraps and never runs under a button.
- `?editorui=old` brings back the old card.
- Check: `node scripts/partner-shots.mjs` (stills in `data/eval/cc-198-partner/`).

## Toasts (CC-197)
- Every short message in the Course goes through one stack, `src/ui/toast-stack.ts`.
- A new toast is added below the others, and the older ones stay above.
- A toast leaves by moving up and fading out.
- The same words are never shown twice at once, and the stack holds at most four.
- Time is passed in (the Course uses simulation ticks), so a paused game keeps its toasts.
- `?toasts=old` keeps the single centred toast.
- The hint under the gauges and the ghost chip stay where they are: they are standing status, not messages.
- Check: `tests/toast-stack.test.ts` and `node scripts/toast-shot.mjs`.
