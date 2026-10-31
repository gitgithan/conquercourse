"""Step 4 (route A): the SAM 3D Objects mesh + its splat colours -> a 6,000-face textured mesh -> rigged on the 34-bone skeleton -> a skinned GLB.
usage: PYTHONPATH=pipelines uv run --no-project --with numpy --with scipy --with pillow --with fast_simplification --with xatlas python 04_bake_rig.py MESHES_DIR OUT_DIR [ids...]"""
import io, json, os, sys, time
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigtool as rt
from ccpipe import objbake

MESHES, OUT = sys.argv[1:3]
only = sys.argv[3:]
FACES = int(os.environ.get("CC_FACES", "6000"))
TEX = int(os.environ.get("CC_TEX", "512"))
YAW = float(os.environ.get("CC_YAW", "0"))  # degrees about y, to turn the lifted figure to face +z (the template's front)
os.makedirs(OUT, exist_ok=True)
t = rt.Template()
runs = []
for f in sorted(os.listdir(MESHES)):
    if not f.endswith(".npz"):
        continue
    cid = f[:-4]
    if only and cid not in only:
        continue
    t0 = time.time()
    raw = np.load(f"{MESHES}/{f}")
    v, faces, uv, tex, info = objbake.bake_textured(raw["vertices"], raw["faces"], raw["splat_xyz"], raw["splat_dc"], raw["splat_opacity"], "character", 1.75, max_faces=FACES, k=4, texture_size=1024)
    a = np.deg2rad(YAW); R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    v = v @ R.T
    np.savez_compressed(f"{OUT}/{cid}.baked.npz", v=v, f=faces, uv=uv, tex=tex)
    V, scale = rt.fit_to_template(t, v)
    joints, weights = rt.nearest_bone_weights(t, V)
    size, tex_bytes = rt.write_skinned_glb(f"{OUT}/{cid}.glb", t, V, faces, uv, tex, joints, weights, tex_size=TEX)
    runs.append({"id": cid, "bake_rig_seconds": round(time.time() - t0, 1), "verts": int(len(V)), "faces": int(len(faces)), "glb_bytes": size, "texture_bytes": tex_bytes, "fit": scale, "bake": {k: info[k] for k in ("height_m", "yaw_deg", "tilt_deg") if k in info}})
    print(runs[-1], flush=True)
json.dump(runs, open(f"{OUT}/rig_runs.json", "w"), indent=2)
