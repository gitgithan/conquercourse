# Film assembly: clips to one film (CC-143)

*Serves the Demo score; reads [film-storyboard.json](film-storyboard.json), the single source for lengths and words.*

## So what
- One command turns the per-shot clips into the whole 76.8 second film on the 100 bpm grid.
- A shot that is not recorded yet shows a labelled card, so the film always plays end to end.
- Re-run it whenever a clip lands; nothing else needs to change.

## Run it
- `node scripts/film-d/assemble.mjs`
  - Needs `ffmpeg` and the DejaVu Sans Bold font; runs on the laptop or on a Modal CPU container.
- Options:
  - `--dir <folder>` sets the clip folder (default `../conquercourse-assets/film`).
  - `--out <name>` sets the output name (default `conquercourse_v0.2.mp4`).
  - `--offset 5=0.4` skips the first 0.4 s of shot 5's clip.

## What it does
- Finds each clip as `<key>_v<N>.mp4` or `shot<id>_v<N>.mp4` and takes the highest version.
  - Example keys: `earth`, `search`, `editor`, `lift`, `train`, `matrix`, `burst`, `courses`, `dojo`, `lab`, `group`.
- Trims or pads each clip to its slot (`seconds` in the storyboard) at 1920x1080 and 30 fps.
  - A short clip holds its last frame; a long clip is cut at the slot end.
  - Slots are whole bars (2.4 s), so every cut lands on the grid.
- Burns the storyboard overlay words in large type at the bottom, one idea at a time.
  - Shots with several overlays share the slot equally (shot 5: one bar each).
- Shot 6 cuts to black for the last 1.2 s, and the music is muted over that same time.
- Shot 11 dims into the end card: name, the slogan "Train slow. Run fast.", Play Now, the link and the credit line.
- A missing clip becomes a card "shot N: not recorded yet" with the shot title.

## Sound
- If `music.wav` is in the clip folder, it is mixed in, cut to the film length, with true silence over the shot 6 blackout and a short fade at the end.
- If it is missing, the film is silent.
- A click track is always written to `click_100bpm.wav`: one click per beat, a higher one on each bar line.
  - Play it with the film to check that cuts land on the beat.

## Checks
- Output length must read 76.8 s: `ffprobe conquercourse_v0.2.mp4`.
- Look at a frame from each shot; captions must sit inside the frame and not cover the app.
