"""Kimodo's wall samples -> repaired, pushed out of the wall, contacts snapped, gated and scored (CC-17).

    python pipelines/wall_postprocess.py --samples <assets>/round1/kimodo_samples.json --targets data/eval/cc-17-wall/inputs/targets.json \
        --out data/eval/cc-17-wall/outputs/round1 --assets <assets>/round1

Writes per sample: the final clip (outside git, in --assets), a GIF beside the text-only baseline, and one summary JSON."""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from ccpipe import gate, repairs, wall_contacts as wc, wall_render  # noqa: E402
from ccpipe.clip import Clip  # noqa: E402
from ccpipe.skeleton import IDX, NAMES  # noqa: E402
from ccpipe.wall_geom import Wall  # noqa: E402

SUPPORT = ["a warped wall"]


def clip_of(frames, **meta):
    return Clip(frames, 30.0, meta={"supportedBy": SUPPORT, **meta})


def target_errors(frames, targets):
    """How far each pinned joint is from its target at the middle of its frames (m)."""
    out = {}
    for pin in wc.pins_of(targets):
        a, b = pin["frames"]
        t = (a + b) // 2
        out[f"{pin['joint']}@{a}-{b}"] = round(float(np.linalg.norm(frames[t, IDX[pin["joint"]]] - np.array(pin["point"]))), 3)
    return out


def process(sample, targets, wall, rounds=2):
    raw = np.array(sample["sample"], float)
    f = clip_of(raw)
    f, log = repairs.repair(f)
    frames = f.frames
    for _ in range(rounds):
        frames = wc.push_out(frames, wall, margin=0.02)
        frames, left = wc.contact_ik(frames, wc.pins_of(targets))
    final = clip_of(frames)
    report = gate.run_gate(final)
    score = wc.evaluate(frames, 30.0, targets, wall, report)
    raw_report = gate.run_gate(clip_of(raw))
    raw_score = wc.evaluate(raw, 30.0, targets, wall, raw_report)
    return {"final": frames, "report": report, "score": score, "raw_score": raw_score, "repairs": log, "ik_leftover": left,
            "target_error_raw": target_errors(raw, targets), "target_error_final": target_errors(frames, targets),
            "wall_depth_raw": round(float(wc.inside_wall(raw, wall).max()), 4)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", required=True)
    ap.add_argument("--targets", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--assets", required=True)
    a = ap.parse_args()
    with open(a.samples) as f:
        data = json.load(f)
    with open(a.targets) as f:
        targets = json.load(f)
    assert data["bone_order_names"] == NAMES, "the model's joint order differs from ccpipe.skeleton.NAMES"
    wall = Wall()
    os.makedirs(os.path.join(a.out, "gifs"), exist_ok=True)
    os.makedirs(a.assets, exist_ok=True)
    summary = []
    for s in data["samples"]:
        r = process(s, targets, wall)
        seed = s["seed"]
        Clip(r["final"], 30.0, meta={"supportedBy": SUPPORT, "seed": seed}).save(os.path.join(a.assets, f"sample_seed{seed}.json"))
        base = np.array(s["baseline"], float)
        wall_render.candidate_gif(os.path.join(a.out, "gifs", f"seed{seed}.gif"), r["final"], base, targets, wall, f"seed {seed}: {r['score']['met']}/8")
        row = {"seed": seed, "met_final": r["score"]["met"], "met_raw": r["raw_score"]["met"],
               "failed_final": [k for k, v in r["score"]["lines"].items() if not v["ok"]],
               "failed_raw": [k for k, v in r["raw_score"]["lines"].items() if not v["ok"]],
               "hips_err_final": r["score"]["lines"]["2_hips_on_path"]["value"], "hips_err_raw": r["raw_score"]["lines"]["2_hips_on_path"]["value"],
               "wrists_final": r["score"]["lines"]["3_grab"]["value"], "wrists_raw": r["raw_score"]["lines"]["3_grab"]["value"],
               "hang_frames": r["score"]["lines"]["4_hang"]["value"], "plant": r["score"]["lines"]["5_plant"]["value"],
               "pull_up": r["score"]["lines"]["6_pull_up"]["value"], "wall_depth_final": r["score"]["lines"]["7_wall"]["value"], "wall_depth_raw": r["wall_depth_raw"],
               "gate_failed_final": [k for k, v in r["report"]["hard"].items() if not v["ok"]],
               "soft_failed_final": [k for k, v in r["report"]["soft"].items() if not v["ok"]],
               "target_error_raw_m": r["target_error_raw"], "target_error_final_m": r["target_error_final"], "ik_leftover_m": r["ik_leftover"],
               "repairs": r["repairs"], "gen_s": s["gen_s"], "lines": r["score"]["lines"]}
        summary.append(row)
        print(seed, "final", row["met_final"], "/8 failed", row["failed_final"], "| raw", row["met_raw"], row["failed_raw"], "| hips", row["hips_err_raw"], "->", row["hips_err_final"], "| wall", row["wall_depth_raw"], "->", row["wall_depth_final"])
    best = max(summary, key=lambda r: (r["met_final"], -(r["hips_err_final"] or 9)))
    with open(os.path.join(a.out, "summary.json"), "w") as f:
        json.dump({"round": data["config"].get("round"), "best_seed": best["seed"], "best_met": best["met_final"], "samples": summary}, f, indent=2)
    print("best seed", best["seed"], best["met_final"], "of 8")


if __name__ == "__main__":
    main()
