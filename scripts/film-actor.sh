#!/usr/bin/env bash
# CC-31: film the Rookie actor clearing the first gap and the wall on the real simulator run (stepped clock, true speed).
# Usage: scripts/film-actor.sh [a|b]  -> test-results/actor-<rookie>.mp4 (copy it to ../conquercourse-assets/evidence/cc-31-actor/)
set -euo pipefail
R="${1:-a}"
mkdir -p test-results/actor-parts
npm run film -- --query "demo=actor&rookie=$R&t0=440" --frames 75 --out "test-results/actor-parts/gap-$R.mp4"
npm run film -- --query "demo=actor&rookie=$R&t0=1190" --frames 75 --out "test-results/actor-parts/wall-$R.mp4"
printf "file 'gap-%s.mp4'\nfile 'wall-%s.mp4'\n" "$R" "$R" > test-results/actor-parts/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i test-results/actor-parts/list.txt -c copy "test-results/actor-$R.mp4"
echo "wrote test-results/actor-$R.mp4"
