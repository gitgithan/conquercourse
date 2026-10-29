# Storyboard: the reference video, our 20 s hook and the 3 minute film (CC-143)

*Serves the demo score and Most Viral (CC-126); built on the film tools in [film-toolchain](film-toolchain.md).*
*Related: [demo-script-v2](demo-script-v2.md), [viral-plan](viral-plan.md), [music](music.md).*

## What the reference video does (study only, never committed)
- Source: the 2:25 to 3:05 excerpt (40 s) of the hardware product film the product owner likes (esY3iS4l3Xs).
- How it was read:
  - ffmpeg scene scores at three thresholds, then a frame sheet every 1 s and every 2 s.
  - Times are good to about 0.2 s; the long shots with a slow camera move have no hard cut, so their ends are read by eye.
  - The text labels were counted on frames sampled every 1 to 2 s, so a short label can be missed.

| # | Time | Length | What is on screen | Camera | Overlay |
|---|---|---|---|---|---|
| 1 | 0.0 | 0.4 | the maker's face, eyes closed, smoke | static close-up | none |
| 2 | 0.4 | 5.6 | the maker talks to camera in the workshop | static, shallow depth | animated green glyphs beside the speaker |
| 3 | 6.0 | 1.0 | parts lie on a table | macro, slides along the table | none |
| 4 | 7.0 | 0.7 | one part, close | macro, small push | none |
| 5 | 7.7 | 3.3 | a lens on the table | macro, top-down, slow turn | none |
| 6 | 11.0 | 1.5 | dark blur | whip into the next shot | none |
| 7 | 12.5 | 3.8 | a white machine, from a low angle | glides past it | none |
| 8 | 16.3 | 0.5 | a row of speakers, cut-away drawing | fast swoop | none |
| 9 | 16.8 | 1.1 | the same row, closer | swoop along the row | none |
| 10 | 18.0 | 3.4 | down a tube, a graphic floor, then the whole instrument | whip, then pull back | none |
| 11 to 21 | 21.4 | 2.2 (11 shots of about 0.2) | the instrument lights up, parts flash by | a cut every 5 frames, on the beat | green glow on the lit parts |
| 22 | 23.6 | 2.3 | a row of glowing speaker cups | slow slide | green glow edges |
| 23 | 25.9 | 0.5 | the same row | still | text label "Speaker" with a leader line |
| 24 | 26.4 | 1.8 | one cup, smoke rises | macro | green glow |
| 25 to 27 | 28.2 | 0.6 (3 shots of 0.2) | cups flash by | rapid cuts | none |
| 28 | 28.8 | 1.2 | cup close | macro | none |
| 29 | 30.0 | 2.9 | dark macro of cups, smoke puffs | macro, locked | none |
| 30 | 32.9 | 7.1 | the maker plays the instrument, green smoke builds up | wide, locked, slow | green smoke, glowing table |

## What we learn from it
- Shots: 30 in 40 s, an average of 1.3 s.
- Without the 14 flash shots of 0.2 s, 16 shots average 2.3 s, and the longest (7.1 s) is the payoff.
- Labelled parts: 1 text label with a leader line in the whole excerpt, so the glow carries the idea more than the words.
- Close-ups: 10 macro or close shots; the film never stays on a wide view for long.
- The rhythm: a calm talking head first, then fast macro cuts, a flash burst on the beat, one label, and a long wide payoff.
- Camera moves are always slow glides or whips; nothing is a static wide shot except the payoff.

## Our rules (from the reference)
- Cuts land on the beat of the music, and the beat is measured from the file.
- Shots are 1.5 to 3 s; a flash burst of short shots is allowed once, on a drop.
- Every shot has a move (push, glide, orbit, whip), and at least a third are close-ups.
- Labels name a part or a physics idea, never a person's technique, and no formulas on the Course.
- A label is at most 3 words, with a leader line and a glow on the part, and it never covers the runner.
- Every shot is tagged REAL, META or GFX on screen, so the film stays honest (see [film-toolchain](film-toolchain.md)).

## Music and the beat grid
- Track: the Course loop (original, from MusicGen, CC-132), looped to 20 s; the CC0 track "Scaling Up" is the fallback.
- Tempo is measured by `scripts/measure-bpm.py`, never typed by hand:
  - Course loop: 100 bpm, so one beat is 0.6 s and one bar is 2.4 s.
  - The first beat is 0.046 s into the file, so the film starts the music there and beat 0 is second 0.
  - The measurement is saved in `data/eval/cc-143-hook/music-measured.json` and a test checks the hook data against it.
- Every cut below is a whole number of beats.

## The 20 s hook (16:9 and 9:16, 33 beats = 19.8 s)

| # | Beats | Seconds | Shot | Camera | Label and glow | Footage | Tag |
|---|---|---|---|---|---|---|---|
| 1 | 4 | 2.4 | a real park photo with a rail in it | slow push on the photo | yellow box and "Handrail" | the real photo (CC0), SAM 3 box | REAL, META |
| 2 | 3 | 1.8 | the photo melts into the built rail at the same angle | match cut, camera starts to rise | glow dot "Rail" | game capture | REAL |
| 3 | 3 | 1.8 | macro: a foot meets the ground | tight on the foot, small orbit | "Ground pushes back" | game capture | REAL |
| 4 | 3 | 1.8 | the whole course from above | fast drone dash along the lane | "Stairs", "Ledge", "Rail" in turn | game capture | REAL |
| 5 | 3 | 1.8 | macro: a hand on the bar | tight on the hand, small orbit | "Hand on the bar" | game capture | REAL |
| 6 | 3 | 1.8 | the runner swings on the bar | side view, wide enough to keep the whole swing | none | game capture | REAL |
| 7 | 4 | 2.4 | the let-go, in slow motion (0.25 times speed) | same take, slight push | "Let go: speed carries on" | game capture, every frame captured | REAL |
| 8 | 3 | 1.8 | the landing | orbit | none | game capture | REAL |
| 9 | 3 | 1.8 | the ninja-warrior character steps in (slot) | set by CC-131 | none | CC-131 clip (`?demo=intro`) | GFX |
| 10 | 4 | 2.4 | end card "ConquerCourse: Train slow. Run fast." | static, music resolves | title | title card | GFX |

- Whip cuts at 2 to 3, 4 to 5 and 8 to 9; a white flash on the cut into the slow motion at 7.
- Shot count 10, average 2.0 s, labelled parts 8, close-ups 3 (two macro and the slow-motion release).
- The slow motion is real: the game clock steps in smaller pieces, so the physics run at a quarter speed and every frame is drawn.
- In 9:16 the same shots are captured at 720 by 1280; the camera stays on the runner, so the crop never loses the action.

## The 3 minute film (beats from [demo-script-v2](demo-script-v2.md))

| Time | Beat | Shots (1.5 to 3 s each) | Footage | Tag |
|---|---|---|---|---|
| 0:00 to 0:20 | Hook | the 20 s hook above | game capture, photo | REAL |
| 0:20 to 0:35 | The owner's story | talking head, then macro cut-ins of the photo and the rail | voice and the real park photo | REAL |
| 0:35 to 1:00 | Hero 1: a pin becomes a world | pin drop, the map flies in (whip), the shrunk buildings (drone dash), the editor | screen capture of `?mode=map` | REAL |
| 1:00 to 1:15 | A photo becomes an object | photo, SAM 3 glow, the object beside a person at real size (match cut) | SAM photo, game capture | REAL, META |
| 1:15 to 1:35 | The design partner | helper window, "cannot clear", one click, a layout that works | screen capture | REAL, META |
| 1:35 to 2:05 | Hero 2: the lache pair | the macro hand, the swing (follow), the let-go in slow motion, the landing (orbit) | game capture | REAL |
| 2:05 to 2:20 | Why it worked | the debug swing path and the drum lane, labelled | game capture | REAL |
| 2:20 to 2:40 | The Dojo | the swing lesson earns the saying | game capture | REAL |
| 2:40 to 2:50 | The character | the intro slot, then the same run in another look | CC-131 clip | GFX |
| 2:50 to 3:00 | End card | "Train slow. Run fast." | title card | GFX |

- Target shots: about 75 in 3 minutes (average 2.4 s), with one flash burst and one slow motion.
- Real capture stays above 85% of the film (spec section 10).
- Each beat is filmed as one stepped-clock take on the VM and cut on the beat in Remotion.

## Footage sources
- REAL: a real photo, the real map, a screen capture of the product.
- META: a picture made by a Meta model (a SAM 3 mask, a Muse Image still), tagged on screen.
- REAL also covers a capture of the running game, because the game really drew it, and the tag says so.
- GFX: a title card or a graphic added in the edit.

## What is not done yet
- The character intro slot waits for CC-131.
- The 3 minute film is a plan; only the 20 s hook is cut.
- The glow is a box, not the SAM 3 outline.
- The product owner has not yet watched the hook and listed what is missing; the next round is filed from that list.
