# The 80 second film: beat stills and clips (CC-209, CC-210)

## So what
- The leap-to-rope beat is a real run: the hero course clears in the simulator, and the clip is the game replaying that stored plan on the stepped clock.
- The cut comes at 4.40 s of game time, in the air, before the catch (take-off tick 1231, catch tick 1312).
- Beats 1 to 3 are concept stills drawn from the stored OpenStreetMap buildings of the same place; they are not captured from the app.

## What is real and what is concept
| Beat | File | Real or concept |
|---|---|---|
| 1 street map | `beat1-street-map.png` | Concept: the stored buildings drawn as a flat map; no tiles |
| 2 slice | `beat2-slice.png` | Concept |
| 3 blocks rise | `beat3-blocks-rise.png` | Concept; the game's own extrusion is the real version |
| 5 leap | `beat5-leap.mp4`, `beat5-leap-poster.png`, `beat5-leap-sheet.png` | Real: `?bot=ideal`, `?film=spin`, stepped clock, slow motion 0.25 |
| 8 end card | `beat8-endcard.mp4`, `.png` | Designed logo and tagline |

## How they were made
- Leap: `node scripts/film.mjs --query "course=/assets/demo/hero-montmartre-paris.course.json&front=0&bot=ideal&film=spin&fx=bloom&trail=1" --frames 132 --from-x 52.5 --ramp 0,4.4,0.25` on a Vultr VM (software GPU, about 9 s a frame).
- Stills: `node scripts/osm-concept.mjs montmartre-paris <dir>` and `node scripts/endcard.mjs <dir>`.
- Data: map data is OpenStreetMap contributors (ODbL); the rope section comes from the Training course.

- Rough cut v1: `rough-cut-v1.mp4` (67.2 s, 100 bpm bed) from `scripts/rough-cut.sh`; each beat carries a REAL or CONCEPT label; the fly-by, editor and Earth beats are placeholders.

## Known gaps, ranked
- The light trail is too bright and hides the runner's hips; lower its strength.
- The hand is not yet at the rope when the clip ends; cut one or two frames later for a closer cut.
- The runner is lit flat; the sky is plain blue.
- The Earth zoom and the editor settle are not captured.

## Rough cut v2 (2026-10-30)
- `rough-cut-v2.mp4`: 67.2 s, the real fly-by (`beat4-flyby.mp4`, 216 frames) and the wide real run (`beat5-run.mp4`) are now in.
- The close run take was never rendered on the VM, so beat 5 is still the far take.
- Long MusicGen try: rejected for two silent gaps (see `../music/film-track.run.json`); `film-bed.ogg` stays.

## Rough cut v3 (2026-10-30), clean (no captions)
- `rough-cut-v3.mp4`: 67.2 s, music `../music/film-bed.ogg`, every cut on the 100 bpm bar grid (2.4 s).
- Captions are off in this cut; the table below says what is real and what is concept.
| Time | Beat | File | Status |
| --- | --- | --- | --- |
| 0.0-7.2 | Earth to street map | `beat1-concept.mp4` | CONCEPT: a drawn globe and the stored OpenStreetMap buildings (`scripts/film-concept.mjs`) |
| 7.2-14.4 | the slicing sweep | `beat2-concept.mp4` | CONCEPT: same drawing; the real slicer screen is not filmed |
| 14.4-28.8 | blocks rise, photo-lifted box drops in, lane becomes the course | `beat3-concept.mp4` | CONCEPT: the photo and the box are real files (credit on screen); the motion is drawn |
| 28.8-36.0 | fly-by of the course | `beat4-flyby.mp4` | REAL: game replay, stepped clock |
| 36.0-50.4 | the run | `beat5-run-close.mp4` when present, else `beat5-run.mp4` (far take) | REAL: `?bot=ideal` replay of the proven plan |
| 50.4-55.2 | leap to the rope, cut before the catch | `beat5-leap.mp4` | REAL: same replay, slow motion 0.25, thin trail, last frame 122 of the render (hands at the rope) |
| 55.2-67.2 | end card | `beat8-endcard.mp4` | DESIGNED: logo, tagline, credits |
- Leap fix: the trail is now thin, dim, short and fades to nothing at the runner (`src/render/trail.ts`), so the hips stay visible.
- Skin and street furniture on the hero course: not done, because both are placed with the frame of the stored place mesh, and the hero lane is a different slice of it; it needs its own frame (next step).

## v3 update: close run take
- `beat5-run-close.mp4` = `v3-run-a` (8 s, macro camera close to the runner, textured photo-lifted box visible on the lane) followed by 6.4 s of the far take (`beat5-run.mp4`, 1.6-8.0 s).
- A second close take (`from-x 30`, 192 frames) was queued on the VM but is not needed for this cut; replace the far half with it when it exists.
- Frames: `beat5-run-close-sheet.png`.

## v4 (rough-cut-v4.mp4)

- Found: the game drew only the first and last deck of any course with a photo object, so the v3 real run showed the runner on thin air and the box over the lava.
- Fix: `keepDecks` on the hero course (and `?decks=1`); the beat 5 close run and the leap are re-rendered with every deck drawn, and the box now sits on its deck.
- Beat 5 real: `beat5-run-close.mp4` is 8 s of the close take plus 6.4 s from x 30 (both macro camera, bloom).
- Beat 5 leap real: `beat5-leap.mp4`, 126 frames, the last frame has the hands at the rope.
- Beat 3 concept: the box is seated on its deck.
- Backdrop (CC-234): `?backdrop=montmartre-paris` draws the buildings and street furniture behind the lane; it is off by default and not in v4 (shots under `data/eval/cc-spectacle/backdrop/`).
- Real slicer recording: `scripts/film-ui.mjs` records the real map page (place, Slice, lane, strip, cut) at 1280 px.
- Verdict: it works, but the side panel is crowded and the strip takes about 2 minutes, so the concept beats 2 and 3 stay in v4.
- Beats 1, 2, 3 are concept; beat 4 is a real fly-by; beat 5 is real; beat 8 is a still and clip.

## v5 (rough-cut-v5.mp4)

- Beat 4 real: the fly-by is re-rendered with `?backdrop=montmartre-paris&film=flyover` (216 frames, VM3), so the Montmartre buildings and street furniture stand behind the lane and all decks are drawn.
- The backdrop is there from frame 0.
- Known look problems: the street lamps are over-sized yellow flags (the CC-213 furniture style), and the fly-over angle is steeply tilted.
- Beat 2 real: `beat2-slicer-real.mp4` is 7.2 s of the real slicer page on Montmartre (`scripts/film-ui.mjs`), with the crowded side panel and map credit line cropped out; the end card credits OpenStreetMap.
- The concept version `beat2-concept.mp4` stays as the fallback; delete the real file and the cut uses it again.
- Editor screen: `scripts/film-editor.mjs` records the real editor on the hero course (VM2, 1280 px), but the 3D view is a bare beige ground with a tiny lane, and the side-view strip is a flat line, so it is not used.
- Its screenshot is kept as `editor-screen-verdict-not-used.png`; beat 3 stays concept.
- Hero still for CC-210: `data/eval/cc-spectacle/hero-course-still.png` (frame at 3.6 s of the fly-by: runner on the box, backdrop behind).
- Beat table v5: 1 concept, 2 REAL slicer, 3 concept, 4 REAL fly-by with backdrop, 5 REAL run, 7 REAL leap, 8 designed end card.

## v6 (rough-cut-v6.mp4)

- Beat 4 real: the fly-by is now the new `skyline` shot (`?film=skyline`), low and nearly level, 216 frames from VM3; the old `flyover` shot is unchanged.
- The backdrop lamps are drawn near true size in the film (`FILM_MIN_SCALE` 0.2 against 0.5), set only in `src/render/backdrop-view.ts`; `?furniture=1` keeps its look.
- Known look gaps: the second half of the shot is mostly decks and lava, and the backdrop is sparse in it, so the strongest part is the first 4 s.
- Editor start scene (CC-238): `?mode=editor&start=hero:montmartre-paris` opens the editor on the real place with the proven lane (turn 110 degrees, sideways 8.5 m, level 6 m) and the camera on the lane; the simulator says it can clear it (2 gaps, 4 steps, 24 m).
- The photo box can be added with `&box=1` and shows on the roof, but it becomes part of the lane and the check then says the lane cannot be cleared, and it looks like it floats above the roofs.
- Screenshots: `editor-start-scene.png` and `editor-start-scene-with-box.png`.
- The side strip shows only a thin line near the water because the real roof heights are low (under 2.4 m of drop); it does not read well on screen.
- Beat 3 stays concept: the editor start scene is not good enough to film yet.

## v7 (rough-cut-v7.mp4)

- Editor box (CC-238): the photo box is now scenery that the lane check ignores (`decor`, handled like a bar's frame), so the verdict stays "can clear" with the box on (2 gaps, 4 steps, 24 m).
- The box is moved along the lane to the nearest stretch of real roof and lowered onto it, so it no longer floats in a street gap.
- Side strip: `?vzoom=1` stretches the height to the lane's real range, so the 1 to 2 m deck steps read; the default strip is unchanged.
- Screenshot: `editor-start-scene-v7.png` (box on, strip stretched).
- Known look gaps: the box is half sunk into a translucent building and the 3D view is flat blue-grey, so it is not film quality.
- Beat 3 stays concept.
- Beat 4 real: the `skyline` shot now stops over the stored buildings (about x 46) and swings round to face them, so the second half shows backdrop and not bare decks.
- Result: backdrop buildings now stand in most of the shot with the runner in view; the last 2 s are still mostly bare decks (a sheet is in `beat4-flyby-sheet.png`).
