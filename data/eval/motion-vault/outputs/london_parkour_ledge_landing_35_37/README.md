# Ledge climb and higher landing candidate

Source: [Learn Parkour : Pop Vault by London Parkour](https://www.youtube.com/watch?v=gP9CHhAmEP4), licensed under Creative Commons Attribution (reuse allowed). Requested source window: 00:35–00:37. See [source metadata](../../inputs/london-parkour-pop-vault-source.json).

`clip.json` is the measured 30-joint movement in the game's `names` / `parents` / `fps` / `frames` clip format. It uses the video-to-motion pipeline's filtered, floor-repaired frames; no poses were hand-authored. Source MP4 and raw frame images remain outside Git under `/tmp/conquercourse-vault/`.

## Capture review

The athlete is visible throughout this window. The captured sequence rises onto the wall and ends with both feet on the higher top.

Modal measured 60 frames at 30000/1001 fps; estimated processing cost: $0.06. The video-to-motion worker used its default field of view. The contact sheet is privacy-masked.

## Gate

The clip is marked as held by a higher ledge, so ballistic free-flight is not judged. The gate still reports `held_clips_are_held = false`: inferred unsupported stretches are 0.8675 s (limit 0.6 s). Knee direction/range and teleport checks pass; floor repair passes. This is a direct movement capture for review, not a gate-approved shipped animation.

See [contact sheet](contact_sheet.jpg), [detected contacts](contacts.json), [gate report](gate.json), [pipeline skeleton](motion.json), and reusable [game-format skeleton](clip.json).
