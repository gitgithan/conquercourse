# Voices: who is speaking in the game (CC-243)

- The product owner asked for the main tech and characters to pop, with titles like "Simulator".
- One small badge sits above each message the main tech makes: an icon disc, the title, and a "powered by" line.
- The code is `src/ui/says.ts`; the table of voices is `VOICES` in that file and the test `tests/says.test.ts` checks it.
- Turn all badges and the crew strip off with `?says=0`; the messages stay as they were (default on).

## The rules
- A badge names a speaker; the words under it are the short facts and hints that were already there.
- Nothing under a badge shows a formula, grades a person or coaches technique (`BANNED_IN_COPY` in the test).
- A badge appears in pauses, reports, panels and toasts; never over the track while the Course runs.
- The "powered by" line names a Meta model only where the code calls it (see [model-ledger.md](model-ledger.md)); a star marks those lines.
- Where there is no model, the line says so: the Simulator is our own physics, the Ghost is a replay.
- Motion: a short slide-in; it is off when the browser asks for reduced motion.

## Where the Simulator speaks (changed 2026-11-01)
- The first pass put the Simulator badge on the end report and the verdicts.
- The product owner said the Simulator shows up most while a person edits, in the World Editor and the World Slicer, not on the report card.
- Now a "Simulator" strip sits first in the side panel of both screens, always in view (it sticks to the top while the panel scrolls).
- It speaks in the first person and follows the lane check as the lane changes.
- Editor states: waiting, checking (a ghost runs your lane), can clear (with the counts that were already in the verdict), cannot clear, not checked (Stopped, Timed out, could not finish).
- Slicer states: the same five, driven by the live lane read as the cut height or the line changes.
- A state is never colour alone: each has its own icon and its own word (Waiting, Checking, Can clear, Cannot clear, Not checked).
- The strip says "Not an AI: the real game physics, the same every time."
- The end-report badge stays, now smaller (`says-small`).
- The strip is never over the track: the Course does not mount it (the test checks that `course.ts` and `main.ts` do not use it).
- `?says=0` removes it; the older verdict lines stay.

## Not covered yet (honest list)
- The ideal time ("I can clear this in 4.6 s"): the lane check returns a plan and windows, not a finish time, so the strip does not say one.
- How far a runner falls short ("0.3 m short"): the check says only clear or not clear, so the strip does not invent a number.
- Fix it results, the "cannot clear this gap" hint and the squeeze-to-fit result stay under the Design partner or in their own lines; they are partner words backed by a Simulator proof.
- The piece-info lines are static catalogue text, not a live check, so they carry no Simulator badge.

## The table
| Title | Colour | Powered by | Speaks when | Screens | Where the words live |
|---|---|---|---|---|---|
| Simulator (live) | green, blue, red, gold by state | our own physics, not an AI | the World Editor and the World Slicer: a strip at the top of the side panel that follows the lane check as you edit or drag the line | World Editor, World Slicer, Course, Coaster builder, End report | `src/ui/sim-says.ts`, `src/modes/editor.ts`, `src/modes/map.ts` |
| Simulator (small) | green | our own physics, not an AI | the end-of-run report and the fall panel, the coaster and graph verdicts | End report, Coaster builder, Course | `src/ui/run-report.ts`, `src/modes/coaster.ts`, `src/modes/graph-studio.ts`, `src/slice/lane-check-ui.ts` |
| Design partner | orange | Muse Spark Open | the Design partner panel: notes, Fix it, Suggest | World Editor | `src/modes/editor.ts` |
| Safety check | red | Muse Spark Open | when you press Share in Community | Make your own | `src/modes/community-flow.ts` |
| Cutter | blue | SAM 3 | Make your own, step 3: Segment Objects | Make your own | `src/modes/community-flow.ts` |
| Builder | gold | SAM 3D Objects | Make your own, step 5: Make them, and the prize screen | Make your own | `src/modes/community-flow.ts`, `src/ui/prize.ts` |
| Character maker | pink | Muse Image, SAM 3.1 and SAM 3D Objects | the Characters panel | Characters | `src/characters/panel.ts` |
| Ghost | amber | a replay of a real run, not an AI | the ghost line in the end report | End report | `src/ui/ghost.ts` |
| Street photos say | green | Mapillary photos, people masked | the name tag on a live photo strip | Course, World Slicer | `src/ui/place-photos.ts` |
| Pip | orange | Rookie A | the first card in the Characters panel; the crew strip | Course, Characters | `src/characters/panel.ts` |
| Juno | violet | Rookie B | the crew strip | Course | `src/characters/panel.ts` |

## Meet the crew
- Each card has a column of small icons down its right side: one per game screen where that guy speaks.
- A legend at the top (the cards scroll under it in the dialog, so it is always in view) names every icon.
- The icons differ in shape, carry a tooltip and an aria-label, and never rely on colour alone.
- The map is `VOICE_SCREENS` in `src/ui/says.ts`; the table above uses the same screen names and the test checks they agree.
- Screens: World Editor, World Slicer, Course, Coaster builder, End report, Make your own, Characters.
- Explore and the Dojo are not icons: the crew strip itself lives on Explore, and no voice has a badge in the Dojo.
- Clicking outside the dialog closes it, like Esc and Close.
- The welcome page has a "Meet the crew" button (top right) that opens the strip in a dialog.
- The Community page, Explore tab, has the same strip as its last section.
- One card per voice: the badge, a one-line job, and the powered-by line.
- The Rookies are named Pip and Juno (plain names, no real people).

## What is not badged on purpose
- The Ghost chip and the gap line during a run: they sit over the track, so they stay as they were.
- The refusal messages for daily limits: they are the site talking, not the safety check.
- Cannon and trebuchet hints during a run: they are on the track.

## Checks
- `npx vitest run tests/says.test.ts` checks the table, the model names against the ledger, the copy rules, the files and the doc.
- `node scripts/says-check.mjs` takes a before (`?says=0`) and an after picture of each screen at 1280 x 720 and checks the badge.

## Pictures for the live strip (1280 x 720)
- [editor-before](evidence/cc-243-sim-says/editor-before.jpg)
- [editor-after](evidence/cc-243-sim-says/editor-after.jpg)
- [slicer-before](evidence/cc-243-sim-says/slicer-before.jpg)
- [slicer-after](evidence/cc-243-sim-says/slicer-after.jpg)

## Pictures (1280 x 720; before is `?says=0`)
- [welcome-crew-after](evidence/cc-243-says-welcome-crew-after.jpg)
- [community-crew-after](evidence/cc-243-says-community-crew-after.jpg)
- [report-before](evidence/cc-243-says-report-before.jpg)
- [report-after](evidence/cc-243-says-report-after.jpg)
- [editor-partner-after](evidence/cc-243-says-editor-partner-after.jpg)
- [coaster-before](evidence/cc-243-says-coaster-before.jpg)
- [coaster-after](evidence/cc-243-says-coaster-after.jpg)
- [make-segment-before](evidence/cc-243-says-make-segment-before.jpg)
- [make-segment-after](evidence/cc-243-says-make-segment-after.jpg)
- [characters-before](evidence/cc-243-says-characters-before.jpg)
- [characters-after](evidence/cc-243-says-characters-after.jpg)
- The Course Agent had a badge in the first version; its photo input was cut from the scope (50a9cf7d), so its voice is gone from the table.

## Pictures for the crew icons and click-outside (1280 x 720)
- [crew-icons](evidence/cc-243-crew-icons/crew-icons-1280.png)
- [characters-open](evidence/cc-243-crew-icons/characters-open-1280.png)
- [characters-closed-by-click-outside](evidence/cc-243-crew-icons/characters-closed-1280.png)
- `node scripts/crew-icons-check.mjs` takes them and checks that a click outside closes the dialog and the picker, that a drag from inside does not, and that Esc still works.
