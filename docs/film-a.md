# Film A: the Twitter film that follows the owner's sample script (CC-143)

*Serves the Twitter demo film for new players; the storyboard is in [storyboard](storyboard.md).*

## What it is
- A 72 s, 1280x720, 30 fps film plus a 15 s cut.
- Every picture is drawn on the stepped game clock and saved one by one, never screen-recorded.
- The music is the 100 bpm bed in `docs/ASSETS.md`; the film starts 4.8 s into it so the drop lands at 19.2 s.
- Cuts sit on beats (18 frames) and scene changes on bars (72 frames).

## Shot list
- 0 to 4.8 s: Earth globe to a real street (World Slicer map; the globe view is a filming-only map setting).
- 4.8 to 12 s: slice a real place, radius, deselect, horizontal cut, tilt.
- 12 to 19.2 s: World Editor, add pieces, move them, Design partner.
- 19.2 to 31.2 s: Training course, dive, side view, first-person view.
- 31.2 to 36 s: Dojo lesson, then a Lab.
- 36 to 40.8 s: fast runs, then the bar swing; the picture dims to black before the grab.
- 40.8 to 43.2 s: logo and slogan.
- 43.2 to 60 s: fast beats (Coaster, Drone, Launch, Climb, Cannon) cut with six characters running.
- 60 to 67.2 s: the Rookie and the 8 cast characters in a group photo.
- 67.2 to 72 s: logo and slogan.

## Gaps against the sample script
- No real Earth view or satellite-to-plain-map toggle in the product; the globe is a map setting used only for the film.
- The flat-to-3D rise is shown by the slicer's own rise flight and tilt.
- No Courses picker or course-map transition was captured; the story goes from the editor straight into the Training course.
- The Training aerial fly-over looked poor, so the dive, side view and first-person tour replaces it.
- The Ghost chase and some toy shots were captured but not used.
- Dojo, Lab, Slicer and Editor shots hold still between actions, so they show repeated frames by design.

## How to rebuild
- `scripts/film-a-course.mjs`, `film-a-map.mjs`, `film-a-page.mjs`, `film-a-editor.mjs`, `film-a-lineup.mjs` capture the shots.
- `scripts/film-a-assemble.mjs spec.json` joins them on the beat grid and adds the music.
- `scripts/film-a-smooth.mjs` counts repeated frames, spikes and cuts.
- Videos live in `../conquercourse-assets/films/a/` with `SHA256SUMS`.
