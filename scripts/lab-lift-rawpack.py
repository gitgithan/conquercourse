"""Pack the REAL raw lifts (the output of the lift model, before any bake) into small files for Cut-out, lift and bake.

Input: raw.npz files kept outside the repo (../conquercourse-assets/eval-full/demo-lifts and bar-photos).
Output: public/assets/lab/lift/raw/<name>.bin and index.json.
Each .bin is: u32 vertex count, u32 face count, float32 xyz per vertex, uint8 rgb per vertex, uint16 indices.
The mesh is decimated (quadric) to about 6,000 faces for the page; the real face count and the real raw size, tilt and turn are kept in index.json.
Run: PYTHONPATH=<dir with fast_simplification> python3 scripts/lab-lift-rawpack.py <assets-root>   (assets-root = ../conquercourse-assets/eval-full)
"""
import json, struct, sys
from pathlib import Path
import numpy as np
import fast_simplification

root = Path(sys.argv[1]); out = Path("public/assets/lab/lift/raw"); out.mkdir(parents=True, exist_ok=True)
PICKS = [  # (folder, name, photo credit, licence, where the photo row is)
    ("demo-lifts/lifts/p1_bench_left", "p1-bench-left", "Jonn Leffmann, Dansbana, Ystad", "CC BY 3.0"),
    ("demo-lifts/lifts/p1_bench_right", "p1-bench-right", "Jonn Leffmann, Dansbana, Ystad", "CC BY 3.0"),
    ("demo-lifts/lifts/p1_pole", "p1-pole", "Jonn Leffmann, Dansbana, Ystad", "CC BY 3.0"),
    ("demo-lifts/lifts/p2_monkey_bars", "p2-monkey-bars", "Koefbac, Rataje workout park", "CC BY-SA 4.0"),
    ("bar-photos/lifts/photo3_bars", "bars-photo3", "Salada220422, Saienji Mamedecca Park", "CC0"),
    ("bar-photos/lifts/photo4_bars", "bars-photo4", "Ntsctalk, Hiroomote ES", "CC BY-SA 4.0"),
    ("bar-photos/lifts/photo6_bars", "bars-photo6", "Michael Rivera, Balfour Park", "CC BY-SA 4.0"),
    ("bar-photos/lifts/photo7_bars", "bars-photo7", "Ajisaka, Miyakohara park", "CC BY-SA 4.0"),
]
TARGET = 6000
index = []
for folder, name, credit, lic in PICKS:
    d = root / folder; z = np.load(d / "raw.npz"); mj = json.load(open(d / "mesh.json")); lj = json.load(open(d / "lift.json"))
    v, f, col = z["vertices"].astype(np.float32), z["faces"].astype(np.int32), np.clip(z["vertex_attrs"], 0, 1)
    red = 1 - TARGET / len(f)
    v2, f2 = fast_simplification.simplify(v, f, target_reduction=red)
    # colour of each kept vertex: the nearest original vertex (chunked brute force)
    c2 = np.empty((len(v2), 3), np.uint8)
    for a in range(0, len(v2), 500):
        dd = ((v2[a:a + 500, None, :] - v[None, :, :]) ** 2).sum(-1); c2[a:a + 500] = (col[dd.argmin(1)] * 255).astype(np.uint8)
    assert len(v2) < 65536
    blob = struct.pack("<II", len(v2), len(f2)) + v2.astype("<f4").tobytes() + c2.tobytes() + f2.astype("<u2").tobytes()
    (out / f"{name}.bin").write_bytes(blob)
    index.append({
        "name": name, "label": mj["label"], "file": f"{name}.bin", "kib": round(len(blob) / 1024), "photo_credit": credit, "licence": lic,
        "typed_height_m": mj["target_height_m"], "scale_source": mj["scale_source"], "raw_height": mj["raw_height"], "raw_faces": mj["raw_faces"], "drawn_faces": int(len(f2)),
        "tilt_deg": mj["tilt_deg"], "yaw_deg_recorded": mj["yaw_deg"], "baked_extents_m": mj["extents_m"], "bake_factor": mj["scale_factor"],
        "mask_how": lj["mask"]["how"], "lift_seconds": lj["lift_seconds"], "usd_estimate": lj["usd_estimate"],
    })
    print(name, len(f), "->", len(f2), len(blob) // 1024, "KiB")
(out / "index.json").write_text(json.dumps({"note": "real raw lifts, decimated for the page", "target_faces": TARGET, "objects": index}, indent=2) + "\n")
