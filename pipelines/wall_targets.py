"""Turn the exported simulator wall run into Kimodo targets (CC-17).

    npx tsx scripts/wall-path-export.ts 7 data/eval/cc-17-wall/inputs/sim_path.json
    python pipelines/wall_targets.py data/eval/cc-17-wall/inputs/sim_path.json data/eval/cc-17-wall/inputs/targets.json"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ccpipe import wall_geom  # noqa: E402

if __name__ == "__main__":
    with open(sys.argv[1]) as f:
        sim = json.load(f)
    targets = wall_geom.build_targets(sim)
    with open(sys.argv[2], "w") as f:
        json.dump(targets, f, indent=2)
        f.write("\n")
    print({k: targets[k] for k in ("grab_frame", "hips_to_wrist_at_grab", "hips_to_wrist_at_sim_grab_tick")})
