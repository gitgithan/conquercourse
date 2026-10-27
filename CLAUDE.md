# ConquerCourse: instructions for Claude and other agents

A ninja-warrior physics game where real parks and real moves become the course, built for the Meta Global AI Developer Hackathon (2026-10-26 to 2026-11-04).
*Train slow. Run fast.*

## Read first
- `docs/spec/SPEC.md`: the source of truth (product, physics, motion, Park, agents, architecture, tests, demo, plan, risks).
- `docs/lessons.md`: what we already know, with reasons.
- `docs/ASSETS.md` and `docs/PRIOR-WORK.md`: where every non-code file came from, and what is new.
- `docs/sayings.md`: one physics saying per obstacle.

## Hard rules
- **New work only:** never copy code from the practice project; write it from the spec.
- **Never:** formulas on screen, except as the last, earned step of a Dojo lesson (owner, 2026-10-27; never on the Course); chat tutors; grading or coaching a person's technique; Moon or low-gravity scenarios; robotics framing; footage of minors.
- **Never commit:** secrets (keys live in private env files outside the repo), the product owner's name, home paths or workspace names, big binaries (they go in `../conquercourse-assets/` with `SHA256SUMS`).
- **Every asset gets a row in `docs/ASSETS.md`** before the game uses it.
- **No motion is shown before it passes the plausibility check;** experiments live in `public/assets/experiments/`.

## How work is tracked
- **Linear:** team ConquerCourse (key `CC`), project `conquercourse`, milestones M0-M5 from the spec.
- **Every issue opens with a Links block:**
  - "Depends on", "Affects" and "Why this exists" are headings.
  - Under each, one sub-bullet per linked issue (`CC-n: the reason`), never a run-on sentence listing several issues.
  - "Why this exists" says whether it was planned in the spec or which finding in which issue created it.
  - Also set the blocked-by relations in Linear so the product owner can travel both ways.
- **Every issue also has a "Definition of Done"** (a checklist, ticked as it is met) **and "How we judge quality"** (the tests, measurements, side-by-side or by-eye checks, and any known gap); an issue closes only when every box is ticked.
- **Issue first:** create the issue (one testable outcome, about half a day) before writing code; its first line says which player, lesson or demo beat it serves.
- **Commits:** one logical change per commit, one issue per commit; every message carries a magic word: "Part of CC-12" for partial work, "Fixes CC-12" only on the commit that finishes it.
- **Ship through a pull request:**
  - Linear's GitHub app only reacts to pull requests, not to commits pushed straight to `main` (tested 2026-10-27).
  - Work on a branch named `hanqi91/cc-12-short-name`.
  - Run `scripts/ship.sh CC-12 --part` (or `--fixes` on the finishing change); it tests, rebases, opens the pull request with the magic word, and rebase-merges it.
  - Linear then links the pull request and moves or closes the issue by itself; never close issues by hand.
- **Findings:** a one-line Linear comment plus the details in the repo (the relevant doc or `data/eval/<experiment>/README.md`).

## How work is done
- **Main work happens on the laptop** (the product owner watches at `http://localhost:5173`); the Vultr VM is extra compute: self-contained tasks on their own branches, pulled, reviewed and merged on the laptop.
- **At most one browser test run at a time on the laptop** (about 7 GB of RAM); heavy runs go to the VM.
- **JSON is committed pretty-printed** (2 spaces): write it with `indent=2` or run `npm run format:json`; `npm run test:quick` fails on unformatted files.
- **Order by dependencies:** before an issue or experiment, list what it needs (upstream issues, tools, known lessons in `docs/`); build those first or flag the block; a weakened test that fails is "not tested", not "failed".
- **Reports lead with the so-what:** what it means for the game and demo in project terms, the recommendation and the next step; technical detail after.
- **Tests:** physics-law tests first; `npm run test:quick` on every change and before every merge; browser smoke tests after UI changes.
- **Visual evidence:** a UI or motion change is done only with a screenshot or clip under `test-results/` (copied out before the next run) and linked in its issue; films use the stepped clock.
- **Experiment trail:** every experiment saves its inputs, outputs and a `run.json` in `data/eval/<experiment>/`.
- **Spending:** state the cost before any paid step and which credits do or don't cover it.
- **New feature?** Put it behind a feature switch so new players aren't shown everything at once.

## Writing style
- Bullets, one idea each; never start a new sentence in the middle of a line (docs, plans, Linear, commit messages).
- Plain words a 13-year-old can follow in anything a player sees.
