# Status: where the build stands, and what to do next

*Kept current by whoever works; a new session reads this first, after `CLAUDE.md`.*

## Now (2026-10-27, afternoon)
- **Done:**
  - CC-1 to CC-2: repo, knowledge, app skeleton.
  - CC-5 to CC-10: the simulator (sprint, braking, flight, gap, steps, landing, warped wall, rope, trampoline) and the ideal-run search.
  - CC-24 and CC-26: the SAM 3.1 spike and the Pexels clips.
- **Playable on main:**
  - The Course (`/`), the Dojo (`/?mode=dojo`), and a hands-free bot (`/?bot=ideal`).
  - Run `npm run dev`, then open `http://localhost:5173`.
- **Running on the VM:**
  - CC-16 (Rookie in the game) and CC-3 (true-speed film helper).
  - CC-25 (photo to course, the hero beat).
  - CC-29 (video ingest; the wall clip fails the gate, so it becomes Kimodo targets).
- **Next, in order:**
  1. Merge the CC-16, CC-3 and CC-25 branches; fix conflicts in `src/main.ts`.
  2. Film the demo beats (CC-28) with the film helper.
  3. The wall clip from targets (CC-17) and the strobe overlay (CC-27).
  4. A real person plays it (CC-15, CC-11 notes).
- **Issue numbers:** CC-1 to CC-18 and CC-24 to CC-29; CC-19 to CC-23 do not exist.

## Machines and access (all checked 2026-10-27)
- **Laptop:** main work and the dev server (`http://localhost:5173`); at most one browser test run at a time.
- **Vultr VM** (`root@207.148.123.42`): Claude Code logged in (`ssh root@<vm> 'claude -p "<task>"'`); a deploy key that pushes only to this repo (`GIT_SSH_COMMAND="ssh -i /root/.ssh/cc_deploy -o IdentitiesOnly=yes"`); the Meta key (`/root/.config/ninja/meta.env`), Modal token and Linear key in private files.
  - About $0.22 an hour while running.
- **Linear:** team ConquerCourse (`CC`), project `conquercourse`, milestones M0-M5.
- **GitHub:** `gitgithan/conquercourse`, private until reviewed for secrets and names, public before submission.

## Waiting on the product owner
- Add `conquercourse` to the Linear GitHub app's repository access, so "Fixes CC-n" closes issues (steps in `docs/dev-setup.md`).
- Confirm Tripo's commercial rights for the two rookies.
- Self-filming of safe moves, when there's time (spec §13); one real park gap as a photo and as a video for the hero beat.
- Make the repo public at the first reviewed checkpoint.
