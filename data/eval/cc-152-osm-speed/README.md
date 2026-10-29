# CC-152: why a pin on the map is slow, and the speed-up

## So what
- A new pin waits on the public map servers, not on our code.
- The map servers took 20 to 40 s to answer, or gave no answer at all in 40 s for 4 of 7 places.
- Reading the ground (0.3 s), building the 3D mesh (2 to 14 ms) and parsing are tiny.
- The lane search takes 25 to 126 s, but it runs in a worker in the background.
- The fix asks the map servers the moment the pin drops, so the wait overlaps the time the player spends choosing a radius and reading.
- With the servers held back 6 s, Build took 322 ms with the fix and 6578 ms with `?speed=0`.
- For the demo, use the ready places or run `scripts/warm-places.mjs` from the demo network first.

## What was timed (VM2, Singapore, `before/places.json`)
- Seven places that are not ready places, each server alone (30 s limit), then all servers at once twice.
- Asking all at once: New York 26.4 s, Rio 26.0 s, Singapore 19.7 s.
- No answer in 40 s: New York with 300 m radius, Cairo, London, Mexico City.
- Asking the same place again took 31 to 40 s: the servers keep no answer, so only our own cache helps.
- Several servers refuse a request in under half a second from this machine; two never answer.
- Lane search: New York 25 s, Rio 37 s, Singapore 126 s.

## After
- `browser-check.json`: Build 322 ms with the speed-up, 6578 ms with `?speed=0`; asked once; the lane found for a pin is kept and shows at once next time.
- Screenshots: `after-build-at-once.png`, `before-build-waits.png`.

## Known gaps
- Measured from a Singapore machine, not the product owner's network, and the public servers vary by hour.
- The site's cache is per data centre, so warm it from the machine the demo will use.
- A cache shared across data centres needs a database table and a deploy, which need the product owner's yes.
- Faster query shapes (bbox, `qt` ordering) were not tried yet.
