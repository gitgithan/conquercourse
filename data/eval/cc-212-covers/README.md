# CC-212: one cover photo per Ready place

- Question: why do only 4 of 26 places show a photo, and can we just pick one for each?
- Answer: yes; the 4 were picked by hand in CC-85, and nobody had done the same for the rest.
- Mapillary was not used: only 3 places have a person-free allow-list, and those pictures are not stored in the repo.
- Source used: Wikimedia Commons public search API (no key, no login, no cookies), free licences only (CC0, public domain, CC BY, CC BY-SA).
- `find-candidates.py` fetched up to 8 landscape candidates per place; each was looked at by eye on a contact sheet.
- Rejected: photos with people, crowds or children, paintings, close-ups of objects, night shots too dark to read.
- `chosen.json` holds the picked photo per place; `build-covers.py` crops 320 by 180 and saves under 40 KB.
- Spanish Steps and Washington Square were cropped higher so no small figures show at the bottom.
- Result: 26 of 26 listed places show a photo with a credit; 0 skyline tiles are shown in the default list.
- Known gap: covers show the place, not the lane direction (no way to match the lane without a per-place camera).
- Skyline tiles stay as the fallback for the unlisted places and for any future place without a photo.
- Stills: `shots/gallery.png` and `shots/gallery-scrolled.png` (1280 px, VM2 browser).
