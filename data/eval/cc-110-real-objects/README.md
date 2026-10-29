# CC-110: more real objects from photos, organised by move

## So what
- The game now has 19 real objects (6 from before, 13 new), each from a Wikimedia Commons photo we can credit.
- The Real objects tab can group them by the move that gets past them: jump over, climb up, vault, swing and hang, balance, duck under.
- Duck under has no real object yet; the tab says so.
- All 14 photos lifted in 3 short Modal runs for about 16 cents; 13 are shipped and one (a split-rail fence) is not.
- Each object is about 406 KB on average (273 to 602 KB), 5,820 faces; 13 objects are 5.3 MB in total.

## What we did
- Round 1 (5 objects), round 2 (8 objects), round 3 (the gabion wall alone, photo padded 1.5 times because it fills the frame).
- Heights are typed from real sizes, so every object is at its real size.
- Collision is never the mesh: the editor reads a lane from the piece as for every other object.
- The two hang bars are scenery that does not count as ground; each brings a hold bar at its real crossbar height.

## Results by photo
- Good: hydrant, bollard, barrel, planter, concrete pipe, curved bench, black hang bar, green hang bar, spruce stump, gabion wall.
- Partly: picnic table (thin legs), canal railing (thin), driftwood log (odd shape, but real).
- Not shipped: split-rail fence (rails come out as one heap), same limit as the bare handrail in CC-38.

## Known gaps
- Duck under: no object yet; boom barriers are too thin for SAM 3D and a bike shelter was not tried.
- Three objects are CC BY-SA (hydrant, concrete pipe, canal railing): the object made from the photo is shared under the same licence.

## Where things are
- `photos.json`: box, typed height, author, licence and source of every photo.
- `inputs/`, `r1/`, `r2/`, `r3/`: the photos and per-photo mask, privacy.json, mesh.json, mesh.glb and sheet.png.
- `run.json`: cost, bytes and faces; the big raw lifts are in `../conquercourse-assets/cc-110-real-objects/`.
- Evidence: the by-move screenshots are linked from CC-110.
