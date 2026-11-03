#!/usr/bin/env bash
# Reproduces the bar-photos run (CC-133). Run from the repo root.
#   needs: ../conquercourse-assets/bar-photos/ (photos + SHA256SUMS), uv, a logged-in Modal client; the deployed app cc-photo-to-object is only called, nothing is deployed.
#   cost: about $0.05 on Modal for 8 photos (finder under $0.002 each, lift about $0.005 each warm); no other paid service.
set -euo pipefail
D=data/eval/bar-photos
A=${CC_ASSETS_DIR:-../conquercourse-assets}
( cd "$A/bar-photos" && sha256sum -c SHA256SUMS )
mkdir -p $D/inputs && cp "$A"/bar-photos/photo*.jpg $D/inputs/
python3 -I $D/scripts/prep_photos.py $A/bar-photos $D/prep
MODAL="uv run --no-project --with modal --with numpy<2 --with pillow --with scipy python -I -u $D/scripts/modal_calls.py"
$MODAL suggest                                   # privacy blur + Segment Objects with the bar phrases
uv run --no-project --with numpy --with pillow python -I $D/scripts/finder_bars.py   # look: did the finder outline the bars?
# objects.json holds one box per photo: the finder's box when it found the bars, a hand-drawn box (Mark it yourself) when it did not
$MODAL maskbox                                   # cut-out preview; LOOK at evidence/maskbox_*.jpg before the next line
$MODAL lift                                      # refuses a photo without a cut-out picture
uv run --no-project --with numpy --with scipy --with pillow --with matplotlib --with xatlas --with fast-simplification python -I $D/scripts/bake_previews.py
uv run --no-project --with numpy --with pillow python -I $D/scripts/make_evidence.py
mkdir -p $A/eval-full/bar-photos && cp -r $D/lifts $D/suggest $D/prep $D/evidence $A/eval-full/bar-photos/ && ( cd $A/eval-full/bar-photos && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )
