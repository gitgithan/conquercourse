# Film B: the cohesive Twitter story (CC-209)

Serves the Demo score and the Most Viral bonus: a 57.6 s film and a 15 s cut for Twitter.
Every shot is a capture of the real game or a real page, on the stepped clock; nothing is screen-recorded and nothing is faked.
The film files live outside git (`../conquercourse-assets/films/b/`, with `SHA256SUMS`).

## The story
- A real run in slow motion, then a hail of fast moves, then "where does this course come from?".
- The answer: pick a real place (World Slicer), fix the lane (World Editor), play real courses (Community), then see a course turn from side view into first person.
- Then a burst of every obstacle, a Dojo lesson, a Lab, the group photo, and the logo with "Train slow. Run fast."

## Shot list (30 fps, 1280x720, bars of 2.4 s on the music, beats of 0.6 s)
- 0.0 s: hook, a real run in slow motion (the camera follows; caption "A real run. In slow motion.").
- 4.8 s: hail, 0.6 to 1.2 s per move: vault, drop, band, launch, rope, cannon-ball, coaster, drone, wall, hang, trampoline.
- 14.4 s: World Slicer, a map flight from Europe to a real place, then the circle and the buildings rising.
- 16.8 s: World Editor, the "Fix" button and the Design partner reply.
- 18.6 s: Community, browsing the starter courses.
- 21.6 s: Courses, the camera swings from side view into first person.
- 24.6 s: obstacle burst: coaster, vault, drone, wall, launch, hang, rope, trampoline.
- 40.8 s: Dojo, the Gap jump lesson.
- 42.6 s: Posing a character, dragging the bar and watching the arm follow.
- 45.6 s: group photo, the Rookie and eight characters facing the camera.
- 50.4 s: logo card dissolves in on a quiet bar of the music; it holds to 57.6 s.
- The music is the existing score, cut in at 19.33 s of the track; nothing was generated, so the cost is zero.

## Smoothness (the automatic test, `scripts/film-b-smooth.mjs`)
- Every game clip: constant frame rate, no repeated frames, no spikes (largest frame-to-frame jump ratio 2.5).
- The final: constant frame rate; 16 repeated frames in 6 runs of at most 6 frames; 7 jumps that are real page changes (a click in the Slicer, panels opening in the Editor, a Dojo step); the group photo and logo holds are meant to be still and are excluded.
- The 15 s cut: constant frame rate, 0 repeated frames outside the still end card, 3 small jumps at hard cuts.
- Page captures save a picture only when the page changed, so waits for map tiles or data never become repeated frames.

## How to make it again
- Game shots: `node scripts/film-b.mjs scripts/film-b/specs/real1.json --out films/raw` (one clock step and one screenshot per frame).
- Page shots: `node scripts/film-b-ui.mjs scripts/film-b/scenarios/slicer.mjs --out films/ui` (same rule; the page is given time to finish loading before each picture).
- Timeline: `node scripts/film-b/make-timeline.mjs tl.json tl-short.json`, then `node scripts/film-b-assemble.mjs tl.json out.mp4`.
- Check: `node scripts/film-b-smooth.mjs out.mp4 --static=48-57.6 --cuts=4.8,6.0`.
- Software GPU makes game shots take 3 to 6 s per frame, so run them on a spare machine.

## Evidence
- `docs/film-b/contact-sheet.jpg`: one picture per bar of the final.
- `docs/film-b/still-hook.jpg`, `still-slicer.jpg`, `still-group.jpg`.

## Known gaps
- The climb is not in the hail: the climber hides behind the wall from the side camera.
- The Dojo clip starts with a short pause (5 repeated frames) while the lesson step opens.
- The rotation clip begins with a short ease-in hold (6 repeated frames).
