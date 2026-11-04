#!/bin/bash
# Compose the 3x3 grid from nine takes of scripts/film-char-facing.mjs.
# usage: compose.sh FRAMES_DIR OUT.mp4   (FRAMES_DIR holds <char>-<col>/f00000.jpg ..., char = banana|skater|potato, col = asmade|right|left)
# Each take is 1280x720; the crop below follows the runner (set per take in CROPS: "x:y" of the top-left of a 400x300 window).
set -euo pipefail
D=$1; OUT=$2; W=480; H=360; LBL=190; TOP=56
FONT=$(fc-match -f '%{file}' 'DejaVu Sans:bold')
declare -A CROPS=(); [ -n "${CROPS_OVERRIDE:-}" ] && eval "CROPS=($CROPS_OVERRIDE)"
tmp=$(mktemp -d)
rows=(banana skater potato); cols=(asmade right left)
names=("Banana" "Skater" "Potato Blob"); heads=("As made (before the fix)" "Fixed, running right" "Fixed, running left")
for r in "${rows[@]}"; do for c in "${cols[@]}"; do
  xy=${CROPS["$r-$c"]:-${CROPS["default-$c"]:-0:305}}
  ffmpeg -loglevel error -y -framerate 30 -i "$D/$r-$c/f%05d.jpg" -frames:v ${KEEP:-75} -vf "crop=400:300:${xy%%:*}:${xy##*:},scale=${W}:${H}:flags=lanczos,format=yuv420p" -an "$tmp/$r-$c.mp4"
done; done
ins=(); lay=(); i=0
for ri in 0 1 2; do for ci in 0 1 2; do ins+=(-i "$tmp/${rows[$ri]}-${cols[$ci]}.mp4"); lay+=("$((LBL + ci*W))_$((TOP + ri*H))"); i=$((i+1)); done; done
IFS='|'; L="${lay[*]}"; unset IFS
f="color=c=0x14202b:s=$((LBL+3*W))x$((TOP+3*H)):r=30[bg];"
for k in $(seq 0 8); do f+="[$k:v]setpts=PTS-STARTPTS[v$k];"; done
f+="[v0][v1][v2][v3][v4][v5][v6][v7][v8]xstack=inputs=9:layout=$L:fill=0x14202b[g];"
f+="[bg]null[b0];[b0][g]overlay=0:0:shortest=1[o]"
dt=""
for ci in 0 1 2; do dt+="drawtext=fontfile=$FONT:text='${heads[$ci]}':fontsize=22:fontcolor=white:x=$((LBL + ci*W + 12)):y=16,"; done
for ri in 0 1 2; do dt+="drawtext=fontfile=$FONT:text='${names[$ri]}':fontsize=24:fontcolor=white:x=14:y=$((TOP + ri*H + H/2 - 14)),"; done
f+=";[o]${dt%,}[out]"
ffmpeg -loglevel error -y "${ins[@]}" -filter_complex "$f" -map "[out]" -c:v libx264 -crf ${CRF:-26} -preset slow -pix_fmt yuv420p -movflags +faststart -an "$OUT"
rm -rf "$tmp"; ls -l "$OUT"
