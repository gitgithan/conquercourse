# Promo storyboard (interim)

- Status: interim, 2026-11-05; the product owner is describing the scenes one by one.
- Serves: the opening of the 3-minute demo (the film plays first, then the owner speaks about what it does not show).
- How the film is built: [promo v2](promo-v2.md).
- Rules: no prize or scorecard card; no screen fully still for more than 1 second; nothing recorded until the owner says the UI is ready.

## How to read this page

- One block per scene, in play order.
- Every block has a **Music lane** line.
  - It stays "not decided" until the music is picked.
  - Later it holds: the track, the bar it starts on, the hit points, and the loop or fade.
- Times are from the start of the film; "not set" means the owner has not given them yet.

## Splash: the first scene (1 s, decided)

- Content: our big logo and the slogan "Train slow. Run fast." on a dark background.
- Look: no more cartoonish art; the old start card (sky, blocks, hill, trees in `scripts/film-d/cards.mjs`) is not reused.
- The very first frame is the finished picture, fully visible.
  - Sharing sites take the first frame as the preview picture, so it cannot fade in from black.
  - The background is dark; the logo and slogan are bright from frame 0.
- Length: 1 second only.
  - Then the film cuts to the Grand Entrance.
  - At most 1 second fully still, so a small movement starts at once or by the half second.
- The same screen is reused as the end card, with the website link added.
- Logo: `public/brand/conquercourse-logo-slogan.svg`, lettering in Nunito (owner's pick, 2026-11-05, for rounder edges); rows in `docs/ASSETS.md`; pictures in `docs/evidence/cc-133-logo/`.
- **Music lane:** not decided.

## Scene 0: The Grand Entrance, then the run (12 s, decided)

| Part | Time | What the viewer sees | Overlay |
|---|---|---|---|
| 0a | 0 to 5 s | The Grand Entrance tunnel: starts slow, speeds up, reaches the stage at exactly 5.0 s (150 pictures at 30 fps, measured; the tunnel is 40,680 page units long, the peak speed 16,272 units a second at 4 s, then a 1 s ease into the stage). Pip and Juno are 3D and walking from the first picture; the other eight walk in at the end. Made with `?promo=1` on `public/making-of/timeline.html` and `scripts/promo-v2/entrance.mjs`; the clip is `promo-v2b/entrance/clip.mp4` | none |
| 0b | 5 to 12 s | First person on the track; the ghost runs away ahead | "Chase your friend or the ideal run from simulator" |
| 0c | during the run | The camera rotates to about 45 degrees, then ends in side view | "Rotate camera (C key or mouse)" |
| 0d | 8 s (3 s into the run) | Debug view turns on | "Debug view (B) to predict where you land" |
| 0e | 12 s | The runner clears the Warped Wall (the real vault animation) | none |

- Keys are real: C cycles the camera, B toggles the debug view.
- The tunnel's end matches the Training course front view; the cut to first person keeps the camera in place.
- **Music lane:** not decided.

## Rules for every clip (owner, 2026-11-05)

- Every click is marked: a big yellow circle over the cursor, so the viewer sees which button was pressed.
- Clips are recorded in real time on the stepped clock, then sped up freely afterwards (retime in the build, never jerky).

## Scene 1: Choose a location (about 15 s)

| Part | Length | What the viewer sees | Overlay |
|---|---|---|---|
| 1a | 3.4 s (4 s at most) | Start on the globe; the moment Earth fills the screen, the film jumps straight to street level over Shibuya (no flat-map zoom, no loading flicker); place a pin on the exact spot of our prepared course, click to show a street view photo | "Drop a pin anywhere" |
| 1b | about 3 s or less | The slice runs in real time and ends by itself; faster is better; no jerking | "Slice this place" |
| 1c | 8 s at most | Move the height slider up and down so the extrusions change colour; put it back to the default; scroll down; click "Send to World Editor"; the editor opens with the world fitted in view | "Cut a height" |

- Subheadings kept: Drop a pin anywhere, Slice this place, Cut a height, Send to the World Editor.
- Street photos are Mapillary's, shown live under their terms (no copies).
- 1a cut (owner, 2026-11-05): the zoom is cut after the globe fills the screen; the 17 flickering frames and the whole flat-map zoom are gone; the part after the jump runs at about 1.3x.
- Decided (owner, 2026-11-05): the Mapillary photo in 1a is fine; the runner standing still at the start of the opening run is fine.
- Speeds: every clip is sped up from the stepped clock; nothing runs at real demo speed (1c and the opening run are the closest, about 1.4x and 1.6x).
- **Music lane:** not decided.

## Scene 2: Create your obstacles (6 s, filmed 2026-11-05)

| Part | Length | What the viewer sees | Overlay | Chip (top left) |
|---|---|---|---|---|
| 2a | 1 s | Community, Make your own: the photo of the benches, the pole and the light bulbs is chosen and appears | "Upload your image" | none |
| 2b | 2 s | The photo of the park: SAM 3 draws a box and a label on each bench, the pole and the light bulbs, then cuts them out (reused footage, see below) | "Select of your regions or let SAM 3 decide" | SAM 3 (Meta) |
| 2c | 3 s | The cut-outs lift to 3D: the bench, pole and light bulbs appear in a row, then a bench turns on its own (reused footage, see below) | "Lift to 3D" | SAM 3D Objects (Meta) |

- Layout rule for every clip with a chip (owner, 2026-11-05):
  - The overlay text goes at the bottom of the frame (centred, 96 px up from the bottom edge).
  - The blue Meta chip goes at the top left (28 px in, 24 px down).
  - They sit in different halves of the picture, so they can never overlap.
  - The layout is stored in the manifest (`layout`), used by the build step (`scripts/promo-v2-scene2-build.mjs`) and proved by `python3 scripts/promo-v2/layout-check.py`.
- Photo: demo photo 1 (Jonn Leffmann, Wikimedia Commons, CC BY 3.0), the blurred copy; it holds both the benches and the light bulbs.
- 2a is the real app (Community, Make your own); the finder answer is the prepared SAM 3 result, so every run is the same and no paid job runs.
- 2b and 2c reuse the footage of the earlier film (`promo-v2.mp4`, 0:52 to 1:02), taken from its clean source clip `promo-v2/lift/clip.mp4` (no caption burned in), per the owner (2026-11-05): the look of the selection and the lift is the one the owner already liked.
  - 2b is source 0 to 8.4 s played in 2 s (about 4.2x); 2c is source 8.4 to 14.4 s played in 3 s (2x).
  - Both are cut from one continuous run at the same point, so the join has no jump; the bottom overlay and the top-left chip are burned in again.
  - The first plan (2b 1 s) was too fast to read; 2b is 2 s.
  - The older own-footage versions are kept as `clip-old.mp4` beside the new ones.
- Joins between clips (owner worry, 2026-11-05): separate clips can join badly, so a scene is built as one run and only scene edges get a short dissolve; 2b and 2c already join as one run (`promo-v2b/2bc.mp4`).
- Clips are recorded in real time on the stepped clock and retimed afterwards by the game clock; 2a is sped up.
- Clip script: `scripts/promo-v2/scene2-community.mjs` (2a; its own 2b is kept as the old version) and `scripts/promo-v2/lift.mjs` (the source of the reused 2b and 2c); the click marker is `scripts/promo-v2/marker.mjs`.
- Files (not in git): `../conquercourse-assets/promo-v2b/<clip>/` with the raw frames, `marks.json`, `clip.mp4`, `thumb.jpg`; the list is `manifest.json` there.
- Stills: `docs/evidence/cc-133-promo-scene2/`.
- **Music lane:** not decided.

## Scene 3: Build your course (about 31 s; was scenes 3 and 4)

- One scene on one map (owner, 2026-11-05): building and refining need the same map, so they are filmed as one run in the same editor; no cut back to a fresh map between the beats.
- Overlay "Choose your course" (8 s max, 1 s per view):
  - Start from the Shibuya 3D slice, rotate around the editor, show the top view, click Fit, go back to the 3D view.
  - Change the dropdown to the bulb and bench course, click Fit.
- Overlay "Add your objects" (4 s max for the tabs, then 4 s max for the railing):
  - Click Add Pieces; the default tab Real objects stays 1 s, then 0.5 s each for the next 7 tabs (4 s max in all).
  - Add a canal railing, move it somewhere weird, show that the Simulator says no solution, and highlight it (4 s max).
- Overlay "Design partner to suggest fixes" (4 s max, sped up if the Design partner is slow):
  - Click Improve, then Ask AI for ideas.
  - Show the Simulator suggesting piece movements; highlight the teal outlines.
- Overlay "Accept changes" (4 s max):
  - Click Apply.
  - Show the Simulator now says it can clear; highlight it.
- Overlay "Add moves by tweaking obstacles" (7 s max):
  - Click Moves, then Find ways to add missing moves, then Show it; mouse over to highlight the suggested changes.
  - Close the Design partner, click Play this lane, and end on a natural transition into the next scene.
  - For that transition, use the already prepared "Bench lane or bulb lane" course (`public/assets/demo/fork-bench-bulb.course.json`, with its drawn pole) and not the course the editor builds (owner, 2026-11-05).
  - The wait at Find ways is cut after filming (the hang is fixed in PR 806).
- Total: about 31 s with the caps above; time still to be confirmed by the owner.
- **Music lane:** not decided.

## Scene 4: Run, share and learn (timings judged by the filmer; mostly real speed)

- Overlay "Run your course":
  - A smooth run from start to end on the Bench lane or bulb lane course.
  - The character starts running after the ghost.
- Overlay "Choose your path (High or Low)":
  - Run jump, catch the pole during the jump, climb up the pole.
  - Pump one full circle and swing at least once, let go down onto the bench, run on to the finish.
- Overlay "Share your achievements":
  - Type MetaHackathon in the Name field, click Publish, see the run enter the leaderboard.
  - Highlight the new row.
- Overlay "Challenge your friend, or take their challenge":
  - Point at Copy link to challenge a friend.
- Overlay "Watch yourself or the simulator to do better":
  - Point at download your clip.
  - Scroll down, click Watch the best line, watch the character jump through everything, then cut (6 s of watching at most).
- Go fast wherever nothing needs waiting.
- **Music lane:** not decided.

## Scene 5: Unleash your creativity (about 10 s)

- Each obstacle gets 2 s (owner, 2026-11-05):
  - A cannonball flying at us, with the cannon in view if possible.
  - The coaster starting down from a very steep angle.
  - Boarding and flying the drone.
  - The pole vault.
  - Launching from the trebuchet.
- Overlay: none (owner, 2026-11-05: no overlays after Scene 4 until Scene 9).
- **Music lane:** not decided.

## Scene 6: Learn the Basics (about 10 s)

- Overlay: none (owner, 2026-11-05: no overlays after Scene 4 until Scene 9).
- Start on the Dojo Gap Jump screen:
  - 2 s on the default tab, The real obstacle.
  - Click The idea, 2 s.
  - Click "The exact formula" and drag the sliders so the graph changes, 2 s.
  - Click the rope swing tab, 2 s.
  - Click the stored energy tab, 2 s.
- The formula is the last, earned step of a Dojo lesson, which the rules allow (owner, 2026-10-27).
- **Music lane:** not decided.

## Scene 7: Go for Mastery (time depends on the number of Pipelines cards)

- Overlay: none (owner, 2026-11-05: no overlays after Scene 4 until Scene 9).
- Start from the mindmap of the Labs.
- Mouse over each Pipelines card for 1 s, so the edges are seen updating.
- After the last second, click Know the limits; the yellow click circle must be visible.
- In the Know the limits lab:
  - Drag some cards across columns, 3 s.
  - Press Page Down twice, with a 2 s pause after each.
- The Labs may show equations (owner, 2026-10-29).
- **Music lane:** not decided.

## Scene 8: Create your own Character (as long as it needs; the generation wait is trimmed)

- Overlay: none (owner, 2026-11-05: no overlays after Scene 4 until Scene 9).
- Start from the Training course and click Characters at the top right.
- Type "ninja warrior" character by character, click Make it.
- After the generation (trimmed), click Play as.
- Rotate the camera from the side view to the front view, full body.
- Add 10 other characters running onto a platform from behind.
- Then all are raised up from the game and land on a platform, spread out with the ninja warrior in the middle.
- Final jump shot: left and right alternating; take ideas from `promo-v2.mp4`, do not copy it.
- **Music lane:** not decided.

## Scene 9: Close

- Overlay: "Play now: https://conquercourse.pages.dev".
- Close with the logo and the slogan, "Train slow. Run fast."
- **Music lane:** not decided.

## Decisions so far

- Order: Create your obstacles comes before Build your course (the owner agreed the swap).
- Scenes 3 and 4 are merged into one, "Build and refine your course", on one map (owner, 2026-11-05); later scenes moved up one number (Set a record is 4, Unleash your creativity 5, Indulge your curiosity 6, Close 7).
- The opening replaces the separate "ideal-run ghost" hook, because it already shows the ghost.
- First scene: the new 1-second splash (see above); last scene: the same splash plus the website link.
- Total length: not set; the opening is 12 s.
