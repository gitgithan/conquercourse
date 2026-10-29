# CC-136: share a course made in the editor

## So what
- A player who builds a course in the editor can now send a link that carries the course and the run.
- Nothing is stored on a server and the live database is not touched.
- 23 of the 27 demo courses fit in a link; the 4 coaster courses are too big, and the button says so in plain words.

## Choice
- A: the course travels inside the link (built).
- B: a short id with the course stored in D1 (not built).
- Why A first:
  - It needs no server change, so nothing live changes and no one needs to say yes.
  - Links never expire and cannot be lost.
- Why B stays open:
  - Big courses (the coasters) do not fit in a link.
  - B needs a new D1 table, so it needs the product owner's yes first.

## How it stays safe
- The link carries only what the simulator plays (platforms, holds, wall, rope, zones); looks stay home.
- The course is cleaned when the link is made and again when it is opened.
- Cleaning allows known keys only, plain numbers in range, plain short text with no web addresses or tags, and limited depth and length.
- The packed course is limited to 1700 characters and unpacking is capped, so a link cannot blow up the page.
- The simulator must clear the course when the link is made and when it is opened.

## Packed sizes (characters, `tests/share-made.test.ts`)
- Fit: band 277, bench 347, cannon 340, climb 288, drone 267, drop 245, generated 499, lache 356, lanes 384–508, launch 273–296, parks 695–824, planks 303–369, recoil 324, skate 497, stack 463, training 627.
- Too big: coaster-low 2813, coaster-sharp 3667, coaster 3636, coaster-two-hills 5251.

## Evidence
- `opened.png`: a link opened in a fresh page, the made course with the friend's run (9.36 s).
- `refused.png`: a damaged course, refused in plain words.
- `scripts/share-made-check.mjs`: 5 PASS (software GL on VM2).

## Switch
- `?share=0` turns it off.
