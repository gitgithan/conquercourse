"""Targets for the two wall stages (CC-36).

    python pipelines/wall_two_stage_targets.py data/eval/cc-17-wall/inputs/sim_path.json data/eval/cc-36-wall-two-stage/inputs"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ccpipe import wall_stages  # noqa: E402

if __name__ == "__main__":
    with open(sys.argv[1]) as f:
        sim = json.load(f)
    os.makedirs(sys.argv[2], exist_ok=True)
    for name, t in (("targets_a.json", wall_stages.build_targets_a(sim)), ("targets_b.json", wall_stages.build_targets_b())):
        with open(os.path.join(sys.argv[2], name), "w") as f:
            json.dump(t, f, indent=2)
            f.write("\n")
        if name == "targets_a.json":
            lo = wall_stages.lowered(t, 0.7)
        else:
            lo = wall_stages.lowered(t, 0.6)
        with open(os.path.join(sys.argv[2], name.replace(".json", "_r2.json")), "w") as f:
            json.dump(lo, f, indent=2)
            f.write("\n")
        print(name, {k: v for k, v in t.items() if k in ("frames", "hips_rise", "hips_to_edge_wrist_at_end", "hips_to_wrist_at_hang")}, [(p["joint"], p["frames"], p["point"], p.get("hips_to_ankle")) for p in t["plants"]])
