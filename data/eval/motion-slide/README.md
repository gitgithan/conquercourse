# Slide clip (CC-240)

- Serves the slide key (S or Down) that dodges a head-high cannonball.
- The question: can Kimodo write a slide that passes the plausibility gate and a slide check?

## So what

- Yes, once: 1 of 36 Kimodo samples (a "sliding tackle" prompt) shows a real drop to a low seat with the legs out in front.
- It is shipped as `public/assets/motion/slide.json`.
- The bone-built crouch stays as the fallback when the file is missing.
- Most prompts make Kimodo run on with a small dip; only "sliding tackle" and "on the back, feet first" got the hips down.

## What was run

- Round 1: 3 prompts (`slide_a` to `slide_c`) times 6 samples, one L4 on Modal, 525 s, about $0.12 (estimate at $0.80 per hour).
  - 18 pass the gate, 0 pass the slide check: the hips never came below 0.6 of their standing height in 17 of them.
  - The one that came down (`slide_b` sample 4) walks backward.
- Round 2: 6 new prompts (`slide_d` to `slide_i`) times 6 samples, 1031 s, about $0.23.
  - 34 of 36 pass the gate.
- First check version asked the hips to travel 1 m.
  - That was wrong: the game moves the body along the ground and draws the clip in place, so a clip need not travel.
  - It now asks for a foot 0.3 m ahead of the hips at the lowest point (legs out in front), and no trunk turn over 110 degrees.
  - The new check is judged on the same 36 clips; no new Kimodo run was paid for.

## The slide check (`pipelines/ccpipe/movecheck.py`, `slide_check`)

- Starts and ends on its feet (hips above 0.8 of standing).
- Hips at or below 0.6 of standing for 0.3 to 1.6 s.
- A foot at least 0.3 m ahead of the hips at the lowest point.
- The trunk never turns more than 110 degrees (a roll or a flip is not a slide).
- Nothing airborne for more than 0.2 s inside the move.
- Tests: `pipelines/tests/test_movecheck.py` (a low run with legs out passes; a crouch with feet under the body, a small dip, a roll and standing do not).

## Result

- Best: `slide_d_s4`, gate pass, check pass: low 1.03 s, lowest hips 0.24 of standing, foot 0.37 m ahead, trunk turn 37 degrees, nothing airborne.
- Pictures: `outputs/slide.png` (also `docs/evidence/slide-kimodo-sheet.png`) and the in-game strip `docs/evidence/slide-in-game.png` (running, 0.2 s, 0.5 s into the slide).
- The other 35 fail the slide check (most never come down); 2 of them also fail the gate; see `run.json`.

## Known gaps

- Kimodo makes a seated drop more than a flat slide on the hip; it reads as a slide at game speed.
- A second round with a different model, or filmed slides, would give a flatter body.
- The sliding tackle is a text-to-motion sample, not a captured motion: by the motion standard it is the minimum bar.

## Where the files are

- Tracked: this README, `run.json`, `inputs/prompts.json`, `inputs/kimodo_run.json`, `outputs/slide.json`, `outputs/slide.png`.
- Raw (36 Kimodo samples, all repaired candidates, both run logs): `../conquercourse-assets/eval-full/motion-slide/raw.tgz`.
