# Most Viral plan (CC-126, CC-128, CC-129)

*Serves the $20K Most Viral prize: the most engagement on X for a demo post.*
*The post goes up on Nov 4 after the demo video is final; the deadline is Nov 8, 11:59 PM ET.*

## What a viewer sees
- A clip of a real run, tall like a phone screen, about 15 seconds.
- The course name and the time on top.
- The line "Train slow. Run fast." and the site address at the bottom.
- A link that opens the same course with the friend's run as a ghost, and the words "Beat this time: 9.36 s".

## The 20 second hook clip: shot list
- Built only from beats that already exist in `docs/demo-script-v2.md`.
- At least 85% real product capture, no stock footage.

| Seconds | Shot | Where it comes from | On screen |
|---|---|---|---|
| 0-2 | A real photo of a park gap, then the runner at the edge | Hook beat, 0:00 | "Can I make that?" |
| 2-5 | A pin dropped on the map, the street turns into a course | Hero 1, 0:30 | "Any place on Earth" |
| 5-8 | A photo of a bench becomes a bench you can run over | Photo to object, 0:55 | "Any photo" |
| 8-14 | The lache pair: run, vault, grab, pump, let go | Hero 2, 1:30 | the time counting |
| 14-17 | The friend's ghost beside the runner | Share clip, new | "Beat this time" |
| 17-20 | Title card with the site address | What's next, 2:50 | "Train slow. Run fast." |

## Post text for X
- Draft 1: "Pick a place on Earth. The game builds a ninja course there, and the physics decides if you make it. Beat my 9.4 s: <challenge link> #MetaHackathon"
- Draft 2: "I turned a photo of a park bench into an obstacle. Then I tried to run it. Train slow. Run fast. <site address>"
- Rules for the post:
  - Name the Meta models in a reply, not in the first line.
  - The clip is the post; the link goes in the post text.
  - No real names and no footage of minors.

## Timeline
| Date | What | Who |
|---|---|---|
| Oct 29 | Challenge link and share clip merged behind the switch | agent |
| Nov 1 | Clip made from the final build; the link tested on a phone | agent |
| Nov 2 | Hook clip cut from the demo beats | product owner |
| Nov 3 | Post drafted and read once | product owner |
| Nov 4 | Demo submitted; post goes up; link added to the submission | product owner |
| Nov 4 to 8 | Reply to comments; post one more challenge link per day | product owner |
| Nov 8, 11:59 PM ET | Most Viral deadline | none |

## How a clip is made
- In the game: clear a course, then press "Download a video" on the report (the link is the way to share).
- It plays the run again on a stepped clock, four ticks a picture, so every computer makes the same clip.
- A script does the same without a person: `node scripts/share-clip.mjs <challenge link>`.
- The file is `conquercourse-run.mp4`, 720 by 1280, 30 pictures a second.
- If the browser cannot make H.264, the file is VP9 in an mp4; convert it with `ffmpeg -i in.mp4 -c:v libx264 -pix_fmt yuv420p out.mp4` before posting.

## Safety
- A link holds the keys of a run and the course, never a name, a time or an account.
- The time on the banner is what the simulator says when it plays the keys, so a changed link cannot claim a better time.
- A link that is damaged, cut short, from an older version, or for a changed course is refused in plain words.

## Clip smoothness (CC-141)
- The owner saw the sample clip pulse and look laggy.
- The cause we found: the clip drew its pictures outside a real animation frame.
- The renderer refreshes some camera values once per real frame, so the runner was drawn with a stale camera.
- The runner slid out of the picture about every 8 pictures, then snapped back.
- The fix: each picture is now drawn inside `requestAnimationFrame`.
- Measured on software graphics (lache, 326 pictures): the dips to zero motion are gone and the runner stays in the picture.
- Ruled out, with a measurement each:
  - The clock: exactly 4 ticks a picture, and the runner and camera move evenly.
  - The encoder: even timestamps, same result at 3 and 5 Mbps.
  - The graphics backend: WebGPU and WebGL2 behave the same.
  - The keyframe gap: dips do not line up with keyframes.
  - The runner's animation: the body is always within 0.1 m of the simulated runner.
- Still open:
  - A few exact repeat pictures appear at random places on software graphics; they could be the capture timing.
  - Only software graphics was tested.
- The real test is a clip made in the owner's own browser with a real graphics card.

## Share check list (before the post goes up)
- Open a challenge link, beat the ghost, press "Download a video", and watch the file.
- Check the tag box: an empty tag, a blocked tag, and a normal tag.
- Open the link on a phone: the run plays by itself and the notice says to play on a computer.
- Make one clip on a real graphics card (the owner's own browser) and watch it at full speed; the clip must look smooth there too.
