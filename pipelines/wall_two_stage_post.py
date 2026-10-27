"""One stage's Kimodo samples -> repaired, pushed out of the wall, contacts snapped, gated and scored against its pass lines (CC-36).

    python pipelines/wall_two_stage_post.py --stage a --samples <assets>/round1/a/kimodo_samples.json \
        --targets data/eval/cc-36-wall-two-stage/inputs/targets_a.json --out data/eval/cc-36-wall-two-stage/outputs/round1/a --assets <assets>/round1/a

Stage B comes back in the ledge's local frame and is moved into the world first. Writes per sample: the final clip (outside git, in
--assets), a GIF beside the text-only baseline, and one summary JSON."""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from ccpipe import gate, repairs, wall_contacts as wc, wall_render, wall_stages as ws  # noqa: E402
from ccpipe.clip import Clip  # noqa: E402
from ccpipe.skeleton import NAMES  # noqa: E402
from ccpipe.wall_geom import Wall  # noqa: E402
from wall_postprocess import SUPPORT, clip_of, target_errors  # noqa: E402


def process(stage, raw, targets, wall, rounds=2):
    """raw: (T, 30, 3) in the world. Returns the final frames, the gate report, the score and the raw score."""
    score = ws.evaluate_a if stage == "a" else ws.evaluate_b
    f, log = repairs.repair(clip_of(raw))
    frames = f.frames
    for _ in range(rounds):
        frames = wc.push_out(frames, wall, margin=0.02)
        frames, left = wc.contact_ik(frames, wc.pins_of(targets))
    report = gate.run_gate(clip_of(frames))
    raw_report = gate.run_gate(clip_of(raw))
    return {"final": frames, "report": report, "score": score(frames, targets, wall, report), "raw_score": score(raw, targets, wall, raw_report),
            "repairs": log, "ik_leftover": left, "target_error_raw": target_errors(raw, targets), "target_error_final": target_errors(frames, targets),
            "wall_depth_raw": round(float(wc.inside_wall(raw, wall).max()), 4)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", required=True, choices=["a", "b"])
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
    shift = np.array(targets.get("world_shift", [0, 0, 0]))
    world = ws.world_targets_b(targets) if a.stage == "b" else targets
    wall = Wall()
    os.makedirs(os.path.join(a.out, "gifs"), exist_ok=True)
    os.makedirs(a.assets, exist_ok=True)
    summary = []
    for s in data["samples"]:
        raw = np.array(s["sample"], float) + shift
        r = process(a.stage, raw, world, wall)
        seed = s["seed"]
        Clip(r["final"], 30.0, meta={"supportedBy": SUPPORT, "seed": seed, "stage": a.stage}).save(os.path.join(a.assets, f"sample_seed{seed}.json"))
        wall_render.candidate_gif(os.path.join(a.out, "gifs", f"seed{seed}.gif"), r["final"], np.array(s["baseline"], float) + shift, world, wall,
                                  f"{a.stage.upper()} seed {seed}: {r['score']['met']}/{r['score']['of']}")
        lines = r["score"]["lines"]
        row = {"seed": seed, "met_final": r["score"]["met"], "met_raw": r["raw_score"]["met"], "of": r["score"]["of"],
               "failed_final": [k for k, v in lines.items() if not v["ok"]], "failed_raw": [k for k, v in r["raw_score"]["lines"].items() if not v["ok"]],
               "gate_failed_final": [k for k, v in r["report"]["hard"].items() if not v["ok"]],
               "soft_failed_final": [k for k, v in r["report"]["soft"].items() if not v["ok"]],
               "wall_depth_raw": r["wall_depth_raw"], "target_error_raw_m": r["target_error_raw"], "target_error_final_m": r["target_error_final"],
               "ik_leftover_m": r["ik_leftover"], "repairs": r["repairs"], "gen_s": s["gen_s"], "lines": lines}
        summary.append(row)
        print(seed, "final", row["met_final"], "/", row["of"], "failed", row["failed_final"], "| raw", row["met_raw"], row["failed_raw"], "| gate", row["gate_failed_final"])
    best = max(summary, key=lambda r: (r["met_final"], -len(r["gate_failed_final"])))
    with open(os.path.join(a.out, "summary.json"), "w") as f:
        json.dump({"stage": a.stage, "round": data["config"].get("round"), "best_seed": best["seed"], "best_met": best["met_final"], "of": best["of"], "samples": summary}, f, indent=2)
    print("best seed", best["seed"], best["met_final"], "of", best["of"])


if __name__ == "__main__":
    main()
