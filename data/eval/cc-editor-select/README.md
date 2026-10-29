# CC-200: Add pieces first, and choosing several pieces

## So what
- The builder now sees "+ Add pieces" first on the bar, and can clear or move a group of objects with one gesture instead of one click each.
- Shift + drag draws the box on the 3D picture, because a plain drag turns the view.
- On the flat plan a plain drag on empty ground draws the box.

## Evidence (1280 px, VM, scripted)
- `marquee-in-progress.png`: the dashed box while dragging.
- `selected-chip.png`: "3 selected" with Delete and Clear, green outlines on the three pieces.
- `plan-selected.png`: the same on the flat plan.
- `add-menu-open.png`: the Add pieces menu open from the new place.
- `node scripts/editor-select-check.mjs` passes 18 checks with no page errors.
- `npx vitest run tests/selection.test.ts` passes 8 tests.

## Known gaps
- Chosen pieces do not move together; dragging still moves the one under the mouse.
- The side view does not outline the chosen group.
- The box picks a piece when its centre is inside it (3D) or when its edge touches it (plan).
