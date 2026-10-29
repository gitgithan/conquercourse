#!/bin/sh
# Stitches the film's beats into one rough cut (CC-209): each beat is padded or held to its slot on the 100 bpm bar grid, with a REAL or CONCEPT label.
# Usage: scripts/rough-cut.sh <film-dir> <music> <out.mp4>   (beat files are looked up in <film-dir>; a missing clip falls back to its still)
D=$1; M=$2; OUT=$3; T=$(mktemp -d); F="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
seg() { # name seconds source(kind:file) label
  N=$1; S=$2; K=${3%%:*}; P=${3#*:}; L=$4
  LAB="drawtext=fontfile=$F:text='$L':x=24:y=h-44:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8"
  if [ "$K" = still ]; then
    ffmpeg -y -loglevel error -loop 1 -framerate 30 -i "$P" -t "$S" -vf "scale=1536:-1,zoompan=z='1+0.06*on/($S*30)':d=1:s=1280x720:fps=30,$LAB,format=yuv420p" -c:v libx264 -crf 20 "$T/$N.mp4"
  else
    ffmpeg -y -loglevel error -i "$P" -vf "scale=1280:720,fps=30,tpad=stop_mode=clone:stop_duration=$S,trim=duration=$S,setpts=PTS-STARTPTS,$LAB,format=yuv420p" -an -c:v libx264 -crf 20 "$T/$N.mp4"
  fi
}
pick() { if [ -f "$D/$1.mp4" ]; then echo "clip:$D/$1.mp4"; else echo "still:$D/$2.png"; fi; }
seg 1 7.2  "still:$D/beat1-street-map.png"      "BEAT 1  CONCEPT: street map drawn from the stored OpenStreetMap buildings"
seg 2 7.2  "still:$D/beat2-slice.png"           "BEAT 2  CONCEPT: the cut sweeping through"
seg 3 14.4 "still:$D/beat3-blocks-rise.png"     "BEAT 3  CONCEPT: blocks rise; photo and editor beats not yet made"
seg 4 7.2  "$(pick beat4-flyby beat3-blocks-rise)" "BEAT 4  REAL if a clip, else placeholder: fly-by of the hero course"
seg 5 14.4 "$(pick beat5-run beat3-blocks-rise)" "BEAT 5  REAL (wide, far take; close take not yet made): the ideal-plan replay"
seg 7 7.2  "clip:$D/beat5-leap.mp4"             "BEAT 7  REAL: leap to the rope, cut before the catch"
seg 8 9.6  "clip:$D/beat8-endcard.mp4"          "BEAT 8  DESIGNED: logo and tagline"
for i in 1 2 3 4 5 7 8; do echo "file '$T/$i.mp4'"; done > "$T/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$T/list.txt" -i "$M" -t 67.2 -c:v libx264 -crf 20 -c:a aac -b:a 160k -shortest "$OUT"
echo "wrote $OUT"; rm -rf "$T"
