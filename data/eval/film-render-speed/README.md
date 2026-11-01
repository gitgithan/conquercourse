# Film render speed: laptop against Modal (CC-209)

## So what
- Films can be drawn about 5 times faster on Modal than on the laptop, with no real graphics GPU.
- The speed-up comes from the renderer choice, not from the GPU card.
- Chromium with `--use-gl=angle --use-angle=gl-egl` draws through Mesa llvmpipe, which is far faster than SwiftShader.
- Estimate for the 77 s film (about 1,850 frames at 24 fps): about 16 minutes on Modal, against about 85 minutes on the laptop.
- Recommendation: render films on Modal with the llvmpipe flags; the L4 card is not needed, so a CPU-only container should do (not yet tested).

## Results
- Page: preview site, 1280 x 720, 20 stepped screenshot frames.

| Where | Renderer | Live fps | 20 frames |
|---|---|---|---|
| Laptop (WSL) | SwiftShader | 2.8 | 54.8 s |
| Modal L4 | SwiftShader | 2.2 | 120.2 s |
| Modal L4 | Mesa llvmpipe | 17 | 10.5 s |

## What this does not show
- No run used a real graphics GPU.
  - The L4 is a compute card; the container had no graphics driver Chromium could use.
  - The faster run is still software drawing, on the container's CPU cores.
- The core count of the Modal container was not measured, so the speed-up may depend on it.
- Frames per second is a sample of one run per row; the stepped-clock output was not compared pixel by pixel between renderers.
- The laptop's own GPU is still unreached from Playwright inside WSL.
  - Every flag set tried (angle gl-egl, d3d12, gles, channel chromium) fell back to SwiftShader.
  - Vulkan and ozone variants hung.

## Next steps, ranked
- Compare a few llvmpipe frames with SwiftShader frames, to be sure the films look the same.
- Try the same flags on a CPU-only Modal container (cheaper) and on the laptop (the flags may reach llvmpipe there too).
- Try Windows-side Chrome over CDP to use the laptop's real GPU.

## Files
- `bench.mjs`: launches Chromium with the flags, reports the renderer, live fps and seconds for 20 frames.
- `modal_bench.py`: the Modal app (L4, CUDA image, Playwright 1.49.1, Xvfb) that runs both modes.
- `run.json`: the numbers above.
- Raw frames are not tracked.
