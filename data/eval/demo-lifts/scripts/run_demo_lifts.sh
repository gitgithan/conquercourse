#!/usr/bin/env bash
# Reproduces the whole demo-lifts run from the two Commons photos. Run from the repo root.
#   needs: ../conquercourse-assets/demo-photos/ (originals + SHA256SUMS), uv, Node deps (npm ci), ~/.config/ninja/baseten.env, a logged-in Modal client.
#   cost: Baseten (Muse Spark Open) a few small calls; Modal about $0.15 to $0.40 with warm containers (see run.json); no production deploy, it only calls the deployed cc-photo-to-object app.
set -euo pipefail
D=data/eval/demo-lifts
A=${CC_ASSETS_DIR:-../conquercourse-assets}
( cd "$A/demo-photos" && sha256sum -c SHA256SUMS )
mkdir -p $D/inputs && cp "$A"/demo-photos/photo*.jpg $D/inputs/
python3 -I $D/scripts/prep_photos.py $A/demo-photos $D/prep
uv run --no-project --with torch --with torchvision --with pillow python -I $D/scripts/people_check.py $D/people_check.json $D/inputs/photo1_dansbana_ystad.jpg $D/inputs/photo2_rataje_workout.jpg
for p in photo1 photo2; do
  ( set -a; . ~/.config/ninja/baseten.env; set +a; npx tsx $D/scripts/safety_check.ts $D/prep/${p}_thumb.jpg $D/safety/$p.json )
done
MODAL="uv run --no-project --with modal --with numpy<2 --with pillow --with scipy python -I $D/scripts/modal_calls.py"
$MODAL suggest
# --via-flow (owner principle 2026-11-03): lifts go through segment-then-confirm, as the product does.
#   1. maskbox writes evidence/maskbox_<name>.jpg for every lab box (a cheap cut-out preview, no lift).
#   2. Look at the pictures; delete the picture of any cut-out that is wrong and fix its box in objects.json.
#   3. Only then run the lift; it refuses an object without a preview picture.
$MODAL maskbox
$MODAL lift
uv run --no-project --with numpy --with scipy --with pillow --with matplotlib --with xatlas --with fast-simplification python -I $D/scripts/bake_previews.py
uv run --no-project --with numpy --with pillow --with matplotlib python -I $D/scripts/make_evidence.py
# raw outputs (GLBs, raw lifts, masks) leave git: copy to $A/eval-full/demo-lifts/ and write SHA256SUMS there
mkdir -p $A/eval-full/demo-lifts && cp -r $D/lifts $D/suggest $D/prep $A/eval-full/demo-lifts/ && ( cd $A/eval-full/demo-lifts && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )
