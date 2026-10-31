# Street photos: where to see them (CC-90)

## So what
- Real street photos of a place are shown where you work on its lane.
  - 17 places have them today; `public/assets/photos-live/index.json` lists them (Edinburgh Old Town, Montmartre in Paris and the Eixample in Barcelona were the first three).
- Every photo was checked for people ahead of time, on our side, before it went into the allow-list.
  - A photo with a person in it is left out.
- A place you cut yourself has no street photos.
  - The page says so in plain words.

## Where to see them
- **World Slicer** (`?mode=map`): pick a ready place that wears the blue "Street photos" chip, press Slice.
  - The "Street photos" panel sits under the line note.
  - It says if the photos cover your whole lane, part of it, or none of it.
  - Up to six thumbnails are spread along the lane; each says how far along the lane it looks and how far the camera stood from the line.
  - Click a thumbnail to see it large; the credit stays on screen.
  - Move the line and the panel follows it.
- **Place picker** (the ready-place cards in the Slicer): the blue "Street photos" chip marks the places that have them.
- **Courses gallery**: the same chip on the real-place course cards.
- **Course** (the run itself): the photo strip follows the runner along the lane and changes as the runner moves.
  - This already existed; turn it off with `?photos=0` or the Hide switch on the strip.

## Switches
- `?streetphotos=0` hides the Slicer panel and the chips.
- `?photos=0` hides the photo strip on the Course.
- Both are on by default.

## Credit and licence
- The photos are Mapillary contributors' pictures under CC BY-SA 4.0.
- Each photo shows its creator, the licence and a link to its Mapillary page.

## How it works
- The allow-lists are `public/assets/photos-live/<place>.json`; `public/assets/photos-live/index.json` names the places that have one.
- The picture address is looked up at play time by our own `/api/photos` function (three photos per call); the token lives only on the server.
- No call is made until a place with an allow-list is open, and nothing new is paid for at play time.
- The "how much of the lane is covered" line comes from `lanePhotos` in `src/world/street-photos.ts`: every 10 m along the line, it asks which allowed photos face that spot.

## What is not there yet
- 30 of the 47 ready places have no street photos yet; they say so in the panel.
- The Slicer's photo panel only shows photos near the lane; it does not show them on the map itself.
