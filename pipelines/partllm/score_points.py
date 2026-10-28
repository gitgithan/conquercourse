"""Score PartLLM point-prompt output (data/eval/partllm/raw/points/<mesh>/<i>/) against the answer key (CC-49).

Usage: python3 -I pipelines/partllm/score_points.py   (needs numpy, trimesh)
Per probe the part is the face mask PartLLM returns for one click.
- Hold probe: a hit when at least half of the part's area is inside the hold region (the editor would say "yes, a hand can hold here").
- Not-hold probe: a false hold when at least half of the part's area is inside the hold region (the editor would wrongly say yes).
- Also written: recall (how much of the hold region the part covers) and whether the clicked face is inside the part.
"""
import importlib.util
import json
import pathlib

import numpy as np

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("helpers", HERE / "helpers.py")
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)

OUT = pathlib.Path("data/eval/partllm")
key = json.loads((OUT / "answer-key.json").read_text())["objects"]
probes = json.loads((OUT / "probes.json").read_text())
rows, per_obj = [], {}
for name, ps in probes.items():
    m = h.load(name)
    area = m.area_faces
    hold = h.hold_mask(m, key[name]["hold"])
    for i, pr in enumerate(ps):
        f = OUT / "raw" / "points" / name / str(i) / name
        masks = sorted(f.glob("click_*/binary_mask.npy"))
        if not masks:
            rows.append({"mesh": name, "i": i, "kind": pr["kind"], "verdict": "no output"})
            continue
        sel = np.load(masks[-1]).astype(bool)
        if len(sel) != len(m.faces):
            rows.append({"mesh": name, "i": i, "kind": pr["kind"], "verdict": "face count mismatch"})
            continue
        a = float(area[sel].sum())
        prec = float(area[sel & hold].sum() / a) if a else 0.0
        rec = float(area[sel & hold].sum() / area[hold].sum()) if area[hold].sum() else 0.0
        says_hold = prec >= 0.5
        verdict = ("hit" if says_hold else "miss") if pr["kind"] == "hold" else ("false hold" if says_hold else "correct no")
        rows.append({"mesh": name, "i": i, "kind": pr["kind"], "q": pr["q"], "area_share": round(a / area.sum(), 3),
                     "precision": round(prec, 2), "recall": round(rec, 2), "clicked_face_in_part": bool(sel[pr["face"]]),
                     "verdict": verdict})
scored = [r for r in rows if r["verdict"] in ("hit", "miss", "false hold", "correct no")]
holds = [r for r in scored if r["kind"] == "hold"]
nots = [r for r in scored if r["kind"] == "not-hold"]
summary = {
    "hold_probes": len(holds), "hold_hits": sum(r["verdict"] == "hit" for r in holds),
    "not_hold_probes": len(nots), "false_holds": sum(r["verdict"] == "false hold" for r in nots),
    "unscored": len(rows) - len(scored),
}
by_mesh = {}
for r in scored:
    d = by_mesh.setdefault(r["mesh"], {"hold_hits": 0, "holds": 0, "false_holds": 0, "not_holds": 0})
    if r["kind"] == "hold":
        d["holds"] += 1; d["hold_hits"] += r["verdict"] == "hit"
    else:
        d["not_holds"] += 1; d["false_holds"] += r["verdict"] == "false hold"
(OUT / "scores-points.json").write_text(json.dumps({"summary": summary, "by_mesh": by_mesh, "probes": rows}, indent=2) + "\n")
print(json.dumps(summary))
for k, v in by_mesh.items():
    print(k, v)
