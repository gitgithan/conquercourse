# Janitor queue (2026-10-29)

Order: tests first (everything else is checked with them), then failures on main, then gaps from reports.
Skipped on purpose: work other agents own now (Courses gallery, editor UI cleanup and `scripts/editor-check.mjs`, lane and slicer work, Mapillary photos) and anything that needs the owner.

## Done
- CC-95: `test:fast`, `test:slow`, `test:changed`, slowest-10 report (full suite 317 s, fast tier 68 s on VM3).

## Queue
1. **Park rail run does not clear** (`scripts/make-real-demos.ts` says "DOES NOT CLEAR"; the stored plan lands hard at x = 20.0 with no roll).
   - Why first: it is the demo the welcome chooser opens on, and it fails `tests/roll-window.test.ts`.
   - Cause so far: the stored plan jumps from x = 11.45 over the middle deck and lands on the edge at 20.0 with impact 6.7 and no roll; the search no longer finds any clearing plan (the roll window, vault or climb changes landed after the course was built).
   - Next: find which platform needs which move, change the layout in `make-real-demos.ts` so a vault or jump clears, regenerate, `npm run plans` for that file.
2. `tests/easier.test.ts` "says so when the lane cannot be cleared at all" fails (CC-80); check the new tick budgets of CC-69.
3. `scripts/drums-check.mjs` reports the stock drum lane as off.
4. `scripts/slicer-check.mjs` fails `someHeightIsClearable` on main (lane/slicer agent owns the slicer; hand over the finding, do not edit).
5. `tests/fixbars.test.ts` has one failing test in the slow tier under load (103 s file); give it its own budget or split.
6. Generator lache gap at least 8.5 m so the bars are needed (CC-47, from CC-71: 11 of 11 generated lache courses are skippable by a plain jump).
7. Muzzle blast sound for the cannon (`src/ui/audio.ts`).
8. Climb over a steep curved top (Montmartre hills lane stays 8.7 m).
9. Trebuchet in the shortcut finder (CC-71 gap).
10. Plank-walking pose and falling-plank animation (CC-82 gap).

## Needs owner (not started)
- Easy mode (auto-grab, arrows only): needs a yes.
- Tripo half of the bake-off: about 660 credits (about $6.60) or credits from the collaboration programme.
- Replay checks for CC-44/47/48/56/58/60/61/62/66/67/68/76/77/82 (hands-on, not a bug).
- Open Linear issue DoD boxes: the Linear list call returned the descriptions cut short, so the unticked boxes of the 55 In Progress issues are not in this queue; most of them are "owner replay" boxes.
