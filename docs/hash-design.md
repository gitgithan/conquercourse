# Designing a fingerprint (hash) so it never wipes work
- A fingerprint is a short code made from a file.
- Boards, clears and shared run links are filed under the course's fingerprint.
- When the fingerprint changes, everything filed under the old one is still stored, but nobody can reach it.

## The rule
- A fingerprint covers only what changes how the thing plays.
- It never covers what we measured about the thing afterwards.
- Ask one question about each field: "if this changes and nothing else does, would an old recorded run play out differently?"
  - Yes: it belongs in the fingerprint (the ground, the obstacles, the rules, the start and finish).
  - No: it stays out (the stored plan, the windows, the routes, the shortcuts, notes, names and stats).

## What went wrong (CC-224, 2026-11-02)
- The stored `windows` (how wide the good-press zone is at each take-off) were added to the course file.
- `courseHash()` in `src/sim/replay.ts` hashed the whole file except a short list of fields, so `windows` counted by accident.
- Re-measuring the windows changed the fingerprint of 8 courses, which would have emptied their boards and broken their old share links.
- The cause was the style of the code: a list of fields to leave out.
  - A new field counts by default.
  - Someone has to remember to add it to the list.

## How to build it better
- **Leave-in beats leave-out.** Hash a named list of the fields that matter, not "everything except".
  - A new field then changes nothing until someone decides it should.
- **Test the boundary both ways.**
  - Each measured field changes nothing (`tests/replay.test.ts`).
  - A world field (finish line, ground) changes the fingerprint.
- **Golden file.** `tests/golden/course-hashes.json` holds every shipped course's fingerprint.
  - A diff in it is a decision: say in the pull request why each course moved.
  - Regenerate it by deleting the file and running `UPDATE_GOLDEN=1 npx vitest run tests/course-schema.test.ts`.
- **Golden trace.** `tests/golden/sim-trace.json` holds a hash of the world after every tick for plans and seeded key mashes.
  - It is a play fingerprint, not a course fingerprint: it moves when the physics arithmetic moves, the course hashes do not.
  - Regenerate it by deleting the file and running `UPDATE_GOLDEN=1 npx vitest run tests/sim-trace.test.ts`; list which entries moved in the pull request.
  - It is exact on Node 22 and Node 24 (the sim uses no `**` or `Math.pow`; `tests/sim-no-pow.test.ts` guards that); workerd differs where a tick uses sin, cos, tan or exp.
- **Version the recipe.** If the fingerprint recipe must change, change it on purpose, once, and list which boards move.
- **Plan the clean-up before the change.**
  - Count the rows under the old fingerprints first (read-only).
  - Check that no old fingerprint is a fingerprint the change brings back.
  - Only then delete; a delete cannot be undone.

## What to do when a course must change
- Gameplay change (geometry, rules): a new fingerprint is right; the old board belonged to a different course.
- Measurement change (plan, windows, routes, shortcuts): the fingerprint must not move.
