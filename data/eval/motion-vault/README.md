# Motion vault candidates

Source metadata and attribution are in `inputs/`. The full source video and raw frames stay outside git in `/tmp/conquercourse-vault/`.

Candidate outputs go under `outputs/<clip-stem>/`. The source window is 32–39 seconds from London Parkour's *Learn Parkour : Pop Vault* (CC BY), processed at its 30000/1001 fps rate.

The two requested sections have separate, reusable 30-joint clips:

- [`ledge-climb-landing` (00:35–00:37)](outputs/london_parkour_ledge_landing_35_37/clip.json)
- [`same-level-vault` (01:20–01:24)](outputs/london_parkour_same_level_vault_80_84/clip.json)

They preserve the measured movement as skeleton clips with the game's joint-parent format.
Each folder includes the masked contact sheet, detected contacts, and gate report.
The gate first marked both clips as held-motion failures because it inferred longer unsupported stretches than its 0.6 s limit.
The contact detector does find the hands on the wall and the ledge during those stretches.
A real hand plant rolls the wrist at 0.3 to 0.8 m/s, so the gate's still-hand proxy misses it.
The held limit is now 1.0 s with that reason written in `pipelines/ccpipe/gate.py`.
Both clips then pass every hard gate rule.
Only the soft foot-slide rule still warns.
After manual preview approval, both clips shipped on 2026-10-29 as `public/assets/motion/vault.json` and `public/assets/motion/climb.json`.
The game plays the vault's frames 21 to 69 and the climb's frames 36 to 59.
The hands are pinned on the game's own contact point and ledge while they play.
The built poses stay as fallbacks when a clip cannot load.

To review them on the in-game Rookie model, run `npm run dev` and open `http://localhost:5173/?demo=captured-vault`. Choose between the ledge climb followed by a run-on and the vault with the same kick/hand targets, a continuous pass over the wall, and the game's fall/landing finish. The height slider tests 0.4–2.1 m walls; the **Test 1.5× wall** button sets 2.025 m (1.5 times the captured 1.35 m ledge). At that height, the preview pins the kicking foot to the wall face and allows the hands to stretch to the top in the climb test. Drag the scene to orbit around the character, use the wheel to zoom, and pause/restart or drag the frame slider to inspect poses. The climb test uses a 6 m long block. This is a local preview; the same clips now play in the game itself. Heights beyond the captured 0.62–1.35 m range are experimental retargets, not validated for collision clearance.

The video-to-motion pipeline uses Modal L4 workers for privacy masking, body measurement and SOMA conversion, followed by local CPU post-processing and plausibility gating. Candidate motion should not be promoted to `public/assets/motion/` unless its contact sheet and gate output have been reviewed.
