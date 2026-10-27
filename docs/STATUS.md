# Status: where the build stands, and what to do next

*Kept current by whoever works; a new session reads this first, after `CLAUDE.md`.*

## Now (2026-10-27)
- **Done:** CC-1, the knowledge and asset transfer (spec, sayings, research briefs, characters, footage manifest, lessons, learning design, challenges, pipelines, experiments, CLAUDE.md, dev setup, prior work).
- **CC-17 (branch `cc-17-starter-clips`, not merged):** run, leap, land, hang, swing shipped from CMU (plus a reach and a Kimodo leap) through the gate with a guard test; wall run-up and grab NOT achieved (Kimodo text only: 0 of 36 samples); see `data/eval/starter-clips/README.md`.
  - Next for it: contact targets for the wall move (pipelines 3, 5 and 6) or the Pexels wall footage (CC-26).
- **CC-29 (branch `cc-29-video-ingest`, not merged):** video ingest built and tested (`pipelines/ingest_video.py`, primitives doc and schema, move recipes, one shared gate); the three videos are NOT processed: YouTube's bot check blocked the download from this machine; needs a cookies file or the files from the product owner; see `data/eval/cc-29-video-ingest/README.md`.
  - The shared gate now fails CC-26's two "conditional pass" clips.
- **Next, in order:**
  1. **CC-2** app skeleton (Vite + TypeScript + three.js WebGPU; Rookie A standing; `npm run test:quick`), on the laptop.
  2. **CC-5** simulator core, then **CC-6 to CC-10**: good work for the VM (pure TypeScript and tests).
  3. **CC-24** the SAM 3.1 park-photo spike, early (the hero beat's riskiest assumption; spec §12).
  4. **CC-3** browser smoke test and true-speed filming on the VM; **CC-4** the merge path.
  5. Then M2 (CC-11 to CC-15) and M3 (CC-16 to CC-18), and M4 (CC-25 to CC-27), M5 (CC-28).
- **Issue numbers:** CC-1 to CC-18 and CC-24 to CC-28; CC-19 to CC-23 don't exist (used up by attempts the free plan's issue limit refused).

## Machines and access (all checked 2026-10-27)
- **Laptop:** main work and the dev server (`http://localhost:5173`); at most one browser test run at a time.
- **Vultr VM** (`root@<vm1-address>`): Claude Code logged in (`ssh root@<vm> 'claude -p "<task>"'`); a deploy key that pushes only to this repo (`GIT_SSH_COMMAND="ssh -i /root/.ssh/cc_deploy -o IdentitiesOnly=yes"`); the Meta key (`/root/.config/ninja/meta.env`), Modal token and Linear key in private files.
  - About $0.22 an hour while running.
- **Linear:** team ConquerCourse (`CC`), project `conquercourse`, milestones M0-M5.
- **GitHub:** `gitgithan/conquercourse`, private until reviewed for secrets and names, public before submission.

## Waiting on the product owner
- Add `conquercourse` to the Linear GitHub app's repository access, so "Fixes CC-n" closes issues (steps in `docs/dev-setup.md`).
- Confirm Tripo's commercial rights for the two rookies.
- Self-filming of safe moves, when there's time (spec §13); one real park gap as a photo and as a video for the hero beat.
- Make the repo public at the first reviewed checkpoint.
