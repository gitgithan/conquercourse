# The three Twitter films: ideas and shot lists

*How each film is built, what happens in each stretch of seconds, and how to ask for a mix.*

## How every film is made
- Each film is a list of short shots joined in order on the beats of one music bed.
- A shot is the real game or a real page, captured by stepping the game clock one frame at a time, never screen-recorded.
- So any shot can be named, dropped, reordered or replaced without touching the others.
- Software graphics are slow, so shots are captured on a spare machine (about 4 s a frame); the stepped clock keeps the speed true.
- Neither the laptop nor our Vultr machines have a real graphics card, so re-capturing there looks the same, only faster or slower to make.

## Film A: the owner's sample script (72 s, plus a 15 s cut)
- Idea: follow the sample script, from the Earth to a run that dims to the logo, then fast toys and the group photo.
- 0 to 4.8 s: Earth globe to a real street (filming-only globe setting).
- 4.8 to 12 s: slice a real place, radius, deselect, horizontal cut.
- 12 to 19.2 s: World Editor, add and move pieces, Design partner.
- 19.2 to 31.2 s: Training course dive, side view, first-person view.
- 31.2 to 36 s: Dojo lesson, then a Lab.
- 36 to 40.8 s: fast runs, then the bar swing; the picture dims before the grab.
- 40.8 to 43.2 s: logo and slogan.
- 43.2 to 60 s: fast beats (Coaster, Drone, Launch, Climb, Cannon) with six characters running.
- 60 to 67.2 s: group photo of the Rookie and eight characters.
- 67.2 to 72 s: logo and slogan.
- Known gaps: no real Earth view or course picker in the product; the Training fly-over looked poor.

## Film B: one cohesive story (57.6 s, plus a 15 s cut)
- Idea: a real run in slow motion, a hail of moves, then "where does this course come from?" answered by the four features.
- 0 to 4.8 s: hook, a real run in slow motion ("A real run. In slow motion.").
- 4.8 to 14.4 s: hail of moves, 0.6 to 1.2 s each (vault, drop, band, launch, rope, cannon-ball, coaster, drone, wall, hang, trampoline).
- 14.4 to 16.8 s: World Slicer, a map flight to a real place, the buildings rise.
- 16.8 to 18.6 s: World Editor, Fix and the Design partner.
- 18.6 to 21.6 s: Community, the starter courses.
- 21.6 to 24.6 s: Courses, the camera turns from side view into first person.
- 24.6 to 40.8 s: obstacle burst (coaster, vault, drone, wall, launch, hang, rope, trampoline).
- 40.8 to 42.6 s: Dojo, the Gap jump lesson.
- 42.6 to 45.6 s: Lab 3, dragging the bar.
- 45.6 to 50.4 s: group photo.
- 50.4 to 57.6 s: logo and "Train slow. Run fast."
- Details and smoothness numbers: [film B](film-b/README.md).

## Film C: character-led journey (69.6 s, plus a 15.3 s cut)
- Idea: a calm "Train slow" half that teaches and shows the tools, then a fast "Run fast" half on a tempo drop.
- 0 to 3.6 s: Dojo, a lesson played by dragging a slider.
- 3.6 to 6.0 s: a Lab.
- 6.0 to 10.8 s: World Slicer.
- 10.8 to 15.6 s: World Editor.
- 15.6 to 20.4 s: hero course (Montmartre), fly-over.
- 20.4 to 24.0 s: hero run, side view.
- 24.0 to 26.4 s: the leap in slow motion, dimming to dark.
- 26.4 to 28.8 s: logo and slogan (the pause before the grab).
- 28.8 to 30.5 s: the catch (the tempo drops here).
- 30.5 to 57.7 s: one move or obstacle per 1.7 s shot: wall, vault, hang, swing, first-person (3.4 s), bounce, plank, balls, recoil, band, launch, drone, coaster, climb, ghost.
- 57.7 to 61.1 s: Community.
- 61.1 to 64.5 s: group photo.
- 64.5 to 69.6 s: logo and slogan.
- Music: the project's own loops at 100 and 140 bpm, cut on bar lines.

## How to ask for a mix
- Name shots by film and seconds, for example "B 14.4 to 16.8 (Slicer flight) then C 30.5 to 40.7 (the moves)".
- A mix keeps one music bed; shots are cut on its beats, so say which bed to keep.
- Shots from different films differ in size, caption style and music tempo, so a mix may need a re-cut of those edges.
- Files: `../conquercourse-assets/films/{a,b,c}/` with `SHA256SUMS`; scripts in `scripts/film-a-*.mjs`, `scripts/film-b*.mjs` and `scripts/film-c/`.
