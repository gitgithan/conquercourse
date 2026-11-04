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

## Scene 3: Build and refine your course (time not set; was scenes 3 and 4)

- One scene on one map (owner, 2026-11-05): building and refining need the same map, so they are filmed as one run in the same editor with the same course; no cut back to a fresh map between them.
- Build your course:
  - Choose a view (Top down and 3D)
  - Add objects
- Refine your course:
  - Repair with Design Partner
  - Accept suggestions
  - Plan this lane
- Camera: not set.
- Overlay: not set (one overlay per subheading, as in scenes 1 and 2).
- **Music lane:** not decided.

## Scene 4: Set a record (time not set)

- Chase a record
- Stretch your limits
- Camera: not set.
- Overlay: not set.
- **Music lane:** not decided.

## Scene 5: Unleash your creativity (time not set)

- X built-in objects, infinite combinations (X is counted from the editor before the text is fixed)
- Camera: not set.
- Overlay: not set.
- **Music lane:** not decided.

## Scene 6: Indulge your curiosity (time not set)

- 7 year olds to University
- Camera: not set.
- Overlay: not set.
- **Music lane:** not decided.

## Scene 7: Close (time not set)

- Zoom out of the globe and darken
- The splash screen again, with the website link added
- The slogan: "Train slow. Run fast."
- Camera: not set.
- **Music lane:** not decided.

## Decisions so far

- Order: Create your obstacles comes before Build your course (the owner agreed the swap).
- Scenes 3 and 4 are merged into one, "Build and refine your course", on one map (owner, 2026-11-05); later scenes moved up one number (Set a record is 4, Unleash your creativity 5, Indulge your curiosity 6, Close 7).
- The opening replaces the separate "ideal-run ghost" hook, because it already shows the ghost.
- First scene: the new 1-second splash (see above); last scene: the same splash plus the website link.
- Total length: not set; the opening is 12 s.
