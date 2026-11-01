# Film toolchain: how the demo video is made (CC-130)

Serves the Demo score (25%) and the Most Viral bonus (CC-126).
Every shot is a capture of the running game on the stepped clock, so it is frame-exact and can be made again.

## The pieces (the media kit)
- **Camera director** (`src/film/camera.ts`): five shots, each a pure function of time, like the map flight.
- **Shot library:** `flyover` is the drone flight, `orbit` circles an obstacle, `follow` zooms in on a take-off and out on the landing, `push` is the slow macro close-up, and `hero` is real photo to course.
- **Labels in the game** (`src/film/overlay.ts`): a data file of 3D anchors; each frame the anchor is projected through the real camera, so a callout stays on its part for free.
- **Real-to-course hero shot** (`?film=hero`): the real park photo, a yellow box on the object SAM 3 found, then the photo dissolves into the built place while the camera flies up and out.
- **Remotion project** (`demo/`): compositions that cut the clips together with captions, tags, a music bed and an end card.
- **Callout and SAM glow components** (`demo/src/components/`): the same callouts and a pulsing box for real photos, for footage that does not come from the game.
- **Cards** (`demo/src/components/Cards.tsx`): title and end card; a Muse Image still can go behind the title and is tagged META.
- **Course intro template** (`demo/data/course-intro/<course>.json`): one data file per course gives a flyover with labelled obstacles.
- **Music bed** (`demo/src/lib/music.ts`): fade, ducking under a voice, and cuts snapped to the beat.
- **Beat-cut hook** (`demo/src/Hook20.tsx`, data in `demo/data/hook/`): every shot is a whole number of beats, so every cut lands on the music; cuts, whips and flashes.
- **Tempo measurer** (`scripts/measure-bpm.py`): finds the tempo and first beat of a music file; the hook data must match its output (a test checks it).
- **Character intro slot** (`demo/src/components/CharacterIntro.tsx`): a marked placeholder until the ninja-warrior entry clip exists.

## Turn on the film camera
- Add `?film=<shot>` to a course URL; without it nothing changes.
- `filmx` and `filmy` set the object the orbit, push and hero shots look at.
- `labels=/film/<name>.labels.json` adds callouts.
- `?film=macro` stays on one part of the runner: `filmx` and `filmy` are its offset from the runner (m) and `md` the distance.
- `dur=2.2` plays a whole move in 2.2 s (a fast drone dash).
- `photo`, `size`, `box`, `label` and `credit` set the real photo for the hero shot.
- Film time is `performance.now()`, so the stepped clock makes it deterministic.
- The page hides its own panels while a film shot is on.

## Label file format
- `labels` is a list of `{ id, text, idea, at: [x, y, z], from, to, dx, dy }`.
- `at` is the anchor in game metres; `from` and `to` are seconds of film time.
- `dx` and `dy` move the text box away from the anchor, in pixels.
- Labels name obstacle parts and physics ideas only; they never grade a person's technique and never show a formula.

## Re-render the proof clip
- On a Vultr VM, in a worktree with `npm ci` done: `scripts/film-proof.sh 1280 720 30` (width, height, frames a second; add `hero` or `flyover` to record one shot, so two machines can each take one).
- Every frame is captured at the real output rate; nothing is captured at a lower rate and nothing is blended or repeated.
- The stepped clock means a slow software GPU only makes the capture slower, never choppier: about 4 s a frame at 1280x720 on a VM.
- `scripts/film.mjs` hashes every captured picture and prints the exact duplicates; a picture identical to the one before is captured again after another wait, because the renderer had not finished drawing.
- It also writes the per-frame label tracks.
- Clips and music go to `../conquercourse-assets/demo-media/`, which Remotion reads through `--public-dir`.
- Then `cd demo && npm install && npm run render:proof`; the mp4 lands in `test-results/proof20.mp4`.
- Copy it out before the next Playwright run, which wipes `test-results/`.
- Count the unique pictures with `ffmpeg -i clip.mp4 -an -vf mpdecimate,showinfo -f null -` (the static end card is dropped by design).
- Check by eye: the photo, the box and its label, the dissolve, the flight, the callouts sticking to the stairs, ledge and rail.

## Other renders
- `npm run render:hook`: the 20 second hook in 16:9, cut on the beat; `npm run render:hook916` is the 9:16 one.
- `node scripts/film.mjs --ramp 3,5,0.25` makes slow motion: between seconds 3 and 5 of the film the game runs at a quarter speed, and every frame is still captured.
- `node scripts/film.mjs --from-x 37` steps the game without pictures until the runner reaches x = 37, then starts the film there.
- `--skip 5` does the same for a number of game seconds.
- `scripts/film-hook.sh <dir> <width> <height> <take...>` records the takes of the 20 second hook (hero, foot, dash, hand, swing, landing) one browser at a time.
- `npx tsx scripts/film-timeline.ts <course.json>` prints where the runner is, second by second, so a take can start at the right place.
- Film mode now runs the game on the stepped clock too:
  - Before CC-143 the camera was stepped but the runner ran on the real clock, about ten times too fast per frame.
  - The earlier hero and flyover clips show that fast runner; the camera in them was right.
- `npm run render:intro`: a course intro from its data file.
- `npm run render:full`: the three-minute skeleton; beats with no clip show a "TO FILM" card, so nothing is faked.
- `npm run studio`: Remotion Studio, to scrub and tune.

## Honesty rules
- At least 85% of the film is real capture of the running build.
- A shot sped up says "sped up"; a step made earlier says "processed earlier".
- Every shot carries a REAL, META or GFX tag, and META names the model.
- No photoreal AI people and no children.
- The video description lists every generative tool.

## Tools and what they did
| Tool | Job in the film | Licence or cost |
|---|---|---|
| Remotion 4.0.539 (pinned) | cuts, captions, tags, audio, end card | free for teams of up to three people; the licence may change in 5.0, so the version is pinned |
| Playwright on the stepped clock | frame-exact capture of the game | free |
| ffmpeg | encodes and blends frames | free |
| SAM 3 | the box on the object in the real photo (`park01.objects.json`) | build time, Modal |
| SAM 3D Objects | the rail mesh that sits on the course | build time, Modal |
| Muse Image | optional title stills, tagged META | Meta Model API |
| Muse Spark Open (Baseten) | optional: draft a shot list or label text; a person checks it | Baseten credits |
| "Scaling Up" by Ruskerdax | the music bed | CC0; the author asks for a credit, which the end card gives |

## Not done yet
- Callouts are drawn in the game footage; the Remotion `Callout` reads the saved tracks but is not used on a real photo in the proof clip.
- The SAM glow is a box; the mask outline needs the saved mask image.
- The beat grid uses a BPM set by hand; it has not been measured from the track.
- Muse Spark Open shot-list drafting is not wired.
- The character intro slot is empty.

## Filming methods: what changed (2026-11-01)
- The first test film (v0) only proved the pipeline; it did not follow the storyboard, so it was dropped.
- Now each shot is a script that drives the real app, then the clip is cut to the storyboard.

### Renderer
- Browser: Chrome in Playwright on Modal CPU containers, flags `--use-gl=angle --use-angle=gl-egl`.
- That runs Mesa llvmpipe, which is about 5 times faster than SwiftShader (about 17 frames a second live).
- The 3D picture is the same on both renderers; only text edges differ a little.
- No real GPU yet; one test on a Modal NVIDIA GPU is still to do.
- Size: 1920 by 1080, the standard laptop size.
- The page is scaled to 1706 by 960 and padded with a black band, so captions never cover the app.

### Capture methods
- Real-time recording (new default): Playwright `recordVideo` while a script plays the app like a person.
  - Used for the Earth zoom: one take, about 16 distinct frames a second, accepted by the product owner.
  - A silent warm-up pass first, so tiles are loaded; the warm-up is trimmed off.
- Scripted controls: sliders set by value, the mouse dragged with `page.mouse`, keys pressed on a timeline.
  - Used for Dojo gap jump (shot 9) and Lab 3 (shot 10); the product owner called the in-app demos smooth.
- Frame by frame (old): each frame set from its index and screenshotted.
  - Kept only for shots that cannot run live; it can be split across containers.
  - It failed on the Earth zoom (memory), which is why real-time recording replaced it.

### Captions and clean screen
- Captions are drawn last, with ffmpeg drawtext, in the black band.
- The Feedback and Sound buttons are hidden before recording.
- Shots 3 and 4 share one overlay text, as the storyboard says.

### Cost
- About 1 dollar for a full pass on Modal CPU; the dev budget is 20 dollars.
