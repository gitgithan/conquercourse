# CC-134: an optional three-letter tag in the challenge link

- Serves the Most Viral prize: a friend sees who to beat.
- A box next to "Copy challenge link" takes up to three letters or digits.
- The tag is empty by default.
- The tag goes into the link, the "Beat AMY: 9.36 s" banner and the ghost chip.
- A blocked tag makes no link ("Pick another tag").
- A blocked tag inside a link someone else made is not shown.
- The run in such a link still plays.
- Nothing is stored on a server.
- Checked by `scripts/share-nick-check.mjs` (8 of 8 PASS) and `tests/share-nick.test.ts` (6 tests).
- Screenshots: `report-tag.png`, `banner-tag.png`.
- Known gap: a three-letter tag can still be a made-up real name.
- The box says "Not your real name" in its hint.
