# CC-167: the ghost looks like the player's runner
- So-what: the ghost is now the same Rookie shape as the player, in see-through amber with a dark amber outline.
- It reads on sky, grass and dark; the old light-blue capsule faded into the sky.
- Pictures: `new-{sky,grass,dark}.png` against `old-{sky,grass,dark}.png`; `new-sky-jump.png` shows it mid-jump.
- Backgrounds in the pictures come from `?bg=rrggbb` (pictures only); `scripts/ghost-shots.mjs` makes them.
## Challenge link cost
- Rookie a adds 0 bytes.
- Rookie b adds 5 characters (`&rk=b`).
- Anything else opens as Rookie a, so old links work.
- The custom body (`?look=custom`) does not travel; sending it would cost the full body parameters (not measured).
- Fallback for a custom body: the friend sees Rookie a.
## Switches
- `?ghost=old` brings back the blue capsule.
## Same pass
- The "Ghost is … ahead" words now sit under the chip, clear of "Edit this course".
- The "5.0 m" label is drawn behind the runner and ghost.
- The "Press Space" hint shows within 6 m of an edge (was 9 m); it is the first-time hint, not the black pill (that was the empty message panel, CC-166).
## Not tested
- A real GPU.
- A friend's look over a real shared link in a browser.
- The ghost pose is rebuilt from the track, so it is run-like, not the exact recorded pose.
