#!/bin/sh
# Records the takes of the 20 s hook on the stepped clock, one browser at a time (CC-143).
# Usage: scripts/film-hook.sh <out-dir> <width> <height> <take...>   (takes: hero foot dash hand swing landing)
# Every frame is captured and hashed; film.mjs prints the exact duplicates it had to re-wait for.
cd "$(dirname "$0")/.."
OUT=$1; W=$2; H=$3; shift 3; FPS=30; mkdir -p "$OUT" films
L="course=/assets/demo/lache.course.json&front=0&bot=ideal&film=macro"
take() { # name frames query [film.mjs flags]
  N=$1; F=$2; Q=$3; shift 3; S=$(date +%s)
  node scripts/film.mjs --track --query "$Q" --frames "$F" --fps $FPS --out "$OUT/$N.mp4" --port ${PORT:-5191} --width "$W" --height "$H" "$@" || exit 1
  echo "$N: $F frames in $(( $(date +%s) - S )) s"
}
for t in "$@"; do case $t in
  hero) take hero 132 "course=/assets/demo/park-run.course.json&front=0&labels=/film/park-run.hero.labels.json&film=hero&filmx=23.8&filmy=0.7&photo=/assets/park/park01.jpg&size=1024,760&box=294,183,658,454&label=handrail&credit=Photo:+IOR+Skatepark,+Bucharest,+CC0" ;;
  foot) take foot 54 "$L&labels=/film/hook-foot.labels.json&filmx=0.2&filmy=0.1&md=1.8" --from-x 31.2 ;;
  dash) take dash 54 "course=/assets/demo/park-run.course.json&front=0&bot=ideal&film=flyover&dur=1.8&labels=/film/hook-dash.labels.json" ;;
  hand) take hand 54 "$L&labels=/film/hook-hand.labels.json&filmx=0.2&filmy=1.2&md=5" --from-x 37.0 --ramp 0,1.8,0.5 ;;
  swing) take swing 126 "$L&labels=/film/hook-swing.labels.json&filmx=0.3&filmy=1.2&md=8" --from-x 37.8 --ramp 1.5,4.2,0.25 ;;
  landing) take landing 54 "$L&filmx=0&filmy=0.5&md=5" --from-x 44.0 ;;
esac; done
