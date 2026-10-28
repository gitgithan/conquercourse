# World editor layout (CC-94)

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
- Add piece menu: every button that puts something into the world, under headings (Basic shapes, Real objects, Overhead bars, Machines, Cup stacks, Size references).
- More menu: Search actions, Reset to the starter scene, Photo to course (labs).
- Docked card on the picture: Moves or Design partner, one at a time (opening one closes the other).
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
