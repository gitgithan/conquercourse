"""Ship chosen objects of a round into the game's folder: public/assets/objects/<name>.glb and index.json (photo + box -> GLB).

usage: python pipelines/ship_objects.py --exp data/eval/cc-38-photo-to-3d --round r2 --pick bench01=bench-concrete park03=box-ledge ...
Each pick is <photo>=<object name>; every GLB must be at most 1.5 MB and 6,000 faces, or nothing is written."""
import argparse
import json
import os
import shutil

MAX_BYTES, MAX_FACES = 1_500_000, 6000


def ship(exp, rnd, picks, out_dir, notes=None):
    photos = {p["photo"]: p for p in json.load(open(f"{exp}/photos.json"))}
    entries = []
    for photo, name in picks:
        d = f"{exp}/{rnd}/{photo}"
        info = json.load(open(f"{d}/mesh.json"))
        if info["bytes"] > MAX_BYTES or info["faces"] > MAX_FACES:
            raise SystemExit(f"{photo}: {info['bytes']} bytes, {info['faces']} faces is over the limit")
        p = photos[photo]
        entries.append({
            "name": name, "photo": photo, "box": p["box"], "label": p["label"], "glb": f"{name}.glb",
            "height_m": info["height_m"], "extents_m": info["extents_m"], "scale_source": info["scale_source"],
            "faces": info["faces"], "bytes": info["bytes"], "author": p["author"], "licence": p["licence"],
            "look": (notes or {}).get(photo, ""),
        })
        os.makedirs(out_dir, exist_ok=True)
        shutil.copy(f"{d}/mesh.glb", f"{out_dir}/{name}.glb")
    json.dump({"schemaVersion": "0.1.0", "note": "a skin only: collision always comes from a primitive", "objects": entries},
              open(f"{out_dir}/index.json", "w"), indent=2)
    open(f"{out_dir}/index.json", "a").write("\n")
    return entries


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--exp", default="data/eval/cc-38-photo-to-3d")
    ap.add_argument("--round", required=True)
    ap.add_argument("--out", default="public/assets/objects")
    ap.add_argument("--pick", nargs="+", required=True)
    a = ap.parse_args()
    for e in ship(a.exp, a.round, [x.split("=") for x in a.pick], a.out):
        print(e["name"], e["bytes"], e["faces"])
