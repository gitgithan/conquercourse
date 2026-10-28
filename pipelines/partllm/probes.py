"""Pick probe points for the point-prompt test (CC-49) from the hand-labelled answer key.

Usage: python3 -I pipelines/partllm/probes.py   (needs numpy, trimesh)
Hold probes: top-facing triangle centres inside the hold region, at 20%, 50% and 80% along the long side.
Non-hold probes: triangle centres outside the hold region on the lowest 40% of the object, at the same three positions.
Each probe is a point on the surface in the GLB's own coordinates (metres, y up), the frame the answer key uses.
"""
import json
import pathlib
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import importlib.util

OUT = pathlib.Path("data/eval/partllm")
spec = importlib.util.spec_from_file_location("score_helpers", pathlib.Path(__file__).parent / "helpers.py")
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)

key = json.loads((OUT / "answer-key.json").read_text())["objects"]
probes = {}
for name, k in key.items():
    m = h.load(name)
    c, n = m.triangles_center, m.face_normals
    hold = h.hold_mask(m, k["hold"])
    long_axis = int(np.argmax(m.extents[[0, 2]]) * 2)  # x (0) or z (2)
    t = (c[:, long_axis] - c[:, long_axis].min()) / max(1e-9, np.ptp(c[:, long_axis]))
    lo, hi = c[:, 1].min(), c[:, 1].max()
    low = c[:, 1] <= lo + 0.4 * (hi - lo)
    pts = []
    for kind, pool in (("hold", hold & (n[:, 1] > 0.5)), ("not-hold", ~hold & low)):
        if not pool.any():
            pool = hold if kind == "hold" else ~hold
        for q in (0.2, 0.5, 0.8):
            idx = np.where(pool)[0]
            best = idx[np.argmin(np.abs(t[idx] - q))]
            pts.append({"kind": kind, "q": q, "face": int(best), "point": [round(float(v), 4) for v in c[best]]})
    probes[name] = pts
(OUT / "probes.json").write_text(json.dumps(probes, indent=2) + "\n")
print({k: len(v) for k, v in probes.items()})
