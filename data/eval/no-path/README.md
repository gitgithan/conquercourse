# No path, no option (CC-211)

- `scripts/no-path-check.mjs` drives the map screen at 1280 px.
- `browser-check.json` holds the result of every check.
- `shots/new-screen.png` is the new screen: no hills box, no ready-place box.
- `shots/old-screen.png` is `?slice2=old`, which keeps both boxes.
- `shots/build-montmartre.png` is a ready place after Build, with the editor button.
- `shots/pin.png` is a pin in New York; the Overpass answer was not reachable from the test machine, so the plain no-path reason was not exercised in the browser.
