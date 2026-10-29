# CC-137: the share clip follows the runner closely

## So what
- The runner is now a third of the clip's height or more in every picture, on all three test courses.
- Before, the runner was about a seventeenth of the frame and hard to see on a phone.

## Measurement
- Smallest runner height as a share of the 1280-pixel frame, over every picture of the clip.
- lache: 0.340
- climb: 0.340
- drop: 0.340
- The clip asks for at least 0.333; all three pass.

## What changed
- The clip has its own camera: side-on, close, 0.45 m ahead of the runner, 1.05 m above the feet.
- The camera is placed so the standing runner is 0.34 of the frame tall (`clipCameraDistance`).
- It moves once for each picture, so it is the same on every computer.
- The middle band of the clip crops the view so the runner fills it (`CLIP_BAND`, `clipCrop`).

## Pictures
- `strip.png`: drop at three moments and climb at one.
- `lache-2.png`, `climb-2.png`, `drop-2.png`: one frame of each course.
- `before-wide-camera.png`: the old wide camera, for the side by side.

## Known gaps
- Measured on software graphics only; see CC-141 for the smoothness check on a real graphics card.
- A very long fall keeps the runner in the picture because the camera may drift at most 0.8 m from the runner.
