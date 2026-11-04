"""CC-133: turn the real lift outputs (raw.npz per photo) into the Lab 14 data set.

Reads  data/eval/cc-133-real-lifts/{a,b}/<photo>/ (raw.npz, mask.png, entry.json, mesh.json) made by pipelines/photo_to_object.py.
Writes public/assets/lab/lift/real/<name>.glb (raw lift, z up, lift units, about 300 KB or less), <name>-mask.png, <name>.json and index.json.
Big raw outputs are copied to ../conquercourse-assets/eval-full/cc-133-real-lifts/ by the caller.
"""
import json, os, sys, shutil
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, os.path.join(ROOT, "pipelines"))
from ccpipe import objbake, glb  # noqa: E402

EXP = os.path.join(ROOT, "data/eval/cc-133-real-lifts")
OUT = os.path.join(ROOT, "public/assets/lab/lift/real")
L40S, L4 = 1.95 / 3600, 0.80 / 3600
MAX_BYTES = 300_000


def main():
    os.makedirs(OUT, exist_ok=True)
    idx = json.load(open(os.path.join(ROOT, "public/assets/objects/index.json")))["objects"]
    prov = {o["id"]: o for o in json.load(open(os.path.join(ROOT, "public/assets/objects/provenance.json")))["objects"]}
    photos = {p["photo"]: p for p in json.load(open(os.path.join(EXP, "photos.json")))}
    entries = []
    for o in idx:
        name, photo = o["name"], o["photo"]
        rnd = "b" if photo in ("bench01", "rail01", "gabion-wall") else "a"
        d = os.path.join(EXP, rnd, photo)
        raw = np.load(os.path.join(d, "raw.npz"))
        ent = json.load(open(os.path.join(d, "entry.json")))
        v, f = raw["vertices"], raw["faces"]
        # the bake's own measurements (yaw, tilt) from this real raw lift, on the CPU
        _, _, _, _, info = objbake.bake_textured(v, f, raw["splat_xyz"], raw["splat_dc"], raw["splat_opacity"], o["label"], o.get("height_m") if prov[name]["height_source"] == "typed" else None, k=4, texture_size=256)
        mn, mx = v.min(0), v.max(0)
        size = mx - mn
        rgb = objbake.splat_rgb(raw["splat_dc"])
        faces = 8000
        while True:  # keep the file at or under the size line
            dv, df = objbake.decimate(v, f, faces)
            col = objbake.vertex_colours(dv, raw["splat_xyz"], rgb, raw["splat_opacity"], k=4)
            path = os.path.join(OUT, name + ".glb")
            glb.write_glb(path, dv, df, col, name=name)
            if os.path.getsize(path) <= MAX_BYTES or faces < 1500:
                break
            faces = int(faces * 0.8)
        Image.open(os.path.join(d, "mask.png")).convert("L").save(os.path.join(OUT, name + "-mask.png"), optimize=True)
        cost = ent["lift_seconds"] * L40S + ent["mask_seconds"] * L4
        stats = {
            "rawHeight": round(float(size[2]), 4),  # lift units, z is up in the raw lift
            "rawExtents": [round(float(s), 4) for s in size],
            "rawFaces": int(len(f)), "previewFaces": int(len(df)), "previewBytes": os.path.getsize(path),
            "yawDeg": info["yaw_deg"], "tiltDeg": info["tilt_deg"],
            "splatPoints": int(len(raw["splat_xyz"])),
            "liftSeconds": ent["lift_seconds"], "maskSeconds": ent["mask_seconds"],
            "costUsd": round(cost, 5), "costBasis": "container seconds only (L40S 1.95/h, L4 0.80/h); model loads and idle time not included",
            "padded": rnd == "b",
        }
        entry = {
            "name": name, "photoMade": True, "photo": photo, "label": o["label"], "typedHeightM": o.get("height_m"),
            "credit": prov[name]["credit"]["line"], "licence": prov[name]["credit"]["licence"],
            "rawMesh": f"assets/lab/lift/real/{name}.glb", "maskPicture": f"assets/lab/lift/real/{name}-mask.png",
            "bakedGlb": f"assets/objects/{o['glb']}", "stats": stats,
            "note": "Real raw lift (SAM 3D Objects, seed 42), z up, in the lift's own units, thinned to a preview. Re-lifted 2026-11-04 with the same photo, box and settings as the shipped object.",
        }
        json.dump(entry, open(os.path.join(OUT, name + ".json"), "w"), indent=2)
        entries.append(entry)
        print(name, stats["rawHeight"], stats["rawFaces"], "->", stats["previewFaces"], stats["previewBytes"])
    json.dump({"schemaVersion": 1, "note": "Real raw lifts for Lab 14. Every one of the 19 library objects was made from a photo through the lift; none is a plain download.",
               "objects": entries}, open(os.path.join(OUT, "index.json"), "w"), indent=2)


if __name__ == "__main__":
    main()
