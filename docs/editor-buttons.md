# World editor: every button, what it does, when to click it (CC-177)

The product owner could not tell when to click what.
This is the full list, grouped by job, with the level each button has now.
Levels: primary is filled green, secondary is outlined, quiet is plain text.
`?editorui=old` brings back the CC-94 look (same buttons, no levels, no Fix menu, no glossary).

## What "slide designer" means here
- The owner wrote "slide designer"; the code calls it the side view (`#profile`, the strip under the 3D picture).
- It is the one place where a bar is dragged up, down, left and right, so it is the editor's shaping tool.
- It now has a green frame, a title tag "SIDE-VIEW DESIGNER · drag a bar" and about 45% of the height (was 33%).

## Top bar, left to right
- Back to the Course (quiet): leaves the editor, back to the course you came from.
  - Click when you are done.
- Fix (primary, with a red dot when the check says "cannot clear", a tick when it clears): opens the Fix menu, see below.
- Fit (secondary, key F): moves the camera so every piece is in view.
  - Click when you are lost or zoomed too far.
- Top plan / 3D view (secondary): flat map for exact placing and cropping, or back to 3D.
- Moves (secondary): which moves the world has and which are missing.
- Design partner (secondary): the helper card, answers in words.
- Undo, Redo (quiet, joined): step back or forward (Ctrl+Z, Ctrl+Y).
- Add pieces (quiet, small): opens the picture browser.
  - Basic shapes, real objects, bars, machines, cup stacks, size references, import a .glb.
- ? (quiet): shows or hides the "What these buttons do" card.
- ... (quiet): Search actions (`/` or Ctrl+K), Reset to the starter scene, labs buttons.

## The Fix menu (one place for every repair)
- Fix it: when the check says the runner cannot clear the course; shows the smallest changes as outlines, nothing moves until Apply.
- Make it easier: when it clears but the hardest press is tight; shows one small change.
- Look for routes you did not plan: when it works and you wonder if an obstacle can be skipped; about a minute; a list with Close it / Keep it.
- What should I change?: when you are not sure what is wrong; the design partner answers in words.
- Each item is a stand-in for the original button (same id, hidden), so tests and the palette keep working.
- Context buttons that appear only when needed stay where they appear: Apply, Apply and try it, Cancel (the preview row), Fix it from here (after a partner change blocks the lane), Close it and Keep it (each route), Make it so (a plank that would snap), Use it (drone and launcher advice).

## On the picture
- Moves card: Add two bars, Start in a trebuchet, What could this be?, Find ways to add the missing moves, Show it.
- Person chip (bottom left): Show a person / Find the person, Hide.
- Piece bar (next to the chosen piece): delete, copy, scale, turn, crop.

## Right column
- Lane: Find the best lane for me, Play this lane (primary), Test from the selected piece.
- Machine settings (only while a machine is in the world): counterweight, ball, band stiffness, drone knobs.
- Chosen piece: sizes, height, role.

## Camera, the two bugs (root causes)
- The wheel did not bring the camera nearer the pieces: it always zoomed toward a fixed look-at point `(9, 0.5, 0)`, not toward the cursor; a piece 40 m away never got closer, and the distance stopped at 1.5 m from that point.
- Fix: zoom toward the point under the cursor, quicker zoom, a nearer minimum (0.6 m), a farther maximum (400 m).
- Panning only worked on the right mouse button, and left-drag on empty ground turns the view; with a plain, same-looking ground texture and fog a slide looks like nothing happened.
- Fix: the middle button also slides, and Fit puts the view back in one click.
- The flat plan also zoomed around its middle; it now zooms toward the cursor and allows 0.5 to 400 pixels per metre (was 2 to 120).

## Add pieces and choosing several (CC-200)
- "+ Add pieces" is now the first button on the bar and is filled green; Fit is a small outlined button.
- Shift + drag on the 3D picture draws a box and chooses every piece inside it.
- On the flat plan a plain drag on empty ground draws the box; Alt + drag or a right or middle drag slides the plan.
- Shift + click adds a piece to the choice, or drops it when it is already chosen.
- A chip at the bottom of the picture says "3 selected" with Delete and Clear.
- The Delete or Backspace key does the same as the Delete button, in one undo step.
- Esc clears the choice.
- Chosen pieces get a green outline in 3D and a thick green edge on the plan.
- `?editorui=old` keeps the one-piece choice.
