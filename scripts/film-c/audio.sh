#!/bin/bash
# The film's music bed, on a beat grid. Slow half: map loop at 100 bpm, 12 bars (28.8 s). Fast half: course loop at 140 bpm
# stretched by 0.86% so four beats are exactly 51 frames at 30 fps (1.700 s), 24 bars (40.8 s).
# The slow bed fades out over the logo bar; the fast bed starts on the bar line where the catch lands.
# Usage: audio.sh <music dir> <out.m4a>
set -e
M=${1:-public/assets/music}; OUT=${2:-out/bed.m4a}
ffmpeg -y -loglevel error -stream_loop 3 -i "$M/map.ogg" -t 28.8 -af "afade=t=out:st=26.4:d=2.4:curve=qsin" /tmp/slow.wav
ffmpeg -y -loglevel error -stream_loop 8 -i "$M/course.ogg" -af "atempo=1.008571" -t 40.8 -af "atempo=1.008571,afade=t=in:st=0:d=0.02,afade=t=out:st=38.2:d=2.6:curve=qsin" /tmp/fast.wav
ffmpeg -y -loglevel error -i /tmp/slow.wav -i /tmp/fast.wav -filter_complex "[1]adelay=28800|28800[f];[0][f]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95" -t 69.6 -c:a aac -b:a 192k "$OUT"
