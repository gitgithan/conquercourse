# Challenge courses (CC-108)

## The idea
- A ranked board exists only for the four listed courses.
  - A run counts there only when the course is exactly the official one.
  - The check is the course hash.
- Any other course is a challenge course.
  - That means an edited course, a tweaked course, a sliced course or a World Editor course.
  - Its board is small, and it is comparable only within that course.
- Switch: `?challenge=0` hides all of it.

## What the player sees
- After a cleared run on a course that is not the official one, the end card says why.
  - Changed a ranked course: "You changed the course, so this run can't go on the ranked board. Publish it as a challenge course, or play the official course."
  - Any other course: the same idea, without "you changed".
- Two buttons: "Publish as challenge course" and "Play the official course".
- After publishing: "Copy challenge link".
- The old words "This course changed since your run" stay for the one true case, when the official course was updated.

## How tweaked courses from the Courses page are handled
- The player opens a listed course and changes it (the ground with Tab, or any edit).
- The run on the changed course never goes on the ranked board.
- The end card offers to publish the changed course as a challenge course.
- Publishing sends the course and the keys of the run.
  - The page sends no time.
  - The server plays the keys itself on the course it was sent.
- The course is kept only if the server replay clears it.
- Many tiny tweaks of the same course make one entry, because the course is stored once per content hash.
- The player gets a share link (`?cid=<id>`, with the usual short link for the ghost).

## How World Editor courses are handled
- A World Editor course is the same thing: a course JSON and a hash.
- It goes through the same steps, with no special case.
- The player clears it, then publishes it as a challenge course.

## Lifecycle
- Play: the player runs a course that is not the official one.
- Clear: the run reaches the finish.
- Register: the page sends the course and the keys.
  - The server cleans the course and refuses a shape it does not hold.
  - The server replays the keys; no clear, no course.
  - The content hash is looked up; a known course is not stored twice.
- Share: the link `?cid=<id>` opens the course for anyone who has it.
  - The course is not listed anywhere yet.
- Race: another player clears it, and the server replays that run too.
  - The board for the course is `course_clears`, keyed by the course hash.
- Promote: a clear by a different player (never the author) puts the course in the Community list on the Courses screen.
  - The author's own clears never promote.
  - Sending the author's keys again does not count as a play.
- Expire: a course nobody else cleared goes away after about 14 days, with its clears.
  - A promoted course stays.
  - A gone course answers "expired".

## Where it lives
- Table `challenge_courses` (migration 0013): the cleaned course JSON by content hash, the board hash, the author code, the dates.
- Pure rules: `src/share/challenge-course.ts`; the store: `functions/_lib/challenge-db.ts`.
- API: `functions/api/challenge-course.ts` (register, read, list); clears go through `functions/api/course-clear.ts` with the key `challenge/<id>`.
- Page: `src/share/challenge-client.ts`, `src/ui/challenge-card.ts`, the Community section in `src/ui/world-picker.ts`.
- Pages variable `CHALLENGE=off` stops the server side.

## Abuse limits
- Abuse limits: kept in the private notes.

## Checks
- Tests: `tests/challenge-course.test.ts` (replay judge, dedupe, promotion rule, expiry, shape).
- Browser check with the API answered by the script: `scripts/challenge-check.mjs`.
- Pictures: `docs/evidence/cc-108-challenge-*.png`.

## Known gaps
- The same course with its keys in another order is a separate entry.
- A Community course has no ideal time, so it has no "beats ideal" mark.
