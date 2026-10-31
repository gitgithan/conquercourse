# Lab 5: Camera and perspective

*University Lab 5 (see `docs/university-labs.md`).*
*Open it at `?mode=lab-camera&labs=1`; without the labs switch it shows "Labs are switched off".*

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

## Tests
- `tests/lab-camera.test.ts` covers the focal length law, same-size dolly, near/far size against lens, pixel to ray through both bodies, same front photo with different depth, the second camera revealing it, vanishing points, foreshortening and near-plane cutting.
- `scripts/lab-camera-check.mjs` is the browser smoke at 1280 px; evidence is in `docs/evidence/lab-camera-*.png`.

## Not tested
- Phones and touch (out of scope by decision).
- Real lens distortion (the pinhole model has none).
- A real photo: bodies A and B are made by hand, not found from a video.
- There is no card in the Courses gallery; the Lab opens by its address, to keep the shared picker file untouched.
