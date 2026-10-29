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
