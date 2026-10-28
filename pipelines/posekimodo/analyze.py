"""CC-54: run the plausibility gate (unchanged) on every baseline and keyed sample, and measure how close the keyed ones are to their key poses.
Run: python3 pipelines/posekimodo/analyze.py data/eval/pose-kimodo/outputs   (needs numpy)
Writes results.json next to the samples. A sample is shown only if the gate passes; the gate's rules are not changed."""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
from ccpipe import gate  # noqa: E402
from ccpipe.clip import Clip  # noqa: E402
from ccpipe.skeleton import IDX  # noqa: E402
from spec import moves  # noqa: E402

BAR_Y = 2.1


def key_error(frames, keys):
    """Mean distance in metres between the 30 joints at each key frame and the key pose, and the worst joint."""
    errs = [np.linalg.norm(frames[f] - np.asarray(p), axis=-1) for f, p in keys]
    return float(np.mean(errs)), float(np.max(errs))


def swing_amplitude(frames, keys):
    hips_z = frames[:, IDX["Hips"], 2]
    return float(hips_z.max() - hips_z.min())


def summarise(name, frames, spec):
    f = np.asarray(frames)
    clip = Clip(f, 30.0, meta={"supportedBy": spec["supportedBy"]})
    rep = gate.run_gate(clip)
    out = {"gate_pass": rep["pass"], "failures": gate.failures(rep), "hard": {k: r["value"] for k, r in rep["hard"].items()}}
    if name in ("hang", "swing"):
        lo = 80 if name == "hang" else 0
        hands_y = (f[lo:, IDX["LeftHand"], 1] + f[lo:, IDX["RightHand"], 1]) / 2
        out["hands_height_error_m"] = round(float(np.abs(hands_y - BAR_Y).mean()), 3)
    if name == "swing":
        out["hips_z_range_m"] = round(swing_amplitude(f, spec["keys"]), 3)
    if name == "vault":
        out["right_hand_at_frame55_m"] = np.round(f[55, IDX["RightHand"]], 3).tolist()
        out["hips_at_frame55_m"] = np.round(f[55, IDX["Hips"]], 3).tolist()
    m, w = key_error(f, spec["keys"])
    out["key_pose_error_mean_m"], out["key_pose_error_worst_m"] = round(m, 3), round(w, 3)
    return out


def main(d):
    data = json.load(open(os.path.join(d, "kimodo_samples.json")))
    specs = moves(data.get("round", 1))
    results = {}
    for name, item in data["moves"].items():
        spec = specs[name]
        rows = []
        for s in item["samples"]:
            rows.append({"seed": s["seed"], "baseline": summarise(name, s["baseline"], spec), "keyed": summarise(name, s["keyed"], spec)})
        n = len(rows)
        results[name] = {
            "samples": rows,
            "baseline_pass": sum(r["baseline"]["gate_pass"] for r in rows), "keyed_pass": sum(r["keyed"]["gate_pass"] for r in rows), "n": n,
            "baseline_key_error_mean_m": round(float(np.mean([r["baseline"]["key_pose_error_mean_m"] for r in rows])), 3),
            "keyed_key_error_mean_m": round(float(np.mean([r["keyed"]["key_pose_error_mean_m"] for r in rows])), 3),
        }
    with open(os.path.join(d, "results.json"), "w") as f:
        json.dump(results, f, indent=2)
    for name, r in results.items():
        print(name, f"gate pass baseline {r['baseline_pass']}/{r['n']}, keyed {r['keyed_pass']}/{r['n']}; key-pose error baseline {r['baseline_key_error_mean_m']} m, keyed {r['keyed_key_error_mean_m']} m")
        for row in r["samples"]:
            print("  seed", row["seed"], "keyed fails:", row["keyed"]["failures"], "baseline fails:", row["baseline"]["failures"])


if __name__ == "__main__":
    main(sys.argv[1])
