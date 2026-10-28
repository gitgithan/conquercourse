# London Parkour Pop Vault candidate

Source and attribution: [`../../inputs/london-parkour-pop-vault-source.json`](../../inputs/london-parkour-pop-vault-source.json).

The 7-second source segment (video time 32–39 s) was processed at 30000/1001 fps. The source MP4 and raw frames remain outside Git in `/tmp/conquercourse-vault/`.

## Results

- 210 source frames; 130 frames measured by SAM 3D Body; 130 converted to SOMA joints.
- SOMA fit error: 0.97 cm mean, 0.66 cm median.
- Contact extraction found 9 candidate contacts.
- Plausibility gate: **FAIL**.
- Estimated flight acceleration is 3.47 m/s² (expected 9.81 m/s² within 15%), on frames 38–61 of the extracted athlete segment.
- Floor repair fixed foot sinking, but not the flight result.
- Several contacts also persist into the end of the segment, so contact timing needs review.
- Do not ship this candidate as a game animation yet.
- The runner used the default camera field of view, which can affect scale.
- Estimated Modal processing cost: $0.13.

## Reproduction

Frames were extracted from the 30000/1001 fps MP4 using FFmpeg 4.4's `-vsync 0` because that local FFmpeg does not support the pipeline's `-fps_mode passthrough` option. `times.json` records timestamps from `ffprobe`.

```sh
CC_ASSETS_DIR=/tmp/conquercourse-vault/assets \
CC_EVAL_DIR="$PWD/data/eval/motion-vault/outputs" \
uv run --with modal==1.6.3 python pipelines/video_to_motion/run_clip.py london_parkour_pop_vault

CC_ASSETS_DIR=/tmp/conquercourse-vault/assets \
CC_EVAL_DIR="$PWD/data/eval/motion-vault/outputs" \
uv run --with modal==1.6.3 --with 'opencv-python-headless<4.12' \
  python pipelines/video_to_motion/post.py london_parkour_pop_vault
```

See [`contact_sheet.jpg`](contact_sheet.jpg), [`gate.json`](gate.json), [`contacts.json`](contacts.json), and [`motion.json`](motion.json).
