"""CMU subject 01 (playground) scan for monkey-bar motion (CC-133): gate and bar checks on every hang stretch, plus the shipped hang and swing clips.

    python pipelines/bars_eval.py --cmu <dir with 01.asf and 01_01.amc .. 01_14.amc> --out data/eval/bar-motion/outputs/cmu-scan.json

A stretch is a run of frames with both hands above the head and the feet off the floor for at least 1.5 s. Each is cut out, marked
`supportedBy` "playground bars", repaired the same way as every shipped clip, gated and checked as travel, idle and kip."""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ccpipe import barscheck, cmu, gate, repairs  # noqa: E402
from ccpipe.clip import Clip  # noqa: E402
from ccpipe.motion import _runs  # noqa: E402
from ccpipe.skeleton import FEET, IDX  # noqa: E402
import numpy as np  # noqa: E402


def judge(clip):
    fixed, log = repairs.repair(clip)
    rep = gate.run_gate(fixed)
    out = {"gate_pass": rep["pass"], "gate_failed": gate.failures(rep), "checks": {}}
    for kind, fn in barscheck.CHECKS.items():
        ok, nums = fn(fixed)
        out["checks"][kind] = {"ok": ok, **nums}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cmu", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    asf = open(os.path.join(a.cmu, "01.asf")).read()
    res = {"source": "CMU Graphics Lab Motion Capture, subject 01 (playground), trials 01_01 to 01_14", "stretches": [], "shipped": {}}
    for i in range(1, 15):
        t = f"01_{i:02d}"
        c = cmu.import_trial(asf, open(os.path.join(a.cmu, f"{t}.amc")).read(), 120)
        f = c.frames
        head = f[:, IDX["Head"], 1]
        hang = (f[:, IDX["LeftHand"], 1] > head) & (f[:, IDX["RightHand"], 1] > head) & (f[:, FEET, 1].min(axis=1) > 0.1)
        for lo, hi in _runs(hang):
            if (hi - lo) / 30 < 1.5:
                continue
            seg = Clip(f[lo:hi].copy(), 30.0, meta={"supportedBy": ["playground bars"]})
            seg.frames[:, :, [0, 2]] -= seg.frames[0, 0, [0, 2]]
            res["stretches"].append({"trial": t, "frames": [int(lo), int(hi)], "seconds": round((hi - lo) / 30, 2), **judge(seg)})
    for name in ("hang", "swing"):
        c = Clip.load(os.path.join(HERE, "..", "public", "assets", "motion", f"{name}.json"))
        res["shipped"][name] = judge(c)
    best = {k: [s for s in res["stretches"] if s["gate_pass"] and s["checks"][k]["ok"]] for k in barscheck.CHECKS}
    res["summary"] = {"stretches": len(res["stretches"]), **{f"pass_gate_and_{k}": len(v) for k, v in best.items()}}
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(res, f, indent=2)
        f.write("\n")
    print(json.dumps(res["summary"]))
    for s in res["stretches"]:
        print(s["trial"], s["frames"], s["seconds"], "gate", s["gate_pass"], {k: v["ok"] for k, v in s["checks"].items()})


if __name__ == "__main__":
    main()
