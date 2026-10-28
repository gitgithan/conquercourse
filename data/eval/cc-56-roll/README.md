# CC-56: roll and survivable drops

- **So what:** a 5 m ledge is clearable with a C tap and a hard landing without one (real keys, slow motion, headless Chromium on the VM).
- **Run:** `PORT=5472 node scripts/roll-check.mjs`
  - With the tap: outcome `running`, the runner carries on past the drop.
  - Without it: outcome `hurt`, the panel says "Hard landing" (`hard-landing.png`).
- **Limits and numbers:** `docs/world-slice.md`, section "Roll and survivable drops (CC-56)".
