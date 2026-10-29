#!/usr/bin/env bash
# Overnight spectacle stills on a VM (CC-188): export the course, render Blender stills at 128 samples, take the in-game fx stills.
# Usage on the VM, from a worktree with npm ci done and /root/spectacle/bpyvenv made (see data/eval/cc-spectacle/HANDOVER.md):
#   nohup scripts/spectacle-queue.sh <course.json> <out_dir> > /root/spectacle/queue.log 2>&1 &
# CPU only; about 10 minutes at 128 samples on 8 cores. Stills only: no video is made.
set -euo pipefail
course=${1:-public/assets/demo/training.course.json}
out=${2:-/root/spectacle/queue-out}
mkdir -p "$out"
npx tsx scripts/export-gltf.ts "$course" "$out/course.glb"
. /root/spectacle/bpyvenv/bin/activate
python pipelines/spectacle/render_stills.py "$out/course.glb" public/assets/characters/rookie-a.glb "$out" 128
node scripts/fx-stills.mjs "$out/fx"
echo "done $(date -u +%FT%TZ)" > "$out/DONE"
