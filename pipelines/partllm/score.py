"""Score PartLLM text-guided output against data/eval/partllm/answer-key.json and draw one picture per object.

Usage: python3 -I pipelines/partllm/score.py   (needs numpy, trimesh, matplotlib)
Hit for a 'present' prompt: the part has at least half of its area inside the hold region (precision)
and covers at least a third of the region (recall). A 'false claim' is a part returned for an 'absent' prompt.
"""
import json
import pathlib
import re

import matplotlib
import numpy as np
import trimesh

matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = pathlib.Path("data/eval/partllm")
OBJ = pathlib.Path("public/assets/objects")
KEY = json.loads((OUT / "answer-key.json").read_text())["objects"]
PROMPTS = ["bar", "rail", "ledge", "step"]


def load(name):
    sc = trimesh.load(OBJ / f"{name}.glb")
    return trimesh.util.concatenate(sc.dump())


def hold_mask(m, hold):
    c = m.triangles_center
    if "box" in hold or "boxes" in hold:
        mask = np.zeros(len(c), bool)
        for b in [hold["box"]] if "box" in hold else hold["boxes"]:
            mask |= np.all((c >= b[:3]) & (c <= b[3:]), axis=1)
        return mask
    s, d = hold["slice_m"], hold["depth_m"]
    idx = np.floor((c[:, 0] - c[:, 0].min()) / s).astype(int)
    mask = np.zeros(len(c), bool)
    for i in np.unique(idx):
        sel = idx == i
        mask[sel] = c[sel, 1] >= c[sel, 1].max() - d
    return mask


def parts_of(name):
    d = OUT / "raw" / "text" / name / name
    labels = np.load(d / "face_labels.npy")
    info = (d / "info.txt").read_text()
    names = {int(i): n.strip().lower() for i, n in re.findall(r"class (\d+) \[[a-z]+\]: (\S+)", info)}
    return labels, names


rows, run = [], {}
for name, spec in KEY.items():
    m = load(name)
    labels, names = parts_of(name)
    ok = len(labels) == len(m.faces)
    area = m.area_faces
    hold = hold_mask(m, spec["hold"])
    res = {"faces_match": bool(ok), "prompts": {}}
    fig, ax = plt.subplots(1, 5, figsize=(20, 3.6))
    c = m.triangles_center
    ax[0].scatter(c[:, 0], c[:, 1], s=1, c=np.where(hold, "tab:green", "lightgrey"))
    ax[0].set_title(f"{name}: answer key (green)")
    for k, p in enumerate(PROMPTS):
        cls = [i for i, n in names.items() if n == p]
        sel = np.isin(labels, cls) if ok else np.zeros(len(m.faces), bool)
        a = float(area[sel].sum())
        prec = float(area[sel & hold].sum() / a) if a else 0.0
        rec = float(area[sel & hold].sum() / area[hold].sum()) if area[hold].sum() else 0.0
        expect = spec["prompts"][p]
        claimed = a > 0.02 * area.sum()
        verdict = {"present": "hit" if prec >= 0.5 and rec >= 1 / 3 else "miss",
                   "absent": "false claim" if claimed else "correctly empty",
                   "unclear": "not scored"}[expect]
        res["prompts"][p] = {"expected": expect, "area_share": round(a / area.sum(), 3), "precision": round(prec, 2),
                             "recall": round(rec, 2), "verdict": verdict}
        ax[k + 1].scatter(c[:, 0], c[:, 1], s=1, c=np.where(sel, "tab:red", "lightgrey"))
        ax[k + 1].set_title(f'"{p}" ({expect}): {verdict}\nprec {prec:.2f} rec {rec:.2f}')
    for a_ in ax:
        a_.set_aspect("equal")
    plt.tight_layout()
    plt.savefig(OUT / f"{name}.png", dpi=55)
    plt.close(fig)
    run[name] = res

present = [(n, p) for n, r in run.items() for p, v in r["prompts"].items() if v["expected"] == "present"]
absent = [(n, p) for n, r in run.items() for p, v in r["prompts"].items() if v["expected"] == "absent"]
summary = {
    "present_hits": sum(run[n]["prompts"][p]["verdict"] == "hit" for n, p in present), "present_total": len(present),
    "absent_false_claims": sum(run[n]["prompts"][p]["verdict"] == "false claim" for n, p in absent), "absent_total": len(absent),
}
(OUT / "scores.json").write_text(json.dumps({"summary": summary, "objects": run}, indent=2) + "\n")
print(json.dumps(summary))
for n, r in run.items():
    print(n, {p: (v["verdict"], v["precision"], v["recall"]) for p, v in r["prompts"].items()}, "faces_match", r["faces_match"])
