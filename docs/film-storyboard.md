# Reference film storyboard (CC-143)

*Serves the demo score and Most Viral; data in [film-storyboard.json](film-storyboard.json), which a later render script reads.*

## So what
- The film is eleven shots and 76.8 seconds on a 100 bpm grid (one bar is 2.4 s), so every cut and every overlay lands on a bar.
- Each shot has visual checkpoints: what must be visible, so a frame can be checked by eye before the clip is kept.
- Next step: capture the real shots on the stepped clock, then check each against its checkpoints.

## Rules that apply to every shot
- No formulas on screen except in the Dojo and Labs
- No grading of technique
- Mapillary photos only live, with Mapillary's blur, never stored
- Credit OpenStreetMap contributors and every CC BY object on the end card

## Shots

### 1. Undim: Earth to street (0 s, 9.6 s, 4 bars)
- Overlay: Explore a new world
- What happens: Fade up from black on the logo and the slogan, then the Earth seen from far.
  - The camera dives to the ground until the map is an OSM street view.
  - The slice plane sweeps and the buildings extrude, the camera tilts from straight-down to 45 degrees, and street photos pop up like a shuffled deck of cards and fan out.
- Camera: Dolly-in from orbit to ground; then pitch from 90 to 45 degrees; photo cards fan out left to right on the beat.
- Source: Slicer map mode (real); Earth zoom is a concept stand-in; photo cards use Mapillary live under its blur (never stored).
- Status: Slicer real, globe concept
- Music: Soft pad and single high piano notes; swell on the dive; a bell on the fan-out.
- Visual checkpoints:
  - Logo and 'Train slow.
    - Run fast.' are readable for at least 1.2 s before the dive
  - The OSM credit is on screen when the map shows
  - No photo shows a close-up person (our 0.2 rule) and none is stored or un-blurred
- Risk and fallback: Globe zoom is not built; fall back to a flat dive from a zoomed-out map.

### 2. A path is searched and found (9.6 s, 4.8 s, 2 bars)
- Overlay: Find your path
- What happens: Over the extruded city, thin lines fan out from the start as the simulator searches.
  - Dead ends fade, one line stays and glows.
  - The glow dissolves into the World Editor.
- Camera: High 45-degree view, slow push; match-cut from the glowing line to the editor lane.
- Source: Ideal-run search overlay (real) and the Editor lane (real).
- Status: Real
- Music: Pulse starts: soft kick on every beat, plucked notes follow the search lines.
- Visual checkpoints:
  - Several tried lines are visible before one wins
  - The winning line is the proved lane, not a drawn guess
  - The dissolve lands on the Editor with the same camera angle
- Risk and fallback: Search lines are drawn from the stored search log; if the log is missing, re-run it on the VM.

### 3. Design your course (14.4 s, 7.2 s, 3 bars)
- Overlay: Design your course, using your objects
- What happens: In the Editor: drag a piece, resize it, ask the Design Partner for help, flip Top view and 3D view, orbit from far to fit the whole lane, then add objects from the library with the 3D-generated pieces in focus (planter, railing, skate box).
- Camera: Screen capture at 1280 wide, full frame, no zoom crop; orbit from far to near.
- Source: World Editor, real; the pieces made from photos show their new pictures (CC-200).
- Status: Real
- Music: Gentle groove joins: warm bass, light shaker.
- Visual checkpoints:
  - Every action is visible at full frame: the cursor, the piece and the panel together
  - At least three photo-made pieces appear in the library with pictures, not emoji
  - Text stays on through shot 4
- Risk and fallback: Keep the stepped clock; software drawing is slow, so record on the stepped clock only.

### 4. From photo to 3D, then a run (21.6 s, 7.2 s, 3 bars)
- Overlay: Design your course, using your objects
- What happens: Look at one 3D object, the iron railing: the photo, a box drawn round the railing, the cut-out, the lift into 3D, and a turntable.
  - Then cut to the same real course with Rookie A jumping over at least one obstacle.
- Camera: Locked frame for the cut-out; turntable orbit 360 degrees; then side-on tracking of the jump.
- Source: Photo-lift steps from the CC-38 object pipeline (real inputs); Rookie A run on the stepped clock (real).
- Status: Lift is a stand-in made from real intermediate files; run is real
- Music: Same groove; a rising riser into the jump, then a short drum fill.
- Visual checkpoints:
  - The railing in the turntable is the same one placed in the course
  - Rookie A clears at least one obstacle and lands, in a frame that shows the take-off and the landing
  - The clip uses the licensed railing credit on the final frame
- Risk and fallback: The railing is CC0; its credit must show in the end card.

### 5. Chase a record (28.8 s, 9.6 s, 4 bars)
- Overlay: Chase a record / See the gaps / Experience in first-person
- What happens: The training course: a flyover of the full course first.
  - Then the ghost runs ahead and the player chases it, the debug view shows the gaps, and the camera cycles through side, back and first-person views.
- Camera: Flyover along the lane; split of ghost and runner; view cuts every bar.
- Source: Course flyover, ghost, debug and camera modes (all real).
- Status: Real
- Music: Build: hats and a rising bass line; each overlay lands on a bar line.
- Visual checkpoints:
  - The ghost and the runner are both in frame at once
  - The debug view shows the gaps with words only, no formulas
  - First-person view is shown for a full beat
- Risk and fallback: Three overlays in four bars: give each exactly one bar, in order.

### 6. The jump nobody sees land (38.4 s, 7.2 s, 3 bars)
- Overlay: Practice your moves / Stretch your limits
- What happens: A lache: the runner lets go of one bar toward the next.
  - Start on a front view, zoom out and orbit from behind the character to the side and then 45 degrees in front, at 360-degree matrix feel, then black out in silence.
  - The viewer never sees if he caught the next bar.
- Camera: Front close-up, pull back, 180 degrees of orbit at slow motion, cut to black on the release.
- Source: Lache clip on the stepped clock with the orbit camera (real; the vault and climb clips stay locked).
- Status: Real; the orbit move is new
- Music: Everything drops except one low note; the last 1.2 s is true silence over black.
- Visual checkpoints:
  - The release is visible before the blackout
  - The orbit shows back, side and front-45 views in that order
  - The silence is truly silent: no tail, no room tone
- Risk and fallback: Both ends are real physics: film the actual outcome, then end the clip before it shows.

### 7. Fast beats: every kind of move (45.6 s, 7.2 s, 3 bars)
- Overlay: Unleash your creativity
- What happens: Hard cuts on the beat: sliding below cannon balls, down the roller coaster, carried by the drone, pole vault, the trebuchet throw.
  - Then a transition into a course shown on the course map.
- Camera: One shot of about 0.6 s each; each cut lands on a beat; the last cut pulls back into the map.
- Source: Existing demo courses and clips for each contraption (real).
- Status: Real
- Music: Full drums enter; one hit per cut; snare roll into the map.
- Visual checkpoints:
  - All five moves show, one cut each, on a beat
  - Each clip shows its take-off and result
  - The final cut lands on a bar line
- Risk and fallback: Pole vault is the one clip that may not exist yet: check the Park moves list.

### 8. The Courses page: Dojo and Labs (52.8 s, 4.8 s, 2 bars)
- Overlay: Learn through play, for all ages
- What happens: Scroll the Courses page down past the real places to the new Dojo cards and then the Labs cards.
- Camera: Smooth scroll, 1280 wide, full frame.
- Source: Course picker (real, CC-200: Dojo cards above the Labs).
- Status: Real
- Music: Back to calm: piano and bell, sparse notes.
- Visual checkpoints:
  - Dojo cards and Labs cards are both visible, with their headings
  - Scroll speed is slow enough to read the card titles
- Risk and fallback: Dojo cards have no pictures yet; make thumbnails before filming.

### 9. Train in the Dojo (57.6 s, 7.2 s, 3 bars)
- Overlay: Train in the Dojo
- What happens: Open the Gap jump lesson and its Try It page.
  - Move the sliders; the graph on the left updates live.
  - Keep the whole page in frame.
- Camera: Fixed full-page frame; no zoom, so no control or label is cut off.
- Source: Dojo, gap lesson (real).
- Status: Real
- Music: Sparse piano, quiet; a soft note on each slider stop.
- Visual checkpoints:
  - Sliders, graph, answer and Try It button are all inside the frame
  - The graph visibly changes while a slider moves
  - No formula shows before the last earned step
- Risk and fallback: Slider moves must be scripted, not hand-held, so the clip is repeatable.

### 10. Posing a character: Posing a character (64.8 s, 4.8 s, 2 bars)
- Overlay: Mastery in the Labs / University level
- What happens: Open Posing a character.
  - Move a hand toward a bar and watch the arm bend; move a few limbs.
  - A small tag says the Labs are university level.
- Camera: Fixed full-page frame.
- Source: Posing a character (real); equations are allowed in the Labs.
- Status: Real
- Music: Same sparse piano with a slow low pad.
- Visual checkpoints:
  - The arm visibly bends as the hand moves
  - The university-level tag is readable
- Risk and fallback: None known.

### 11. Group photo, then the call to play (69.6 s, 7.2 s, 3 bars)
- Overlay: Play Now / https://conquercourse.pages.dev/
- What happens: All ten characters on one platform, the two Rookies in the middle, standing.
  - Then each does a different move (jump shot and others) and freezes.
  - Dim into the logo and slogan, with Play Now and the link below.
- Camera: Wide, slightly low, locked; a slow push-in as they freeze; dim to the end card.
- Source: The ten characters from the cast (real models; poses from the move library).
- Status: Poses real; the group scene is new
- Music: The theme returns, full; hits on each freeze; resolves on a held chord.
- Visual checkpoints:
  - Ten characters are visible, the Rookies in the centre
  - Every pose is different and holds still for a beat
  - The link is spelled exactly: https://conquercourse.pages.dev/
- Risk and fallback: Ten rigs in one scene may be heavy; render on the VM.

## Music plan
- Bed (shots 1-5): One 100 bpm gentle bed: pad and light piano, drums join at shot 2 and build to shot 5.
- Drop (shots 6): Cut the bed to one low note, then 1.2 s of true silence over black.
- Burst (shots 7): Full drums at 100 bpm, one hit on every cut; same tempo so the grid never changes.
- Calm (shots 8-10): Sparse light piano in the style of the Dojo loop, with fewer notes.
- Theme (shots 11): The bed's tune returns in full, held chord on the end card.
- How to make it: MusicGen text-only clips cut to the 100 bpm grid, chosen by measured match to the reference style; a clip from MusicGen is CC BY-NC, so it carries a swap-before-a-sale note in docs/ASSETS.md.
- Cost: about $1 on Modal for a batch; state it before running.
