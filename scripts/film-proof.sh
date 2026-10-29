#!/bin/sh
# Records the two shots of the 20 s proof clip on the stepped clock, one browser at a time (CC-130). Usage: scripts/film-proof.sh [width height]
cd "$(dirname "$0")/.."
W=${1:-1280}; H=${2:-720}; MEDIA=../conquercourse-assets/demo-media; mkdir -p "$MEDIA/clips" "$MEDIA/music" films
C="course=/assets/demo/park-run.course.json"
node scripts/film.mjs --track --query "$C&labels=/film/park-run.hero.labels.json&front=0&film=hero&filmx=23.8&filmy=0.7&photo=/assets/park/park01.jpg&size=1024,760&box=294,183,658,454&label=handrail&credit=Photo:+IOR+Skatepark,+Bucharest,+CC0" --frames 165 --fps 15 --out films/hero.mp4 --port ${PORT:-5191} --width $W --height $H || exit 1
node scripts/film.mjs --track --query "$C&labels=/film/park-run.flyover.labels.json&front=0&film=flyover&bot=ideal" --frames 143 --fps 15 --out films/flyover.mp4 --port ${PORT:-5191} --width $W --height $H || exit 1
for n in hero flyover; do ffmpeg -loglevel error -y -i films/$n.mp4 -vf "minterpolate=fps=30:mi_mode=blend" -c:v libx264 -pix_fmt yuv420p -crf 18 "$MEDIA/clips/$n.mp4"; done
cp /root/cc/conquercourse-assets/music/scaling_up.mp3 "$MEDIA/music/" 2>/dev/null || cp ../conquercourse-assets/music/scaling_up.mp3 "$MEDIA/music/"
echo done > films/proof.done
