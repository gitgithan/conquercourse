# Experiment: film the promo on a Modal GPU (CC-133)

## So what
- A promo clip now captures in about a minute on a real GPU, so filming stops being the slow step.
- The Modal frames match the VM films, so existing capture scripts run unchanged.
- The slow step is now writing the capture script for each scene, not capturing it.
- Recommendation: film every scene on Modal in parallel; keep the Vultr VMs only as a fallback.

## Question
- Can a Modal GPU container replace the Vultr VMs (software GL) for stepped-clock film captures, at the same frames?

## Setup
- Harness: `scripts/promo-v2/modal_film.py`, run with `modal run scripts/promo-v2/modal_film.py --clip <script> --args "<args>"`.
- One clip per container, headless Chromium on a Tesla T4, the repo's own vite server inside the container.
- Output goes outside git: `../conquercourse-assets/promo-v2b-modal/<name>/` (frames, `marks.json`, `modal-run.json`).
- The first two clips tested: the Grand Entrance and Scene 1b (Slice this place).

## Results
| Clip | Frames | Capture time | Match with the earlier VM film |
|---|---|---|---|
| Grand Entrance | 150 | 58 s | mean pixel difference about 0.5 grey levels; 0.02 % of pixels differ by more than 40 |
| Scene 1b | 251 | 52.7 s (start-up 3.6 s) | marks identical (2.4, 7.97, 8.37 s); 0.1 to 0.4 % of pixels differ by more than 40 (map tiles) |

- The browser reports "ANGLE (NVIDIA ... Tesla T4 ...)", not SwiftShader.
- Entrance frame 0 differs on 7.6 % of pixels, because it shows the model still loading.
- The VM film of the Entrance ended with `done:false`; the Modal one ends with `done:true`.
- The 17-minute VM figure is for a different clip: the slicer flight segment (51 s of film, `docs/promo-v2.md`).
  - That segment was not re-filmed on Modal, so it is not a like-for-like comparison.
  - No VM time was recorded for the Entrance or Scene 1b, so no speedup is claimed; a like-for-like test (the slicer segment on Modal) is still to do.
- Cost: T4 is about $0.59 an hour, so about $0.01 per minute of capture; a whole clip with start-up is under $0.05; the one-time image build was a few cents.

## Problems and fixes
- An L4 queued for more than 10 minutes with no container, so T4 is the default (`FILM_GPU=L4` still works).
- About 5000 small file uploads dropped the connection; the repo now goes up as one tarball.
- The first run of a changed repo re-uploads about 110 MB, which takes minutes on this uplink.
- Container output shows only when `modal run` ends, so a long clip looks silent.
- `max_containers=3` applies per function, so more than three parallel clips would queue; raise it (the workspace limit is 10 GPUs).
- `film()` films against the in-container vite build; to film the preview site, pass its URL as the script's optional last argument (not wired in the first version).
- `lib.mjs` reads `CC_GL` as the ANGLE backend override; the default is unchanged.

## Not verified
- Three or more containers at once (this is being run now for Scenes 3 to 8).
- Filming against the preview site.
- Quality beyond the pixel differences above.

## Fallback and next steps
- Fallback: the Vultr VMs, slow but proven.
- Next: write the Scene 3 to 8 capture scripts, run them in parallel, add a base-URL option to `film()`.
