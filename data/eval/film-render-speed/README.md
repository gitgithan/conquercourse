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
- Frames per second is a sample of one run per row.
- The laptop's own GPU is still unreached from Playwright inside WSL.
  - Every flag set tried (angle gl-egl, d3d12, gles, channel chromium) fell back to SwiftShader.
  - Vulkan and ozone variants hung.

## Pixel check: do the two renderers draw the same picture?
- Result: yes for the 3D scenes; they differ a little in text and thin lines.
- Method: four pages (Course, Editor, Slicer, Dojo) on a frozen clock, drawn by SwiftShader twice and by llvmpipe once, on Modal.
  - The two SwiftShader runs give the noise floor: 0 to 0.11 percent of pixels differ.
  - The Course timer still differed between runs (7.8 s and 4.9 s), so that page also differs in its text.
- SwiftShader against llvmpipe:

| Page | Pixels that differ at all | By more than 32 levels (of 255) |
|---|---|---|
| Course | 5.4 percent | 0.88 percent |
| Editor | 10.9 percent | 0.21 percent |
| Slicer | 4.0 percent | 0.04 percent |
| Dojo | 10.5 percent | 0.001 percent (largest step 56) |

- Where the differences are: only on text, thin lines and the changing timer; sky, ground, water and the 3D view in the Editor show none (see `evidence/pixel-check-course.png` and `evidence/pixel-check-editor.png`; the right picture marks pixels that differ by more than 32).
- A likely cause is how each run draws text (the llvmpipe run also sets `--enable-gpu-rasterization`); this was not isolated.
- So what: the look of 3D scenery is the same, and the difference shows as slightly different text edges.
- Rule: render every shot of one film on the same renderer (Modal, llvmpipe), and do not mix frames from the laptop's SwiftShader into it.
- Not tested: a moving 3D course scene at the same game tick (the clock was frozen but the Course timer was not); a run with the same flags on both sides.

## Next steps, ranked
- Render each film entirely on one renderer (see the pixel check below), and repeat the check on a 3D course scene at the same game tick.
- Try the same flags on a CPU-only Modal container (cheaper) and on the laptop (the flags may reach llvmpipe there too).
- Try Windows-side Chrome over CDP to use the laptop's real GPU.

## Files
- `bench.mjs`: launches Chromium with the flags, reports the renderer, live fps and seconds for 20 frames.
- `modal_bench.py`: the Modal app (L4, CUDA image, Playwright 1.49.1, Xvfb) that runs both modes.
- `frames2.mjs` and `modal_px2.py`: the pixel check (frozen clock, three renders, difference numbers).
- `evidence/`: two side-by-side pictures (SwiftShader, llvmpipe, difference).
- `run.json`: the numbers above.
- Raw frames are not tracked.
