# Pole vault clips (CC-239)

- Question: can Kimodo make the motion for carrying, planting and clearing a pole?
- Input: four prompts in `inputs/prompts.json`, three samples each, one L4 on Modal.
- Cost: about $0.25 of the $20 Modal dev cap.
- Result, raw (before any trim or repair), plausibility gate:
  - Carrying the pole while running: 3 of 3 pass.
  - Landing on a mat: 2 of 3 pass.
  - The vault itself: 0 of 3 pass (the flight is not a clean arc, the feet slide).
  - The fall back: 0 of 3 pass.
- So what for the game: nothing from this run is shown yet, because no motion is shown before it passes.
- The pole course plays with the ordinary run pose and a drawn pole.
- Next steps, ranked:
  - Run the pipeline repairs and trim (`pipelines/ccpipe`) on the vault samples, then the gate again.
  - Search the CMU set for a pole or high-jump clip as a second source.
  - Draw more samples (6 to 12) for the vault prompt and keep any that pass.
- Raw outputs are in `../conquercourse-assets/eval-full/pole-clips/`.
