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
- **Never:** formulas on screen; chat tutors; grading or coaching a person's technique; Moon or low-gravity scenarios; robotics framing; footage of minors.
- **Never commit:** secrets (keys live in private env files outside the repo), the product owner's name, home paths or workspace names, big binaries (they go in `../conquercourse-assets/` with `SHA256SUMS`).
- **Every asset gets a row in `docs/ASSETS.md`** before the game uses it.
- **No motion is shown before it passes the plausibility check;** experiments live in `public/assets/experiments/`.

## How work is tracked
- **Linear:** team ConquerCourse (key `CC`), project `conquercourse`, milestones M0-M5 from the spec.
- **Issue first:** create the issue (one testable outcome, about half a day) before writing code; its first line says which player, lesson or demo beat it serves.
- **Commits:** one logical change per commit, one issue per commit; every message carries a magic word: "Part of CC-12" for partial work, "Fixes CC-12" only on the commit that finishes it (we push to `main`, so "Fixes" closes the issue at once).
- **Findings:** a one-line Linear comment plus the details in the repo (the relevant doc or `data/eval/<experiment>/README.md`).

## How work is done
- **Main work happens on the laptop** (the product owner watches at `http://localhost:5173`); the Vultr VM is extra compute: self-contained tasks on their own branches, pulled, reviewed and merged on the laptop.
- **At most one browser test run at a time on the laptop** (about 7 GB of RAM); heavy runs go to the VM.
- **Tests:** physics-law tests first; `npm run test:quick` on every change and before every merge; browser smoke tests after UI changes.
- **Visual evidence:** a UI or motion change is done only with a screenshot or clip under `test-results/` (copied out before the next run) and linked in its issue; films use the stepped clock.
- **Experiment trail:** every experiment saves its inputs, outputs and a `run.json` in `data/eval/<experiment>/`.
- **Spending:** state the cost before any paid step and which credits do or don't cover it.
- **New feature?** Put it behind a feature switch so new players aren't shown everything at once.

## Writing style
- Bullets, one idea each; never start a new sentence in the middle of a line (docs, plans, Linear, commit messages).
- Plain words a 13-year-old can follow in anything a player sees.
