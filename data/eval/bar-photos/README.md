# Bar photos: a good 3D monkey bars from eight Creative Commons photos (CC-133)

## So what
- Yes: we now have a good 3D monkey bars for the film, and it does not depend on the one Rataje photo.
  - Best: photo 3 (Saienji park, CC0): posts, slanted legs, cross rails and about 14 separate rungs, 5.3 m long.
  - Second: photo 5 (a Japanese overhead ladder, CC BY-SA 3.0): ladder at each end, the most natural proportions, 5.7 m long.
- Seven of eight photos gave a usable frame (quality 2 to 5); one failed (photo 8, posts hide the bars).
- The finder (Segment Objects) outlined the whole frame, posts and rungs, on 4 of 8 photos (2, 3, 5, 7) under the label "pull-up bar"; on the other 4 the Mark-it-yourself box worked on the first try for 3 of them.
- Why Rataje was weak: thin bars seen from the side with the frame hidden behind clutter; these photos show a clear frame against sky, grass or sand.
- Recommendation: film photo 3 (CC0, no sale risk); keep photo 5 as the look reference; use a plain bar for collision.
- Next steps:
  - Put the Saienji GLB through the Dojo/Course placement (`docs/model-limits.md`: check the real bar height).
  - Add the phrase "pull-up bar" as a known monkey-bars hit: the finder already finds frames when the whole frame is in view.
  - Fix photo-8 style cases (posts in front) with a box on the bars plus a second box on the posts, or skip them.
- Files for the owner: `../conquercourse-assets/bar-photos/best/` (two GLBs, turntables, README).

## Photos (eight, no person in any of them)
- Originals stay outside git: `../conquercourse-assets/bar-photos/` with `SHA256SUMS`; each has a row in `docs/ASSETS.md`; licences were read on the source pages (`photos.json`).
- Owner's pick (Flickr, "Old school monkey bars", Nels Olsen, CC BY-SA 2.0) is photo 1; the Flickr page shows the licence and the image has no person.
- The others come from Wikimedia Commons categories Monkey bars, Street workout and Jungle gyms; chosen by eye from about 30 thumbnails for a clear frame, no person and different angles.
- People check by eye (no person in any of the 8, small or large); the face and plate blur ran on every photo (photo 2: 1 plate blurred, the rest nothing to blur).
- The Muse Spark Open safety check was not run (lab run; needs the Baseten key and is for people, which none of these show).

| # | Photo | Author | Licence | Angle |
|---|---|---|---|---|
| 1 | Old school monkey bars (Flickr) | Nels Olsen | CC BY-SA 2.0 | three-quarter, arch with ladder legs |
| 2 | Hikone Newtown Dai1 Park B, bar 1 | Salada220422 | CC0 | three-quarter, blue frame |
| 3 | Monkey bar Saienji Mamedecca Park | Salada220422 | CC0 | three-quarter from low |
| 4 | Hiroomote ES Monkey Bars | Ntsctalk | CC BY-SA 4.0 | side-on |
| 5 | 雲梯2 (overhead ladder 2) | KENPEI | CC BY-SA 3.0 | three-quarter |
| 6 | Blue monkey bars, Balfour Park | Michael Rivera | CC BY-SA 4.0 | front |
| 7 | Miyakohara 4 overhead ladder (Japan) | Ajisaka | CC BY-SA 4.0 | side-on, long and low |
| 8 | Brastad outdoor gym | W.carter | CC BY-SA 4.0 | from below, wooden posts |

## Flow (the real product flow, step by step)
- Privacy blur and Segment Objects with the bar phrases ("pull-up bar", "overhead bars", "metal bars", "bar grid" among the 20 phrases), the deployed `cc-photo-to-object` app: `evidence/finder_bars.jpg` shows only the bar outlines.
- Cut-out preview: every box got the box-prompted cut-out first (`evidence/maskbox_all.jpg`); I looked at all eight; 7 were the whole frame, photo 8 kept only the blue top bars (first box missed the frame; second box too).
- Only then the lift (SAM 3D Objects, seed 42) with the typed name "monkey bars" and a typed height (2.2 m for frames with posts); the baker turns it into a 5,820-face GLB with a 1024 texture.

## Results
- Pictures: `evidence/lifts_turntables.jpg` (six views of each lift), `evidence/finder_bars.jpg`, `evidence/maskbox_all.jpg`.
- Quality is my reading of the turntable and the sheet (front, side, top) pictures, not the receipts.

| # | Finder found the bars | Box used | Lift look (1 to 5) | Size (m, length x height x depth) | Cost (est.) |
|---|---|---|---|---|---|
| 1 | no | Mark it yourself | 4: clean arch, separate rungs, but no posts or flat top | 4.6 x 2.4 x 0.8 | $0.0061 |
| 2 | yes, "pull-up bar" 0.75 | the finder's box | 3: clean frame, 6 rungs, but legs and ladder at one end only | 3.5 x 2.2 x 1.1 | $0.0051 |
| 3 | yes, "pull-up bar" 0.38 | the finder's box | 5: posts, A-legs, cross rails, about 14 separate rungs | 5.3 x 2.2 x 2.0 | $0.0050 |
| 4 | no | Mark it yourself | 3: readable frame, junk blobs on the ladders, blotchy top | 5.7 x 2.2 x 1.7 | $0.0050 |
| 5 | yes, "metal bars" 0.47 and "pull-up bar" 0.40 | the finder's box | 5: ladder each end, A-legs, about 14 rungs | 5.7 x 2.2 x 1.6 | $0.0048 |
| 6 | no | Mark it yourself | 2: three frames fused into a tangle | 3.8 x 2.2 x 1.9 | $0.0050 |
| 7 | yes, "pull-up bar" 0.75 | the finder's box | 3: all parts there, but 8.2 m long and rough, speckled surface | 8.2 x 2.2 x 1.4 | $0.0049 |
| 8 | no | Mark it yourself | 1: failed, a flat bar 31 m long (`lift_check` flagged it) | 31 x 0.8 x 6.9 | $0.0048 |

## What is still wrong
- The mesh is a skin: use a plain bar for collision; rungs are thin (about 5 cm) and the texture is soft.
- Size comes from the typed 2.2 m (posts); the real height is not measured, so check it before placing.
- Rungs near the ends can merge, and the far end of a frame that is cut by the photo edge is missing (photo 2).
- The finder labels the frame "pull-up bar", not "monkey bars"; a player would have to type the name.
- Posts in front of the bars (photo 8) break the cut-out.
- Not checked: how the GLB looks in the game's own renderer (the pictures are from our preview renderer).

## Cost
- State before the run: finder under $0.002 per photo, lift about $0.005 warm and up to $0.03 cold; cap 12 lifts and $0.50; Modal credits cover it.
- Spent (container seconds): lifts $0.0407 for 8 lifts (one lift per photo, none repeated), finder about $0.004; a cold start took about 3 minutes and a few dropped streams were asked again (not counted in seconds); total under $0.15 by any count.
- Dropped streams: the first finder and cut-out runs used a long open call that the cold container dropped; the script now spawns and polls (`scripts/modal_calls.py`).

## Files
- `scripts/run_bar_photos.sh` reproduces it; `run.json`, `photos.json`, `objects.json`, `evidence/`.
- Raw GLBs, masks, raw lifts: `../conquercourse-assets/eval-full/bar-photos/` with `SHA256SUMS`; the best two with a README: `../conquercourse-assets/bar-photos/best/`.
