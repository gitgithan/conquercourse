# Lab 5: Camera and perspective

*University Lab 5 (see `docs/university-labs.md`).*
*Open it at `?mode=lab-camera&labs=1`; without the labs switch it shows "Labs are switched off".*

## When you open it
- Live: it opens on the front camera of the twin-bodies lesson with the game's cameras compare card already filled.
- The controls are the Lab's lesson camera, not the game's side camera.
- A small label at the top says "Showing our setting, already run" (or "Precomputed with the same code (seed N)"); change a control and press Run to try your own.

## The question
- Why can one photo of a body not tell you how far away each part is?
- Where does a second camera help, and where does it not?

## What the player sees
- Body A is a vault reach: the right arm and leg reach toward the front camera.
- Body B is a different pose with the same bone lengths that makes exactly the same front photo.
- Three pictures:
  - The front photo, with A and B drawn on top of each other (the gap is 0.000 px).
  - The second camera looking at A.
  - The second camera looking at B, with A faint, so the difference shows.
- Grey lines are the front camera's lines of sight through the flipped joints; every point on one lands on the same pixel.
- Click the front photo to send a purple line of sight through that pixel (the editor's pixel-to-ray step).

## The controls
- Field of view (8 to 100 degrees).
- Camera height (0.2 to 4.5 m).
- Second camera angle (0 degrees is the front camera's place, 90 degrees is the side).
- Keep the body the same size: moves the camera back as the lens zooms, so only the perspective changes.
- Distance (when the box above is off).
- Which limbs of B are flipped.

## What each output means
- Focal length in pixels: f = (H/2) / tan(fov/2).
- Horizon row and vanishing points of the lane direction and the across-the-lane direction (none when the lines run across the picture).
- Near/far size: how many times bigger the nearest joint looks than the farthest.
- Gap in depth between A and B: metres the photo cannot show.
- Gap between A and B in the second camera: how far apart the two bodies look from there.
  - At a small angle the second camera is nearly the front camera, so the gap collapses.
- Share shown of each bone: picture length over the length it would have lying across the picture (foreshortening).
- "Joints with no exact twin": a bone too short to reach the line of sight; those joints sit at the nearest spot and are ringed in red.

## The real code
- `src/labs/camera/camera-lab.ts` uses the three.js `PerspectiveCamera` (the class the game draws with), its projection matrix for every pixel, and `Raycaster.setFromCamera` for pixel to ray.
- B is found joint by joint: where a bone of the same length meets the line of sight (a quadratic with a near and a far answer).
- The page is `src/modes/lab-camera.ts`; it runs in the page, with no worker, because a frame is a few hundred projections.

## What we chose and why (the compare card)
- The side camera: lens 40 degrees, about 25 m back, a few metres up (`src/modes/course.ts`).
  - Far back with a long-ish lens keeps sizes along the lane true, so the player can judge the next gap.
  - It looks across the lane, so limbs lie flat to the picture and the move reads.
- The corner window and first person: lens 75 degrees, on purpose, because exaggerated depth makes speed feel fast.
- Filming your own move: a side or three-quarter view and a normal lens (`docs/motion-from-you.md`), because a front view cannot separate bodies like A and B.

## How it was designed
- **The one question:** why can one photo not tell you how far away each part is, and where does a second camera help?
- **The choices and why those:**
  - Field of view, height and second-camera angle are the three numbers that make a camera; changing them is the whole lesson.
  - "Keep the body the same size" exists so the player can see perspective change without the body growing or shrinking.
  - Body B is built to make the exact same front photo as body A, so the failure of one photo is shown, not told.
- **Which real game code runs:** the three.js `PerspectiveCamera` (the class the game draws with), its projection matrix for every pixel, and `Raycaster.setFromCamera` (the editor's pixel-to-ray step).
  - The pose maths (`src/labs/camera/camera-lab.ts`) is new Lab code.
  - Nothing else from the game runs; there is no simulator in this Lab.
- **Which data is precomputed:** none.
  - Body A is 16 joints with positions typed in by hand (a vault reach, 1.8 m tall).
  - Body B is computed on the page, joint by joint, from A and the front camera.
- **Order of the screen and why compare comes last:**
  - Controls, then the three pictures (front photo, second camera on A, second camera on B), then the numbers.
  - The compare card (what the game's cameras use and why) comes last, so the player has moved the sliders and felt the trade-off before reading our choice.

## How we prove the lesson is right
- `tests/lab-camera.test.ts` (14 tests), all on the same three.js camera the game uses:
  - Focal length: a point 1 m off-axis at depth d lands f/d pixels from the middle, at three fields of view.
  - Same-size dolly: the head-to-foot height on screen does not change with the lens (to a pixel).
  - A wider lens up close makes the near hand bigger against the hips.
  - The game's side camera numbers (25 m back, lens 40) give a near-to-far size ratio under 1.1.
  - Pixel to ray: the ray through a joint's pixel passes through that joint and through B's twin joint (under 1 mm).
  - The key claim: with three limbs flipped, B's front picture differs from A's by under 0.001 px, every bone has the same length, and the depth differs by more than 0.3 m.
  - The second view reveals it: at 90 degrees the gap is over 40 px, larger than at 30 degrees, and a 5 degree view shows less than 30 degrees.
  - No flip means B equals A.
  - A flip is exact whenever the Lab says so; where a bone is too short, those joints are named; across nine camera settings at least five were exact.
  - Parallel lines meet at the vanishing point; a direction parallel to the picture has none.
  - Foreshortening: the reaching forearm shows under 0.6 of its length from the front and over 0.8 from the side.
  - Segments behind the camera are cut, not drawn through it.
- `scripts/lab-camera-check.mjs`: the browser run at 1280 px; evidence in `docs/evidence/lab-camera-same-angle-4.png` and `docs/evidence/lab-camera-side-90.png`.
- What would make the Lab's claim false:
  - A body B with different bone lengths or a different front picture (the 0.001 px and 1e-6 m checks fail).
  - A "second camera" that still could not tell A from B at 90 degrees (the 40 px check fails).

## Limits
- **Pinhole camera only:** there is no lens distortion, so real photos differ.
- **No real photo:** A and B are made by hand and by geometry, not found from a video.
- **One pair of bodies:** the lesson is shown on a vault reach; other poses are not tested.
- **The compare card is not tested against the game.**
  - `GAME_SIDE` (lens 40, 25 m back, 4 m up) is copied by hand from `src/modes/course.ts`; no test reads the game file.
  - The first-person lens of 75 degrees and the advice for filming your own move (`docs/motion-from-you.md`) are statements, not checks.
- **"Why one lens feels fast"** (exaggerated depth) is a design opinion, not measured.
- **A second photo is shown as helping,** but the Lab never recovers depth from two real photos; it only shows that the pictures differ.
- No phone or touch layout (out of scope by decision); the Lab opens by its address, not from the Courses gallery.

## How to make the lesson better
1. Add a test that reads the game's camera settings from `src/modes/course.ts`, so the compare card cannot drift.
2. Let the player drop in a real photo of a person, with a hand-clicked skeleton, to see the same ambiguity on real data.
3. Show a third pose pair (a crouch) to prove the idea is not special to the vault reach.
4. Show two cameras recovering depth by crossing their rays (triangulation), as the step after "the second camera reveals it".
5. Add a simple lens distortion slider and say how much it moves the vanishing lines.
