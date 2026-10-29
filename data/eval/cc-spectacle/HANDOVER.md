# Handover: overnight spectacle stills (CC-188)

- Goal: more Blender and in-game stills of a course, with no video.
- Machine: a Vultr VM, CPU only (VM2 `<vm2-address>` was used; VM3 was busy with a load of 24).
- Ready on VM2 already:
  - `/root/spectacle/bpyvenv`: Python 3.11 with `bpy` 5.0.1 (made with `uv venv --python 3.11` and `uv pip install bpy`).
  - `/root/spectacle/repo`: a copy of this branch with `npm ci` done.
- Run: `cd /root/spectacle/repo && nohup scripts/spectacle-queue.sh public/assets/demo/training.course.json /root/spectacle/queue-out > /root/spectacle/queue.log 2>&1 &`
- It writes `/root/spectacle/queue-out/DONE` when it finishes (about 10 to 20 minutes).
- Copy the pictures back with `scp -r root@<vm2-address>:/root/spectacle/queue-out data/eval/cc-spectacle/queue-out`.
- Do not:
  - make any video or clip;
  - touch the vault or climb clips;
  - print or copy any key.
- Open fixes for the next person:
  - The warped wall shows a black face in Blender: check the winding of the side faces in `scripts/export-gltf.ts`.
  - Pick a Rookie pose other than the bind pose (needs the motion import, untested).
