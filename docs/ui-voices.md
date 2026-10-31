# Voices: who is speaking in the game (CC-243)

- The product owner asked for the main tech and characters to pop, with titles like "Course Agent says" and "Simulator says".
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

## The table
| Title | Colour | Powered by | Speaks when | Where the words live |
|---|---|---|---|---|
| Simulator says | green | our own physics, not an AI | the lane verdict in the editor, the end-of-run report and the fall panel, the coaster and graph verdicts | `src/modes/editor.ts`, `src/ui/run-report.ts`, `src/modes/coaster.ts`, `src/modes/graph-studio.ts`, `src/slice/lane-check-ui.ts` |
| Course Agent says | purple | Muse Spark Open, tested by the Simulator | the propose, test, repair steps (labs, `?agent=1`) | `src/ui/course-agent-trace.ts` |
| Design partner says | orange | Muse Spark Open | the Design partner panel: notes, Fix it, Suggest | `src/modes/editor.ts` |
| Safety check says | red | Muse Spark Open | when you press Share in Community | `src/modes/community-flow.ts` |
| Cutter says | blue | SAM 3 | Make your own, step 3: Segment Region | `src/modes/community-flow.ts` |
| Builder says | gold | SAM 3D Objects | Make your own, step 5: Make them, and the prize screen | `src/modes/community-flow.ts`, `src/ui/prize.ts` |
| Character maker says | pink | Muse Image and SAM 3.1 | the Characters panel | `src/characters/panel.ts` |
| Ghost says | amber | a replay of a real run, not an AI | the ghost line in the end report | `src/ui/ghost.ts` |
| Street photos say | green | Mapillary photos, people masked | the name tag on a live photo strip | `src/ui/place-photos.ts` |
| Pip | orange | Rookie A | the first card in the Characters panel; the crew strip | `src/characters/panel.ts` |
| Juno | violet | Rookie B | the crew strip | `src/characters/panel.ts` |

## Meet the crew
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

## Pictures (1280 x 720; before is `?says=0`)
- [welcome-crew-after](evidence/cc-243-says-welcome-crew-after.jpg)
- [community-crew-after](evidence/cc-243-says-community-crew-after.jpg)
- [report-before](evidence/cc-243-says-report-before.jpg)
- [report-after](evidence/cc-243-says-report-after.jpg)
- [editor-agent-before](evidence/cc-243-says-editor-agent-before.jpg)
- [editor-agent-after](evidence/cc-243-says-editor-agent-after.jpg)
- [editor-partner-after](evidence/cc-243-says-editor-partner-after.jpg)
- [coaster-before](evidence/cc-243-says-coaster-before.jpg)
- [coaster-after](evidence/cc-243-says-coaster-after.jpg)
- [make-segment-before](evidence/cc-243-says-make-segment-before.jpg)
- [make-segment-after](evidence/cc-243-says-make-segment-after.jpg)
- [characters-before](evidence/cc-243-says-characters-before.jpg)
- [characters-after](evidence/cc-243-says-characters-after.jpg)
