"""Rebuild the eight Muse characters at the shipped size (3,000 faces, 256 px texture) from the raw lifted meshes, through the real packager.
usage (from pipelines/): PYTHONPATH=. uv run --no-project --with numpy --with scipy --with pillow --with fast_simplification --with xatlas python ../data/eval/cc-chars-eight/scripts/rebuild.py MESHES_DIR OUT_DIR"""
import json, os, sys, time
import numpy as np
from ccpipe import objbake
from charmaker import limits, package
from charmaker import rig as rt
from charmaker.contracts import Baked

MESHES, OUT = sys.argv[1:3]
os.makedirs(OUT, exist_ok=True)
t = rt.Template()
runs = []
for f in sorted(os.listdir(MESHES)):
    if not f.endswith(".npz"):
        continue
    cid = f[:-4]
    raw = np.load(f"{MESHES}/{f}")
    v, faces, uv, tex, info = objbake.bake_textured(raw["vertices"], raw["faces"], raw["splat_xyz"], raw["splat_dc"], raw["splat_opacity"], "character", 1.75, max_faces=3000, k=4, texture_size=1024)
    np.savez_compressed(f"{OUT}/{cid}.raw-fit.npz", v=v, f=faces, uv=uv, tex=tex)
    baked = Baked(v=v, f=faces, uv=uv, tex=tex, info=info)
    rigged, _ = package.rig_baked(baked, t, quality=80)
    problems = limits.glb_problems(rigged.glb, t.names)
    open(f"{OUT}/{cid}.glb", "wb").write(rigged.glb)
    runs.append({"id": cid, "faces": rigged.faces, "verts": rigged.verts, "glb_bytes": len(rigged.glb), "cap_problems": problems, "yaw_deg": info["yaw_deg"], "height_m": info["height_m"]})
    print(runs[-1], flush=True)
json.dump(runs, open(f"{OUT}/rebuild.json", "w"), indent=2)
