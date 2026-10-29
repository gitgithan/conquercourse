#!/bin/sh
# Records the shots of the proof clip on the stepped clock at the real output rate, one browser at a time (CC-130).
# Every frame is captured: the stepped clock makes a slow software GPU only slower, never choppier, so nothing is blended or repeated.
# Usage: scripts/film-proof.sh [width height fps shot]   (shot: hero, flyover or both; default 1280 720 30 both)
cd "$(dirname "$0")/.."
W=${1:-1280}; H=${2:-720}; FPS=${3:-30}; SHOT=${4:-both}; MEDIA=../conquercourse-assets/demo-media; mkdir -p "$MEDIA/clips" "$MEDIA/music" films
C="course=/assets/demo/park-run.course.json&front=0"
shot() { # name seconds query
  S=$(date +%s)
  node scripts/film.mjs --track --query "$3" --frames $(( $2 * FPS )) --fps $FPS --out films/$1.mp4 --port ${PORT:-5191} --width $W --height $H || exit 1
  echo "$1: $(( $2 * FPS )) frames in $(( $(date +%s) - S )) s"
  cp films/$1.mp4 "$MEDIA/clips/$1.mp4"; cp films/$1.mp4.track.json "$MEDIA/clips/$1.track.json"
}
[ "$SHOT" != flyover ] && shot hero 11 "$C&labels=/film/park-run.hero.labels.json&film=hero&filmx=23.8&filmy=0.7&photo=/assets/park/park01.jpg&size=1024,760&box=294,183,658,454&label=handrail&credit=Photo:+IOR+Skatepark,+Bucharest,+CC0"
[ "$SHOT" != hero ] && shot flyover 10 "$C&labels=/film/park-run.flyover.labels.json&film=flyover&bot=ideal"
echo done > films/proof.done
