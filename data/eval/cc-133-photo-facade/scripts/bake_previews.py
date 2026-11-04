"""Step 5 (CPU): raw lift -> textured GLB (the same bake the site uses: ccpipe.objbake.bake_textured, then ccpipe.glb), contact sheet, and a 6-angle turntable strip.
usage: uv run --no-project --with numpy --with scipy --with pillow --with matplotlib --with xatlas --with fast-simplification python -I bake_previews.py [--only a,b]   (run from the repo root)"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, "pipelines")
from ccpipe import glb, objbake, objsheet
D = "data/eval/cc-133-photo-facade"
prep = {r["photo"]: r for r in json.load(open(f"{D}/prep/prep.json"))}
only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else []
def yaw(v, a):
    c, s = np.cos(a), np.sin(a)
    return v @ np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]]).T
for o in json.load(open(f"{D}/objects.json")):
    if only and o["name"] not in only: continue
    d = f"{D}/lifts/{o['name']}"
    if not os.path.exists(f"{d}/raw.npz"): continue
    raw = np.load(f"{d}/raw.npz")
    v, f, uv, tex, info = objbake.bake_textured(raw["vertices"], raw["faces"], raw["splat_xyz"], raw["splat_dc"], raw["splat_opacity"], o["label"], o.get("height_m"), k=4, texture_size=1024)
    nbytes = glb.write_glb(f"{d}/mesh.glb", v, f, None, name=o["name"], uv=uv, texture=tex)
    info.update(bytes=nbytes, raw_faces=int(len(raw["faces"])), model="SAM 3D Objects (seed 42)")
    ext = (v.max(0) - v.min(0)).round(3).tolist()
    info["extent_xyz_m"] = ext
    json.dump(info, open(f"{d}/mesh.json", "w"), indent=2)
    s = prep[o["photo"]]["scale"]
    box = [round(x * s) for x in o["box_original"]]
    objsheet.sheet(f"{D}/prep/{o['photo']}.jpg", box, f"{d}/mask.png", v, f, None, f"{d}/sheet.png", title=f"{o['name']}: {o['label']}, {info['height_m']} m", uv=uv, tex=tex)
    tiles = [objsheet.render_view(yaw(v, a), f, None, (0, 1), 2, True, px=300, uv=uv, tex=tex)[0] for a in np.linspace(0, 2 * np.pi, 6, endpoint=False)]
    h = max(t.shape[0] for t in tiles)
    tiles = [np.pad(t, ((0, h - t.shape[0]), (0, 0), (0, 0)), constant_values=255) for t in tiles]
    Image.fromarray(np.concatenate(tiles, 1)).save(f"{d}/turntable.png")
    print(o["name"], info["faces"], "faces", nbytes, "bytes", ext)
