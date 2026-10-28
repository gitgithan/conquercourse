# CC-66: recoil (momentum is conserved)
- **So what:** the demo gap (10.5 m) is beyond a perfect running jump (7.5 m clears, 8 m does not); one shot of 4.4 m/s makes it clearable, and the bot clears it.
- **Files:**
  - pad.png: the launcher on the runner at the teal pad, with the K drum on the strip.
  - shot.png: the toast after the shot (the push in m/s).
  - end.png: the end of the run.
  - editor.png: the editor with the Launcher and Heavy crate buttons and the ball knobs.
  - dojo.png: the Dojo lesson "Recoil: push back, go forward".
- **Numbers:** a 12 kg ball at 30 m/s gives a 70 kg runner 4.4 m/s; a 25 kg crate at 6 m/s gives 1.6 m/s (lanes up to about 9 m).
- **Checks:** scripts/recoil-check.mjs (bot clears), scripts/recoil-shots.mjs (editor and Dojo), tests/recoil-law.test.ts, tests/recoil.test.ts, tests/recoil-editor.test.ts.
