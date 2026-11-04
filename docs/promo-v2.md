# Promo v2 (CC-133)

- The second promo film: the same story and overlay text as the first, re-shot because the screens changed.
- Videos never go in git.
  - Every clip, raw frame, thumbnail and the final film live in `../conquercourse-assets/promo-v2/`.
  - Only the scripts, this page and a few small stills are tracked.
- Social post text is not tracked.

- The scene plan for the next film: [promo storyboard](promo-storyboard.md).

## Rebuild the film

- One command: `node scripts/promo-v2-build.mjs` (needs ffmpeg and the DejaVu Sans Bold font).
- It reads `../conquercourse-assets/promo-v2/manifest.json`, cuts each segment to its slot, joins them, burns the credit tags and writes `final/<name>.mp4`.
- Add `--only seg1,seg2` to redo just those segments and reuse the rest.
- Music: the 100 bpm bed (`music/v9-master-audio.wav`), one bar is 2.4 s.
  - Each segment takes its old range of the bed.
  - A longer slot loops the last 4.8 s with a 0.3 s crossfade, so the drop still lands on the lache.

## What is saved per segment

- `promo-v2/<segment>/raw/`: the captured frames (1920 x 1080 jpeg) and `marks.json` (the seconds of each beat).
- `promo-v2/<segment>/clip.mp4`: the retimed clip at the game clock, 30 fps.
- `promo-v2/<segment>/thumb.jpg`: one frame.
- The script and params used are tracked here (`scripts/promo-v2/`) and named in the manifest.
- `manifest.json` holds the commit hash, viewport, date, each segment's script, duration, start and end seconds, overlay text, and the music file and loop points.

## How a capture works

- Layout 1280 x 720 at device scale 1.5, so the frames are 1920 x 1080.
- A stepped clock replaces `performance.now`: one step per picture, so a slow software GPU only makes capture slower, never choppier.
- The course loop times itself on the animation-frame stamp, so the course run also hands it the stepped clock (`rafStep` in `scripts/promo-v2/lib.mjs`).
- Real waits (a map flight, a model loading) tick the clock and take no pictures.
- Craft rules from the owner: fly-overs and slow motion are good; no foot zoom; no shaky hand or capture.

## Segments

- Slicer and editor (`slicer-editor.mjs`):
  - the gallery of ready places, pick Alfama, the map flies in;
  - Slice this place, the real flight plays, tilt the map with the Tilt slider;
  - Send to the World Editor, rotate, Fit (never zooms beyond fit), the starting person;
  - Simulator states ("Find the best lane for me", turn slider), the Design partner with suggested boxes, Top plan, the Add pieces browser with its tabs and a scroll.
  - Tags: Mapillary while the gallery and flight play; Muse Spark Open while the Design partner is open.
- Photo lift (`lift.mjs` with `lift-stage.html`):
  - a staged page driven by `window.__t(t)`, a pure function of time, so every frame is the same on every run;
  - it uses the real saved lift files of the bench-and-bulbs photo (people blurred first) and shows the photo, boxes, cut-outs, 3D models, a bench turntable and the objects again;
  - the photo credit stays on screen: Jonn Leffmann, Wikimedia Commons, CC BY 3.0.
- Course run (`course-run.mjs`):
  - the lifted bench and bulbs course, the ideal bot, Debug on (B), Controls hidden (H);
  - side camera, then 45 degree camera (C), then back to side, with the front "Looking ahead" inset on all the time (F would hide it), in slow motion (`rate` in the params).
  - The Earth zoom-out clip (`old/earth-zoomout.mp4`) follows it.
- Courses card (`courses.mjs`): the Courses card scrolls from the Dojo group down to the Labs groups.
- Dojo (`dojo.mjs`): the gap lesson, the Try It sliders dragged up and back.
- Labs (`labs.mjs`): the Labs button opens the mind map, hover "Video to motion" so the others dim, enter "Posing a character" and slide "how crouched the body is".
- Kept from v1: logo, lache, burst, group, end (`old/`).

## Reshoot one segment

- Sync the repo to the capture machine, start `npm run dev`, then run the segment script:
  `node scripts/promo-v2/<script>.mjs <playwright-path> <outdir> [params.json]`.
- Pull the frames into `promo-v2/<segment>/raw/`, encode (`encode()` in `lib.mjs`, or ffmpeg at 30 fps), update `dur` in the manifest, rebuild.
- Before the final capture of a segment, pull `origin/main` and write its hash in the manifest.
- Lift: `node scripts/promo-v2/lift.mjs <playwright> <lifts-dir> <three-dir> <outdir>` (the lifts folder is `eval-full/demo-lifts/lifts`).

## UI states each script relies on

- Slicer: `#ready-gallery-btn`, `.card`, `#slice`, `#tilt`, `#buildpieces`, and `data-flight-done` on the root element.
- Editor: `#glossaryhide`, `#fitview`, `#viewmode`, `#addpiece` with `.pb-tab` and `.pb-card`, `#best`, `#helperbtn`, `#suggest`, `#applyedits`, `#closehelper`.
- Courses card: `#courses-btn` (click it with a script click), the scroller is found from a group header.
- Labs: `#labs-open`, `#labs-panel` with `.lp-tile`, the Posing slider `#ik-fold`.
- Course run (B Debug, H hides Controls, C cycles the camera): `?course=/assets/demo/fork-bench-bulb.course.json&bot=ideal`.
- Dojo: `?mode=dojo&ex=gap`.

## Fragile parts

- The Design partner reply is a scripted stand-in.
  - The vite dev server has no `/api/designer`, and the capture machine has no model key.
  - The script answers that call with a reply in the live format (text plus a fenced JSON edit list).
  - The panel, the suggested boxes, the preview and the simulator check are the real app; only the model's words are scripted.
  - Say so wherever the film is shown, or re-shoot the beat with the live model.
- Group headers and button names are matched by text (for example "Dojo (" and "Labs, Foundations: Search"); a rename needs a params change.
- The slicer flight is slow on a software GPU (about 17 minutes of capture for the 51 s segment).
- The lift stage needs the lift files from `../conquercourse-assets/eval-full/demo-lifts/` and a local copy of three.js.
- A new toast, drum or header can overlap an old crop; look at every segment's thumbnail after a UI change.
- Do not use unblurred photos; the lift page uses the blurred input only.

## Scene 2 clips (promo v2b)

- Scene 2 (Create your obstacles) is filmed apart, into `../conquercourse-assets/promo-v2b/`; plan and layout rule: [promo storyboard](promo-storyboard.md).
- Capture: `scripts/promo-v2/scene2-community.mjs` (2a, real app, finder answered by the prepared SAM 3 result).
- 2b and 2c are cut from the clean `promo-v2/lift/clip.mp4` (the earlier film's 0:52 to 1:02, owner's pick, 2026-11-05): source 0 to 8.4 s in 2 s, then 8.4 to 14.4 s in 3 s, with the bottom overlay and top-left chip burned in again (ffmpeg `drawtext`, same layout as the build step).
- Build: `node scripts/promo-v2-scene2-build.mjs` retimes the frames by the game clock and burns the bottom overlay and the top-left chip.
- Layout proof: `python3 scripts/promo-v2/layout-check.py`.
- The click marker is `scripts/promo-v2/marker.mjs`.
- Vite dev server on a fresh VM: start it with `--force` once, or the first loads fail with "Outdated Optimize Dep".

## Credits on screen

- Mapillary street photos, Muse Spark Open design partner, SAM 3 cut-out and SAM 3D Objects, SAM 3D Body (on the lache), and MusicGen for the score, all "(Meta)".
- Photo: Jonn Leffmann, Wikimedia Commons, CC BY 3.0.

## Scene 1 and the run opening (filmed 2026-11-05)

- Scripts: `scripts/promo-v2/scene1.mjs` (clips a, b, c) and `scripts/promo-v2/open-run.mjs`; params in `scripts/promo-v2/params/scene1.json` and `open-run.json`.
- Every click shows a big yellow ring over the cursor, drawn into the frames by `CLICK_MARKER` in `scripts/promo-v2/lib.mjs` (`S.pressAt`, `S.clickSel`).
- 1a "Drop a pin anywhere" (3.4 s): globe until Earth fills the screen, then a jump cut to street level, pin at the prepared Shibuya course, then a live Mapillary photo.
  - The flat-map zoom and its 17 flickering tile frames are cut (owner, 2026-11-05); the part after the jump runs at about 1.3x.
  - The pin coordinates are the place file's own (`public/assets/places/shibuya-tokyo.json`: 35.6595, 139.7005), so the pin lands on the course.
  - The film shows a live Mapillary photo under Mapillary's terms; we do not store it.
- 1b "Slice this place": the real slice, played in real time and sped up.
- 1c "Cut a height": the height slider up and down, back to the default, scroll, "Send to World Editor", the editor with the world fitted.
- Run opening: first person with the ghost ahead (`?botlag=N` delays the ghost bot by N ticks), camera turns to side view, B at 3 s, the ideal run clears the Warped Wall.
- Overlay layout rule (owner, 2026-11-05): overlay text at the bottom of the frame, blue Meta model chips top left, never overlapping; the manifest records both positions.
- Capture lessons:
  - Another agent's vite can hold a port: use `--strictPort` and check the page served is yours.
  - Software GL on a shared VM is slow; run one clip per VM.
