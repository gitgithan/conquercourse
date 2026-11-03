"""Kimodo's monkey-bar samples -> repaired, gated, checked and scored against the targets (CC-133).

    python pipelines/bars_postprocess.py --samples <assets>/r1/travel/kimodo_samples.json --targets data/eval/bar-motion/inputs/travel.json \
        --kind travel --out data/eval/bar-motion/outputs/r1-travel.json [--clips <dir to write the passing clips>]

Per sample, for the constrained result and for the text-only baseline that came with it: the gate (clip marked `supportedBy` "overhead bars"),
the bar check for the kind (travel, idle, kip) and how far each hand was from its rung while it should have been holding it."""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ccpipe import barscheck, gate, repairs  # noqa: E402
from ccpipe.clip import Clip  # noqa: E402
from ccpipe.skeleton import IDX  # noqa: E402

SUPPORT = ["overhead bars"]


def grip_errors(frames, targets):
    errs = []
    for g in targets["grips"]:
        a, b = g["frames"]
        mid = (a + b) // 2
        errs.append(float(np.linalg.norm(frames[mid, IDX[g["joint"]]] - np.array(g["point"]))))
    return errs


def judge(raw, kind, targets):
    clip = Clip(raw, 30.0, meta={"supportedBy": SUPPORT})
    fixed, log = repairs.repair(clip)
    rep = gate.run_gate(fixed)
    ok, nums = barscheck.CHECKS[kind](fixed)
    errs = grip_errors(fixed.frames, targets)
    return fixed, {"gate_pass": rep["pass"], "gate_failed": gate.failures(rep), "soft_failed": [k for k, r in rep["soft"].items() if not r["ok"]],
                   "bar_check_ok": ok, "bar_numbers": nums, "grip_error_m": {"mean": round(float(np.mean(errs)), 3), "max": round(float(np.max(errs)), 3)},
                   "repairs": log}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", required=True)
    ap.add_argument("--targets", required=True)
    ap.add_argument("--kind", required=True, choices=list(barscheck.CHECKS))
    ap.add_argument("--out", required=True)
    ap.add_argument("--clips", default=None)
    a = ap.parse_args()
    data, targets = json.load(open(a.samples)), json.load(open(a.targets))
    rows = []
    for s in data["samples"]:
        row = {"seed": s["seed"]}
        for label in ("sample", "baseline"):
            fixed, r = judge(np.array(s[label], float), a.kind, targets)
            row[label] = r
            if label == "sample" and a.clips and r["gate_pass"] and r["bar_check_ok"]:
                os.makedirs(a.clips, exist_ok=True)
                fixed.copy(id=f"bars_{a.kind}", move=f"bars_{a.kind}", source=f"Kimodo {data['model']} with hand and hips constraints, seed {s['seed']}",
                           supportedBy=SUPPORT).save(os.path.join(a.clips, f"bars_{a.kind}_s{s['seed']}.json"))
        rows.append(row)
    summary = {lab: {"gate_pass": sum(r[lab]["gate_pass"] for r in rows), "bar_check_ok": sum(r[lab]["bar_check_ok"] for r in rows),
                     "both": sum(r[lab]["gate_pass"] and r[lab]["bar_check_ok"] for r in rows), "of": len(rows)} for lab in ("sample", "baseline")}
    out = {"kind": a.kind, "prompt": data["config"].get("prompt"), "model": data["model"], "kimodo_commit": data["kimodo_commit"], "steps": data["steps"],
           "summary": summary, "samples": rows}
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(json.dumps(summary))
    for r in rows:
        s = r["sample"]
        print(r["seed"], "gate", s["gate_pass"], s["gate_failed"], "bars", s["bar_check_ok"], "grip err", s["grip_error_m"], {k: v for k, v in s["bar_numbers"].items() if k in ("hang_share", "hips_travel_m")})


if __name__ == "__main__":
    main()
