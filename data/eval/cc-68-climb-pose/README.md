# CC-68 climb pose: before and after

- before-*: the captured climb clip (commit 1a3098e) seen from the rear-left camera.
- after-*: the earlier hang-to-stand climb, now the default; the captured clips play only with ?clips=1.
- The neck and shoulders are held inside a small limit while the body blends (src/motion/neck.ts, tests/neck.test.ts).
- Film script: scripts/climb-film.mjs (stages of the climb), scripts/climb-rejump-film.mjs (let go and climb again).
